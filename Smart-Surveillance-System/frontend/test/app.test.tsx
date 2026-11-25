import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertDTO } from "@intellisafe/contracts";
import App from "../src/App";

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  close(): void {
    this.onclose?.();
  }
}

const criticalAlert: AlertDTO = {
  id: "a-1",
  event_id: "e-1",
  timestamp: new Date().toISOString(),
  received_at: new Date().toISOString(),
  source: "simulator",
  device_id: "jetson-01",
  camera_id: "cam-2",
  session_id: "s",
  event: "fire",
  priority: "CRITICAL",
  worker_id: null,
  confidence: 0.97,
  compliance_score: 40,
  frame: { width: 1280, height: 720 },
  detections: [],
  image_path: "samples/sample_fire.png",
  acknowledged: false,
  acknowledged_at: null,
};

const summary = {
  window_hours: 24,
  generated_at: new Date().toISOString(),
  alerts_total: 0,
  alerts_critical: 0,
  alerts_unacknowledged: 0,
  compliance: { compliance_score: null, worker_count: null, violation_count: null, last_metrics_at: null },
  by_event: [],
  by_priority: [],
  devices: [],
};

beforeEach(() => {
  FakeSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = url.startsWith("/api/alerts")
        ? { items: [], total: 0, limit: 50, offset: 0 }
        : url.startsWith("/api/metrics/summary")
          ? summary
          : url.startsWith("/api/metrics/trend")
            ? { window_hours: 1, bucket: "minute", points: [] }
            : [];
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("<App />", () => {
  it("renders, connects the websocket, and shows a live CRITICAL alert with a toast", async () => {
    render(<App />);
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    const socket = FakeSocket.instances[0] as FakeSocket;
    act(() => {
      socket.onopen?.();
      socket.onmessage?.({ data: JSON.stringify({ kind: "alert", data: criticalAlert }) });
    });
    await waitFor(() => expect(screen.getAllByText(/fire/i).length).toBeGreaterThan(1));
    expect(screen.getAllByText(/cam-2/i).length).toBeGreaterThan(0);
  });

  it("shows an error banner when the API is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500, statusText: "Server Error" })));
    render(<App />);
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});
