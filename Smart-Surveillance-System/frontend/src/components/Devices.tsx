import type { DeviceDTO } from "@intellisafe/contracts";
import { formatUptime, relativeTime } from "../lib/format";
import { useNow } from "../lib/useNow";
import { useStore } from "../store";
import { Card, Empty } from "./ui";

const DOT = { online: "bg-emerald-400", degraded: "bg-amber-400", offline: "bg-red-500" } as const;

const NO_DEVICES: DeviceDTO[] = []; // stable reference: selectors must not allocate

export function Devices() {
  const devices = useStore((s) => s.summary?.devices ?? NO_DEVICES);
  const now = useNow(5000);
  return (
    <Card title="Edge devices">
      {devices.length === 0 ? (
        <Empty>No heartbeat received yet.</Empty>
      ) : (
        <ul className="space-y-2">
          {devices.map((d) => (
            <li key={d.device_id} className="flex items-center justify-between rounded-md bg-slate-800/40 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${DOT[d.status]}`} />
                <span className="font-medium text-slate-100">{d.device_id}</span>
                <span className="rounded bg-slate-800 px-1 text-[10px] uppercase text-slate-400">{d.source}</span>
              </div>
              <div className="text-right text-xs text-slate-400">
                <p>
                  {d.status} - {d.fps.toFixed(1)} fps
                </p>
                <p>
                  up {formatUptime(d.uptime_sec)} - seen {relativeTime(d.last_seen, now)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
