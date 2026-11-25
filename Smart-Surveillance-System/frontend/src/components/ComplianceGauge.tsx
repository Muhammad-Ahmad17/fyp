import { scoreColor } from "../lib/format";
import { useStore } from "../store";
import { Card } from "./ui";

/** Semi-circle gauge. `score` is 0-100 or null (no data yet). */
export function Gauge({ score }: { score: number | null }) {
  const r = 80;
  const c = Math.PI * r; // half circumference
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const color = scoreColor(score);
  return (
    <svg viewBox="0 0 200 120" className="mx-auto w-full max-w-[240px]" role="img" aria-label={score === null ? "Compliance unknown" : `Compliance ${score} percent`}>
      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1e293b" strokeWidth="16" strokeLinecap="round" />
      <path
        d="M 20 100 A 80 80 0 0 1 180 100"
        fill="none"
        stroke={color}
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.6s ease" }}
      />
      <text x="100" y="92" textAnchor="middle" className="fill-slate-100" fontSize="30" fontWeight="600">
        {score === null ? "--" : `${score.toFixed(0)}%`}
      </text>
      <text x="100" y="112" textAnchor="middle" className="fill-slate-400" fontSize="10">
        site compliance
      </text>
    </svg>
  );
}

export function ComplianceGauge() {
  const summary = useStore((s) => s.summary);
  const c = summary?.compliance;
  const score = c?.compliance_score ?? null;
  return (
    <Card title="Compliance">
      <Gauge score={score} />
      <p className="mt-4 text-center text-sm text-slate-300">
        {c?.worker_count == null ? "waiting for metrics" : `${c.worker_count} workers, ${c.violation_count} violations`}
      </p>
      <p className="mt-1 text-center text-xs text-slate-500">{summary?.alerts_total ?? 0} alerts (24h)</p>
    </Card>
  );
}
