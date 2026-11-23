import RedisMock from "ioredis-mock";
import { beforeEach, describe, expect, it } from "vitest";
import {
  EXAMPLE_ALERT,
  EXAMPLE_HEARTBEAT,
  EXAMPLE_METRICS,
  STREAMS,
  topicFor,
} from "@intellisafe/contracts";
import { handleMqttMessage, type StreamWriter } from "../src/handler";

let redis: InstanceType<typeof RedisMock>;
let writer: StreamWriter;
const fixedNow = () => new Date("2026-10-28T12:00:01.000Z");

const entries = async (stream: string): Promise<Record<string, string>[]> => {
  const rows = (await redis.xrange(stream, "-", "+")) as [string, string[]][];
  return rows.map(([id, kv]) => {
    const obj: Record<string, string> = { id };
    for (let i = 0; i < kv.length; i += 2) obj[kv[i] as string] = kv[i + 1] as string;
    return obj;
  });
};

beforeEach(async () => {
  redis = new RedisMock();
  await redis.flushall();
  writer = { xadd: (key, ...args) => (redis as never as { xadd: (...a: unknown[]) => Promise<string> }).xadd(key, ...args) };
});

describe("handleMqttMessage: happy path", () => {
  it.each([
    ["alert", EXAMPLE_ALERT, STREAMS.alert],
    ["metrics", EXAMPLE_METRICS, STREAMS.metrics],
    ["heartbeat", EXAMPLE_HEARTBEAT, STREAMS.heartbeat],
  ] as const)("routes %s to its stream", async (_n, msg, stream) => {
    const res = await handleMqttMessage(writer, topicFor(msg), JSON.stringify(msg), { now: fixedNow });
    expect(res).toMatchObject({ ok: true, stream, event_id: msg.event_id });

    const [row] = await entries(stream);
    expect(row).toBeDefined();
    expect(row?.event_id).toBe(msg.event_id);
    expect(row?.type).toBe(msg.type);
    expect(row?.device_id).toBe("jetson-01");
    expect(row?.received_at).toBe("2026-10-28T12:00:01.000Z");
    expect(JSON.parse(row?.payload ?? "{}")).toEqual(msg);
    expect(await entries(STREAMS.deadLetter)).toHaveLength(0);
  });

  it("indexes alert fields", async () => {
    await handleMqttMessage(writer, topicFor(EXAMPLE_ALERT), JSON.stringify(EXAMPLE_ALERT));
    const [row] = await entries(STREAMS.alert);
    expect(row).toMatchObject({ event: "helmet_missing", priority: "HIGH" });
  });

  it("accepts a Buffer payload", async () => {
    const res = await handleMqttMessage(writer, topicFor(EXAMPLE_METRICS), Buffer.from(JSON.stringify(EXAMPLE_METRICS)));
    expect(res.ok).toBe(true);
  });
});

describe("handleMqttMessage: dead letter", () => {
  const dead = async () => entries(STREAMS.deadLetter);

  it("dead-letters unknown topics", async () => {
    const res = await handleMqttMessage(writer, "ppe/other/thing", JSON.stringify(EXAMPLE_ALERT), { now: fixedNow });
    expect(res).toMatchObject({ ok: false, ignored: false, reason: "unknown_topic" });
    const [row] = await dead();
    expect(row).toMatchObject({ topic: "ppe/other/thing", reason: "unknown_topic", received_at: "2026-10-28T12:00:01.000Z" });
  });

  it("dead-letters invalid JSON", async () => {
    const res = await handleMqttMessage(writer, topicFor(EXAMPLE_ALERT), "{not json");
    expect(res.ok).toBe(false);
    expect((await dead())[0]?.reason).toMatch(/^parse_error/);
    expect(await entries(STREAMS.alert)).toHaveLength(0);
  });

  it("dead-letters contract violations with the reason", async () => {
    const bad = { ...EXAMPLE_ALERT, confidence: 5, extra: true };
    const res = await handleMqttMessage(writer, topicFor(EXAMPLE_ALERT), JSON.stringify(bad));
    expect(res.ok).toBe(false);
    const reason = (await dead())[0]?.reason ?? "";
    expect(reason).toMatch(/^validation_error/);
    expect(await entries(STREAMS.alert)).toHaveLength(0);
  });

  it("dead-letters a different major schema_version", async () => {
    const bad = { ...EXAMPLE_METRICS, schema_version: "2.0" };
    const res = await handleMqttMessage(writer, topicFor(EXAMPLE_METRICS), JSON.stringify(bad));
    expect(res.ok).toBe(false);
    expect((await dead())[0]?.reason).toMatch(/schema_version/);
  });

  it("dead-letters when the topic disagrees with the payload", async () => {
    const res = await handleMqttMessage(writer, "ppe/alerts/MEDIUM", JSON.stringify(EXAMPLE_ALERT));
    expect(res.ok).toBe(false);
    expect((await dead())[0]?.reason).toMatch(/^topic_mismatch/);
  });

  it("truncates huge payloads in the dead letter entry", async () => {
    await handleMqttMessage(writer, "ppe/alerts/MEDIUM", "x".repeat(10_000));
    expect((await dead())[0]?.payload).toHaveLength(4000);
  });

  it("ignores empty payloads (retained topic cleared)", async () => {
    const res = await handleMqttMessage(writer, topicFor(EXAMPLE_HEARTBEAT), "");
    expect(res).toEqual({ ok: false, ignored: true, reason: "empty_payload" });
    expect(await dead()).toHaveLength(0);
  });
});
