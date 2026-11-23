import { useCallback, useEffect, useState } from "react";
import type { AlertDTO } from "@intellisafe/contracts";
import { AlertHistory } from "./components/AlertHistory";
import { ComplianceGauge } from "./components/ComplianceGauge";
import { Devices } from "./components/Devices";
import { EvidenceModal } from "./components/EvidenceModal";
import { Header } from "./components/Header";
import { Kpis } from "./components/Kpis";
import { LiveFeed } from "./components/LiveFeed";
import { SimulatorPanel } from "./components/SimulatorPanel";
import { Toasts } from "./components/Toasts";
import { TrendChart } from "./components/TrendChart";
import { connectLive } from "./lib/live";
import { useStore } from "./store";

export default function App() {
  const [open, setOpen] = useState<AlertDTO | null>(null);
  const error = useStore((s) => s.error);
  const ack = useStore((s) => s.acknowledge);
  // Keep the open modal in sync with live acknowledgements.
  const live = useStore((s) => (open ? s.feed.find((a) => a.id === open.id) : undefined));

  useEffect(() => {
    const { setConnection, applyLive, loadAll } = useStore.getState();
    void loadAll();
    return connectLive({
      onState: setConnection,
      onEvent: applyLive,
      // alerts that arrived while the socket was down are not replayed: reload.
      onReconnect: () => void loadAll(),
    });
  }, []);

  const close = useCallback(() => setOpen(null), []);
  const shown = live ?? open;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        {error && (
          <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            Cannot reach the API: {error}
          </p>
        )}
        <Kpis />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <TrendChart />
            <LiveFeed onOpen={setOpen} />
          </div>
          <div className="space-y-4">
            <ComplianceGauge />
            <SimulatorPanel />
            <Devices />
          </div>
        </div>
        <AlertHistory onOpen={setOpen} />
      </main>
      <Toasts />
      {shown && <EvidenceModal alert={shown} onClose={close} onAck={(id) => void ack(id)} />}
    </div>
  );
}
