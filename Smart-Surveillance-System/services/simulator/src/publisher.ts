import { MQTT_QOS, isRetained, topicFor, type SafetyMessage } from "@intellisafe/contracts";

/** The slice of the mqtt.js client we use (lets tests pass a fake). */
export interface MqttPublisherClient {
  publishAsync(
    topic: string,
    payload: string,
    opts: { qos: 0 | 1 | 2; retain: boolean },
  ): Promise<unknown>;
}

export interface PublishedInfo {
  topic: string;
  retain: boolean;
}

/** Publish a contract message with the topic, QoS and retain flag the contract defines. */
export async function publishMessage(client: MqttPublisherClient, msg: SafetyMessage): Promise<PublishedInfo> {
  const topic = topicFor(msg);
  const retain = isRetained(msg.type);
  await client.publishAsync(topic, JSON.stringify(msg), { qos: MQTT_QOS, retain });
  return { topic, retain };
}
