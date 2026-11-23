import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  EXAMPLE_ALERT,
  EXAMPLE_HEARTBEAT,
  EXAMPLE_METRICS,
  LIVE_CHANNEL,
  STREAMS,
  streamFieldsFor,
  topicFor,
  type LiveEvent,
  type SafetyMessage,
} from "@intellisafe/contracts";
import { AlertConsumer, type ReaderRedis, type WriterRedis } from "../src/consumer";
import { schema, type Db } from "../src/db";
import { FakeRedis, FakeRedisServer } from "./fake-redis";
import { createTestDb, silentLog, truncateData } from "./helpers";

type Mock = FakeRedis;

let db: Db;
let closeDb: () => Promise<void>;
let reader: Mock;
let writer: Mock;
let server: FakeRedisServer;
let consumer: AlertConsumer;

const asReader = (r: Mock) => r as unknown as ReaderRedis;
const asWriter = (r: Mock) => r as unknown as WriterRedis;

/** What the bridge does: append a validated message to its stream. */
async function xaddMessage(msg: SafetyMessage, streamOverride?: string): Promise<void> {
  const stream =
    streamOverride ?? (msg.type === "alert" ? STREAMS.alert : msg.type === "metrics" ? STREAMS.metrics : STREAMS.heartbeat);
  const fields = streamFieldsFor(topicFor(msg), msg, new Date().toISOString());
  const args: string[] = [];
  for (const [k, v] of Object.entries(fields)) args.push(k, v);
  await (writer as unknown as { xadd: (...a: string[]) => Promise<string> }).xadd(stream, "*", ...args);
}

async function xaddRaw(stream: string, payload: string): Promise<void> {
  await (writer as unknown as { xadd: (...a: string[]) => Promise<string> }).xadd(stream, "*", "topic", "t", "payload", payload);
}

const readAll = async (stream: string) =>
  (await writer.xrange(stream, "-", "+")) as [string, string[]][];

const pending = async (stream: string): Promise<number> => {
  const r = (await (writer as unknown as { xpending: (...a: string[]) => Promise<unknown[]> }).xpending(
    stream,
    "alert-svc",
  )) as [number, ...unknown[]];
  return Number(r[0] ?? 0);
};

let originalInsert: unknown;

beforeAll(async () => {
  ({ db, close: closeDb } = await createTestDb());
  originalInsert = (db as unknown as { insert: unknown }).insert;
});

afterAll(async () => {
  await closeDb();
});

beforeEach(async () => {
  (db as unknown as { insert: unknown }).insert = originalInsert;
  await truncateData(db);
  server = new FakeRedisServer();
  reader = new FakeRedis(server);
  writer = new FakeRedis(server);
  consumer = new AlertConsumer({
    db,
    reader: asReader(reader),
    writer: asWriter(writer),
    log: silentLog,
    blockMs: 0,
    maxAttempts: 3,
  });
  await consumer.ensureGroups();
});

describe("AlertConsumer", () => {
  it("creates groups idempotently", async () => {
    await expect(consumer.ensureGroups()).resolves.toBeUndefined();
  });

  it("stores an alert, acks it and broadcasts it on the live channel", async () => {
    const live: LiveEvent[] = [];
    const sub = new FakeRedis(server);
    await sub.subscribe(LIVE_CHANNEL);
    sub.on("message", (_c: string, m: string) => live.push(JSON.parse(m)));

    await xaddMessage(EXAMPLE_ALERT);
    const r = await consumer.pollOnce("new");
    expect(r).toEqual({ processed: 1, failed: 0 });

    const rows = await db.select().from(schema.violations);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      eventId: EXAMPLE_ALERT.event_id,
      eventType: "helmet_missing",
      priority: "HIGH",
      workerId: 7,
      deviceId: "jetson-01",
      cameraId: "cam-01",
      frameWidth: 1280,
      acknowledged: false,
    });
    expect(rows[0]?.detections).toHaveLength(2);
    expect(await pending(STREAMS.alert)).toBe(0);

    await new Promise((r) => setTimeout(r, 50));
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({ kind: "alert", data: { event_id: EXAMPLE_ALERT.event_id, acknowledged: false } });
  });

  it("stores metrics and upserts heartbeats", async () => {
    await xaddMessage(EXAMPLE_METRICS);
    await xaddMessage(EXAMPLE_HEARTBEAT);
    expect((await consumer.pollOnce("new")).processed).toBe(2);

    const metrics = await db.select().from(schema.complianceMetrics);
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({ score: 91.5, workerCount: 6, violationCount: 1 });

    const devices = await db.select().from(schema.devices);
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ deviceId: "jetson-01", status: "online", fps: 14.2 });
  });

  it("is idempotent on event_id (duplicate delivery stores one row, broadcasts once)", async () => {
    const live: string[] = [];
    const sub = new FakeRedis(server);
    await sub.subscribe(LIVE_CHANNEL);
    sub.on("message", (_c: string, m: string) => live.push(m));

    await xaddMessage(EXAMPLE_ALERT);
    await xaddMessage(EXAMPLE_ALERT);
    expect((await consumer.pollOnce("new")).processed).toBe(2);

    expect(await db.select().from(schema.violations)).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 50));
    expect(live).toHaveLength(1);
    expect(await pending(STREAMS.alert)).toBe(0);
  });

  it("ignores a heartbeat older than the stored state", async () => {
    await xaddMessage({ ...EXAMPLE_HEARTBEAT, event_id: "11111111-1111-4111-8111-111111111111", timestamp: "2026-10-28T12:30:00.000Z", status: "online" });
    await consumer.pollOnce("new");
    // stale retained message replayed later
    await xaddMessage({ ...EXAMPLE_HEARTBEAT, event_id: "22222222-2222-4222-8222-222222222222", timestamp: "2026-10-28T12:00:00.000Z", status: "degraded" });
    await consumer.pollOnce("new");
    const [dev] = await db.select().from(schema.devices);
    expect(dev?.status).toBe("online");
    expect(dev?.lastEventId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("applies a last-will offline heartbeat of the same session even though its timestamp is older", async () => {
    await xaddMessage({ ...EXAMPLE_HEARTBEAT, event_id: "11111111-1111-4111-8111-111111111111", timestamp: "2026-10-28T12:30:00.000Z" });
    await xaddMessage({ ...EXAMPLE_HEARTBEAT, event_id: "22222222-2222-4222-8222-222222222222", timestamp: "2026-10-28T12:00:00.000Z", status: "offline", fps: 0 });
    await consumer.pollOnce("new");
    const [dev] = await db.select().from(schema.devices);
    expect(dev).toMatchObject({ status: "offline", fps: 0, lastEventId: "22222222-2222-4222-8222-222222222222" });
    expect(dev?.lastSeen.toISOString()).toBe("2026-10-28T12:30:00.000Z"); // last time it was heard alive
  });

  it("does not let an old offline message of a previous session override a newer session", async () => {
    await xaddMessage({ ...EXAMPLE_HEARTBEAT, event_id: "11111111-1111-4111-8111-111111111111", timestamp: "2026-10-28T12:30:00.000Z", session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    await xaddMessage({ ...EXAMPLE_HEARTBEAT, event_id: "22222222-2222-4222-8222-222222222222", timestamp: "2026-10-28T12:00:00.000Z", status: "offline", session_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
    await consumer.pollOnce("new");
    const [dev] = await db.select().from(schema.devices);
    expect(dev?.status).toBe("online");
  });

  it("dead-letters invalid payloads and still acks them", async () => {
    await xaddRaw(STREAMS.alert, "{broken");
    await xaddRaw(STREAMS.alert, JSON.stringify({ ...EXAMPLE_ALERT, confidence: 9 }));
    await xaddMessage(EXAMPLE_METRICS, STREAMS.alert); // metrics message in the alert stream
    const r = await consumer.pollOnce("new");
    expect(r).toEqual({ processed: 3, failed: 0 });

    const dead = await readAll(STREAMS.deadLetter);
    expect(dead).toHaveLength(3);
    const reasons = dead.map(([, kv]) => kv[kv.indexOf("reason") + 1]);
    expect(reasons[0]).toMatch(/consumer:parse_error/);
    expect(reasons[1]).toMatch(/consumer:validation_error/);
    expect(reasons[2]).toMatch(/consumer:wrong_stream/);
    expect(await db.select().from(schema.violations)).toHaveLength(0);
    expect(await pending(STREAMS.alert)).toBe(0);
  });

  it("keeps an entry pending when the database fails, then retries it", async () => {
    await xaddMessage(EXAMPLE_ALERT);

    const realInsert = db.insert.bind(db);
    let calls = 0;
    (db as unknown as { insert: unknown }).insert = (...args: unknown[]) => {
      calls += 1;
      if (calls === 1) throw new Error("db down");
      return (realInsert as (...a: unknown[]) => unknown)(...args);
    };

    expect(await consumer.pollOnce("new")).toEqual({ processed: 1, failed: 1 });
    expect(await db.select().from(schema.violations)).toHaveLength(0);
    expect(await pending(STREAMS.alert)).toBe(1);

    expect(await consumer.pollOnce("pending")).toEqual({ processed: 1, failed: 0 });
    expect(await db.select().from(schema.violations)).toHaveLength(1);
    expect(await pending(STREAMS.alert)).toBe(0);
  });

  it("dead-letters a poison entry after maxAttempts", async () => {
    await xaddMessage(EXAMPLE_ALERT);
    (db as unknown as { insert: unknown }).insert = () => {
      throw new Error("always failing");
    };
    await consumer.pollOnce("new"); // attempt 1
    await consumer.pollOnce("pending"); // attempt 2
    const last = await consumer.pollOnce("pending"); // attempt 3 -> dead letter
    expect(last.failed).toBe(0);
    const dead = await readAll(STREAMS.deadLetter);
    expect(dead).toHaveLength(1);
    expect(dead[0]?.[1]).toContain("consumer:processing_failed: always failing");
    expect(await pending(STREAMS.alert)).toBe(0);
  });

  it("start() replays entries published before the group existed and stop() ends the loop", async () => {
    const server2 = new FakeRedisServer();
    const fresh = new FakeRedis(server2);
    const w = new FakeRedis(server2);
    // entry exists BEFORE the group is created
    await (w as unknown as { xadd: (...a: string[]) => Promise<string> }).xadd(
      STREAMS.alert,
      "*",
      ...Object.entries(streamFieldsFor(topicFor(EXAMPLE_ALERT), EXAMPLE_ALERT, new Date().toISOString())).flat(),
    );
    const c = new AlertConsumer({
      db,
      reader: asReader(fresh),
      writer: asWriter(w),
      log: silentLog,
      blockMs: 0,
      idleSleepMs: 10,
      group: "replay-group",
    });
    await c.start();
    const start = Date.now();
    while ((await db.select().from(schema.violations)).length === 0) {
      if (Date.now() - start > 4000) throw new Error("consumer did not process the entry");
      await new Promise((r) => setTimeout(r, 20));
    }
    await c.stop();
    expect(await db.select().from(schema.violations)).toHaveLength(1);
  });
});
