import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import pino from "pino";
import { schema, seedSiteRules, type Db } from "../src/db";

const here = fileURLToPath(new URL(".", import.meta.url));

export const silentLog = pino({ level: "silent" });

/** Embedded Postgres (PGlite) with the real Drizzle migrations applied. */
export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite();
  const pgliteDb = drizzle(client, { schema });
  await migrate(pgliteDb, { migrationsFolder: resolve(here, "../drizzle") });
  const db = pgliteDb as unknown as Db;
  await seedSiteRules(db);
  return { db, close: () => client.close() };
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Poll until `fn` returns a truthy value (or throw after the timeout). */
export async function waitFor<T>(fn: () => Promise<T | false | null | undefined> | T | false | null | undefined, timeoutMs = 5000, stepMs = 25): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    await sleep(stepMs);
  }
}

/** Fast reset between tests (much cheaper than a new PGlite + migrations). */
export async function truncateData(db: Db): Promise<void> {
  await db.execute(sql`truncate table violations, compliance_metrics, devices`);
}
