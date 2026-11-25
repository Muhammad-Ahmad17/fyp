/**
 * Enumerations shared by every message and DTO in the v1.0 contract.
 * Plain `as const` tuples so they can be used by Zod, the UI (filters) and tests.
 */

export const SCHEMA_VERSION = "1.0" as const;

export const MESSAGE_TYPES = ["alert", "metrics", "heartbeat"] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

/** Alert events. `compliant` is NOT an alert, it is reported via metrics. */
export const ALERT_EVENTS = ["helmet_missing", "vest_missing", "fire", "smoke"] as const;
export type AlertEvent = (typeof ALERT_EVENTS)[number];

/** Events the edge (CVHandoff) may return. Includes `compliant`. */
export const HANDOFF_EVENTS = [...ALERT_EVENTS, "compliant"] as const;
export type HandoffEvent = (typeof HANDOFF_EVENTS)[number];

/** PPE events are tied to a worker. Hazard events are not tied to a worker. */
export const PPE_EVENTS = ["helmet_missing", "vest_missing"] as const satisfies readonly AlertEvent[];
export const HAZARD_EVENTS = ["fire", "smoke"] as const satisfies readonly AlertEvent[];

export const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SOURCES = ["simulator", "edge"] as const;
export type Source = (typeof SOURCES)[number];

export const DETECTION_CLASSES = ["worker", "helmet", "vest", "fire", "smoke"] as const;
export type DetectionClass = (typeof DETECTION_CLASSES)[number];

export const DEVICE_STATUSES = ["online", "degraded", "offline"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];
