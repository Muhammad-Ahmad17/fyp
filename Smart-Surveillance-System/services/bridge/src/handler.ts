import {
  STREAMS,
  parseTopic,
  safetyMessageSchema,
  streamFieldsFor,
  streamForType,
  topicMismatch,
} from "@intellisafe/contracts";

/** The slice of ioredis the bridge needs (lets tests use ioredis-mock). */
export interface StreamWriter {
  xadd(key: string, ...args: (string | number)[]): Promise<string | null>;
}

export type BridgeResult =
  | { ok: true; stream: string; id: string; event_id: string; type: string }
  | { ok: false; ignored: true; reason: string }
  | { ok: false; ignored: false; reason: string; deadLetterId: string | null };

export interface BridgeOptions {
  /** Approximate MAXLEN for each stream (bounds memory). */
  maxLen?: number;
  now?: () => Date;
}

const DEFAULT_MAXLEN = 100_000;
const PAYLOAD_LIMIT = 4000;

function describeIssues(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  return issues
    .slice(0, 5)
    .map((i) => `${i.path.length ? i.path.map(String).join(".") : "(root)"}: ${i.message}`)
    .join("; ");
}

async function deadLetter(
  redis: StreamWriter,
  topic: string,
  raw: string,
  reason: string,
  receivedAt: string,
  maxLen: number,
): Promise<string | null> {
  return redis.xadd(
    STREAMS.deadLetter,
    "MAXLEN",
    "~",
    maxLen,
    "*",
    "topic",
    topic,
    "payload",
    raw.slice(0, PAYLOAD_LIMIT),
    "reason",
    reason,
    "received_at",
    receivedAt,
  );
}

/**
 * Validate one MQTT message against the v1.0 contract and append it to the
 * matching Redis stream. Anything that fails validation goes to ppe:dead_letter
 * with the reason, so nothing is silently dropped.
 */
export async function handleMqttMessage(
  redis: StreamWriter,
  topic: string,
  payload: Buffer | string,
  opts: BridgeOptions = {},
): Promise<BridgeResult> {
  const maxLen = opts.maxLen ?? DEFAULT_MAXLEN;
  const receivedAt = (opts.now?.() ?? new Date()).toISOString();
  const raw = typeof payload === "string" ? payload : payload.toString("utf8");

  // An empty retained message is how a retained topic is cleared. Not an error.
  if (raw.length === 0) return { ok: false, ignored: true, reason: "empty_payload" };

  const fail = async (reason: string): Promise<BridgeResult> => ({
    ok: false,
    ignored: false,
    reason,
    deadLetterId: await deadLetter(redis, topic, raw, reason, receivedAt, maxLen),
  });

  if (!parseTopic(topic)) return fail("unknown_topic");

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    return fail(`parse_error: ${(err as Error).message}`);
  }

  const parsed = safetyMessageSchema.safeParse(json);
  if (!parsed.success) return fail(`validation_error: ${describeIssues(parsed.error.issues)}`);

  const mismatch = topicMismatch(topic, parsed.data);
  if (mismatch) return fail(`topic_mismatch: ${mismatch}`);

  const stream = streamForType(parsed.data.type);
  const fields = streamFieldsFor(topic, parsed.data, receivedAt);
  const args: (string | number)[] = ["MAXLEN", "~", maxLen, "*"];
  for (const [k, v] of Object.entries(fields)) args.push(k, v);
  const id = await redis.xadd(stream, ...args);
  if (!id) return fail("redis_xadd_returned_null");
  return { ok: true, stream, id, event_id: parsed.data.event_id, type: parsed.data.type };
}
