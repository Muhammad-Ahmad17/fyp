/**
 * End-to-end pipeline test, fully in-process:
 *
 *   simulator/API trigger -> MQTT broker (aedes, real TCP) -> bridge (real code)
 *     -> Redis Streams (in-memory fake) -> consumer -> Postgres (PGlite)
 *     -> live channel -> WebSocket -> client, plus the REST API.
 *
 * test/integration/ runs the same flow against real Redis/Mosquitto/Postgres in CI.
 */
import { createServer as createHttpServer, type Server } from "node:http";
import { createServer as createTcpServer, type Server as TcpServer } from "node:net";
import type { AddressInfo } from "node:net";
import { Aedes } from "aedes";
import mqtt, { type MqttClient } from "mqtt";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import {
  STREAMS,
  ALERT_EVENTS,
  type AlertDTO,
  type AlertListDTO,
  type LiveEvent,
  type MetricsSummaryDTO,
} from "@intellisafe/contracts";
import { startBridge, type RunningBridge } from "@intellisafe/bridge/bridge";
import type { StreamWriter } from "@intellisafe/bridge/handler";
import {
  CYCLE,
  createContext,
  generateAlert,
  generateCycleStep,
  generateHeartbeat,
} from "@intellisafe/simulator/generator";
import { publishMessage, type MqttPublisherClient } from "@intellisafe/simulator/publisher";
import { createApp } from "../src/app";
import { AlertConsumer, type ReaderRedis, type WriterRedis } from "../src/consumer";
import type { Db } from "../src/db";
import { LiveHub } from "../src/live";
import { createMqttEventPublisher, type EventPublisher } from "../src/mqtt-publisher";
import { FakeRedis, FakeRedisServer } from "./fake-redis";
import { createTestDb, silentLog, truncateData, waitFor } from "./helpers";

let broker: Aedes;
let tcp: TcpServer;
let mqttUrl: string;
let db: Db;
let closeDb: () => Promise<void>;
let redisServer: FakeRedisServer;
let bridge: RunningBridge;
let consumer: AlertConsumer;
let publisher: EventPublisher;
let http: Server;
let hub: LiveHub;
let baseUrl: string;
let wsUrl: string;
let opened: MqttClient[] = [];
let ws: WebSocket[] = [];

const fake = () => new FakeRedis(redisServer);

async function deviceClient(opts: mqtt.IClientOptions = {}): Promise<MqttClient> {
  const c = mqtt.connect(mqttUrl, { reconnectPeriod: 0, ...opts });
  opened.push(c);
  await new Promise<void>((resolve, reject) => {
    c.once("connect", () => resolve());
    c.once("error", reject);
  });
  return c;
}

async function liveClient(): Promise<LiveEvent[]> {
  const socket = new WebSocket(wsUrl);
  ws.push(socket);
  const events: LiveEvent[] = [];
  socket.on("message", (d) => events.push(JSON.parse(String(d))));
  await waitFor(() => events.length > 0); // hello
  return events;
}

const alertsIn = async (): Promise<AlertListDTO> => (await request(baseUrl).get("/api/alerts?limit=200")).body;
const deadLetters = async () => (await fake().xrange(STREAMS.deadLetter, "-", "+")).length;

beforeAll(async () => {
  broker = await Aedes.createBroker();
  tcp = createTcpServer(broker.handle);
  await new Promise<void>((r) => tcp.listen(0, "127.0.0.1", r));
  mqttUrl = `mqtt://127.0.0.1:${(tcp.address() as AddressInfo).port}`;
  ({ db, close: closeDb } = await createTestDb());
});

afterAll(async () => {
  await closeDb();
  await new Promise<void>((r) => tcp.close(() => r()));
  await new Promise<void>((r) => broker.close(() => r()));
});

beforeEach(async () => {
  await truncateData(db);
  redisServer = new FakeRedisServer();

  // bridge: real code, fake Redis
  const bridgeRedis = fake();
  const writer: StreamWriter = {
    xadd: (key, ...args) => bridgeRedis.xadd(key, ...args),
  };
  bridge = startBridge({ mqttUrl, writer, log: silentLog, clientId: `bridge-${Math.random()}` });
  await new Promise<void>((resolve) => (bridge.client.connected ? resolve() : bridge.client.once("connect", () => resolve())));
  await new Promise((r) => setTimeout(r, 50)); // let the subscribe round trip finish

  // consumer
  consumer = new AlertConsumer({
    db,
    reader: fake() as unknown as ReaderRedis,
    writer: fake() as unknown as WriterRedis,
    log: silentLog,
    blockMs: 0,
    idleSleepMs: 10,
  });
  await consumer.start();

  // api + websocket
  publisher = createMqttEventPublisher({ url: mqttUrl });
  await waitFor(() => publisher.isConnected());
  const app = createApp({ db, redis: fake(), publisher, log: silentLog, evidenceDir: "." });
  http = createHttpServer(app);
  hub = new LiveHub({ subscriber: fake(), log: silentLog });
  hub.attach(http);
  await hub.start();
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  const port = (http.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
  wsUrl = `ws://127.0.0.1:${port}/ws`;

  return async () => {
    for (const s of ws.splice(0)) s.terminate();
    for (const c of opened.splice(0)) await c.endAsync(true).catch(() => undefined);
    await hub.stop();
    await new Promise<void>((r) => http.close(() => r()));
    await consumer.stop();
    await publisher.close();
    await bridge.stop();
    opened = [];
    ws = [];
  };
});

describe("mock event -> dashboard pipeline", () => {
  it("POST /api/simulate reaches the database, the REST API and the WebSocket", async () => {
    const events = await liveClient();

    const res = await request(baseUrl).post("/api/simulate").send({ type: "alert", event: "fire" });
    expect(res.status).toBe(202);
    const sent = res.body.published[0] as { event_id: string; topic: string };
    expect(sent.topic).toBe("ppe/alerts/CRITICAL");

    // live push
    const live = await waitFor(() => events.find((e) => e.kind === "alert"));
    expect(live).toMatchObject({ kind: "alert", data: { event_id: sent.event_id, event: "fire", priority: "CRITICAL", acknowledged: false } });

    // REST history
    const list = await alertsIn();
    expect(list.total).toBe(1);
    const stored = list.items[0] as AlertDTO;
    expect(stored.event_id).toBe(sent.event_id);
    expect(stored.id).toBe((live as { data: AlertDTO }).data.id);

    // acknowledge -> ack broadcast + persisted
    const ack = await request(baseUrl).post(`/api/alerts/${stored.id}/ack`);
    expect(ack.body.acknowledged).toBe(true);
    await waitFor(() => events.find((e) => e.kind === "ack"));
    expect(events.find((e) => e.kind === "ack")).toMatchObject({ data: { id: stored.id } });

    expect(await deadLetters()).toBe(0);
  });

  it("a full simulator cycle (all alerts, metrics, heartbeat) lands in the right tables", async () => {
    const events = await liveClient();
    const device = await deviceClient();
    const ctx = createContext({ device_id: "jetson-e2e" });
    for (let n = 0; n < CYCLE.length; n += 1) await publishMessage(device as unknown as MqttPublisherClient, generateCycleStep(ctx, n));
    await publishMessage(device as unknown as MqttPublisherClient, generateHeartbeat(ctx));

    await waitFor(async () => (await alertsIn()).total === ALERT_EVENTS.length);
    const summary = await waitFor(async () => {
      const s = (await request(baseUrl).get("/api/metrics/summary")).body as MetricsSummaryDTO;
      return s.compliance.compliance_score !== null && s.devices.length === 1 ? s : false;
    });

    expect(summary.alerts_total).toBe(4);
    expect(summary.alerts_critical).toBe(2); // fire + smoke
    expect(summary.compliance.compliance_score).not.toBeNull();
    expect(summary.devices[0]).toMatchObject({ device_id: "jetson-e2e", status: "online", source: "simulator" });
    expect(events.filter((e) => e.kind === "alert")).toHaveLength(4);
    expect(events.filter((e) => e.kind === "metrics")).toHaveLength(1);
    expect(events.filter((e) => e.kind === "heartbeat")).toHaveLength(1);
    expect(await deadLetters()).toBe(0);
  });

  it("the same MQTT message delivered twice is stored once", async () => {
    const device = await deviceClient();
    const msg = generateAlert(createContext({ device_id: "jetson-e2e" }), { event: "vest_missing" });
    await publishMessage(device as unknown as MqttPublisherClient, msg);
    await publishMessage(device as unknown as MqttPublisherClient, msg);
    await waitFor(async () => (await fake().xlen(STREAMS.alert)) === 2);
    await waitFor(async () => (await alertsIn()).total === 1);
    await new Promise((r) => setTimeout(r, 100));
    expect((await alertsIn()).total).toBe(1);
  });

  it("invalid messages go to the dead-letter stream and never reach the database", async () => {
    const device = await deviceClient();
    await device.publishAsync("ppe/alerts/MEDIUM", "{not json", { qos: 1 });
    await device.publishAsync("ppe/alerts/MEDIUM", JSON.stringify({ type: "alert", event: "fire" }), { qos: 1 });
    await device.publishAsync("ppe/unknown/topic", "{}", { qos: 1 });
    await waitFor(async () => (await deadLetters()) === 3);
    expect((await alertsIn()).total).toBe(0);
    expect(await fake().xlen(STREAMS.alert)).toBe(0);
  });

  it("a dropped device is shown offline through its MQTT last will", async () => {
    const events = await liveClient();
    const ctx = createContext({ device_id: "jetson-lwt" });
    const will = generateHeartbeat(ctx, { status: "offline" });
    const device = await deviceClient({
      clientId: "jetson-lwt",
      will: { topic: "ppe/heartbeat/jetson-lwt", payload: Buffer.from(JSON.stringify(will)), qos: 1, retain: true },
    });
    await publishMessage(device as unknown as MqttPublisherClient, generateHeartbeat(ctx));
    await waitFor(() => events.some((e) => e.kind === "heartbeat" && e.data.status === "online"));

    // kill the TCP connection without a DISCONNECT packet
    (device as unknown as { stream: { destroy(): void } }).stream.destroy();

    await waitFor(() => events.some((e) => e.kind === "heartbeat" && e.data.status === "offline"), 5000);
    const devices = (await request(baseUrl).get("/api/devices")).body as { device_id: string; status: string }[];
    expect(devices.find((d) => d.device_id === "jetson-lwt")?.status).toBe("offline");
  });
});
