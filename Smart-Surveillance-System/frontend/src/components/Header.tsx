import { useStore } from "../store";

const STATE: Record<string, { label: string; dot: string }> = {
  open: { label: "Live", dot: "bg-emerald-400" },
  connecting: { label: "Connecting", dot: "bg-amber-400 animate-pulse" },
  closed: { label: "Offline - retrying", dot: "bg-red-500 animate-pulse" },
};

export function Header() {
  const connection = useStore((s) => s.connection);
  const generated = useStore((s) => s.summary?.generated_at);
  const alarm = useStore((s) => s.alarm);
  const s = STATE[connection] ?? STATE.closed!;
  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <div>
            <h1 className="text-base font-semibold leading-tight">IntelliSafe</h1>
            <p className="text-xs text-slate-400">Working site safety monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          {generated && <span className="hidden sm:inline">Updated {new Date(generated).toLocaleTimeString()}</span>}
          {alarm.state === "sounding" && (
            <span role="status" className="inline-flex items-center gap-2 rounded-full border border-red-500/50 bg-red-500/15 px-3 py-1 font-semibold text-red-300">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              ALARM {alarm.reason ?? ""}
            </span>
          )}
          <span
            role="status"
            aria-label={`Connection: ${s.label}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-200"
          >
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        </div>
      </div>
    </header>
  );
}
