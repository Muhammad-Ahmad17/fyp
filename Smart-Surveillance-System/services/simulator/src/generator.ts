import {
  SCHEMA_VERSION,
  priorityFor,
  safetyMessageSchema,
  type AlertEvent,
  type AlertMessage,
  type Detection,
  type DeviceStatus,
  type HeartbeatMessage,
  type MetricsMessage,
  type SafetyMessage,
  type SimulateRequest,
  type Source,
  ALERT_EVENTS,
  HAZARD_EVENTS,
} from "@intellisafe/contracts";

/**
 * Pure mock event generator. Every message it returns is validated against the
 * v1.0 contract, so a bug here fails loudly instead of polluting the pipeline.
 */

export const FRAME = { width: 1280, height: 720 } as const;

/** One camera, one room. */
export const CAMERA_ID = "cam-01";

/** Sample evidence frames served by the API under /api/evidence/. */
export const SAMPLE_IMAGE_BY_EVENT: Record<AlertEvent, string> = {
  helmet_missing: "samples/sample_helmet_missing.png",
  vest_missing: "samples/sample_worker_ppe.png",
  fire: "samples/sample_fire.png",
  smoke: "samples/sample_smoke.png",
};

export interface MockContext {
  device_id: string;
  session_id: string;
  source: Source;
  /** epoch ms used to compute heartbeat uptime */
  startedAt: number;
  rng: () => number;
  now: () => Date;
  uuid: () => string;
}

export function createContext(opts: Partial<MockContext> & { device_id?: string } = {}): MockContext {
  return {
    device_id: opts.device_id ?? "jetson-sim-01",
    session_id: opts.session_id ?? globalThis.crypto.randomUUID(),
    source: opts.source ?? "simulator",
    startedAt: opts.startedAt ?? Date.now(),
    rng: opts.rng ?? Math.random,
    now: opts.now ?? (() => new Date()),
    uuid: opts.uuid ?? (() => globalThis.crypto.randomUUID()),
  };
}

const round = (n: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};
const between = (ctx: MockContext, min: number, max: number): number => min + ctx.rng() * (max - min);
const intBetween = (ctx: MockContext, min: number, max: number): number =>
  Math.floor(between(ctx, min, max + 1));
const pick = <T>(ctx: MockContext, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(ctx.rng() * items.length))] as T;

const envelope = (ctx: MockContext) => ({
  schema_version: SCHEMA_VERSION,
  event_id: ctx.uuid(),
  timestamp: ctx.now().toISOString(),
  source: ctx.source,
  device_id: ctx.device_id,
  session_id: ctx.session_id,
});

function detectionsFor(event: AlertEvent, ctx: MockContext): Detection[] {
  const jitter = () => intBetween(ctx, -20, 20);
  const conf = () => round(between(ctx, 0.78, 0.98), 2);
  const x = 500 + jitter() * 4;
  const y = 180 + jitter();
  const worker: Detection = { class: "worker", bbox: [x, y, 160, 400], confidence: conf() };
  const helmet: Detection = { class: "helmet", bbox: [x + 50, y - 10, 70, 70], confidence: conf() };
  const vest: Detection = { class: "vest", bbox: [x + 20, y + 120, 120, 160], confidence: conf() };
  switch (event) {
    case "helmet_missing":
      return [worker, vest];
    case "vest_missing":
      return [worker, helmet];
    case "fire":
    case "smoke":
      return [{ class: event, bbox: [300 + jitter() * 4, 250 + jitter(), 240, 240], confidence: conf() }];
  }
}

export function generateAlert(
  ctx: MockContext,
  opts: { event?: AlertEvent } = {},
): AlertMessage {
  const event = opts.event ?? pick(ctx, ALERT_EVENTS);
  const isHazard = (HAZARD_EVENTS as readonly string[]).includes(event);
  const detections = detectionsFor(event, ctx);
  const msg = {
    ...envelope(ctx),
    type: "alert" as const,
    event,
    priority: priorityFor(event),
    camera_id: CAMERA_ID,
    worker_id: isHazard ? null : intBetween(ctx, 1, 15),
    confidence: Math.max(...detections.map((d) => d.confidence)),
    compliance_score: round(between(ctx, 40, 85), 1),
    frame: { ...FRAME },
    detections,
    image_path: SAMPLE_IMAGE_BY_EVENT[event],
  };
  return safetyMessageSchema.parse(msg) as AlertMessage;
}

export function generateMetrics(ctx: MockContext): MetricsMessage {
  const workers = intBetween(ctx, 3, 12);
  const violations = Math.min(workers, intBetween(ctx, 0, 3));
  const score = Math.max(0, Math.min(100, 100 - (violations / workers) * 60 - between(ctx, 0, 6)));
  const msg = {
    ...envelope(ctx),
    type: "metrics" as const,
    compliance_score: round(score, 1),
    worker_count: workers,
    violation_count: violations,
  };
  return safetyMessageSchema.parse(msg) as MetricsMessage;
}

export function generateHeartbeat(ctx: MockContext, opts: { status?: DeviceStatus } = {}): HeartbeatMessage {
  const msg = {
    ...envelope(ctx),
    type: "heartbeat" as const,
    status: opts.status ?? "online",
    uptime_sec: Math.max(0, Math.floor((ctx.now().getTime() - ctx.startedAt) / 1000)),
    fps: opts.status === "offline" ? 0 : round(between(ctx, 11, 15), 1),
  };
  return safetyMessageSchema.parse(msg) as HeartbeatMessage;
}

/** Used by POST /api/simulate: generate `count` messages for a request. */
export function generateFromRequest(ctx: MockContext, req: SimulateRequest): SafetyMessage[] {
  const count = req.count ?? 1;
  const out: SafetyMessage[] = [];
  for (let i = 0; i < count; i += 1) {
    const type = req.type ?? "alert";
    if (type === "alert") out.push(generateAlert(ctx, { event: req.event }));
    else if (type === "metrics") out.push(generateMetrics(ctx));
    else out.push(generateHeartbeat(ctx));
  }
  return out;
}

/**
 * Deterministic rotation used by the long-running simulator:
 * one alert of each event followed by one metrics message.
 */
export type CycleStep =
  | { type: "alert"; event: AlertEvent }
  | { type: "metrics" };

export const CYCLE: readonly CycleStep[] = [
  ...ALERT_EVENTS.map((event): CycleStep => ({ type: "alert", event })),
  { type: "metrics" },
];

export function generateCycleStep(ctx: MockContext, n: number): SafetyMessage {
  const step = CYCLE[n % CYCLE.length] as CycleStep;
  return step.type === "alert" ? generateAlert(ctx, { event: step.event }) : generateMetrics(ctx);
}
