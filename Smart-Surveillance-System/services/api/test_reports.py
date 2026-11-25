from services.api.reports import render_report_pdf


def test_empty_report_is_pdf() -> None:
    pdf = render_report_pdf(
        {
            "window_hours": 24,
            "generated_at": "2026-11-24T00:00:00.000Z",
            "alerts_total": 0,
            "alerts_critical": 0,
            "alerts_unacknowledged": 0,
            "compliance": {"compliance_score": None},
            "by_event": [{"event": "fire", "count": 0}],
        },
        [],
    )
    assert pdf.startswith(b"%PDF")
    assert b"IntelliSafe" in pdf


def test_report_includes_alert_rows() -> None:
    pdf = render_report_pdf(
        {
            "window_hours": 24,
            "generated_at": "2026-11-24T00:00:00.000Z",
            "alerts_total": 1,
            "alerts_critical": 1,
            "alerts_unacknowledged": 1,
            "compliance": {"compliance_score": 81.5},
            "by_event": [{"event": "fire", "count": 1}],
        },
        [
            {
                "timestamp": "2026-11-24T09:00:00.000Z",
                "event": "fire",
                "priority": "CRITICAL",
                "camera_id": "cam-01",
                "acknowledged": False,
            }
        ],
    )
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 500
