import { useState } from "react";
import { ALERT_EVENTS, type AlertEvent } from "../lib/contract";
import { EVENT_LABEL } from "../lib/format";
import { useStore } from "../store";
import { Card, Select } from "./ui";

const QUICK: AlertEvent[] = ["fire", "smoke", "helmet_missing", "vest_missing"];

export function SimulatorPanel() {
  const simulate = useStore((s) => s.simulate);
  const latency = useStore((s) => s.lastLatency);
  const connection = useStore((s) => s.connection);
  const [type, setType] = useState<"alert" | "metrics" | "heartbeat">("alert");
  const [event, setEvent] = useState<AlertEvent | "">("");
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);

  const send = async (body: Parameters<typeof simulate>[0]): Promise<void> => {
    setBusy(true);
    try {
      await simulate(body);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Send mock event">
      <p className="mb-3 text-xs text-slate-400">
        Publishes a contract-valid message to MQTT. It travels through the bridge, Redis, the database and comes back here over WebSocket.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {QUICK.map((e) => (
          <button
            key={e}
            disabled={busy || connection !== "open"}
            onClick={() => void send({ type: "alert", event: e })}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-40"
          >
            {EVENT_LABEL[e]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select id="s-type" label="Type" value={type} onChange={(v) => setType((v || "alert") as typeof type)} options={[{ value: "alert", label: "alert" }, { value: "metrics", label: "metrics" }, { value: "heartbeat", label: "heartbeat" }]} />
        <Select id="s-event" label="Random event" value={event} onChange={setEvent} options={ALERT_EVENTS.map((e) => ({ value: e, label: EVENT_LABEL[e] }))} />
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Count
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            className="w-16 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <button
        disabled={busy || connection !== "open"}
        onClick={() => void send({ type, event: type === "alert" ? event || undefined : undefined, count })}
        className="mt-3 w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
      >
        {busy ? "Sending..." : "Send mock event"}
      </button>
      {connection !== "open" && <p className="mt-2 text-xs text-amber-400">Waiting for the live connection...</p>}

      {latency && (
        <p className="mt-3 rounded-md bg-slate-800/60 px-3 py-2 text-xs text-slate-300" data-testid="latency">
          Last event round trip: <span className="font-semibold text-emerald-300">{latency.ms} ms</span> via <code className="text-slate-400">{latency.topic}</code>
        </p>
      )}
    </Card>
  );
}
