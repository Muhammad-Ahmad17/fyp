import type { Logger } from "pino";
import {
  LIVE_CHANNEL,
  STREAMS,
  safetyMessageSchema,
  type LiveEvent,
  type MessageType,
  type SafetyMessage,
} from "@intellisafe/contracts";
import type { Db } from "./db";
import {
  insertAlert,
  insertMetrics,
  toAlertDTO,
  toDeviceDTO,
  toMetricsDTO,
  upsertDevice,
} from "./repo";

type RawEntry = [id: string, fields: string[]];
type RawRead = [stream: string, entries: RawEntry[]][];

/** The slice of ioredis the consumer needs (a dedicated connection, because XREADGROUP BLOCK blocks it). */
export interface ReaderRedis {
  xgroup(...args: string[]): Promise<unknown>;
  xreadgroup(...args: (string | number)[]): Promise<RawRead | null>;
}

/** Commands connection: ack, dead-letter and live publish. */
export interface WriterRedis {
  xack(stream: string, group: string, ...ids: string[]): Promise<number>;
  xadd(key: string, ...args: (string | number)[]): Promise<string | null>;
  publish(channel: string, message: string): Promise<number>;
}

export interface ConsumerDeps {
  db: Db;
  reader: ReaderRedis;
  writer: WriterRedis;
  log: Logger;
  group?: string;
  consumer?: string;
  /** XREADGROUP BLOCK in ms. 0 disables blocking (tests). */
  blockMs?: number;
  batchSize?: number;
  /** Delay when a non-blocking read finds nothing (only used when blockMs = 0). */
  idleSleepMs?: number;
  maxAttempts?: number;
}

export type Outcome = "stored" | "duplicate" | "stale" | "dead_lettered";

const STREAM_TYPES: Record<string, MessageType> = {
  [STREAMS.alert]: "alert",
  [STREAMS.metrics]: "metrics",
  [STREAMS.heartbeat]: "heartbeat",
};
const STREAM_LIST = Object.keys(STREAM_TYPES);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function fieldsToObject(fields: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i + 1 < fields.length; i += 2) out[fields[i] as string] = fields[i + 1] as string;
  return out;
}

/**
 * Redis Streams consumer (consumer group `alert-svc`).
 *
 * At-least-once: an entry is XACKed only after it is stored. Redelivery is safe
 * because the DB insert is idempotent on event_id. Entries that keep failing
 * are moved to ppe:dead_letter after `maxAttempts`.
 */
export class AlertConsumer {
  readonly group: string;
  readonly consumer: string;
  private readonly blockMs: number;
  private readonly batchSize: number;
  private readonly idleSleepMs: number;
  private readonly maxAttempts: number;
  private readonly failures = new Map<string, number>();
  private stopped = true;
  private loopDone: Promise<void> = Promise.resolve();

  constructor(private readonly deps: ConsumerDeps) {
    this.group = deps.group ?? "alert-svc";
    this.consumer = deps.consumer ?? "api-1";
    this.blockMs = deps.blockMs ?? 2000;
    this.batchSize = deps.batchSize ?? 50;
    this.idleSleepMs = deps.idleSleepMs ?? 200;
    this.maxAttempts = deps.maxAttempts ?? 5;
  }

  async ensureGroups(): Promise<void> {
    for (const stream of STREAM_LIST) {
      try {
        // "0": a new group also receives events that were published before the API first started.
        await this.deps.reader.xgroup("CREATE", stream, this.group, "0", "MKSTREAM");
      } catch (err) {
        if (!String((err as Error).message).includes("BUSYGROUP")) throw err;
      }
    }
  }

  async start(): Promise<void> {
    if (!this.stopped) return;
    await this.ensureGroups();
    this.stopped = false;
    this.loopDone = this.loop();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await this.loopDone;
  }

  /** Read one batch. "pending" re-reads this consumer's unacked entries, "new" reads fresh ones. */
  async pollOnce(mode: "pending" | "new"): Promise<{ processed: number; failed: number }> {
    const args: (string | number)[] = ["GROUP", this.group, this.consumer, "COUNT", this.batchSize];
    if (mode === "new" && this.blockMs > 0) args.push("BLOCK", this.blockMs);
    args.push("STREAMS", ...STREAM_LIST, ...STREAM_LIST.map(() => (mode === "new" ? ">" : "0")));

    const res = await this.deps.reader.xreadgroup(...args);
    let processed = 0;
    let failed = 0;
    for (const [stream, entries] of res ?? []) {
      for (const [id, fields] of entries) {
        processed += 1;
        const key = `${stream}:${id}`;
        try {
          const outcome = await this.processEntry(stream, id, fieldsToObject(fields));
          this.failures.delete(key);
          this.deps.log.debug({ stream, id, outcome }, "processed");
        } catch (err) {
          const n = (this.failures.get(key) ?? 0) + 1;
          this.failures.set(key, n);
          this.deps.log.error({ stream, id, attempt: n, err: (err as Error).message }, "processing failed");
          if (n >= this.maxAttempts) {
            await this.deadLetter(stream, id, fieldsToObject(fields), `processing_failed: ${(err as Error).message}`);
            await this.deps.writer.xack(stream, this.group, id);
            this.failures.delete(key);
          } else {
            failed += 1;
          }
        }
      }
    }
    return { processed, failed };
  }

  /** Validate, store, broadcast and ack one stream entry. Throws on infrastructure errors (entry stays pending). */
  async processEntry(stream: string, id: string, fields: Record<string, string>): Promise<Outcome> {
    const { writer, db } = this.deps;
    const ack = () => writer.xack(stream, this.group, id);

    let json: unknown;
    try {
      json = JSON.parse(fields.payload ?? "");
    } catch (err) {
      await this.deadLetter(stream, id, fields, `parse_error: ${(err as Error).message}`);
      await ack();
      return "dead_lettered";
    }
    const parsed = safetyMessageSchema.safeParse(json);
    if (!parsed.success) {
      await this.deadLetter(stream, id, fields, `validation_error: ${parsed.error.issues[0]?.message ?? "invalid"}`);
      await ack();
      return "dead_lettered";
    }
    const msg: SafetyMessage = parsed.data;
    if (STREAM_TYPES[stream] !== msg.type) {
      await this.deadLetter(stream, id, fields, `wrong_stream: ${msg.type} message in ${stream}`);
      await ack();
      return "dead_lettered";
    }

    let live: LiveEvent | null = null;
    let outcome: Outcome = "duplicate";
    switch (msg.type) {
      case "alert": {
        const row = await insertAlert(db, msg, fields.received_at ? new Date(fields.received_at) : new Date());
        if (row) {
          live = { kind: "alert", data: toAlertDTO(row) };
          outcome = "stored";
        }
        break;
      }
      case "metrics": {
        const row = await insertMetrics(db, msg, fields.received_at ? new Date(fields.received_at) : new Date());
        if (row) {
          live = { kind: "metrics", data: toMetricsDTO(row) };
          outcome = "stored";
        }
        break;
      }
      case "heartbeat": {
        const row = await upsertDevice(db, msg);
        if (row) {
          live = { kind: "heartbeat", data: toDeviceDTO(row) };
          outcome = "stored";
        } else {
          outcome = "stale";
        }
        break;
      }
    }

    // Ack first: the row is durable. A failed broadcast must not cause a redelivery loop.
    await ack();
    if (live) await this.broadcast(live);
    return outcome;
  }

  private async broadcast(event: LiveEvent): Promise<void> {
    try {
      await this.deps.writer.publish(LIVE_CHANNEL, JSON.stringify(event));
    } catch (err) {
      this.deps.log.warn({ err: (err as Error).message }, "live publish failed (event is stored)");
    }
  }

  private async deadLetter(stream: string, id: string, fields: Record<string, string>, reason: string): Promise<void> {
    await this.deps.writer.xadd(
      STREAMS.deadLetter,
      "MAXLEN",
      "~",
      100000,
      "*",
      "topic",
      fields.topic ?? stream,
      "payload",
      (fields.payload ?? "").slice(0, 4000),
      "reason",
      `consumer:${reason}`,
      "received_at",
      new Date().toISOString(),
      "source_entry",
      `${stream}:${id}`,
    );
    this.deps.log.warn({ stream, id, reason }, "dead-lettered");
  }

  private async loop(): Promise<void> {
    let recover = true; // first replay anything left pending by a previous run
    let backoff = 500;
    while (!this.stopped) {
      try {
        if (recover) {
          const r = await this.pollOnce("pending");
          if (r.failed > 0) {
            await sleep(backoff);
            backoff = Math.min(backoff * 2, 10_000);
          } else if (r.processed === 0) {
            recover = false;
            backoff = 500;
          }
          continue;
        }
        const r = await this.pollOnce("new");
        if (r.failed > 0) recover = true;
        else if (r.processed === 0 && this.blockMs === 0) await sleep(this.idleSleepMs);
      } catch (err) {
        if (this.stopped) break;
        this.deps.log.error({ err: (err as Error).message }, "consumer loop error, retrying");
        recover = true;
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 10_000);
      }
    }
  }
}
