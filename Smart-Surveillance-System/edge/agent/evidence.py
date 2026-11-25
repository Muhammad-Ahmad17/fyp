"""Uploads an evidence frame (a local file the model saved) to the platform.

The handoff keeps `image_path` as a plain string. The agent uploads the file to POST /api/evidence and
replaces `image_path` with the path the platform returns, so the dashboard can display it. Without an
upload URL (or if the upload fails) the alert is still sent, just without an image.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from pathlib import Path

log = logging.getLogger("edge.evidence")

CONTENT_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
MAX_BYTES = 5 * 1024 * 1024


class EvidenceUploader:
    def __init__(self, url: str | None, token: str | None = None, timeout: float = 5.0) -> None:
        self.url = url
        self.token = token
        self.timeout = timeout

    @property
    def enabled(self) -> bool:
        return bool(self.url)

    def upload(self, image_path: str | None) -> str | None:
        """Returns the platform image path, or None when there is nothing to upload / it failed."""
        if not self.enabled or not image_path:
            return None
        path = Path(image_path)
        ctype = CONTENT_TYPES.get(path.suffix.lower())
        if ctype is None or not path.is_file():
            log.warning("evidence not uploaded (missing or unsupported file): %s", image_path)
            return None
        data = path.read_bytes()
        if len(data) > MAX_BYTES:
            log.warning("evidence too large (%d bytes): %s", len(data), image_path)
            return None
        headers = {"content-type": ctype}
        if self.token:
            headers["x-api-key"] = self.token
        req = urllib.request.Request(self.url or "", data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as res:  # noqa: S310 - URL comes from config
                return json.loads(res.read())["image_path"]
        except (urllib.error.URLError, TimeoutError, KeyError, ValueError) as err:
            log.warning("evidence upload failed: %s", err)
            return None
