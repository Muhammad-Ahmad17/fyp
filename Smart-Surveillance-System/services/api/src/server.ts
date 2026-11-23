import { createServer } from "node:http";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Redis } from "ioredis";
import pg from "pg";
import pino from "pino";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { AlertConsumer, type ReaderRedis, type WriterRedis } from "./consumer";
import { schema, seedSiteRules, type Db } from "./db";
import { LiveHub } from "./live";
import { createMqttEventPublisher } from "./mqtt-publisher";

async function main(): Promise<void> {
  const config = loadConfig();
  const log = pino({ name: "api", level: config.LOG_LEVEL });

  /* Postgres + migrations (retry: the container may start before the DB is ready) */
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });
  pool.on("error", (err) => log.error({ err: err.message }, "pg pool error"));
  const db = drizzle(pool, { schema }) as unknown as Db;
  for (let attempt = 1; ; attempt += 1) {
    try {
      await migrate(drizzle(pool), { migrationsFolder: config.MIGRATIONS_DIR });
      await seedSiteRules(db);
      log.info("database ready");
      break;
    } catch (err) {
      if (attempt >= 30) throw err;
      log.warn({ attempt, err: (err as Error).message }, "database not ready, retrying");
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  /* Redis: three connections (commands, blocking reads, pub/sub) */
  const redisOpts = { maxRetriesPerRequest: null as null };
  const commands = new Redis(config.REDIS_URL, redisOpts);
  const blocking = new Redis(config.REDIS_URL, redisOpts);
  const subscriber = new Redis(config.REDIS_URL, redisOpts);
  for (const [name, r] of [["commands", commands], ["blocking", blocking], ["subscriber", subscriber]] as const) {
    r.on("error", (err) => log.error({ conn: name, err: err.message }, "redis error"));
  }

  /* MQTT publisher (used by POST /api/simulate) */
  const publisher = createMqttEventPublisher({
    url: config.MQTT_URL,
    username: config.MQTT_USERNAME,
    password: config.MQTT_PASSWORD,
    onError: (err) => log.error({ err: err.message }, "mqtt error"),
  });

  /* Consumer: Redis Streams -> Postgres -> live channel */
  const consumer = new AlertConsumer({
    db,
    reader: blocking as unknown as ReaderRedis,
    writer: commands as unknown as WriterRedis,
    log: log.child({ part: "consumer" }),
    group: config.CONSUMER_GROUP,
    consumer: config.CONSUMER_NAME,
  });
  await consumer.start();

  /* HTTP + WebSocket */
  const app = createApp({
    db,
    redis: commands,
    publisher,
    log: log.child({ part: "http" }),
    evidenceDir: config.EVIDENCE_DIR,
    evidenceUploadToken: config.EVIDENCE_UPLOAD_TOKEN || undefined,
    corsOrigin: config.CORS_ORIGIN,
    enableSimulate: config.ENABLE_SIMULATE,
  });
  const server = createServer(app);
  const hub = new LiveHub({ subscriber, log: log.child({ part: "ws" }) });
  hub.attach(server);
  await hub.start();

  server.listen(config.PORT, () => log.info({ port: config.PORT }, "api listening"));

  let closing = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (closing) return;
    closing = true;
    log.info({ signal }, "shutting down");
    setTimeout(() => process.exit(1), 5000).unref(); // never hang on a dead broker/db
    server.close();
    await hub.stop();
    await consumer.stop();
    await publisher.close();
    commands.disconnect();
    blocking.disconnect();
    subscriber.disconnect();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("fatal", err);
  process.exit(1);
});
