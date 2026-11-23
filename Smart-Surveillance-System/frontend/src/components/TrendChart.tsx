import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "../store";
import { Card, Empty } from "./ui";

export function TrendChart() {
  const trend = useStore((s) => s.trend);

  const data = useMemo(() => {
    return [...(trend?.points ?? [])].sort((a, b) => a.bucket.localeCompare(b.bucket));
  }, [trend]);

  return (
    <Card title="Compliance trend (last hour)">
      {data.length === 0 ? (
        <Empty>No compliance metrics yet. They appear as soon as the first metrics message arrives.</Empty>
      ) : (
        <div className="h-64" data-testid="trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis
                dataKey="bucket"
                stroke="#64748b"
                fontSize={11}
                tickFormatter={(v: string) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              />
              <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(v) => new Date(String(v)).toLocaleTimeString()}
              />
              <Line
                type="monotone"
                dataKey="compliance_score"
                name="Compliance"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
