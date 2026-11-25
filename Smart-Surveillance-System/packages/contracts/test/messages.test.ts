import { describe, expect, it } from "vitest";
import {
  EXAMPLE_ALERT,
  EXAMPLE_HEARTBEAT,
  EXAMPLE_METRICS,
  alertSchema,
  cvHandoffSchema,
  handoffToMessage,
  priorityFor,
  safetyMessageSchema,
} from "../src";

const clone = <T>(v: T): T => structuredClone(v);

describe("valid messages", () => {
  it.each([
    ["alert", EXAMPLE_ALERT],
    ["metrics", EXAMPLE_METRICS],
    ["heartbeat", EXAMPLE_HEARTBEAT],
  ])("%s example parses", (_name, example) => {
    expect(safetyMessageSchema.safeParse(example).success).toBe(true);
  });

  it("accepts a newer minor schema_version and rejects another major", () => {
    expect(safetyMessageSchema.safeParse({ ...EXAMPLE_METRICS, schema_version: "1.3" }).success).toBe(true);
    expect(safetyMessageSchema.safeParse({ ...EXAMPLE_METRICS, schema_version: "2.0" }).success).toBe(false);
    expect(safetyMessageSchema.safeParse({ ...EXAMPLE_METRICS, schema_version: "0.9" }).success).toBe(false);
    expect(safetyMessageSchema.safeParse({ ...EXAMPLE_METRICS, schema_version: undefined }).success).toBe(false);
  });
});

describe("invalid messages", () => {
  it("rejects unknown fields (strict)", () => {
    expect(safetyMessageSchema.safeParse({ ...EXAMPLE_ALERT, surprise: 1 }).success).toBe(false);
    expect(safetyMessageSchema.safeParse({ ...EXAMPLE_HEARTBEAT, zone: "general" }).success).toBe(false); // zone no longer exists
  });

  it("rejects an unknown type", () => {
    expect(safetyMessageSchema.safeParse({ ...EXAMPLE_ALERT, type: "log" }).success).toBe(false);
  });

  it("rejects bad ids and timestamps", () => {
    expect(safetyMessageSchema.safeParse({ ...EXAMPLE_ALERT, event_id: "nope" }).success).toBe(false);
    expect(safetyMessageSchema.safeParse({ ...EXAMPLE_ALERT, timestamp: "yesterday" }).success).toBe(false);
    expect(
      safetyMessageSchema.safeParse({ ...EXAMPLE_ALERT, timestamp: "2026-10-28T12:00:00+05:00" }).success,
    ).toBe(false);
  });

  it("rejects out of range numbers", () => {
    expect(safetyMessageSchema.safeParse({ ...EXAMPLE_ALERT, confidence: 1.2 }).success).toBe(false);
    expect(safetyMessageSchema.safeParse({ ...EXAMPLE_ALERT, compliance_score: 101 }).success).toBe(false);
    expect(safetyMessageSchema.safeParse({ ...EXAMPLE_METRICS, worker_count: -1 }).success).toBe(false);
    expect(safetyMessageSchema.safeParse({ ...EXAMPLE_HEARTBEAT, fps: -0.1 }).success).toBe(false);
  });

  it("rejects the compliant alert event, the removed spill event and the removed zone field", () => {
    expect(safetyMessageSchema.safeParse({ ...EXAMPLE_ALERT, event: "compliant" }).success).toBe(false);
    expect(safetyMessageSchema.safeParse({ ...EXAMPLE_ALERT, event: "spill" }).success).toBe(false);
    expect(safetyMessageSchema.safeParse({ ...EXAMPLE_ALERT, zone: "general" }).success).toBe(false);
  });

  it("rejects malformed detections", () => {
    const bad = clone(EXAMPLE_ALERT);
    (bad.detections[0] as unknown as { bbox: number[] }).bbox = [1, 2, 3];
    expect(safetyMessageSchema.safeParse(bad).success).toBe(false);
    const badClass = { ...clone(EXAMPLE_ALERT), detections: [{ class: "forklift", bbox: [1, 2, 3, 4], confidence: 0.5 }] };
    expect(safetyMessageSchema.safeParse(badClass).success).toBe(false);
  });

  it("allows empty detections and null image_path", () => {
    const m = { ...clone(EXAMPLE_ALERT), detections: [], image_path: null };
    expect(alertSchema.safeParse(m).success).toBe(true);
  });
});

describe("cross-field rules", () => {
  it("hazards must have worker_id null", () => {
    const fire = { ...clone(EXAMPLE_ALERT), event: "fire", priority: "CRITICAL", worker_id: 7 };
    expect(alertSchema.safeParse(fire).success).toBe(false);
    expect(alertSchema.safeParse({ ...fire, worker_id: null }).success).toBe(true);
  });

  it("PPE events require a worker_id", () => {
    expect(alertSchema.safeParse({ ...clone(EXAMPLE_ALERT), worker_id: null }).success).toBe(false);
  });

  it("priority must match the platform rules", () => {
    expect(alertSchema.safeParse({ ...clone(EXAMPLE_ALERT), priority: "LOW" }).success).toBe(false);
    expect(alertSchema.safeParse({ ...clone(EXAMPLE_ALERT), priority: "MEDIUM" }).success).toBe(false);
    expect(alertSchema.safeParse({ ...clone(EXAMPLE_ALERT), priority: "HIGH" }).success).toBe(true);
  });
});

describe("priorityFor", () => {
  it.each([
    ["fire", "CRITICAL"],
    ["smoke", "CRITICAL"],
    ["helmet_missing", "HIGH"],
    ["vest_missing", "HIGH"],
    ["compliant", "LOW"],
  ] as const)("%s -> %s", (event, expected) => {
    expect(priorityFor(event)).toBe(expected);
  });
});

describe("handoffToMessage", () => {
  const ctx = {
    device_id: "jetson-01",
    session_id: "0c9a7d3e-51b2-4f60-8a0e-3d9f6b2c1e44",
    source: "edge" as const,
    event_id: "6f1c0e52-7d5b-4c1e-9a43-0b6f1f8d2a10",
    now: new Date("2026-10-28T12:00:00.000Z"),
  };
  const base = {
    camera_id: "cam-01",
    compliance_score: 78,
    confidence: 0.92,
    frame: { width: 1280, height: 720 },
    detections: [{ class: "worker" as const, bbox: [100, 120, 80, 200] as [number, number, number, number], confidence: 0.95 }],
  };

  it("wraps a PPE handoff into an alert with platform priority", () => {
    const msg = handoffToMessage({ ...base, event: "helmet_missing", worker_id: 7 }, ctx);
    expect(msg.type).toBe("alert");
    if (msg.type !== "alert") throw new Error("unreachable");
    expect(msg.priority).toBe("HIGH");
    expect(msg.worker_id).toBe(7);
    expect(msg.source).toBe("edge");
    expect(msg.timestamp).toBe("2026-10-28T12:00:00.000Z");
    expect(msg.image_path).toBeNull();
  });

  it("forces worker_id null for hazards", () => {
    const msg = handoffToMessage({ ...base, event: "fire", worker_id: 3 }, ctx);
    expect(msg.type === "alert" && msg.worker_id).toBe(null);
    expect(msg.type === "alert" && msg.priority).toBe("CRITICAL");
  });

  it("turns compliant into metrics", () => {
    const msg = handoffToMessage({ ...base, event: "compliant", compliance_score: 95 }, ctx);
    expect(msg.type).toBe("metrics");
    if (msg.type !== "metrics") throw new Error("unreachable");
    expect(msg.worker_count).toBe(1); // counted from detections
    expect(msg.violation_count).toBe(0);
    expect(msg.compliance_score).toBe(95);
  });

  it("uses explicit worker_count / violation_count when provided", () => {
    const msg = handoffToMessage({ ...base, event: "compliant", worker_count: 6, violation_count: 2 }, ctx);
    expect(msg.type === "metrics" && [msg.worker_count, msg.violation_count]).toEqual([6, 2]);
  });

  it("throws when a PPE event has no worker_id", () => {
    expect(() => handoffToMessage({ ...base, event: "vest_missing" }, ctx)).toThrow();
  });

  it("rejects an invalid handoff", () => {
    expect(cvHandoffSchema.safeParse({ ...base, event: "forklift" }).success).toBe(false);
    expect(cvHandoffSchema.safeParse({ ...base, event: "fire", frame: undefined }).success).toBe(false);
  });
});
