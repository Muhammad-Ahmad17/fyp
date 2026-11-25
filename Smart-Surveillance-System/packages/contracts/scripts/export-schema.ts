/**
 * Writes contracts/event.schema.json (JSON Schema, draft 2020-12) so the Python
 * edge code can validate its output with the `jsonschema` package.
 *
 *   npm run export-schema
 *
 * A vitest test fails when the committed file is out of date.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildJsonSchemaDocument } from "../src/json-schema";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../../contracts/event.schema.json");

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(buildJsonSchemaDocument(), null, 2)}\n`, "utf8");
console.log(`wrote ${out}`);
