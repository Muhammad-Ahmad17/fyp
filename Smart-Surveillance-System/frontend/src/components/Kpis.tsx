import { useStore } from "../store";

function Kpi({ label, value, hint, tone = "text-slate-100" }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export function Kpis() {
  const summary = useStore((s) => s.summary);
  const dash = "-";
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="Alerts (24h)" value={summary ? String(summary.alerts_total) : dash} hint="all priorities" />
      <Kpi
        label="Critical"
        value={summary ? String(summary.alerts_critical) : dash}
        hint="fire and smoke"
        tone={summary && summary.alerts_critical > 0 ? "text-red-400" : undefined}
      />
      <Kpi
        label="Unacknowledged"
        value={summary ? String(summary.alerts_unacknowledged) : dash}
        hint="need a response"
        tone={summary && summary.alerts_unacknowledged > 0 ? "text-amber-400" : undefined}
      />
      <Kpi
        label="Devices online"
        value={summary ? `${summary.devices.filter((d) => d.status === "online").length}/${summary.devices.length}` : dash}
        hint="from heartbeats"
      />
    </div>
  );
}
