import { z } from "zod";
import { SCHEMA_VERSION } from "./enums";
import {
  alertSchema,
  cvHandoffSchema,
  heartbeatSchema,
  metricsSchema,
  safetyMessageSchema,
} from "./messages";

type Json = Record<string, unknown>;

function convert(schema: z.ZodType, io: "input" | "output"): Json {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io, unrepresentable: "any" }) as Json;
  return rest;
}

/**
 * Builds the JSON Schema document shipped to the Python edge side.
 * Reference the pieces with `{"$ref": "#/$defs/SafetyMessage"}` etc.
 *
 * Cross-field rules that JSON Schema cannot express (priority must match
 * priority_for(event); worker_id null for hazards, required for PPE)
 * are enforced by the platform and documented in contracts/README.md.
 */
export function buildJsonSchemaDocument(): Json {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://intellisafe.local/contracts/event.schema.json",
    title: `IntelliSafe event contract v${SCHEMA_VERSION}`,
    description:
      "Generated from packages/contracts (Zod). Do not edit by hand: run `npm run export-schema`.",
    $defs: {
      SafetyMessage: convert(safetyMessageSchema, "output"),
      AlertMessage: convert(alertSchema, "output"),
      MetricsMessage: convert(metricsSchema, "output"),
      HeartbeatMessage: convert(heartbeatSchema, "output"),
      CVHandoff: convert(cvHandoffSchema, "input"),
    },
  };
}
