import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  LIVE_CHANNEL,
  safetyMessageSchema,
  type AlertDTO,
  type AlertListDTO,
  type AlertMessage,
  type LiveEvent,
  type MetricsSummaryDTO,
  type SafetyMessage,
} from "@intellisafe/contracts";
import { createContext, generateAlert, generateHeartbeat, generateMetrics } from "@intellisafe/simulator/generator";
import { createApp } from "../src/app";
import type { Db } from "../src/db";
import type { EventPublisher } from "../src/mqtt-publisher";
import { insertAlert, insertMetrics, upsertDevice } from "../src/repo";
import { FakeRedis, FakeRedisServer } from "./fake-redis";
import { createTestDb, silentLog, truncateData } from "./helpers";

const NOW = new Date("2026-10-28T12:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

let db: Db;
let closeDb: () => Promise<void>;
let redis: FakeRedis;
let server: FakeRedisServer;
let published: SafetyMessage[];
let connected = true;
let evidenceDir: string;
let app: ReturnType<typeof createApp>;
let tick = 0;

const publisher: EventPublisher = {
  publish: async (msg) => {
    published.push(msg);
    return { topic: `test/${msg.type}`, retain: false };
  },
  isConnected: () => connected,
  close: async () => undefined,
};

/** Seed helper: alert with controlled fields, stored directly in the DB. */
async function seedAlert(over: Partial<AlertMessage> & { minutesAgo?: number } = {}): Promise<AlertDTO> {
  tick += 1;
  const ctx = createContext({
    uuid: () => `00000000-0000-4000-8000-${String(tick).padStart(12, "0")}`,
    now: () => minutesAgo(over.minutesAgo ?? 1),
  });
  const base = generateAlert(ctx, { event: over.event ?? "helmet_missing" });
  const row = await insertAlert(db, { ...base, ...over });
  const { id } = row as { id: string };
  const res = await request(app).get(`/api/alerts/${id}`);
  return res.body as AlertDTO;
}

beforeAll(async () => {
  ({ db, close: closeDb } = await createTestDb());
  evidenceDir = mkdtempSync(join(tmpdir(), "evidence-"));
  mkdirSync(join(evidenceDir, "samples"));
  writeFileSync(join(evidenceDir, "samples", "sample_fire.png"), "PNGDATA");
  writeFileSync(join(tmpdir(), "secret.txt"), "top secret");
});

afterAll(async () => {
  await closeDb();
});

beforeEach(async () => {
  await truncateData(db);
  server = new FakeRedisServer();
  redis = new FakeRedis(server);
  published = [];
  connected = true;
  app = createApp({ db, redis, publisher, log: silentLog, evidenceDir, now: () => NOW });
});

describe("GET /api/health", () => {
  it("is ok when everything is up", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", service: "api", checks: { db: "ok", redis: "ok", mqtt: "connected" } });
  });

  it("is degraded (still 200) when only MQTT is down", async () => {
    connected = false;
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("degraded");
  });

  it("is 503 when redis is down", async () => {
    const broken = createApp({
      db,
      redis: { ping: async () => Promise.reject(new Error("down")), publish: async () => 0 },
      publisher,
      log: silentLog,
      evidenceDir,
    });
    const res = await request(broken).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body.checks.redis).toBe("error");
  });
});

describe("GET /api/alerts", () => {
  it("lists newest first with total, limit and offset", async () => {
    await seedAlert({ minutesAgo: 30 });
    const newest = await seedAlert({ minutesAgo: 1 });
    await seedAlert({ minutesAgo: 10 });

    const res = await request(app).get("/api/alerts?limit=2");
    expect(res.status).toBe(200);
    const body = res.body as AlertListDTO;
    expect(body.total).toBe(3);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]?.id).toBe(newest.id);
    expect(body).toMatchObject({ limit: 2, offset: 0 });

    const page2 = (await request(app).get("/api/alerts?limit=2&offset=2")).body as AlertListDTO;
    expect(page2.items).toHaveLength(1);
    expect(page2.total).toBe(3);
  });

  it("filters by priority, event, source, acknowledged and time", async () => {
    await seedAlert({ event: "fire", priority: "CRITICAL", worker_id: null, minutesAgo: 5 });
    await seedAlert({ event: "helmet_missing", priority: "HIGH", minutesAgo: 20 });
    const acked = await seedAlert({ event: "vest_missing", priority: "HIGH", minutesAgo: 40 });
    await request(app).post(`/api/alerts/${acked.id}/ack`);

    const count = async (q: string) => ((await request(app).get(`/api/alerts?${q}`)).body as AlertListDTO).total;
    expect(await count("priority=HIGH")).toBe(2);
    expect(await count("priority=CRITICAL")).toBe(1);
    expect(await count("event=vest_missing")).toBe(1);
    expect(await count("source=simulator")).toBe(3);
    expect(await count("source=edge")).toBe(0);
    expect(await count("acknowledged=true")).toBe(1);
    expect(await count("acknowledged=false")).toBe(2);
    expect(await count(`from=${minutesAgo(25).toISOString()}`)).toBe(2);
    expect(await count(`to=${minutesAgo(25).toISOString()}`)).toBe(1);
    expect(await count("event=fire&priority=HIGH")).toBe(0);
  });

  it("rejects invalid query values with 400", async () => {
    for (const q of ["event=spill", "limit=0", "limit=1000", "offset=-1", "from=yesterday", "acknowledged=maybe"]) {
      const res = await request(app).get(`/api/alerts?${q}`);
      expect(res.status, q).toBe(400);
      expect(res.body.error).toBe("validation_error");
    }
  });
});

describe("GET /api/alerts/:id and POST /api/alerts/:id/ack", () => {
  it("returns an alert in the DTO shape", async () => {
    const a = await seedAlert({ event: "fire", priority: "CRITICAL", worker_id: null });
    const res = await request(app).get(`/api/alerts/${a.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: a.id,
      event: "fire",
      priority: "CRITICAL",
      worker_id: null,
      acknowledged: false,
      acknowledged_at: null,
      frame: { width: 1280, height: 720 },
      image_path: "samples/sample_fire.png",
    });
    expect(Array.isArray(res.body.detections)).toBe(true);
  });

  it("404s for unknown ids and 400s for malformed ids", async () => {
    expect((await request(app).get("/api/alerts/00000000-0000-4000-8000-0000000000ff")).status).toBe(404);
    expect((await request(app).get("/api/alerts/not-a-uuid")).status).toBe(400);
    expect((await request(app).post("/api/alerts/00000000-0000-4000-8000-0000000000ff/ack")).status).toBe(404);
  });

  it("acknowledges once, is idempotent, and broadcasts a single ack event", async () => {
    const a = await seedAlert();
    const live: LiveEvent[] = [];
    const sub = new FakeRedis(server);
    await sub.subscribe(LIVE_CHANNEL);
    sub.on("message", (_c, m) => live.push(JSON.parse(m)));

    const first = await request(app).post(`/api/alerts/${a.id}/ack`);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ id: a.id, acknowledged: true, acknowledged_at: NOW.toISOString() });

    const second = await request(app).post(`/api/alerts/${a.id}/ack`);
    expect(second.status).toBe(200);
    expect(second.body.acknowledged_at).toBe(NOW.toISOString());

    await new Promise((r) => setTimeout(r, 30));
    expect(live).toEqual([{ kind: "ack", data: { id: a.id, acknowledged_at: NOW.toISOString() } }]);
  });
});

describe("metrics endpoints", () => {
  it("summary on an empty database", async () => {
    const res = await request(app).get("/api/metrics/summary");
    expect(res.status).toBe(200);
    const s = res.body as MetricsSummaryDTO;
    expect(s).toMatchObject({ window_hours: 24, alerts_total: 0, alerts_critical: 0 });
    expect(s.compliance).toEqual({ compliance_score: null, worker_count: null, violation_count: null, last_metrics_at: null });
    expect(s.by_event).toHaveLength(4);
    expect(s.by_priority).toHaveLength(4);
    expect(s.devices).toEqual([]);
  });

  it("summary aggregates alerts, latest metrics and devices", async () => {
    await seedAlert({ event: "fire", priority: "CRITICAL", worker_id: null, minutesAgo: 5 });
    await seedAlert({ event: "smoke", priority: "CRITICAL", worker_id: null, minutesAgo: 6 });
    const hv = await seedAlert({ event: "helmet_missing", priority: "HIGH", minutesAgo: 7 });
    await seedAlert({ event: "vest_missing", priority: "HIGH", minutesAgo: 60 * 30 }); // outside window
    await request(app).post(`/api/alerts/${hv.id}/ack`);

    let n = 0;
    const metricsAt = (score: number, minutes: number) => {
      n += 1;
      const ctx = createContext({ uuid: () => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`, now: () => minutesAgo(minutes) });
      return { ...generateMetrics(ctx), compliance_score: score, worker_count: 10, violation_count: 2 };
    };
    await insertMetrics(db, metricsAt(70, 30)); // older
    await insertMetrics(db, metricsAt(80, 2)); // the latest one wins
    await insertMetrics(db, metricsAt(90, 3));
    await upsertDevice(db, generateHeartbeat(createContext({ device_id: "jetson-01", now: () => minutesAgo(1) })));

    const s = (await request(app).get("/api/metrics/summary?hours=24")).body as MetricsSummaryDTO;
    expect(s.alerts_total).toBe(3);
    expect(s.alerts_critical).toBe(2);
    expect(s.alerts_unacknowledged).toBe(2);
    expect(s.compliance).toMatchObject({ compliance_score: 80, worker_count: 10, violation_count: 2 });
    expect(s.by_event.find((e) => e.event === "fire")?.count).toBe(1);
    expect(s.by_priority.find((p) => p.priority === "CRITICAL")?.count).toBe(2);
    expect(s.devices).toHaveLength(1);
    expect(s.devices[0]).toMatchObject({ device_id: "jetson-01", status: "online" });

    const week = (await request(app).get("/api/metrics/summary?hours=168")).body as MetricsSummaryDTO;
    expect(week.alerts_total).toBe(4);
  });

  it("trend buckets average compliance per minute", async () => {
    let n = 0;
    const add = async (score: number, minutes: number) => {
      n += 1;
      const ctx = createContext({ uuid: () => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`, now: () => minutesAgo(minutes) });
      await insertMetrics(db, { ...generateMetrics(ctx), compliance_score: score });
    };
    await add(60, 5);
    await add(80, 6);
    await add(90, 7);
    await add(100, 120); // outside the 1h window

    const res = await request(app).get("/api/metrics/trend?hours=1&bucket=minute");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ window_hours: 1, bucket: "minute" });
    expect(res.body.points.map((p: { compliance_score: number }) => p.compliance_score)).toEqual([90, 80, 60]);

    const hourly = await request(app).get("/api/metrics/trend?hours=6");
    expect(hourly.body.bucket).toBe("hour");
    expect(hourly.body.points.length).toBeGreaterThanOrEqual(2);
    expect((await request(app).get("/api/metrics/trend?bucket=day")).status).toBe(400);
  });

  it("lists devices", async () => {
    await upsertDevice(db, generateHeartbeat(createContext({ device_id: "b", now: () => minutesAgo(1) })));
    await upsertDevice(db, generateHeartbeat(createContext({ device_id: "a", now: () => minutesAgo(1) })));
    const res = await request(app).get("/api/devices");
    expect(res.body.map((d: { device_id: string }) => d.device_id)).toEqual(["a", "b"]);
  });
});

describe("POST /api/simulate", () => {
  it("publishes a contract-valid alert by default", async () => {
    const res = await request(app).post("/api/simulate").send({});
    expect(res.status).toBe(202);
    expect(res.body.published).toHaveLength(1);
    expect(published).toHaveLength(1);
    expect(safetyMessageSchema.safeParse(published[0]).success).toBe(true);
    expect(published[0]?.source).toBe("simulator");
    expect(res.body.published[0]).toMatchObject({ event_id: published[0]?.event_id, type: "alert", topic: "test/alert" });
  });

  it("honours type, event and count", async () => {
    const res = await request(app).post("/api/simulate").send({ type: "alert", event: "fire", count: 3 });
    expect(res.status).toBe(202);
    expect(published).toHaveLength(3);
    for (const m of published) expect(m).toMatchObject({ type: "alert", event: "fire", priority: "CRITICAL" });
    expect(new Set(published.map((m) => m.event_id)).size).toBe(3);

    published = [];
    await request(app).post("/api/simulate").send({ type: "metrics" });
    expect(published[0]?.type).toBe("metrics");
    published = [];
    await request(app).post("/api/simulate").send({ type: "heartbeat" });
    expect(published[0]?.type).toBe("heartbeat");
  });

  it("validates the body", async () => {
    for (const body of [{ count: 0 }, { count: 21 }, { event: "compliant" }, { event: "spill" }, { zone: "roof" }, { type: "log" }, { extra: 1 }]) {
      const res = await request(app).post("/api/simulate").send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(published).toHaveLength(0);
  });

  it("503s when MQTT is down and 404s when disabled", async () => {
    connected = false;
    expect((await request(app).post("/api/simulate").send({})).status).toBe(503);
    const disabled = createApp({ db, redis, publisher, log: silentLog, evidenceDir, enableSimulate: false });
    connected = true;
    expect((await request(disabled).post("/api/simulate").send({})).status).toBe(404);
  });
});

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("fake-png-body")]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("fake-jpg-body")]);

describe("POST /api/evidence", () => {
  it("stores a PNG and serves it back", async () => {
    const res = await request(app).post("/api/evidence").set("content-type", "image/png").send(PNG);
    expect(res.status).toBe(201);
    expect(res.body.image_path).toMatch(/^uploads\/[0-9a-f-]{36}\.png$/);
    const back = await request(app).get(`/api/evidence/${res.body.image_path}`);
    expect(back.status).toBe(200);
    expect(Buffer.from(back.body).equals(PNG)).toBe(true);
  });

  it("stores a JPEG", async () => {
    const res = await request(app).post("/api/evidence").set("content-type", "image/jpeg").send(JPG);
    expect(res.status).toBe(201);
    expect(res.body.image_path).toMatch(/\.jpg$/);
  });

  it("rejects non-images, wrong magic bytes and oversized bodies", async () => {
    expect((await request(app).post("/api/evidence").set("content-type", "text/plain").send("hello")).status).toBe(415);
    expect((await request(app).post("/api/evidence").set("content-type", "image/png").send(Buffer.from("not a png at all"))).status).toBe(400);
    const big = Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]);
    expect((await request(app).post("/api/evidence").set("content-type", "image/png").send(big)).status).toBe(413);
  });

  it("requires the token when one is configured", async () => {
    const guarded = createApp({ db, redis, publisher, log: silentLog, evidenceDir, evidenceUploadToken: "s3cret" });
    const post = (key?: string) => {
      const r = request(guarded).post("/api/evidence").set("content-type", "image/png");
      return (key ? r.set("x-api-key", key) : r).send(PNG);
    };
    expect((await post()).status).toBe(401);
    expect((await post("wrong")).status).toBe(401);
    expect((await post("s3cret")).status).toBe(201);
  });
});

describe("evidence and fallbacks", () => {
  it("serves sample images and blocks path traversal", async () => {
    const ok = await request(app).get("/api/evidence/samples/sample_fire.png");
    expect(ok.status).toBe(200);
    expect((await request(app).get("/api/evidence/samples/missing.png")).status).toBe(404);
    const traversal = await request(app).get("/api/evidence/..%2f..%2fsecret.txt");
    expect(traversal.status).not.toBe(200);
    expect(traversal.text).not.toContain("top secret");
  });

  it("returns JSON 404 for unknown routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_found");
  });

  it("returns 400 for malformed JSON bodies", async () => {
    const res = await request(app).post("/api/simulate").set("Content-Type", "application/json").send("{bad");
    expect(res.status).toBe(400);
  });
});
