import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertDTO, DeviceDTO, MetricsSummaryDTO } from "../src/lib/contract";

vi.mock("../src/lib/api", () => ({
  api: {
    alerts: vi.fn(),
    summary: vi.fn(),
    trend: vi.fn(),
    ack: vi.fn(),
    simulate: vi.fn(),
    alarm: vi.fn(),
    silenceAlarm: vi.fn(),
    clearAlarm: vi.fn(),
  },
}));

import { api } from "../src/lib/api";
import { FEED_LIMIT, cancelScheduledRefresh, useStore } from "../src/store";

const mocked = api as unknown as Record<
  "alerts" | "summary" | "trend" | "ack" | "simulate" | "alarm" | "silenceAlarm" | "clearAlarm",
  ReturnType<typeof vi.fn>
>;

const alert = (n: number, over: Partial<AlertDTO> = {}): AlertDTO => ({
  id: `id-${n}`,
  event_id: `ev-${n}`,
  timestamp: "2026-10-28T12:00:00.000Z",
  received_at: "2026-10-28T12:00:00.100Z",
  source: "simulator",
  device_id: "jetson-01",
  camera_id: "cam-1",
  session_id: "s",
  event: "helmet_missing",
  priority: "HIGH",
  worker_id: 3,
  confidence: 0.9,
  compliance_score: 70,
  frame: { width: 1280, height: 720 },
  detections: [],
  image_path: null,
  acknowledged: false,
  acknowledged_at: null,
  ...over,
});

const summary = (over: Partial<MetricsSummaryDTO> = {}): MetricsSummaryDTO => ({
  window_hours: 24,
  generated_at: "2026-10-28T12:00:00.000Z",
  alerts_total: 1,
  alerts_critical: 0,
  alerts_unacknowledged: 1,
  compliance: { compliance_score: 88, worker_count: null, violation_count: null, last_metrics_at: null },
  by_event: [],
  by_priority: [],
  devices: [],
  ...over,
});

const initial = useStore.getState();

beforeEach(() => {
  cancelScheduledRefresh();
  vi.useRealTimers();
  useStore.setState({ ...initial, feed: [], summary: null, trend: null, toasts: [], sentAt: {}, lastLatency: null, alertsVersion: 0, error: null, loading: true }, true);
  Object.values(mocked).forEach((m) => m.mockReset());
  mocked.summary.mockResolvedValue(summary());
  mocked.trend.mockResolvedValue({ window_hours: 1, bucket: "minute", points: [] });
  mocked.alarm.mockResolvedValue({
    state: "idle",
    reason: null,
    camera_id: null,
    event_id: null,
    unit: "virtual",
    updated_at: "2026-10-28T12:00:00.000Z",
  });
});

describe("loadAll", () => {
  it("loads feed, summary and trend", async () => {
    mocked.alerts.mockResolvedValue({ items: [alert(1), alert(2)], total: 2, limit: 50, offset: 0 });
    await useStore.getState().loadAll();
    const s = useStore.getState();
    expect(s.feed.map((a) => a.id)).toEqual(["id-1", "id-2"]);
    expect(s.summary?.compliance.compliance_score).toBe(88);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
    expect(mocked.alerts).toHaveBeenCalledWith({ limit: FEED_LIMIT });
  });

  it("records an error when the API is unreachable", async () => {
    mocked.alerts.mockRejectedValue(new Error("boom"));
    await useStore.getState().loadAll();
    expect(useStore.getState()).toMatchObject({ error: "boom", loading: false });
  });
});

describe("applyLive", () => {
  it("prepends alerts, ignores duplicates, caps the feed", () => {
    const { applyLive } = useStore.getState();
    applyLive({ kind: "alert", data: alert(1) });
    applyLive({ kind: "alert", data: alert(1) });
    expect(useStore.getState().feed).toHaveLength(1);
    for (let i = 2; i < FEED_LIMIT + 10; i += 1) applyLive({ kind: "alert", data: alert(i) });
    const feed = useStore.getState().feed;
    expect(feed).toHaveLength(FEED_LIMIT);
    expect(feed[0]?.id).toBe(`id-${FEED_LIMIT + 9}`);
  });

  it("raises a toast only for CRITICAL alerts", () => {
    const { applyLive } = useStore.getState();
    applyLive({ kind: "alert", data: alert(1, { priority: "HIGH" }) });
    expect(useStore.getState().toasts).toHaveLength(0);
    applyLive({ kind: "alert", data: alert(2, { priority: "CRITICAL", event: "fire", worker_id: null }) });
    const toasts = useStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ tone: "critical" });
    expect(toasts[0]?.title).toContain("fire");
  });

  it("marks an alert acknowledged on an ack event", () => {
    const { applyLive } = useStore.getState();
    applyLive({ kind: "alert", data: alert(1) });
    applyLive({ kind: "ack", data: { id: "id-1", acknowledged_at: "2026-10-28T12:01:00.000Z" } });
    expect(useStore.getState().feed[0]).toMatchObject({ acknowledged: true, acknowledged_at: "2026-10-28T12:01:00.000Z" });
  });

  it("updates the device list from heartbeats", () => {
    useStore.setState({ summary: summary({ devices: [] }) });
    const dev = (id: string, status: DeviceDTO["status"]): DeviceDTO => ({
      device_id: id,
      status,
      source: "simulator",
      session_id: "s",
      uptime_sec: 1,
      fps: 10,
      last_seen: "2026-10-28T12:00:00.000Z",
    });
    const { applyLive } = useStore.getState();
    applyLive({ kind: "heartbeat", data: dev("b", "online") });
    applyLive({ kind: "heartbeat", data: dev("a", "online") });
    applyLive({ kind: "heartbeat", data: dev("a", "offline") });
    expect(useStore.getState().summary?.devices.map((d) => `${d.device_id}:${d.status}`)).toEqual(["a:offline", "b:online"]);
  });

  it("debounces summary refreshes after live events", async () => {
    vi.useFakeTimers();
    const { applyLive } = useStore.getState();
    applyLive({ kind: "alert", data: alert(1) });
    applyLive({ kind: "metrics", data: { event_id: "m", timestamp: "t", source: "simulator", device_id: "d", session_id: "s", compliance_score: 90, worker_count: 1, violation_count: 0 } });
    applyLive({ kind: "ack", data: { id: "id-1", acknowledged_at: "t" } });
    expect(mocked.summary).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(mocked.summary).toHaveBeenCalledTimes(1);
  });
});

describe("actions", () => {
  it("acknowledge replaces the alert with the server copy", async () => {
    useStore.setState({ feed: [alert(1)] });
    mocked.ack.mockResolvedValue(alert(1, { acknowledged: true, acknowledged_at: "2026-10-28T12:02:00.000Z" }));
    await useStore.getState().acknowledge("id-1");
    expect(useStore.getState().feed[0]?.acknowledged).toBe(true);
  });

  it("acknowledge failure shows an error toast", async () => {
    useStore.setState({ feed: [alert(1)] });
    mocked.ack.mockRejectedValue(new Error("nope"));
    await useStore.getState().acknowledge("id-1");
    expect(useStore.getState().toasts[0]).toMatchObject({ tone: "error", body: "nope" });
    expect(useStore.getState().feed[0]?.acknowledged).toBe(false);
  });

  it("simulate records the send time and the live arrival reports the round trip", async () => {
    mocked.simulate.mockResolvedValue({ published: [{ event_id: "ev-9", type: "alert", topic: "ppe/alerts/general/HIGH" }] });
    await useStore.getState().simulate({ type: "alert" });
    expect(useStore.getState().sentAt["ev-9"]).toBeDefined();
    useStore.getState().applyLive({ kind: "alert", data: alert(9) });
    const s = useStore.getState();
    expect(s.sentAt["ev-9"]).toBeUndefined();
    expect(s.lastLatency).toMatchObject({ event_id: "ev-9", topic: "ppe/alerts/general/HIGH" });
    expect(s.lastLatency?.ms).toBeGreaterThanOrEqual(0);
  });

  it("simulate failure shows an error toast", async () => {
    mocked.simulate.mockRejectedValue(new Error("MQTT broker is not connected"));
    await useStore.getState().simulate({});
    expect(useStore.getState().toasts[0]).toMatchObject({ tone: "error", title: "Mock event failed" });
  });

  it("toasts can be dismissed", () => {
    useStore.getState().pushToast({ tone: "info", title: "a", body: "b" });
    const id = useStore.getState().toasts[0]?.id as string;
    useStore.getState().dismissToast(id);
    expect(useStore.getState().toasts).toHaveLength(0);
  });
});
