import type { Server } from "node:http";
import type { Logger } from "pino";
import { WebSocket, WebSocketServer } from "ws";
import { LIVE_CHANNEL, type LiveEvent } from "@intellisafe/contracts";

/** The slice of ioredis used for pub/sub (a dedicated connection). */
export interface SubscriberRedis {
  subscribe(channel: string): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  on(event: "message", listener: (channel: string, message: string) => void): unknown;
}

export interface LiveHubOptions {
  subscriber: SubscriberRedis;
  log: Logger;
  path?: string;
  pingIntervalMs?: number;
  now?: () => Date;
}

/**
 * WebSocket gateway: relays everything published on the Redis `ppe:live`
 * channel to every connected dashboard.
 */
export class LiveHub {
  private wss: WebSocketServer | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private alive = new WeakSet<WebSocket>();
  private subscribed = false;

  constructor(private readonly opts: LiveHubOptions) {}

  get clientCount(): number {
    return this.wss ? this.wss.clients.size : 0;
  }

  attach(server: Server): void {
    const { log } = this.opts;
    this.wss = new WebSocketServer({ server, path: this.opts.path ?? "/ws", maxPayload: 4096 });

    this.wss.on("connection", (socket) => {
      this.alive.add(socket);
      socket.on("pong", () => this.alive.add(socket));
      socket.on("error", (err) => log.debug({ err: err.message }, "ws client error"));
      const hello: LiveEvent = { kind: "hello", server_time: (this.opts.now?.() ?? new Date()).toISOString() };
      socket.send(JSON.stringify(hello));
      log.debug({ clients: this.clientCount }, "ws client connected");
    });

    this.pingTimer = setInterval(() => {
      if (!this.wss) return;
      for (const socket of this.wss.clients) {
        if (!this.alive.has(socket)) {
          socket.terminate();
          continue;
        }
        this.alive.delete(socket);
        socket.ping();
      }
    }, this.opts.pingIntervalMs ?? 25_000);
    this.pingTimer.unref();
  }

  async start(): Promise<void> {
    if (this.subscribed) return;
    this.opts.subscriber.on("message", (channel, message) => {
      if (channel === LIVE_CHANNEL) this.broadcast(message);
    });
    await this.opts.subscriber.subscribe(LIVE_CHANNEL);
    this.subscribed = true;
  }

  broadcast(raw: string): void {
    if (!this.wss) return;
    for (const socket of this.wss.clients) {
      if (socket.readyState === WebSocket.OPEN) socket.send(raw);
    }
  }

  async stop(): Promise<void> {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    if (this.subscribed) {
      await this.opts.subscriber.unsubscribe(LIVE_CHANNEL).catch(() => undefined);
      this.subscribed = false;
    }
    const wss = this.wss;
    this.wss = null;
    if (!wss) return;
    for (const socket of wss.clients) socket.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  }
}
