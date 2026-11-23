import { describe, expect, it } from "vitest";
import {
  EXAMPLE_ALERT,
  EXAMPLE_HEARTBEAT,
  EXAMPLE_METRICS,
  STREAMS,
  parseTopic,
  streamFieldsFor,
  topicFor,
  topicMismatch,
} from "../src";

describe("topics", () => {
  it("builds topics per type", () => {
    expect(topicFor(EXAMPLE_ALERT)).toBe("ppe/alerts/HIGH");
    expect(topicFor(EXAMPLE_METRICS)).toBe("ppe/metrics/jetson-01");
    expect(topicFor(EXAMPLE_HEARTBEAT)).toBe("ppe/heartbeat/jetson-01");
  });

  it("parses topics", () => {
    expect(parseTopic("ppe/alerts/MEDIUM")).toEqual({ type: "alert", priority: "MEDIUM" });
    expect(parseTopic("ppe/metrics/jetson-01")).toEqual({ type: "metrics", device_id: "jetson-01" });
    expect(parseTopic("ppe/heartbeat/x")).toEqual({ type: "heartbeat", device_id: "x" });
    expect(parseTopic("ppe/alerts")).toBeNull();
    expect(parseTopic("ppe/alerts/general/HIGH")).toBeNull(); // old zone topics are not part of the contract
    expect(parseTopic("ppe/other/x")).toBeNull();
    expect(parseTopic("foo/alerts/a")).toBeNull();
  });

  it("detects topic/payload mismatches", () => {
    expect(topicMismatch(topicFor(EXAMPLE_ALERT), EXAMPLE_ALERT)).toBeNull();
    expect(topicMismatch(topicFor(EXAMPLE_METRICS), EXAMPLE_METRICS)).toBeNull();
    expect(topicMismatch("ppe/alerts/LOW", EXAMPLE_ALERT)).toMatch(/priority/);
    expect(topicMismatch("ppe/metrics/jetson-01", EXAMPLE_ALERT)).toMatch(/type/);
    expect(topicMismatch("ppe/metrics/other", EXAMPLE_METRICS)).toMatch(/device_id/);
    expect(topicMismatch("nope", EXAMPLE_METRICS)).toMatch(/unknown topic/);
  });
});

describe("stream fields", () => {
  it("indexes the right fields", () => {
    const f = streamFieldsFor("ppe/alerts/HIGH", EXAMPLE_ALERT, "2026-10-28T12:00:01.000Z");
    expect(f).toMatchObject({
      event_id: EXAMPLE_ALERT.event_id,
      type: "alert",
      event: "helmet_missing",
      priority: "HIGH",
      device_id: "jetson-01",
    });
    expect(JSON.parse(f.payload)).toEqual(EXAMPLE_ALERT);
    const hb = streamFieldsFor("ppe/heartbeat/jetson-01", EXAMPLE_HEARTBEAT, "x");
    expect(hb).toMatchObject({ event: "", priority: "" });
  });

  it("has stable stream names", () => {
    expect(STREAMS).toEqual({
      alert: "ppe:alerts",
      metrics: "ppe:metrics",
      heartbeat: "ppe:heartbeat",
      deadLetter: "ppe:dead_letter",
    });
  });
});
