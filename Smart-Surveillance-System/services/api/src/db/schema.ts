import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { Detection } from "@intellisafe/contracts";

const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** Alerts (one row per `type = "alert"` message). */
export const violations = pgTable(
  "violations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Contract event_id. UNIQUE: a redelivered message is ignored. */
    eventId: uuid("event_id").notNull().unique(),
    timestamp: tstz("timestamp").notNull(),
    receivedAt: tstz("received_at").notNull().defaultNow(),
    source: text("source").notNull(),
    deviceId: text("device_id").notNull(),
    cameraId: text("camera_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    eventType: text("event_type").notNull(),
    priority: text("priority").notNull(),
    workerId: integer("worker_id"),
    confidence: doublePrecision("confidence").notNull(),
    complianceScore: doublePrecision("compliance_score").notNull(),
    frameWidth: integer("frame_width").notNull(),
    frameHeight: integer("frame_height").notNull(),
    detections: jsonb("detections").$type<Detection[]>().notNull().default(sql`'[]'::jsonb`),
    imagePath: text("image_path"),
    acknowledged: boolean("acknowledged").notNull().default(false),
    acknowledgedAt: tstz("acknowledged_at"),
    /** Filled by the LLM agent later. */
    agentBriefing: text("agent_briefing"),
  },
  (t) => [
    index("violations_timestamp_idx").on(t.timestamp),
    index("violations_priority_idx").on(t.priority),
    index("violations_ack_idx").on(t.acknowledged, t.timestamp),
  ],
);

/** Compliance samples (one row per `type = "metrics"` message). */
export const complianceMetrics = pgTable(
  "compliance_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().unique(),
    time: tstz("time").notNull(),
    receivedAt: tstz("received_at").notNull().defaultNow(),
    source: text("source").notNull(),
    deviceId: text("device_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    score: doublePrecision("score").notNull(),
    workerCount: integer("worker_count").notNull(),
    violationCount: integer("violation_count").notNull(),
  },
  (t) => [index("compliance_metrics_time_idx").on(t.time)],
);

/** Latest known state of each device (from heartbeats). */
export const devices = pgTable("devices", {
  deviceId: text("device_id").primaryKey(),
  status: text("status").notNull(),
  source: text("source").notNull(),
  sessionId: uuid("session_id").notNull(),
  uptimeSec: integer("uptime_sec").notNull(),
  fps: doublePrecision("fps").notNull(),
  lastSeen: tstz("last_seen").notNull(),
  lastEventId: uuid("last_event_id").notNull(),
});

/** Which PPE the site requires. A single row (id = 1); used by the rule engine later. */
export const siteRules = pgTable("site_rules", {
  id: integer("id").primaryKey().default(1),
  requiresHelmet: boolean("requires_helmet").notNull().default(true),
  requiresVest: boolean("requires_vest").notNull().default(true),
});

export type ViolationRow = typeof violations.$inferSelect;
export type MetricsRow = typeof complianceMetrics.$inferSelect;
export type DeviceRow = typeof devices.$inferSelect;
