/** Dashboard copy of the v1.0 contract. The Python platform owns the runtime rules. */

export const ALERT_EVENTS = ["helmet_missing", "vest_missing", "fire", "smoke"] as const;
export type AlertEvent = (typeof ALERT_EVENTS)[number];

export const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SOURCES = ["simulator", "edge"] as const;
export type Source = (typeof SOURCES)[number];

export type DeviceStatus = "online" | "degraded" | "offline";

export interface Detection {
  class: string;
  bbox: [number, number, number, number];
  confidence: number;
}

export interface Frame {
  width: number;
  height: number;
}

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

export type AlarmState = "idle" | "sounding" | "silenced";

export interface AlarmDTO {
  state: AlarmState;
  reason: "fire" | "smoke" | null;
  camera_id: string | null;
  event_id: string | null;
  unit: string;
  updated_at: string;
}

export type LiveEvent =
  | { kind: "hello"; server_time: string }
  | { kind: "alert"; data: AlertDTO }
  | { kind: "metrics"; data: MetricsPointDTO }
  | { kind: "heartbeat"; data: DeviceDTO }
  | { kind: "ack"; data: { id: string; acknowledged_at: string } }
  | { kind: "alarm"; data: AlarmDTO };

export interface SimulateRequest {
  type?: "alert" | "metrics" | "heartbeat";
  event?: AlertEvent;
  count?: number;
}

export interface AlertQuery {
  priority?: Priority;
  event?: AlertEvent;
  source?: Source;
  acknowledged?: "true" | "false";
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}
