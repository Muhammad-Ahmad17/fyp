import mqtt, { type MqttClient } from "mqtt";
import type { Logger } from "pino";
import { MQTT_QOS, TOPIC_WILDCARD } from "@intellisafe/contracts";
import { handleMqttMessage, type StreamWriter } from "./handler";

export interface BridgeOptions {
  mqttUrl: string;
  writer: StreamWriter;
  log: Logger;
  clientId?: string;
  username?: string;
  password?: string;
  maxLen?: number;
}

export interface RunningBridge {
  client: MqttClient;
  /** Resolves when every message received so far has been written to Redis. */
  drain(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Connects to the broker, subscribes to ppe/# and pipes every message through
 * handleMqttMessage. Messages are processed sequentially so stream order
 * matches arrival order.
 */
export function startBridge(opts: BridgeOptions): RunningBridge {
  const { log } = opts;
  // clean: false + fixed client id => the broker queues QoS 1 messages while we restart.
  const client = mqtt.connect(opts.mqttUrl, {
    clientId: opts.clientId ?? "mqtt-redis-bridge",
    clean: false,
    username: opts.username || undefined,
    password: opts.password || undefined,
    reconnectPeriod: 1000,
  });

  client.on("connect", () => {
    log.info({ url: opts.mqttUrl }, "mqtt connected");
    client.subscribe(TOPIC_WILDCARD, { qos: MQTT_QOS }, (err) => {
      if (err) log.error({ err: err.message }, "subscribe failed");
      else log.info({ topic: TOPIC_WILDCARD }, "subscribed");
    });
  });
  client.on("reconnect", () => log.warn("mqtt reconnecting"));
  client.on("error", (err) => log.error({ err: err.message }, "mqtt error"));

  let queue: Promise<void> = Promise.resolve();
  client.on("message", (topic, payload) => {
    queue = queue.then(async () => {
      try {
        const res = await handleMqttMessage(opts.writer, topic, payload, { maxLen: opts.maxLen });
        if (res.ok) log.info({ stream: res.stream, id: res.id, type: res.type, event_id: res.event_id }, "XADD");
        else if (res.ignored) log.debug({ topic, reason: res.reason }, "ignored");
        else log.warn({ topic, reason: res.reason }, "dead-lettered");
      } catch (err) {
        log.error({ err: (err as Error).message, topic }, "failed to process message");
      }
    });
  });

  return {
    client,
    drain: () => queue,
    stop: async () => {
      await queue.catch(() => undefined);
      await client.endAsync().catch(() => undefined);
    },
  };
}
