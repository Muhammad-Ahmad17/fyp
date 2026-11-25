import { useStore } from "../store";
import { Card } from "./ui";

const COPY: Record<string, { title: string; body: string; tone: string }> = {
  idle: { title: "Alarm idle", body: "Sounds only on fire or smoke. ESP32 can subscribe to ppe/alarm later.", tone: "text-slate-400" },
  sounding: { title: "ALARM", body: "Critical hazard. Silence it here; the MQTT command stays on ppe/alarm.", tone: "text-red-300" },
  silenced: { title: "Alarm silenced", body: "Siren off until the next fire or smoke event.", tone: "text-amber-300" },
};

export function AlarmPanel() {
  const alarm = useStore((s) => s.alarm);
  const silence = useStore((s) => s.silenceAlarm);
  const clear = useStore((s) => s.clearAlarm);
  const copy = COPY[alarm.state] ?? COPY.idle!;
  const sounding = alarm.state === "sounding";

  return (
    <Card
      title="Emergency alarm"
      className={sounding ? "border-red-500/60 bg-red-950/40" : ""}
      action={
        sounding ? (
          <button
            type="button"
            onClick={() => void silence()}
            className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500"
          >
            Silence
          </button>
        ) : alarm.state === "silenced" ? (
          <button
            type="button"
            onClick={() => void clear()}
            className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:border-emerald-500"
          >
            Reset
          </button>
        ) : null
      }
    >
      <p className={`text-sm font-medium ${copy.tone}`}>{copy.title}</p>
      <p className="mt-1 text-xs text-slate-400">{copy.body}</p>
      {alarm.reason && (
        <p className="mt-2 text-xs text-slate-300">
          Reason: <span className="font-semibold">{alarm.reason}</span>
          {alarm.camera_id ? ` · camera ${alarm.camera_id}` : ""}
        </p>
      )}
    </Card>
  );
}
