import type { AlertDTO } from "@intellisafe/contracts";
import { EVENT_LABEL, relativeTime } from "../lib/format";
import { useNow } from "../lib/useNow";
import { useStore } from "../store";
import { Card, Empty, PriorityBadge } from "./ui";

export function LiveFeed({ onOpen }: { onOpen: (a: AlertDTO) => void }) {
  const feed = useStore((s) => s.feed);
  const loading = useStore((s) => s.loading);
  const ack = useStore((s) => s.acknowledge);
  const now = useNow();

  return (
    <Card title="Live alert feed" action={<span className="text-xs text-slate-500">{feed.length} shown</span>}>
      {loading ? (
        <Empty>Loading...</Empty>
      ) : feed.length === 0 ? (
        <Empty>No alerts yet. Use "Send mock event" to push one through the pipeline.</Empty>
      ) : (
        <ul className="max-h-[28rem] divide-y divide-slate-800 overflow-y-auto" aria-live="polite" aria-label="Live alerts">
          {feed.map((a) => (
            <li
              key={a.id}
              className={`slide-in flex items-center gap-3 py-2.5 ${a.priority === "CRITICAL" && !a.acknowledged ? "pulse-critical rounded-md" : ""}`}
            >
              <PriorityBadge priority={a.priority} />
              <button onClick={() => onOpen(a)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-slate-100">
                  {EVENT_LABEL[a.event]}
                  {a.worker_id !== null && <span className="text-slate-400"> - worker #{a.worker_id}</span>}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {a.camera_id} - {relativeTime(a.timestamp, now)}
                  {a.source === "simulator" && <span className="ml-1 rounded bg-slate-800 px-1 text-[10px] uppercase text-slate-400">mock</span>}
                </p>
              </button>
              {a.acknowledged ? (
                <span className="text-xs text-emerald-400">Acknowledged</span>
              ) : (
                <button
                  onClick={() => void ack(a.id)}
                  className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:border-emerald-500 hover:text-emerald-300"
                >
                  Acknowledge
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
