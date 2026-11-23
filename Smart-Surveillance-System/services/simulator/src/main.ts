import mqtt from "mqtt";
import pino from "pino";
import { MQTT_QOS, topicFor } from "@intellisafe/contracts";
import { createContext, generateCycleStep, generateHeartbeat } from "./generator";
import { publishMessage } from "./publisher";

const log = pino({ name: "simulator", level: process.env.LOG_LEVEL ?? "info" });

const MQTT_URL = process.env.MQTT_URL ?? "mqtt://localhost:1883";
const INTERVAL_MS = Math.max(100, Number(process.env.SIMULATOR_INTERVAL_SEC ?? "2") * 1000);
const HEARTBEAT_EVERY = Math.max(1, Number(process.env.SIMULATOR_HEARTBEAT_EVERY ?? "5"));
const DEVICE_ID = process.env.SIMULATOR_DEVICE_ID ?? "jetson-sim-01";
const ENABLED = (process.env.SIMULATOR_ENABLED ?? "true").toLowerCase() !== "false";

async function main(): Promise<void> {
  if (!ENABLED) {
    log.info("SIMULATOR_ENABLED=false, idling");
    setInterval(() => undefined, 1 << 30);
    return;
  }

  const ctx = createContext({ device_id: DEVICE_ID });

  // Last will: if this "device" drops off, the broker publishes an offline heartbeat.
  const lastWill = generateHeartbeat(ctx, { status: "offline" });
  const client = mqtt.connect(MQTT_URL, {
    clientId: `${DEVICE_ID}-${ctx.session_id.slice(0, 8)}`,
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    reconnectPeriod: 1000,
    will: {
      topic: topicFor(lastWill),
      payload: Buffer.from(JSON.stringify(lastWill)),
      qos: MQTT_QOS,
      retain: true,
    },
  });

  client.on("error", (err) => log.error({ err: err.message }, "mqtt error"));
  client.on("offline", () => log.warn("mqtt offline, will retry"));

  let tick = 0;
  let running = true;

  const sendTick = async (): Promise<void> => {
    if (!client.connected) return;
    try {
      const msg = generateCycleStep(ctx, tick);
      const info = await publishMessage(client, msg);
      log.info({ type: msg.type, topic: info.topic, event_id: msg.event_id }, "published");
      if (tick % HEARTBEAT_EVERY === 0) {
        const hb = generateHeartbeat(ctx);
        await publishMessage(client, hb);
      }
      tick += 1;
    } catch (err) {
      log.error({ err: (err as Error).message }, "publish failed");
    }
  };

  client.on("connect", () => log.info({ url: MQTT_URL, device_id: DEVICE_ID }, "connected, publishing"));
  const timer = setInterval(() => void sendTick(), INTERVAL_MS);

  const shutdown = async (signal: string): Promise<void> => {
    setTimeout(() => process.exit(1), 5000).unref(); // never hang on a dead broker
    if (!running) return;
    running = false;
    log.info({ signal }, "shutting down");
    clearInterval(timer);
    try {
      if (client.connected) await publishMessage(client, generateHeartbeat(ctx, { status: "offline" }));
    } catch {
      /* best effort */
    }
    await client.endAsync();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  log.fatal({ err }, "fatal");
  process.exit(1);
});
