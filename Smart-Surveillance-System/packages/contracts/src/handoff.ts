import { cvHandoffSchema, safetyMessageSchema, type AlertMessage, type CVHandoff, type MetricsMessage } from "./messages";
import { priorityFor } from "./priority";
import { HAZARD_EVENTS, SCHEMA_VERSION, type Source } from "./enums";

export interface HandoffContext {
  device_id: string;
  session_id: string;
  source: Source;
  /** Override for tests. Defaults to a fresh UUID v4. */
  event_id?: string;
  /** Override for tests. Defaults to now. */
  now?: Date;
}

/**
 * Platform side wrapper: turns the edge handoff into a contract message.
 *  - `compliant` -> metrics message (no priority, never an alert)
 *  - everything else -> alert message with platform-assigned priority
 * Throws a ZodError when the result does not satisfy the contract
 * (for example a PPE event without a worker_id).
 */
export function handoffToMessage(input: CVHandoff, ctx: HandoffContext): AlertMessage | MetricsMessage {
  const h = cvHandoffSchema.parse(input);
  const envelope = {
    schema_version: SCHEMA_VERSION,
    event_id: ctx.event_id ?? globalThis.crypto.randomUUID(),
    timestamp: (ctx.now ?? new Date()).toISOString(),
    source: ctx.source,
    device_id: ctx.device_id,
    session_id: ctx.session_id,
  };

  if (h.event === "compliant") {
    const workers = h.detections.filter((d) => d.class === "worker").length;
    const msg = {
      ...envelope,
      type: "metrics" as const,
      compliance_score: h.compliance_score,
      worker_count: h.worker_count ?? workers,
      violation_count: h.violation_count ?? 0,
    };
    return safetyMessageSchema.parse(msg) as MetricsMessage;
  }

  const isHazard = (HAZARD_EVENTS as readonly string[]).includes(h.event);
  const msg = {
    ...envelope,
    type: "alert" as const,
    event: h.event,
    priority: priorityFor(h.event),
    camera_id: h.camera_id,
    worker_id: isHazard ? null : (h.worker_id ?? null),
    confidence: h.confidence,
    compliance_score: h.compliance_score,
    frame: h.frame,
    detections: h.detections,
    image_path: h.image_path ?? null,
  };
  return safetyMessageSchema.parse(msg) as AlertMessage;
}
