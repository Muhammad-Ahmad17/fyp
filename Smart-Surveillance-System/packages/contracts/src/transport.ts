import type { MessageType } from "./enums";
import type { SafetyMessage } from "./messages";

/** MQTT topic prefix. The bridge subscribes to `ppe/#`. */
export const TOPIC_PREFIX = "ppe";
export const TOPIC_WILDCARD = `${TOPIC_PREFIX}/#`;

/** Redis Stream names. */
export const STREAMS = {
  alert: "ppe:alerts",
  metrics: "ppe:metrics",
  heartbeat: "ppe:heartbeat",
  deadLetter: "ppe:dead_letter",
} as const;

export function streamForType(type: MessageType): string {
  return STREAMS[type];
}

/** Redis pub/sub channel the API consumer publishes to and the WebSocket gateway relays. */
export const LIVE_CHANNEL = "ppe:live";

/** MQTT QoS used for all three message types. */
export const MQTT_QOS = 1 as const;

/** Only heartbeats are retained (so a new subscriber sees the last device status). */
export function isRetained(type: MessageType): boolean {
  return type === "heartbeat";
}

/**
 * Topic for a message:
 *  - alert     ppe/alerts/{priority}
 *  - metrics   ppe/metrics/{device_id}
 *  - heartbeat ppe/heartbeat/{device_id}
 */
export function topicFor(msg: SafetyMessage): string {
  switch (msg.type) {
    case "alert":
      return `${TOPIC_PREFIX}/alerts/${msg.priority}`;
    case "metrics":
      return `${TOPIC_PREFIX}/metrics/${msg.device_id}`;
    case "heartbeat":
      return `${TOPIC_PREFIX}/heartbeat/${msg.device_id}`;
  }
}

export type ParsedTopic =
  | { type: "alert"; priority: string }
  | { type: "metrics"; device_id: string }
  | { type: "heartbeat"; device_id: string };

/** Returns null for topics that are not part of the contract. */
export function parseTopic(topic: string): ParsedTopic | null {
  const parts = topic.split("/");
  if (parts[0] !== TOPIC_PREFIX) return null;
  if (parts[1] === "alerts" && parts.length === 3 && parts[2]) {
    return { type: "alert", priority: parts[2] };
  }
  if (parts[1] === "metrics" && parts.length === 3 && parts[2]) {
    return { type: "metrics", device_id: parts[2] };
  }
  if (parts[1] === "heartbeat" && parts.length === 3 && parts[2]) {
    return { type: "heartbeat", device_id: parts[2] };
  }
  return null;
}

/** Returns an error string when the topic and payload disagree, otherwise null. */
export function topicMismatch(topic: string, msg: SafetyMessage): string | null {
  const parsed = parseTopic(topic);
  if (!parsed) return `unknown topic: ${topic}`;
  if (parsed.type !== msg.type) return `topic type "${parsed.type}" does not match payload type "${msg.type}"`;
  if (parsed.type === "alert" && msg.type === "alert") {
    if (parsed.priority !== msg.priority) {
      return `topic priority "${parsed.priority}" does not match payload priority "${msg.priority}"`;
    }
  }
  if (parsed.type !== "alert" && msg.type !== "alert") {
    if (parsed.device_id !== msg.device_id) {
      return `topic device_id "${parsed.device_id}" does not match payload device_id "${msg.device_id}"`;
    }
  }
  return null;
}

/** Fields indexed next to the full payload in every Redis stream entry. */
export interface StreamFields {
  topic: string;
  payload: string;
  received_at: string;
  event_id: string;
  type: string;
  event: string;
  priority: string;
  device_id: string;
}

export function streamFieldsFor(topic: string, msg: SafetyMessage, receivedAt: string): StreamFields {
  return {
    topic,
    payload: JSON.stringify(msg),
    received_at: receivedAt,
    event_id: msg.event_id,
    type: msg.type,
    event: msg.type === "alert" ? msg.event : "",
    priority: msg.type === "alert" ? msg.priority : "",
    device_id: msg.device_id,
  };
}
