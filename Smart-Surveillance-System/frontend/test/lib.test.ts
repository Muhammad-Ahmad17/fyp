import { describe, expect, it, vi } from "vitest";
import { buildQuery, evidenceUrl } from "../src/lib/api";
import { clockTime, formatUptime, relativeTime, scoreColor } from "../src/lib/format";
import { connectLive, defaultWsUrl, type ConnectionState } from "../src/lib/live";

describe("format helpers", () => {
  it("relativeTime", () => {
    const now = Date.parse("2026-10-28T12:00:00.000Z");
    const ago = (s: number) => new Date(now - s * 1000).toISOString();
    expect(relativeTime(ago(1), now)).toBe("just now");
    expect(relativeTime(ago(30), now)).toBe("30s ago");
    expect(relativeTime(ago(125), now)).toBe("2m ago");
    expect(relativeTime(ago(7200), now)).toBe("2h ago");
    expect(relativeTime(ago(172800), now)).toBe("2d ago");
    expect(relativeTime(new Date(now + 5000).toISOString(), now)).toBe("just now");
  });

  it("scoreColor thresholds", () => {
    expect(scoreColor(95)).toBe("#34d399");
    expect(scoreColor(90)).toBe("#34d399");
    expect(scoreColor(80)).toBe("#fbbf24");
    expect(scoreColor(40)).toBe("#f87171");
    expect(scoreColor(null)).toBe("#64748b");
  });

  it("formatUptime", () => {
    expect(formatUptime(45)).toBe("45s");
    expect(formatUptime(125)).toBe("2m 5s");
    expect(formatUptime(3700)).toBe("1h 1m");
  });

  it("clockTime returns a time string", () => {
    expect(clockTime("2026-10-28T12:00:00.000Z")).toMatch(/\d/);
  });
});

describe("api helpers", () => {
  it("buildQuery skips empty values", () => {
    expect(buildQuery({})).toBe("");
    expect(buildQuery({ priority: "HIGH", event: undefined, limit: 15, offset: 0 })).toBe("?priority=HIGH&limit=15&offset=0");
    expect(buildQuery({ acknowledged: "false" })).toBe("?acknowledged=false");
  });

  it("evidenceUrl", () => {
    expect(evidenceUrl(null)).toBeNull();
    expect(evidenceUrl("samples/sample_fire.png")).toBe("/api/evidence/samples/sample_fire.png");
    expect(evidenceUrl("/samples/a.png")).toBe("/api/evidence/samples/a.png");
  });
});

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  close(): void {
    this.closed = true;
    this.onclose?.();
  }
}

describe("connectLive", () => {
  it("builds the websocket url from the page location", () => {
    expect(defaultWsUrl({ protocol: "http:", host: "localhost:5173" })).toBe("ws://localhost:5173/ws");
    expect(defaultWsUrl({ protocol: "https:", host: "x.example" })).toBe("wss://x.example/ws");
  });

  it("delivers events, reconnects with backoff and signals reconnect", () => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    const states: ConnectionState[] = [];
    const events: unknown[] = [];
    const onReconnect = vi.fn();
    const stop = connectLive({
      url: "ws://test/ws",
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
      onState: (s) => states.push(s),
      onEvent: (e) => events.push(e),
      onReconnect,
      minDelayMs: 100,
      maxDelayMs: 400,
    });

    const first = FakeSocket.instances[0] as FakeSocket;
    first.onopen?.();
    expect(onReconnect).not.toHaveBeenCalled(); // first connect is not a "re"connect
    first.onmessage?.({ data: JSON.stringify({ kind: "hello", server_time: "t" }) });
    first.onmessage?.({ data: "not json" }); // ignored
    expect(events).toEqual([{ kind: "hello", server_time: "t" }]);

    first.onclose?.(); // server went away
    expect(states.slice(-1)[0]).toBe("closed");
    vi.advanceTimersByTime(99);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(2);

    const second = FakeSocket.instances[1] as FakeSocket;
    second.onclose?.(); // fails again: delay doubles to 200
    vi.advanceTimersByTime(199);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(3);

    const third = FakeSocket.instances[2] as FakeSocket;
    third.onopen?.();
    expect(onReconnect).toHaveBeenCalledTimes(1);

    stop();
    expect(third.closed).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(FakeSocket.instances).toHaveLength(3); // no more reconnects after stop
    vi.useRealTimers();
  });
});
