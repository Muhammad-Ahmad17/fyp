import { Redis } from "ioredis";
import pino from "pino";
import { startBridge } from "./bridge";
import type { StreamWriter } from "./handler";

const log = pino({ name: "bridge", level: process.env.LOG_LEVEL ?? "info" });

const MQTT_URL = process.env.MQTT_URL ?? "mqtt://localhost:1883";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const MAX_LEN = Number(process.env.REDIS_STREAM_MAXLEN ?? "100000");

function main(): void {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  redis.on("error", (err) => log.error({ err: err.message }, "redis error"));
  redis.on("ready", () => log.info("redis connected"));

  const writer: StreamWriter = {
    xadd: (key, ...args) => redis.xadd(key, ...(args as [string, ...string[]])) as Promise<string | null>,
  };

  const bridge = startBridge({
    mqttUrl: MQTT_URL,
    writer,
    log,
    clientId: process.env.MQTT_CLIENT_ID,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    maxLen: MAX_LEN,
  });

  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, "shutting down");
    setTimeout(() => process.exit(1), 5000).unref(); // never hang on a dead broker/db
    await bridge.stop();
    redis.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

try {
  main();
} catch (err) {
  log.fatal({ err }, "fatal");
  process.exit(1);
}
