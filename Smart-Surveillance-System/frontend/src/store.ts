import { create } from "zustand";
import type {
  AlertDTO,
  DeviceDTO,
  LiveEvent,
  MetricsSummaryDTO,
  MetricsTrendDTO,
  SimulateRequest,
} from "@intellisafe/contracts";
import { api } from "./lib/api";
import type { ConnectionState } from "./lib/live";

export const FEED_LIMIT = 50;

export interface Toast {
  id: string;
  title: string;
  body: string;
  tone: "critical" | "info" | "error";
}

export interface Latency {
  event_id: string;
  ms: number;
  topic: string;
}

interface State {
  connection: ConnectionState;
  /** Live feed: newest first, capped at FEED_LIMIT. */
  feed: AlertDTO[];
  summary: MetricsSummaryDTO | null;
  trend: MetricsTrendDTO | null;
  toasts: Toast[];
  /** Bumped on every alert/ack so the history table can refetch. */
  alertsVersion: number;
  /** event_id -> time the dashboard sent it (for the latency read-out). */
  sentAt: Record<string, { t: number; topic: string }>;
  lastLatency: Latency | null;
  loading: boolean;
  error: string | null;

  setConnection: (c: ConnectionState) => void;
  loadAll: () => Promise<void>;
  refreshSummary: () => Promise<void>;
  applyLive: (e: LiveEvent) => void;
  acknowledge: (id: string) => Promise<void>;
  simulate: (req: SimulateRequest) => Promise<void>;
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

let toastSeq = 0;
let summaryTimer: ReturnType<typeof setTimeout> | null = null;

/** Drop a pending debounced summary refresh (used on teardown and in tests). */
export function cancelScheduledRefresh(): void {
  if (summaryTimer) clearTimeout(summaryTimer);
  summaryTimer = null;
}

export const useStore = create<State>((set, get) => ({
  connection: "connecting",
  feed: [],
  summary: null,
  trend: null,
  toasts: [],
  alertsVersion: 0,
  sentAt: {},
  lastLatency: null,
  loading: true,
  error: null,

  setConnection: (connection) => set({ connection }),

  loadAll: async () => {
    try {
      const [list, summary, trend] = await Promise.all([api.alerts({ limit: FEED_LIMIT }), api.summary(24), api.trend(1)]);
      set({ feed: list.items, summary, trend, loading: false, error: null, alertsVersion: get().alertsVersion + 1 });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  refreshSummary: async () => {
    try {
      const [summary, trend] = await Promise.all([api.summary(24), api.trend(1)]);
      set({ summary, trend, error: null });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  applyLive: (e) => {
    const scheduleRefresh = (): void => {
      if (summaryTimer) return;
      summaryTimer = setTimeout(() => {
        summaryTimer = null;
        void get().refreshSummary();
      }, 400);
    };

    switch (e.kind) {
      case "hello":
        return;
      case "alert": {
        const alert = e.data;
        set((s) => {
          const feed = s.feed.some((a) => a.id === alert.id) ? s.feed : [alert, ...s.feed].slice(0, FEED_LIMIT);
          const sent = s.sentAt[alert.event_id];
          const rest = { ...s.sentAt };
          delete rest[alert.event_id];
          return {
            feed,
            alertsVersion: s.alertsVersion + 1,
            sentAt: rest,
            lastLatency: sent ? { event_id: alert.event_id, ms: Math.round(performance.now() - sent.t), topic: sent.topic } : s.lastLatency,
          };
        });
        if (alert.priority === "CRITICAL") {
          get().pushToast({
            tone: "critical",
            title: `CRITICAL: ${alert.event.replace("_", " ")}`,
            body: `camera ${alert.camera_id}`,
          });
        }
        scheduleRefresh();
        return;
      }
      case "metrics":
        scheduleRefresh();
        return;
      case "heartbeat": {
        const device: DeviceDTO = e.data;
        set((s) => {
          if (!s.summary) return {};
          const others = s.summary.devices.filter((d) => d.device_id !== device.device_id);
          return { summary: { ...s.summary, devices: [...others, device].sort((a, b) => a.device_id.localeCompare(b.device_id)) } };
        });
        return;
      }
      case "ack":
        set((s) => ({
          feed: s.feed.map((a) => (a.id === e.data.id ? { ...a, acknowledged: true, acknowledged_at: e.data.acknowledged_at } : a)),
          alertsVersion: s.alertsVersion + 1,
        }));
        scheduleRefresh();
        return;
    }
  },

  acknowledge: async (id) => {
    try {
      const updated = await api.ack(id);
      set((s) => ({
        feed: s.feed.map((a) => (a.id === id ? updated : a)),
        alertsVersion: s.alertsVersion + 1,
      }));
      void get().refreshSummary();
    } catch (err) {
      get().pushToast({ tone: "error", title: "Could not acknowledge", body: (err as Error).message });
    }
  },

  simulate: async (req) => {
    const t = performance.now();
    try {
      const res = await api.simulate(req);
      set((s) => {
        const sentAt = { ...s.sentAt };
        for (const p of res.published) sentAt[p.event_id] = { t, topic: p.topic };
        return { sentAt };
      });
    } catch (err) {
      get().pushToast({ tone: "error", title: "Mock event failed", body: (err as Error).message });
    }
  },

  pushToast: (t) => {
    toastSeq += 1;
    const toast: Toast = { ...t, id: `t${toastSeq}` };
    set((s) => ({ toasts: [...s.toasts, toast].slice(-4) }));
    setTimeout(() => get().dismissToast(toast.id), t.tone === "critical" ? 8000 : 5000);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
