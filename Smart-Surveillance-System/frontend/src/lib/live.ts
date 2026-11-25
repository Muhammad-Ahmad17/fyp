import type { LiveEvent } from "@intellisafe/contracts";

export type ConnectionState = "connecting" | "open" | "closed";

export interface LiveOptions {
  url?: string;
  onEvent: (event: LiveEvent) => void;
  onState: (state: ConnectionState) => void;
  /** Called on every (re)connect so the app can reload data it missed while offline. */
  onReconnect?: () => void;
  WebSocketImpl?: typeof WebSocket;
  minDelayMs?: number;
  maxDelayMs?: number;
}

export function defaultWsUrl(loc: Pick<Location, "protocol" | "host"> = window.location): string {
  return `${loc.protocol === "https:" ? "wss" : "ws"}://${loc.host}/ws`;
}

/** WebSocket with automatic reconnect (exponential backoff). Returns a disconnect function. */
export function connectLive(opts: LiveOptions): () => void {
  const WS = opts.WebSocketImpl ?? WebSocket;
  const minDelay = opts.minDelayMs ?? 1000;
  const maxDelay = opts.maxDelayMs ?? 10_000;
  let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let delay = minDelay;
  let stopped = false;
  let hasConnectedBefore = false;

  const open = (): void => {
    if (stopped) return;
    opts.onState("connecting");
    const ws = new WS(opts.url ?? defaultWsUrl());
    socket = ws;
    ws.onopen = () => {
      delay = minDelay;
      opts.onState("open");
      if (hasConnectedBefore) opts.onReconnect?.();
      hasConnectedBefore = true;
    };
    ws.onmessage = (msg) => {
      try {
        opts.onEvent(JSON.parse(String(msg.data)) as LiveEvent);
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      socket = null;
      if (stopped) return;
      opts.onState("closed");
      timer = setTimeout(open, delay);
      delay = Math.min(delay * 2, maxDelay);
    };
    ws.onerror = () => ws.close();
  };

  open();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    socket?.close();
    opts.onState("closed");
  };
}
