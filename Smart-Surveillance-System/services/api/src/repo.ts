import { and, count, desc, eq, gte, lt, lte, or, sql, type SQL } from "drizzle-orm";
import {
  PRIORITIES,
  ALERT_EVENTS,
  type AlertDTO,
  type AlertEvent,
  type AlertListDTO,
  type AlertMessage,
  type AlertQuery,
  type DeviceDTO,
  type HeartbeatMessage,
  type MetricsMessage,
  type MetricsPointDTO,
  type MetricsSummaryDTO,
  type MetricsTrendDTO,
  type Priority,
  type Source,
  type DeviceStatus,
} from "@intellisafe/contracts";
import { schema, type Db } from "./db";
import type { DeviceRow, MetricsRow, ViolationRow } from "./db/schema";

const { violations, complianceMetrics, devices } = schema;

/* ------------------------------------------------------------------ */
/* Row -> DTO                                                          */
/* ------------------------------------------------------------------ */

export function toAlertDTO(r: ViolationRow): AlertDTO {
  return {
    id: r.id,
    event_id: r.eventId,
    timestamp: r.timestamp.toISOString(),
    received_at: r.receivedAt.toISOString(),
    source: r.source as Source,
    device_id: r.deviceId,
    camera_id: r.cameraId,
    session_id: r.sessionId,
    event: r.eventType as AlertEvent,
    priority: r.priority as Priority,
    worker_id: r.workerId,
    confidence: r.confidence,
    compliance_score: r.complianceScore,
    frame: { width: r.frameWidth, height: r.frameHeight },
    detections: r.detections,
    image_path: r.imagePath,
    acknowledged: r.acknowledged,
    acknowledged_at: r.acknowledgedAt ? r.acknowledgedAt.toISOString() : null,
  };
}

export function toMetricsDTO(r: MetricsRow): MetricsPointDTO {
  return {
    event_id: r.eventId,
    timestamp: r.time.toISOString(),
    source: r.source as Source,
    device_id: r.deviceId,
    session_id: r.sessionId,
    compliance_score: r.score,
    worker_count: r.workerCount,
    violation_count: r.violationCount,
  };
}

export function toDeviceDTO(r: DeviceRow): DeviceDTO {
  return {
    device_id: r.deviceId,
    status: r.status as DeviceStatus,
    source: r.source as Source,
    session_id: r.sessionId,
    uptime_sec: r.uptimeSec,
    fps: r.fps,
    last_seen: r.lastSeen.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Writes (idempotent on event_id)                                     */
/* ------------------------------------------------------------------ */

/** Returns the inserted row, or null when the event_id was already stored. */
export async function insertAlert(db: Db, m: AlertMessage, receivedAt = new Date()): Promise<ViolationRow | null> {
  const rows = await db
    .insert(violations)
    .values({
      eventId: m.event_id,
      timestamp: new Date(m.timestamp),
      receivedAt,
      source: m.source,
      deviceId: m.device_id,
      cameraId: m.camera_id,
      sessionId: m.session_id,
      eventType: m.event,
      priority: m.priority,
      workerId: m.worker_id,
      confidence: m.confidence,
      complianceScore: m.compliance_score,
      frameWidth: m.frame.width,
      frameHeight: m.frame.height,
      detections: m.detections,
      imagePath: m.image_path,
    })
    .onConflictDoNothing({ target: violations.eventId })
    .returning();
  return rows[0] ?? null;
}

export async function insertMetrics(db: Db, m: MetricsMessage, receivedAt = new Date()): Promise<MetricsRow | null> {
  const rows = await db
    .insert(complianceMetrics)
    .values({
      eventId: m.event_id,
      time: new Date(m.timestamp),
      receivedAt,
      source: m.source,
      deviceId: m.device_id,
      sessionId: m.session_id,
      score: m.compliance_score,
      workerCount: m.worker_count,
      violationCount: m.violation_count,
    })
    .onConflictDoNothing({ target: complianceMetrics.eventId })
    .returning();
  return rows[0] ?? null;
}

/**
 * Upsert the latest device state. A heartbeat older than what we already have
 * (e.g. a retained message replayed after a restart) is ignored: returns null.
 *
 * Exception: an `offline` heartbeat is the broker's last-will, whose payload was
 * created when the device connected (so it is "older" than the heartbeats that
 * followed). It still applies to the SAME session, and leaves last_seen untouched
 * (last_seen = last time the device was heard alive).
 */
export async function upsertDevice(db: Db, m: HeartbeatMessage): Promise<DeviceRow | null> {
  const ts = new Date(m.timestamp);
  const offline = m.status === "offline";
  const values = {
    deviceId: m.device_id,
    status: m.status,
    source: m.source,
    sessionId: m.session_id,
    uptimeSec: m.uptime_sec,
    fps: m.fps,
    lastSeen: ts,
    lastEventId: m.event_id,
  };
  const { lastSeen: _keep, ...withoutLastSeen } = values;
  const rows = await db
    .insert(devices)
    .values(values)
    .onConflictDoUpdate({
      target: devices.deviceId,
      set: offline ? withoutLastSeen : values,
      setWhere: offline ? or(lt(devices.lastSeen, ts), eq(devices.sessionId, m.session_id)) : lt(devices.lastSeen, ts),
    })
    .returning();
  return rows[0] ?? null;
}

export async function acknowledgeAlert(db: Db, id: string, now = new Date()): Promise<{ alert: AlertDTO; changed: boolean } | null> {
  const updated = await db
    .update(violations)
    .set({ acknowledged: true, acknowledgedAt: now })
    .where(and(eq(violations.id, id), eq(violations.acknowledged, false)))
    .returning();
  if (updated[0]) return { alert: toAlertDTO(updated[0]), changed: true };
  const existing = await getAlert(db, id);
  return existing ? { alert: existing, changed: false } : null;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export async function getAlert(db: Db, id: string): Promise<AlertDTO | null> {
  const rows = await db.select().from(violations).where(eq(violations.id, id)).limit(1);
  return rows[0] ? toAlertDTO(rows[0]) : null;
}

export async function listAlerts(db: Db, q: AlertQuery): Promise<AlertListDTO> {
  const conds: SQL[] = [];
  if (q.priority) conds.push(eq(violations.priority, q.priority));
  if (q.event) conds.push(eq(violations.eventType, q.event));
  if (q.source) conds.push(eq(violations.source, q.source));
  if (q.acknowledged) conds.push(eq(violations.acknowledged, q.acknowledged === "true"));
  if (q.from) conds.push(gte(violations.timestamp, new Date(q.from)));
  if (q.to) conds.push(lte(violations.timestamp, new Date(q.to)));
  const where = conds.length ? and(...conds) : undefined;

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(violations)
      .where(where)
      .orderBy(desc(violations.timestamp), desc(violations.id))
      .limit(q.limit)
      .offset(q.offset),
    db.select({ total: count() }).from(violations).where(where),
  ]);
  return { items: rows.map(toAlertDTO), total: Number(totals[0]?.total ?? 0), limit: q.limit, offset: q.offset };
}

export async function listDevices(db: Db): Promise<DeviceDTO[]> {
  const rows = await db.select().from(devices).orderBy(devices.deviceId);
  return rows.map(toDeviceDTO);
}

export async function metricsSummary(db: Db, hours: number, now = new Date()): Promise<MetricsSummaryDTO> {
  const since = new Date(now.getTime() - hours * 3_600_000);
  const inWindow = gte(violations.timestamp, since);

  const [totals, byEvent, byPriority, latest, deviceList] = await Promise.all([
    db
      .select({
        total: count(),
        critical: sql<number>`count(*) filter (where ${violations.priority} = 'CRITICAL')`.mapWith(Number),
        unack: sql<number>`count(*) filter (where ${violations.acknowledged} = false)`.mapWith(Number),
      })
      .from(violations)
      .where(inWindow),
    db.select({ event: violations.eventType, n: count() }).from(violations).where(inWindow).groupBy(violations.eventType),
    db.select({ priority: violations.priority, n: count() }).from(violations).where(inWindow).groupBy(violations.priority),
    db.select().from(complianceMetrics).orderBy(desc(complianceMetrics.time)).limit(1),
    listDevices(db),
  ]);

  const m = latest[0];
  const eventCounts = new Map(byEvent.map((r) => [r.event, Number(r.n)]));
  const priorityCounts = new Map(byPriority.map((r) => [r.priority, Number(r.n)]));

  return {
    window_hours: hours,
    generated_at: now.toISOString(),
    alerts_total: Number(totals[0]?.total ?? 0),
    alerts_critical: Number(totals[0]?.critical ?? 0),
    alerts_unacknowledged: Number(totals[0]?.unack ?? 0),
    compliance: {
      compliance_score: m ? m.score : null,
      worker_count: m ? m.workerCount : null,
      violation_count: m ? m.violationCount : null,
      last_metrics_at: m ? m.time.toISOString() : null,
    },
    by_event: ALERT_EVENTS.map((event) => ({ event, count: eventCounts.get(event) ?? 0 })),
    by_priority: PRIORITIES.map((priority) => ({ priority, count: priorityCounts.get(priority) ?? 0 })),
    devices: deviceList,
  };
}

export async function metricsTrend(
  db: Db,
  hours: number,
  bucket: "minute" | "hour",
  now = new Date(),
): Promise<MetricsTrendDTO> {
  const since = new Date(now.getTime() - hours * 3_600_000);
  // `bucket` is validated against a fixed enum before it reaches this point.
  const bucketExpr = sql`date_trunc(${sql.raw(`'${bucket === "hour" ? "hour" : "minute"}'`)}, ${complianceMetrics.time})`;
  const rows = await db
    .select({
      bucket: sql<Date | string>`${bucketExpr}`.as("bucket"),
      score: sql<number>`avg(${complianceMetrics.score})`.mapWith(Number).as("score"),
    })
    .from(complianceMetrics)
    .where(gte(complianceMetrics.time, since))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  return {
    window_hours: hours,
    bucket,
    points: rows.map((r) => ({
      bucket: new Date(r.bucket).toISOString(),
      compliance_score: Math.round(r.score * 10) / 10,
    })),
  };
}
