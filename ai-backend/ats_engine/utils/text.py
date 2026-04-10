from __future__ import annotations

from pathlib import Path
import re

import pdfplumber

try:
    from docx import Document  # type: ignore
except Exception:  # pragma: no cover
    Document = None


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def normalize_preserve_lines(text: str) -> str:
    # Keep line boundaries for section-aware parsers.
    lines = (text or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    cleaned = [re.sub(r"\s+", " ", line).strip() for line in lines]
    return "\n".join([line for line in cleaned if line])


def safe_lower(text: str) -> str:
    return normalize_whitespace(text).lower()


def extract_text_from_file(path: str | Path) -> str:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"File not found: {p}")

    suffix = p.suffix.lower()
    if suffix == ".pdf":
        chunks: list[str] = []
        with pdfplumber.open(str(p)) as pdf:
            for page in pdf.pages:
                txt = page.extract_text() or ""
                if txt.strip():
                    chunks.append(txt)
        return normalize_preserve_lines("\n".join(chunks))

    if suffix in {".txt", ".md"}:
        return normalize_preserve_lines(p.read_text(encoding="utf-8", errors="ignore"))

    if suffix == ".docx":
        if Document is None:
            raise RuntimeError("python-docx is required for .docx parsing.")
        doc = Document(str(p))
        return normalize_preserve_lines("\n".join(x.text for x in doc.paragraphs))

    raise ValueError(f"Unsupported file type: {suffix}")

