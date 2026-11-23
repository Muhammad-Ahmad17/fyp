import type { AlertEvent, Priority } from "@intellisafe/contracts";

export const EVENT_LABEL: Record<AlertEvent, string> = {
  helmet_missing: "Helmet missing",
  vest_missing: "Vest missing",
  fire: "Fire",
  smoke: "Smoke",
};

export const PRIORITY_STYLE: Record<Priority, { badge: string; dot: string; text: string }> = {
  CRITICAL: { badge: "bg-red-500/15 text-red-300 ring-red-500/40", dot: "bg-red-500", text: "text-red-400" },
  HIGH: { badge: "bg-orange-500/15 text-orange-300 ring-orange-500/40", dot: "bg-orange-500", text: "text-orange-400" },
  MEDIUM: { badge: "bg-yellow-500/15 text-yellow-300 ring-yellow-500/40", dot: "bg-yellow-500", text: "text-yellow-400" },
  LOW: { badge: "bg-sky-500/15 text-sky-300 ring-sky-500/40", dot: "bg-sky-500", text: "text-sky-400" },
};

export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** green >= 90, amber >= 75, red below */
export function scoreColor(score: number | null): string {
  if (score === null) return "#64748b";
  if (score >= 90) return "#34d399";
  if (score >= 75) return "#fbbf24";
  return "#f87171";
}

export function formatUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec % 60}s`;
  return `${sec}s`;
}
