/**
 * Same pipeline as pipeline.e2e.test.ts, but against REAL Mosquitto, Redis and PostgreSQL.
 * Runs in CI (service containers) or locally after `make infra`:
 *
 *   INTEGRATION=1 npm run test:integration -w @intellisafe/api
 *
 * Without INTEGRATION=1 the whole file is skipped.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { Redis } from "ioredis";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import mqtt from "mqtt";
import { STREAMS, type AlertListDTO, type LiveEvent } from "@intellisafe/contracts";
import { startBridge, type RunningBridge } from "@intellisafe/bridge/bridge";
import { createApp } from "../src/app";
import { AlertConsumer, type ReaderRedis, type WriterRedis } from "../src/consumer";
import { schema, seedSiteRules, type Db } from "../src/db";
import { LiveHub } from "../src/live";
import { createMqttEventPublisher, type EventPublisher } from "../src/mqtt-publisher";
import { silentLog, waitFor } from "./helpers";

const enabled = process.env.INTEGRATION === "1";
const MQTT_URL = process.env.MQTT_URL ?? "mqtt://localhost:1883";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://intellisafe:intellisafe@localhost:5432/intellisafe";

describe.skipIf(!enabled)("real services: simulate -> MQTT -> Redis -> Postgres -> WebSocket", () => {
  let pool: pg.Pool;
  let db: Db;
  let commands: Redis;
  let blocking: Redis;
  let subscriber: Redis;
  let bridgeRedis: Redis;
  let bridge: RunningBridge;
  let consumer: AlertConsumer;
  let publisher: EventPublisher;
  let http: Server;
  let hub: LiveHub;
  let baseUrl: string;
  let socket: WebSocket;
  const live: LiveEvent[] = [];

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    await migrate(drizzle(pool), { migrationsFolder: resolve(process.cwd(), "drizzle") });
    db = drizzle(pool, { schema }) as unknown as Db;
    await seedSiteRules(db);
    await db.execute(sql`truncate table violations, compliance_metrics, devices`);

    const opts = { maxRetriesPerRequest: null as null };
    commands = new Redis(REDIS_URL, opts);
    blocking = new Redis(REDIS_URL, opts);
    subscriber = new Redis(REDIS_URL, opts);
    bridgeRedis = new Redis(REDIS_URL, opts);
    await commands.del(STREAMS.alert, STREAMS.metrics, STREAMS.heartbeat, STREAMS.deadLetter);

    bridge = startBridge({
      mqttUrl: MQTT_URL,
      writer: { xadd: (key, ...args) => bridgeRedis.xadd(key, ...(args as [string, ...string[]])) as Promise<string | null> },
      log: silentLog,
      clientId: `it-bridge-${Date.now()}`,
    });
    await waitFor(() => bridge.client.connected);
    await new Promise((r) => setTimeout(r, 300)); // subscribe round trip

    consumer = new AlertConsumer({
      db,
      reader: blocking as unknown as ReaderRedis,
      writer: commands as unknown as WriterRedis,
      log: silentLog,
      group: `it-${Date.now()}`,
      consumer: "it-1",
    });
    await consumer.start();

    publisher = createMqttEventPublisher({ url: MQTT_URL });
    await waitFor(() => publisher.isConnected(), 10_000);
    const app = createApp({ db, redis: commands, publisher, log: silentLog, evidenceDir: "." });
    http = createServer(app);
    hub = new LiveHub({ subscriber, log: silentLog });
    hub.attach(http);
    await hub.start();
    await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
    const port = (http.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;

    socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    socket.on("message", (d) => live.push(JSON.parse(String(d)) as LiveEvent));
    await waitFor(() => live.length > 0);
  }, 60_000);

  afterAll(async () => {
    socket?.terminate();
    await hub?.stop();
    await new Promise<void>((r) => (http ? http.close(() => r()) : r()));
    await consumer?.stop();
    await publisher?.close();
    await bridge?.stop();
    for (const r of [commands, blocking, subscriber, bridgeRedis]) r?.disconnect();
    await pool?.end();
  });

  it("a mock alert reaches Postgres, the REST API and the WebSocket", async () => {
    const res = await request(baseUrl).post("/api/simulate").send({ type: "alert", event: "fire" });
    expect(res.status).toBe(202);
    const sent = res.body.published[0] as { event_id: string };

    const pushed = await waitFor(() => live.find((e) => e.kind === "alert"), 10_000);
    expect(pushed).toMatchObject({ data: { event_id: sent.event_id, priority: "CRITICAL" } });

    const list = (await request(baseUrl).get("/api/alerts")).body as AlertListDTO;
    expect(list.items.map((a) => a.event_id)).toContain(sent.event_id);

    const rows = await db.execute(sql`select count(*)::int as n from violations where event_id = ${sent.event_id}`);
    expect((rows.rows[0] as { n: number }).n).toBe(1);
  });

  it("an invalid MQTT payload is dead-lettered, not stored", async () => {
    const before = await commands.xlen(STREAMS.deadLetter);
    const client = await mqtt.connectAsync(MQTT_URL);
    await client.publishAsync("ppe/alerts/HIGH", JSON.stringify({ type: "alert", event: "nonsense" }), { qos: 1 });
    await client.endAsync();
    await waitFor(async () => (await commands.xlen(STREAMS.deadLetter)) === before + 1, 10_000);
  });
});
