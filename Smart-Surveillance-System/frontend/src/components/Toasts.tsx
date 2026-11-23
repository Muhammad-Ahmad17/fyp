import { useStore } from "../store";

const TONE = {
  critical: "border-red-500/60 bg-red-950/90 text-red-100",
  info: "border-sky-500/60 bg-sky-950/90 text-sky-100",
  error: "border-amber-500/60 bg-amber-950/90 text-amber-100",
} as const;

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed right-4 top-16 z-50 flex w-80 flex-col gap-2" aria-live="assertive">
      {toasts.map((t) => (
        <div key={t.id} role="alert" className={`slide-in pointer-events-auto rounded-lg border p-3 shadow-lg ${TONE[t.tone]}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold uppercase">{t.title}</p>
            <button onClick={() => dismiss(t.id)} className="text-xs opacity-70 hover:opacity-100" aria-label="Dismiss">
              x
            </button>
          </div>
          <p className="mt-0.5 text-xs opacity-90">{t.body}</p>
        </div>
      ))}
    </div>
  );
}
