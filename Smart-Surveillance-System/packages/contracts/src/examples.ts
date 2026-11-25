import type { AlertMessage, HeartbeatMessage, MetricsMessage } from "./messages";

/** Reference payloads. Identical to the examples in contracts/README.md. */

export const EXAMPLE_ALERT: AlertMessage = {
  schema_version: "1.0",
  type: "alert",
  event_id: "6f1c0e52-7d5b-4c1e-9a43-0b6f1f8d2a10",
  timestamp: "2026-10-28T12:00:00.000Z",
  source: "simulator",
  device_id: "jetson-01",
  session_id: "0c9a7d3e-51b2-4f60-8a0e-3d9f6b2c1e44",
  event: "helmet_missing",
  priority: "HIGH",
  camera_id: "cam-01",
  worker_id: 7,
  confidence: 0.92,
  compliance_score: 78.0,
  frame: { width: 1280, height: 720 },
  detections: [
    { class: "worker", bbox: [100, 120, 80, 200], confidence: 0.95 },
    { class: "vest", bbox: [110, 160, 60, 80], confidence: 0.88 },
  ],
  image_path: "evidence/0c9a7d3e-51b2-4f60-8a0e-3d9f6b2c1e44/frame_001.jpg",
};

export const EXAMPLE_METRICS: MetricsMessage = {
  schema_version: "1.0",
  type: "metrics",
  event_id: "b2d4f7a1-3c58-4e0b-8f6a-91e7c0d5a3b2",
  timestamp: "2026-10-28T12:00:05.000Z",
  source: "simulator",
  device_id: "jetson-01",
  session_id: "0c9a7d3e-51b2-4f60-8a0e-3d9f6b2c1e44",
  compliance_score: 91.5,
  worker_count: 6,
  violation_count: 1,
};

export const EXAMPLE_HEARTBEAT: HeartbeatMessage = {
  schema_version: "1.0",
  type: "heartbeat",
  event_id: "e9a1c3d5-7b2f-4a68-b0c4-5d8e2f1a6c73",
  timestamp: "2026-10-28T12:00:10.000Z",
  source: "simulator",
  device_id: "jetson-01",
  session_id: "0c9a7d3e-51b2-4f60-8a0e-3d9f6b2c1e44",
  status: "online",
  uptime_sec: 3600,
  fps: 14.2,
};
