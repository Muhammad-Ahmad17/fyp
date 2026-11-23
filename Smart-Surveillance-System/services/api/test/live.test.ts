import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { LIVE_CHANNEL, type LiveEvent } from "@intellisafe/contracts";
import { LiveHub } from "../src/live";
import { FakeRedis, FakeRedisServer } from "./fake-redis";
import { silentLog, waitFor } from "./helpers";

let httpServer: Server;
let hub: LiveHub;
let redisServer: FakeRedisServer;
let url: string;
const sockets: WebSocket[] = [];

async function connect(path = "/ws"): Promise<{ ws: WebSocket; messages: LiveEvent[] }> {
  const ws = new WebSocket(`${url}${path}`);
  const messages: LiveEvent[] = [];
  ws.on("message", (data) => messages.push(JSON.parse(String(data))));
  sockets.push(ws);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
  return { ws, messages };
}

beforeEach(async () => {
  redisServer = new FakeRedisServer();
  httpServer = createServer();
  hub = new LiveHub({
    subscriber: new FakeRedis(redisServer),
    log: silentLog,
    now: () => new Date("2026-10-28T12:00:00.000Z"),
  });
  hub.attach(httpServer);
  await hub.start();
  await new Promise<void>((r) => httpServer.listen(0, "127.0.0.1", r));
  url = `ws://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const s of sockets.splice(0)) s.terminate();
  await hub.stop();
  await new Promise<void>((r) => httpServer.close(() => r()));
});

describe("LiveHub", () => {
  it("greets a new client with a hello event", async () => {
    const { messages } = await connect();
    await waitFor(() => messages.length > 0);
    expect(messages[0]).toEqual({ kind: "hello", server_time: "2026-10-28T12:00:00.000Z" });
  });

  it("relays everything published on ppe:live to every client", async () => {
    const a = await connect();
    const b = await connect();
    await waitFor(() => a.messages.length > 0 && b.messages.length > 0);

    const event: LiveEvent = { kind: "ack", data: { id: "x", acknowledged_at: "2026-10-28T12:00:00.000Z" } };
    await new FakeRedis(redisServer).publish(LIVE_CHANNEL, JSON.stringify(event));

    await waitFor(() => a.messages.length === 2 && b.messages.length === 2);
    expect(a.messages[1]).toEqual(event);
    expect(b.messages[1]).toEqual(event);
    expect(hub.clientCount).toBe(2);
  });

  it("ignores other channels and tolerates disconnected clients", async () => {
    const a = await connect();
    await waitFor(() => a.messages.length > 0);
    const pub = new FakeRedis(redisServer);
    await pub.publish("some:other", "{}");
    const gone = await connect();
    gone.ws.terminate();
    await pub.publish(LIVE_CHANNEL, JSON.stringify({ kind: "hello", server_time: "t" }));
    await waitFor(() => a.messages.length === 2);
    expect(a.messages).toHaveLength(2);
  });

  it("only accepts connections on /ws", async () => {
    await expect(connect("/other")).rejects.toThrow();
  });
});
