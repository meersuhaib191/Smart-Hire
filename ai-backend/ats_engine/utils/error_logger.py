from __future__ import annotations

import json
from pathlib import Path

from ..models.schemas import ErrorLogRecord


LOG_PATH = Path(__file__).resolve().parent / "error_logs.jsonl"


def log_error_record(record: ErrorLogRecord) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record.model_dump(), ensure_ascii=True) + "\n")

