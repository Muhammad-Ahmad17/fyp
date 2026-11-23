import { useEffect, useRef, useState } from "react";
import {
  ALERT_EVENTS,
  PRIORITIES,
  SOURCES,
  type AlertDTO,
  type AlertEvent,
  type AlertListDTO,
  type Priority,
  type Source,
} from "@intellisafe/contracts";
import { api } from "../lib/api";
import { EVENT_LABEL, dateTime } from "../lib/format";
import { useStore } from "../store";
import { Card, Empty, PriorityBadge, Select } from "./ui";

const PAGE = 15;

export function AlertHistory({ onOpen }: { onOpen: (a: AlertDTO) => void }) {
  const version = useStore((s) => s.alertsVersion);
  const ack = useStore((s) => s.acknowledge);

  const [priority, setPriority] = useState<Priority | "">("");
  const [event, setEvent] = useState<AlertEvent | "">("");
  const [source, setSource] = useState<Source | "">("");
  const [acked, setAcked] = useState<"true" | "false" | "">("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<AlertListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  // Any filter change goes back to page 1.
  useEffect(() => setOffset(0), [priority, event, source, acked]);

  useEffect(() => {
    const mine = ++seq.current;
    const t = setTimeout(() => {
      api
        .alerts({
          priority: priority || undefined,
          event: event || undefined,
          source: source || undefined,
          acknowledged: acked || undefined,
          limit: PAGE,
          offset,
        })
        .then((d) => {
          if (mine === seq.current) {
            setData(d);
            setError(null);
          }
        })
        .catch((e: Error) => mine === seq.current && setError(e.message));
    }, 150); // coalesce bursts of live updates
    return () => clearTimeout(t);
  }, [priority, event, source, acked, offset, version]);

  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE, total);

  return (
    <Card title="Alert history">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select id="f-priority" label="All priorities" value={priority} onChange={setPriority} options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
        <Select id="f-event" label="All events" value={event} onChange={setEvent} options={ALERT_EVENTS.map((e) => ({ value: e, label: EVENT_LABEL[e] }))} />
        <Select id="f-source" label="All sources" value={source} onChange={setSource} options={SOURCES.map((s) => ({ value: s, label: s }))} />
        <Select
          id="f-ack"
          label="Any status"
          value={acked}
          onChange={setAcked}
          options={[
            { value: "false", label: "Unacknowledged" },
            { value: "true", label: "Acknowledged" },
          ]}
        />
      </div>

      {error && <p className="mb-2 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      {data && data.items.length === 0 ? (
        <Empty>No alerts match these filters.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2 font-medium">Time</th>
                <th className="px-2 py-2 font-medium">Priority</th>
                <th className="px-2 py-2 font-medium">Event</th>
                <th className="px-2 py-2 font-medium">Worker</th>
                <th className="px-2 py-2 font-medium">Source</th>
                <th className="px-2 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(data?.items ?? []).map((a) => (
                <tr key={a.id} className="hover:bg-slate-800/40">
                  <td className="whitespace-nowrap px-2 py-2 text-slate-300">{dateTime(a.timestamp)}</td>
                  <td className="px-2 py-2">
                    <PriorityBadge priority={a.priority} />
                  </td>
                  <td className="px-2 py-2">
                    <button onClick={() => onOpen(a)} className="text-left text-slate-100 underline-offset-2 hover:underline">
                      {EVENT_LABEL[a.event]}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-slate-400">{a.worker_id === null ? "-" : `#${a.worker_id}`}</td>
                  <td className="px-2 py-2 text-slate-400">{a.source}</td>
                  <td className="px-2 py-2">
                    {a.acknowledged ? (
                      <span className="text-emerald-400">Acknowledged</span>
                    ) : (
                      <button onClick={() => void ack(a.id)} className="rounded-md border border-slate-700 px-2 py-0.5 text-xs text-slate-200 hover:border-emerald-500 hover:text-emerald-300">
                        Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>
          {from}-{to} of {total}
        </span>
        <div className="flex gap-2">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE))}
            className="rounded-md border border-slate-700 px-3 py-1 enabled:hover:border-slate-500 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            disabled={offset + PAGE >= total}
            onClick={() => setOffset(offset + PAGE)}
            className="rounded-md border border-slate-700 px-3 py-1 enabled:hover:border-slate-500 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </Card>
  );
}
