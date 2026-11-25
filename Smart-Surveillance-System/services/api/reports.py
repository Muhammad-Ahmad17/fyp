"""PDF compliance report from stored alerts and metrics."""

from __future__ import annotations

from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from services.api import repo


def build_report_pdf(db: Any, hours: int) -> bytes:
    summary = repo.metrics_summary(db, hours)
    alerts = repo.list_alerts(db, {"limit": 40, "offset": 0})["items"]
    return render_report_pdf(summary, alerts)


def render_report_pdf(summary: dict[str, Any], alerts: list[dict[str, Any]]) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title="IntelliSafe compliance report", leftMargin=18 * mm, rightMargin=18 * mm)
    styles = getSampleStyleSheet()
    story: list[Any] = []
    hours = summary.get("window_hours", 24)
    generated = summary.get("generated_at") or ""
    story.append(Paragraph("IntelliSafe compliance report", styles["Title"]))
    story.append(Paragraph(f"Last {hours} hours · generated {generated}", styles["Normal"]))
    story.append(Spacer(1, 8 * mm))

    comp = summary.get("compliance") or {}
    score = comp.get("compliance_score")
    kpi = [
        ["Alerts", "Critical", "Unacknowledged", "Compliance"],
        [
            str(summary.get("alerts_total", 0)),
            str(summary.get("alerts_critical", 0)),
            str(summary.get("alerts_unacknowledged", 0)),
            "—" if score is None else f"{score:.1f}",
        ],
    ]
    story.append(_table(kpi, header=True))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("Alerts by event", styles["Heading2"]))
    event_rows = [["Event", "Count"]]
    for row in summary.get("by_event") or []:
        event_rows.append([str(row.get("event")), str(row.get("count"))])
    story.append(_table(event_rows, header=True))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("Recent alerts", styles["Heading2"]))
    alert_rows = [["Time", "Event", "Priority", "Camera", "Ack"]]
    if not alerts:
        alert_rows.append(["No alerts in this window", "", "", "", ""])
    for a in alerts:
        alert_rows.append(
            [
                str(a.get("timestamp") or "")[:19].replace("T", " "),
                str(a.get("event") or ""),
                str(a.get("priority") or ""),
                str(a.get("camera_id") or ""),
                "yes" if a.get("acknowledged") else "no",
            ]
        )
    story.append(_table(alert_rows, header=True))

    doc.build(story)
    return buf.getvalue()


def _table(rows: list[list[str]], header: bool = False) -> Table:
    table = Table(rows, hAlign="LEFT")
    style = [
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#94a3b8")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    if header:
        style.extend(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ]
        )
    table.setStyle(TableStyle(style))
    return table
