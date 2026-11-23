import mqtt from "mqtt";
import type { SafetyMessage } from "@intellisafe/contracts";
import { publishMessage, type MqttPublisherClient } from "@intellisafe/simulator/publisher";

/** What the API needs to inject a mock event into the real pipeline (over MQTT). */
export interface EventPublisher {
  publish(msg: SafetyMessage): Promise<{ topic: string; retain: boolean }>;
  isConnected(): boolean;
  close(): Promise<void>;
}

export interface MqttPublisherOptions {
  url: string;
  username?: string;
  password?: string;
  clientId?: string;
  onError?: (err: Error) => void;
}

export function createMqttEventPublisher(opts: MqttPublisherOptions): EventPublisher {
  const client = mqtt.connect(opts.url, {
    clientId: opts.clientId ?? `api-simulate-${Math.random().toString(16).slice(2, 10)}`,
    username: opts.username || undefined,
    password: opts.password || undefined,
    reconnectPeriod: 1000,
  });
  client.on("error", (err) => opts.onError?.(err));
  return {
    publish: (msg) => publishMessage(client as unknown as MqttPublisherClient, msg),
    isConnected: () => client.connected,
    close: async () => {
      await client.endAsync().catch(() => undefined);
    },
  };
}
