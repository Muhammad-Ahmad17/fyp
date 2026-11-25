import { useState } from "react";
import { api } from "../lib/api";
import { Card } from "./ui";

export function ReportPanel() {
  const [hours, setHours] = useState(24);

  return (
    <Card title="PDF report">
      <p className="mb-3 text-xs text-slate-400">Download a compliance snapshot from Postgres (alerts, critical count, score).</p>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        Window
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
        >
          <option value={1}>1 hour</option>
          <option value={24}>24 hours</option>
          <option value={168}>7 days</option>
        </select>
      </label>
      <a
        href={api.reportUrl(hours)}
        className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
      >
        Download PDF
      </a>
    </Card>
  );
}
