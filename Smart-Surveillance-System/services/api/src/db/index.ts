import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * Driver agnostic database type: node-postgres in production,
 * PGlite (embedded Postgres) in tests.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;

export { schema };

/** Idempotent seed: the single row of site rules (helmet and vest required). */
export async function seedSiteRules(db: Db): Promise<void> {
  await db.insert(schema.siteRules).values({ id: 1, requiresHelmet: true, requiresVest: true }).onConflictDoNothing();
}
