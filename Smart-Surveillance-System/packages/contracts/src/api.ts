import { z } from "zod";
import type { AlertEvent, DeviceStatus, Priority, Source } from "./enums";
import { ALERT_EVENTS, PRIORITIES, SOURCES } from "./enums";
import type { Detection, Frame } from "./messages";

/* ------------------------------------------------------------------ */
/* REST / WebSocket DTOs (snake_case, same as the MQTT contract)       */
/* ------------------------------------------------------------------ */

/** A stored alert (row of `violations`). */
export interface AlertDTO {
  id: string;
  event_id: string;
  timestamp: string;
  received_at: string;
  source: Source;
  device_id: string;
  camera_id: string;
  session_id: string;
  event: AlertEvent;
  priority: Priority;
  worker_id: number | null;
  confidence: number;
  compliance_score: number;
  frame: Frame;
  detections: Detection[];
  image_path: string | null;
  acknowledged: boolean;
  acknowledged_at: string | null;
}

export interface MetricsPointDTO {
  event_id: string;
  timestamp: string;
  source: Source;
  device_id: string;
  session_id: string;
  compliance_score: number;
  worker_count: number;
  violation_count: number;
}

export interface DeviceDTO {
  device_id: string;
  status: DeviceStatus;
  source: Source;
  session_id: string;
  uptime_sec: number;
  fps: number;
  last_seen: string;
}

export interface AlertListDTO {
  items: AlertDTO[];
  total: number;
  limit: number;
  offset: number;
}

/** Latest compliance numbers for the site (the most recent metrics message). */
export interface ComplianceSummaryDTO {
  compliance_score: number | null;
  worker_count: number | null;
  violation_count: number | null;
  last_metrics_at: string | null;
}

export interface MetricsSummaryDTO {
  window_hours: number;
  generated_at: string;
  alerts_total: number;
  alerts_critical: number;
  alerts_unacknowledged: number;
  compliance: ComplianceSummaryDTO;
  by_event: { event: AlertEvent; count: number }[];
  by_priority: { priority: Priority; count: number }[];
  devices: DeviceDTO[];
}

export interface TrendPointDTO {
  bucket: string;
  compliance_score: number;
}

export interface MetricsTrendDTO {
  window_hours: number;
  bucket: "minute" | "hour";
  points: TrendPointDTO[];
}

/** Everything the WebSocket gateway sends. */
export type LiveEvent =
  | { kind: "hello"; server_time: string }
  | { kind: "alert"; data: AlertDTO }
  | { kind: "metrics"; data: MetricsPointDTO }
  | { kind: "heartbeat"; data: DeviceDTO }
  | { kind: "ack"; data: { id: string; acknowledged_at: string } };

/* ------------------------------------------------------------------ */
/* POST /api/simulate request                                          */
/* ------------------------------------------------------------------ */

export const simulateRequestSchema = z
  .object({
    type: z.enum(["alert", "metrics", "heartbeat"]).default("alert"),
    event: z.enum(ALERT_EVENTS).optional(),
    count: z.number().int().min(1).max(20).default(1),
  })
  .strict();
export type SimulateRequest = z.input<typeof simulateRequestSchema>;

export const alertQuerySchema = z.object({
  priority: z.enum(PRIORITIES).optional(),
  event: z.enum(ALERT_EVENTS).optional(),
  source: z.enum(SOURCES).optional(),
  acknowledged: z.enum(["true", "false"]).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type AlertQuery = z.output<typeof alertQuerySchema>;
