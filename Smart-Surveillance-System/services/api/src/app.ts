import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import cors from "cors";
import express, { type ErrorRequestHandler, type Express, type RequestHandler } from "express";
import type { Logger } from "pino";
import { z, ZodError } from "zod";
import { LIVE_CHANNEL, alertQuerySchema, simulateRequestSchema, type LiveEvent } from "@intellisafe/contracts";
import { createContext, generateFromRequest, type MockContext } from "@intellisafe/simulator/generator";
import type { Db } from "./db";
import type { EventPublisher } from "./mqtt-publisher";
import { acknowledgeAlert, getAlert, listAlerts, listDevices, metricsSummary, metricsTrend } from "./repo";

/** The slice of ioredis the HTTP layer uses. */
export interface AppRedis {
  ping(): Promise<string>;
  publish(channel: string, message: string): Promise<number>;
}

export interface AppDeps {
  db: Db;
  redis: AppRedis;
  publisher: EventPublisher;
  log: Logger;
  evidenceDir: string;
  corsOrigin?: string;
  enableSimulate?: boolean;
  /** When set, POST /api/evidence requires this value in the `x-api-key` header. */
  evidenceUploadToken?: string;
  now?: () => Date;
  /** Test hook: the mock generator context used by POST /api/simulate. */
  mockContext?: MockContext;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

/** Evidence uploads are only accepted when the bytes really are a PNG or JPEG. */
function imageKind(buf: Buffer): "png" | "jpg" | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  return null;
}

function tokenMatches(given: string | undefined, expected: string): boolean {
  const a = Buffer.from(given ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const idParam = z.object({ id: z.uuid() });
const metricsQuery = z.object({
  hours: z.coerce.number().int().min(1).max(168).default(24),
  bucket: z.enum(["minute", "hour"]).optional(),
});

export function createApp(deps: AppDeps): Express {
  const { db, redis, publisher, log } = deps;
  const now = deps.now ?? (() => new Date());
  const mock = deps.mockContext ?? createContext({ device_id: "dashboard-sim" });

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));
  const origins = (deps.corsOrigin ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (origins.length) app.use(cors({ origin: origins }));

  /* ---------------------------- health ---------------------------- */
  app.get("/api/health", async (_req, res) => {
    const checks = { db: "ok", redis: "ok", mqtt: publisher.isConnected() ? "connected" : "disconnected" };
    try {
      await db.execute("select 1");
    } catch {
      checks.db = "error";
    }
    try {
      await redis.ping();
    } catch {
      checks.redis = "error";
    }
    const healthy = checks.db === "ok" && checks.redis === "ok";
    const status = !healthy ? "unavailable" : checks.mqtt === "connected" ? "ok" : "degraded";
    res.status(healthy ? 200 : 503).json({ status, service: "api", time: now().toISOString(), checks });
  });

  /* ---------------------------- alerts ---------------------------- */
  app.get("/api/alerts", async (req, res) => {
    const q = alertQuerySchema.parse(req.query);
    res.json(await listAlerts(db, q));
  });

  app.get("/api/alerts/:id", async (req, res) => {
    const { id } = idParam.parse(req.params);
    const alert = await getAlert(db, id);
    if (!alert) throw new HttpError(404, "not_found", "alert not found");
    res.json(alert);
  });

  app.post("/api/alerts/:id/ack", async (req, res) => {
    const { id } = idParam.parse(req.params);
    const result = await acknowledgeAlert(db, id, now());
    if (!result) throw new HttpError(404, "not_found", "alert not found");
    if (result.changed) {
      const event: LiveEvent = {
        kind: "ack",
        data: { id, acknowledged_at: result.alert.acknowledged_at ?? now().toISOString() },
      };
      await redis.publish(LIVE_CHANNEL, JSON.stringify(event)).catch((err: Error) => {
        log.warn({ err: err.message }, "ack broadcast failed");
      });
    }
    res.json(result.alert);
  });

  /* ---------------------------- metrics --------------------------- */
  app.get("/api/metrics/summary", async (req, res) => {
    const { hours } = metricsQuery.parse(req.query);
    res.json(await metricsSummary(db, hours, now()));
  });

  app.get("/api/metrics/trend", async (req, res) => {
    const q = metricsQuery.parse(req.query);
    const bucket = q.bucket ?? (q.hours <= 3 ? "minute" : "hour");
    res.json(await metricsTrend(db, q.hours, bucket, now()));
  });

  app.get("/api/devices", async (_req, res) => {
    res.json(await listDevices(db));
  });

  /* ---------------------------- simulate -------------------------- */
  app.post("/api/simulate", async (req, res) => {
    if (deps.enableSimulate === false) throw new HttpError(404, "disabled", "simulate endpoint is disabled");
    const body = simulateRequestSchema.parse(req.body ?? {});
    if (!publisher.isConnected()) throw new HttpError(503, "mqtt_unavailable", "MQTT broker is not connected");
    const messages = generateFromRequest(mock, body);
    const published = [];
    for (const msg of messages) {
      const info = await publisher.publish(msg);
      published.push({ event_id: msg.event_id, type: msg.type, topic: info.topic });
    }
    log.info({ count: published.length, type: body.type }, "mock events published");
    res.status(202).json({ published });
  });

  /* ---------------------------- evidence -------------------------- */
  // The edge device uploads the frame it saved for an alert, then sends image_path in the MQTT message.
  app.post(
    "/api/evidence",
    express.raw({ type: ["image/jpeg", "image/png"], limit: MAX_EVIDENCE_BYTES }),
    async (req, res) => {
      if (deps.evidenceUploadToken && !tokenMatches(req.header("x-api-key"), deps.evidenceUploadToken)) {
        throw new HttpError(401, "unauthorized", "missing or wrong x-api-key");
      }
      if (!Buffer.isBuffer(req.body)) throw new HttpError(415, "unsupported_media_type", "send image/png or image/jpeg");
      const kind = imageKind(req.body);
      if (!kind) throw new HttpError(400, "bad_image", "body is not a valid PNG or JPEG");
      const name = `${randomUUID()}.${kind}`;
      await mkdir(join(deps.evidenceDir, "uploads"), { recursive: true });
      await writeFile(join(deps.evidenceDir, "uploads", name), req.body);
      res.status(201).json({ image_path: `uploads/${name}` });
    },
  );
  app.use("/api/evidence", express.static(deps.evidenceDir, { fallthrough: true, index: false, dotfiles: "ignore", maxAge: "1h" }));

  /* ---------------------------- fallbacks ------------------------- */
  const notFound: RequestHandler = (_req, res) => {
    res.status(404).json({ error: "not_found", message: "route not found" });
  };
  app.use(notFound);

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: "validation_error",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
    const status = typeof err?.status === "number" ? err.status : 500;
    if (status >= 500) log.error({ err: err?.message }, "unhandled error");
    res.status(status).json({
      error: status === 400 ? "bad_request" : "internal_error",
      message: status >= 500 ? "internal server error" : String(err?.message ?? "bad request"),
    });
  };
  app.use(onError);

  return app;
}
