import { useEffect } from "react";
import type { AlertDTO } from "../lib/contract";
import { EVENT_LABEL, dateTime } from "../lib/format";
import { evidenceUrl } from "../lib/api";
import { PriorityBadge } from "./ui";

const BOX_COLOR: Record<string, string> = {
  worker: "#38bdf8",
  helmet: "#facc15",
  vest: "#34d399",
  fire: "#ef4444",
  smoke: "#cbd5e1",
};

export function EvidenceModal({ alert, onClose, onAck }: { alert: AlertDTO; onClose: () => void; onAck: (id: string) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const src = evidenceUrl(alert.image_path);
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Alert evidence"
      onClick={onClose}
    >
      <div className="max-h-full w-full max-w-3xl overflow-auto rounded-xl border border-slate-700 bg-slate-900 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{EVENT_LABEL[alert.event]}</h3>
            <p className="text-sm text-slate-400">
              {alert.camera_id} - {dateTime(alert.timestamp)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={alert.priority} />
            <button onClick={onClose} className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close">
              x
            </button>
          </div>
        </div>

        <div className="relative mt-4 overflow-hidden rounded-lg bg-slate-950">
          {src ? (
            <>
              <img src={src} alt={`Evidence for ${EVENT_LABEL[alert.event]}`} className="block w-full" />
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${alert.frame.width} ${alert.frame.height}`}
                preserveAspectRatio="none"
                aria-hidden
              >
                {alert.detections.map((d, i) => (
                  <g key={i}>
                    <rect x={d.bbox[0]} y={d.bbox[1]} width={d.bbox[2]} height={d.bbox[3]} fill="none" stroke={BOX_COLOR[d.class] ?? "#fff"} strokeWidth={4} />
                    <text x={d.bbox[0] + 6} y={d.bbox[1] + 26} fill={BOX_COLOR[d.class] ?? "#fff"} fontSize={24} fontWeight={600}>
                      {d.class} {(d.confidence * 100).toFixed(0)}%
                    </text>
                  </g>
                ))}
              </svg>
            </>
          ) : (
            <p className="p-10 text-center text-sm text-slate-500">No evidence frame was attached to this alert.</p>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Detail label="Worker" value={alert.worker_id === null ? "none (hazard)" : `#${alert.worker_id}`} />
          <Detail label="Confidence" value={`${(alert.confidence * 100).toFixed(0)}%`} />
          <Detail label="Compliance" value={`${alert.compliance_score.toFixed(1)}%`} />
          <Detail label="Source" value={`${alert.source} / ${alert.device_id}`} />
          <Detail label="Event ID" value={alert.event_id} mono />
          <Detail label="Received" value={dateTime(alert.received_at)} />
        </dl>

        <div className="mt-4 flex justify-end">
          {alert.acknowledged ? (
            <span className="text-sm text-emerald-400">Acknowledged {alert.acknowledged_at ? dateTime(alert.acknowledged_at) : ""}</span>
          ) : (
            <button onClick={() => onAck(alert.id)} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
              Acknowledge
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`truncate text-slate-200 ${mono ? "font-mono text-xs" : ""}`} title={value}>
        {value}
      </dd>
    </div>
  );
}
