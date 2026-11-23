import { resolve } from "node:path";
import { hostname } from "node:os";
import { z } from "zod";

const boolish = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().default("postgres://intellisafe:intellisafe@localhost:5432/intellisafe"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  MQTT_URL: z.string().default("mqtt://localhost:1883"),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  /** Directory that contains the `samples/` evidence folder. */
  EVIDENCE_DIR: z.string().default(resolve(process.cwd(), "../../edge/inference")),
  MIGRATIONS_DIR: z.string().default(resolve(process.cwd(), "drizzle")),
  /** Allowed browser origin(s) for CORS, comma separated. Empty = same-origin only. */
  /** Shared secret the edge device sends as `x-api-key` when uploading evidence. Empty = open (dev only). */
  EVIDENCE_UPLOAD_TOKEN: z.string().optional(),
  CORS_ORIGIN: z.string().default(""),
  CONSUMER_GROUP: z.string().default("alert-svc"),
  CONSUMER_NAME: z.string().default(hostname()),
  ENABLE_SIMULATE: boolish.default(true),
  LOG_LEVEL: z.string().default("info"),
});

export type Config = z.output<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${msg}`);
  }
  return parsed.data;
}
