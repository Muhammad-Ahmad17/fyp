import { z } from "zod";
import {
  ALERT_EVENTS,
  DETECTION_CLASSES,
  DEVICE_STATUSES,
  HANDOFF_EVENTS,
  HAZARD_EVENTS,
  MESSAGE_TYPES,
  PRIORITIES,
  SCHEMA_VERSION,
  SOURCES,
} from "./enums";
import { priorityFor } from "./priority";

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

/** "1.x" is accepted (newer minor versions); any other major is rejected. */
export const schemaVersionSchema = z
  .string()
  .regex(/^1\.\d+$/, `schema_version must be "${SCHEMA_VERSION}" (major 1)`);

const uuid = z.uuid();
/** ISO-8601 UTC timestamp, e.g. 2026-10-28T12:00:00.000Z */
const timestamp = z.iso.datetime();

export const detectionSchema = z
  .object({
    class: z.enum(DETECTION_CLASSES),
    /** [x, y, w, h] in frame pixels, top-left origin */
    bbox: z.tuple([z.number().min(0), z.number().min(0), z.number().min(0), z.number().min(0)]),
    confidence: z.number().min(0).max(1),
  })
  .strict();
export type Detection = z.infer<typeof detectionSchema>;

export const frameSchema = z
  .object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();
export type Frame = z.infer<typeof frameSchema>;

const workerId = z.number().int().min(1);
const score = z.number().min(0).max(100);
const confidence = z.number().min(0).max(1);

/** Fields common to every message. */
const envelopeShape = {
  schema_version: schemaVersionSchema,
  event_id: uuid,
  timestamp,
  source: z.enum(SOURCES),
  device_id: z.string().min(1).max(64),
  session_id: uuid,
};

/* ------------------------------------------------------------------ */
/* Alert                                                               */
/* ------------------------------------------------------------------ */

export const alertSchema = z
  .object({
    ...envelopeShape,
    type: z.literal("alert"),
    event: z.enum(ALERT_EVENTS),
    priority: z.enum(PRIORITIES),
    camera_id: z.string().min(1).max(64),
    /** integer >= 1 for PPE events, null for fire/smoke */
    worker_id: workerId.nullable(),
    confidence,
    compliance_score: score,
    frame: frameSchema,
    detections: z.array(detectionSchema),
    image_path: z.string().min(1).nullable(),
  })
  .strict()
  .superRefine((m, ctx) => {
    const isHazard = (HAZARD_EVENTS as readonly string[]).includes(m.event);
    if (isHazard && m.worker_id !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["worker_id"],
        message: `worker_id must be null for hazard event "${m.event}"`,
      });
    }
    if (!isHazard && m.worker_id === null) {
      ctx.addIssue({
        code: "custom",
        path: ["worker_id"],
        message: `worker_id is required for PPE event "${m.event}"`,
      });
    }
    const expected = priorityFor(m.event);
    if (m.priority !== expected) {
      ctx.addIssue({
        code: "custom",
        path: ["priority"],
        message: `priority must be ${expected} for ${m.event}`,
      });
    }
  });
export type AlertMessage = z.infer<typeof alertSchema>;

/* ------------------------------------------------------------------ */
/* Metrics                                                             */
/* ------------------------------------------------------------------ */

export const metricsSchema = z
  .object({
    ...envelopeShape,
    type: z.literal("metrics"),
    compliance_score: score,
    worker_count: z.number().int().min(0),
    violation_count: z.number().int().min(0),
  })
  .strict();
export type MetricsMessage = z.infer<typeof metricsSchema>;

/* ------------------------------------------------------------------ */
/* Heartbeat                                                           */
/* ------------------------------------------------------------------ */

export const heartbeatSchema = z
  .object({
    ...envelopeShape,
    type: z.literal("heartbeat"),
    status: z.enum(DEVICE_STATUSES),
    uptime_sec: z.number().int().min(0),
    fps: z.number().min(0),
  })
  .strict();
export type HeartbeatMessage = z.infer<typeof heartbeatSchema>;

/* ------------------------------------------------------------------ */
/* Union                                                               */
/* ------------------------------------------------------------------ */

export const safetyMessageSchema = z.discriminatedUnion("type", [
  alertSchema,
  metricsSchema,
  heartbeatSchema,
]);
export type SafetyMessage = z.infer<typeof safetyMessageSchema>;

export type MessageOfType<T extends (typeof MESSAGE_TYPES)[number]> = Extract<SafetyMessage, { type: T }>;

/* ------------------------------------------------------------------ */
/* Edge handoff (what the Python CV code returns per frame)            */
/* ------------------------------------------------------------------ */

export const cvHandoffSchema = z
  .object({
    event: z.enum(HANDOFF_EVENTS),
    camera_id: z.string().min(1).max(64),
    worker_id: workerId.nullable().optional(),
    compliance_score: score,
    confidence,
    frame: frameSchema,
    detections: z.array(detectionSchema).default([]),
    image_path: z.string().min(1).nullable().optional(),
    worker_count: z.number().int().min(0).optional(),
    violation_count: z.number().int().min(0).optional(),
  })
  .strict();
export type CVHandoff = z.input<typeof cvHandoffSchema>;
