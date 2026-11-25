import type {
  AlarmDTO,
  AlertDTO,
  AlertListDTO,
  AlertQuery,
  DeviceDTO,
  MetricsSummaryDTO,
  MetricsTrendDTO,
  SimulateRequest,
} from "./contract";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export type AlertFilters = Partial<Pick<AlertQuery, "priority" | "event" | "source" | "acknowledged" | "limit" | "offset">>;

export function buildQuery(filters: AlertFilters): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && (v as unknown) !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const api = {
  alerts: (filters: AlertFilters = {}) => http<AlertListDTO>(`/api/alerts${buildQuery(filters)}`),
  summary: (hours = 24) => http<MetricsSummaryDTO>(`/api/metrics/summary?hours=${hours}`),
  trend: (hours = 1) => http<MetricsTrendDTO>(`/api/metrics/trend?hours=${hours}`),
  devices: () => http<DeviceDTO[]>("/api/devices"),
  ack: (id: string) => http<AlertDTO>(`/api/alerts/${id}/ack`, { method: "POST" }),
  simulate: (body: SimulateRequest) =>
    http<{ published: { event_id: string; type: string; topic: string }[] }>("/api/simulate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  alarm: () => http<AlarmDTO>("/api/alarm"),
  silenceAlarm: () => http<AlarmDTO>("/api/alarm/silence", { method: "POST" }),
  clearAlarm: () => http<AlarmDTO>("/api/alarm/clear", { method: "POST" }),
  reportUrl: (hours = 24) => `/api/reports?hours=${hours}`,
};

export const evidenceUrl = (imagePath: string | null): string | null =>
  imagePath ? `/api/evidence/${imagePath.replace(/^\/+/, "")}` : null;
