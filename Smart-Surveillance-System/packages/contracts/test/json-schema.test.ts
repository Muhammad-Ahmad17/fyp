import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildJsonSchemaDocument } from "../src";

const here = dirname(fileURLToPath(import.meta.url));

describe("contracts/event.schema.json", () => {
  it("is up to date (run `npm run export-schema` if this fails)", () => {
    const committed = readFileSync(resolve(here, "../../../contracts/event.schema.json"), "utf8");
    expect(committed).toBe(`${JSON.stringify(buildJsonSchemaDocument(), null, 2)}\n`);
  });

  it("describes all message types", () => {
    const doc = buildJsonSchemaDocument() as { $defs: Record<string, unknown> };
    expect(Object.keys(doc.$defs).sort()).toEqual(
      ["AlertMessage", "CVHandoff", "HeartbeatMessage", "MetricsMessage", "SafetyMessage"].sort(),
    );
  });
});
