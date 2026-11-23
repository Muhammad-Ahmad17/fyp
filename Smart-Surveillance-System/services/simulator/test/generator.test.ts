import { describe, expect, it } from "vitest";
import {
  ALERT_EVENTS,
  safetyMessageSchema,
  topicFor,
  type SafetyMessage,
} from "@intellisafe/contracts";
import {
  CAMERA_ID,
  CYCLE,
  createContext,
  generateAlert,
  generateCycleStep,
  generateFromRequest,
  generateHeartbeat,
  generateMetrics,
} from "../src/generator";
import { publishMessage } from "../src/publisher";

/** Deterministic rng (mulberry32) so failures are reproducible. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ctxAt = (seed = 1) =>
  createContext({
    rng: seeded(seed),
    now: () => new Date("2026-10-28T12:00:10.000Z"),
    startedAt: new Date("2026-10-28T11:00:10.000Z").getTime(),
    device_id: "jetson-test",
  });

describe("generator", () => {
  it("every generated message satisfies the contract (fuzz over seeds)", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const ctx = ctxAt(seed);
      for (const event of ALERT_EVENTS) {
        expect(safetyMessageSchema.safeParse(generateAlert(ctx, { event })).success).toBe(true);
      }
      expect(safetyMessageSchema.safeParse(generateMetrics(ctx)).success).toBe(true);
      expect(safetyMessageSchema.safeParse(generateHeartbeat(ctx)).success).toBe(true);
    }
  });

  it("random alerts are valid too", () => {
    const ctx = ctxAt(7);
    for (let i = 0; i < 300; i += 1) {
      expect(safetyMessageSchema.safeParse(generateAlert(ctx)).success).toBe(true);
    }
  });

  it("uses the ctx identity and a unique event_id each time", () => {
    const ctx = ctxAt();
    const ids = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const m = generateAlert(ctx);
      expect(m.device_id).toBe("jetson-test");
      expect(m.session_id).toBe(ctx.session_id);
      expect(m.source).toBe("simulator");
      ids.add(m.event_id);
    }
    expect(ids.size).toBe(50);
  });

  it("sets camera, priority, worker_id and evidence per event", () => {
    const ctx = ctxAt();
    const fire = generateAlert(ctx, { event: "fire" });
    expect(fire).toMatchObject({ priority: "CRITICAL", worker_id: null, camera_id: CAMERA_ID });
    expect(fire.image_path).toBe("samples/sample_fire.png");
    expect(fire.detections.map((d) => d.class)).toEqual(["fire"]);

    const helmet = generateAlert(ctx, { event: "helmet_missing" });
    expect(helmet.priority).toBe("HIGH");
    expect(helmet.worker_id).toBeGreaterThanOrEqual(1);
    expect(helmet.detections.map((d) => d.class)).toEqual(["worker", "vest"]);

    expect(generateAlert(ctx, { event: "vest_missing" }).priority).toBe("HIGH");
  });

  it("metrics: violations never exceed workers", () => {
    const ctx = ctxAt(3);
    for (let i = 0; i < 300; i += 1) {
      const m = generateMetrics(ctx);
      expect(m.violation_count).toBeLessThanOrEqual(m.worker_count);
      expect(m.compliance_score).toBeGreaterThanOrEqual(0);
      expect(m.compliance_score).toBeLessThanOrEqual(100);
    }
  });

  it("heartbeat: uptime comes from startedAt, offline has fps 0", () => {
    const ctx = ctxAt();
    expect(generateHeartbeat(ctx).uptime_sec).toBe(3600);
    const off = generateHeartbeat(ctx, { status: "offline" });
    expect(off).toMatchObject({ status: "offline", fps: 0 });
  });

  it("generateFromRequest honours type, event and count", () => {
    const ctx = ctxAt();
    const alerts = generateFromRequest(ctx, { type: "alert", event: "smoke", count: 3 });
    expect(alerts).toHaveLength(3);
    for (const a of alerts) expect(a).toMatchObject({ type: "alert", event: "smoke" });
    expect(generateFromRequest(ctx, { type: "metrics" })[0]?.type).toBe("metrics");
    expect(generateFromRequest(ctx, { type: "heartbeat" })[0]?.type).toBe("heartbeat");
    expect(generateFromRequest(ctx, {})[0]?.type).toBe("alert");
  });

  it("cycle covers every alert event and a metrics message", () => {
    const ctx = ctxAt();
    const seen = Array.from({ length: CYCLE.length }, (_, n) => generateCycleStep(ctx, n));
    expect(seen.filter((m) => m.type === "alert").map((m) => m.type === "alert" && m.event).sort()).toEqual(
      [...ALERT_EVENTS].sort(),
    );
    expect(seen.filter((m) => m.type === "metrics")).toHaveLength(1);
    // wraps around
    expect(generateCycleStep(ctx, CYCLE.length).type).toBe(seen[0]?.type);
  });
});

describe("publishMessage", () => {
  const fakeClient = () => {
    const calls: { topic: string; payload: string; opts: { qos: number; retain: boolean } }[] = [];
    return {
      calls,
      client: {
        publishAsync: async (topic: string, payload: string, opts: { qos: 0 | 1 | 2; retain: boolean }) => {
          calls.push({ topic, payload, opts });
        },
      },
    };
  };

  it("uses contract topic, QoS 1 and retains only heartbeats", async () => {
    const ctx = ctxAt();
    const { calls, client } = fakeClient();
    const msgs: SafetyMessage[] = [
      generateAlert(ctx, { event: "fire" }),
      generateMetrics(ctx),
      generateHeartbeat(ctx),
    ];
    for (const m of msgs) await publishMessage(client, m);

    expect(calls.map((c) => c.topic)).toEqual([
      "ppe/alerts/CRITICAL",
      "ppe/metrics/jetson-test",
      "ppe/heartbeat/jetson-test",
    ]);
    expect(calls.map((c) => c.opts)).toEqual([
      { qos: 1, retain: false },
      { qos: 1, retain: false },
      { qos: 1, retain: true },
    ]);
    calls.forEach((c, i) => {
      expect(JSON.parse(c.payload)).toEqual(msgs[i]);
      expect(c.topic).toBe(topicFor(msgs[i] as SafetyMessage));
    });
  });
});
