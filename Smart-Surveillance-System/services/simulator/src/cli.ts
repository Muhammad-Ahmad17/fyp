/**
 * Publish one mock event straight to MQTT (bypasses the API), for demos and debugging.
 *
 *   npm run mock -w @intellisafe/simulator -- fire
 *   npm run mock -w @intellisafe/simulator -- helmet_missing
 *   npm run mock -w @intellisafe/simulator -- --bad        # invalid payload -> dead-letter
 *
 * MQTT_URL (default mqtt://localhost:1883), MQTT_USERNAME, MQTT_PASSWORD are honoured.
 */
import mqtt from "mqtt";
import { ALERT_EVENTS, type AlertEvent } from "@intellisafe/contracts";
import { createContext, generateAlert } from "./generator";
import { publishMessage } from "./publisher";

async function main(): Promise<void> {
  const bad = process.argv.includes("--bad");
  const event = process.argv.slice(2).find((a) => !a.startsWith("--") && (ALERT_EVENTS as readonly string[]).includes(a)) as
    | AlertEvent
    | undefined;

  const client = await mqtt.connectAsync(process.env.MQTT_URL ?? "mqtt://localhost:1883", {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    clientId: `mock-cli-${Date.now()}`,
  });
  try {
    if (bad) {
      await client.publishAsync("ppe/alerts/HIGH", JSON.stringify({ type: "alert", event: "nonsense" }), { qos: 1 });
      console.log("published INVALID alert to ppe/alerts/HIGH (expect it in ppe:dead_letter)");
      return;
    }
    const msg = generateAlert(createContext({ device_id: "mock-cli" }), { event });
    const info = await publishMessage(client, msg);
    console.log(`published ${msg.event} (${msg.priority}) to ${info.topic}  event_id=${msg.event_id}`);
  } finally {
    await client.endAsync();
  }
}

main().catch((err: unknown) => {
  console.error((err as Error).message);
  process.exit(1);
});
