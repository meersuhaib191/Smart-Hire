from __future__ import annotations

from pathlib import Path
from typing import Optional
import re

try:
    from docx import Document  # type: ignore
except Exception:  # pragma: no cover
    Document = None


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def extract_text_from_pdf(path: Path) -> str:
    try:
        import pdfplumber  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("pdfplumber is not installed. Install it to parse PDF resumes.") from exc

    text_parts: list[str] = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                text_parts.append(page_text)
    return _normalize_whitespace("\n".join(text_parts))


def extract_text_from_docx(path: Path) -> str:
    if Document is None:
        raise RuntimeError("python-docx is not installed. Install it to parse .docx files.")
    doc = Document(str(path))
    text = "\n".join(p.text for p in doc.paragraphs)
    return _normalize_whitespace(text)


def extract_resume_text(path: str | Path) -> str:
    resume_path = Path(path)
    if not resume_path.exists():
        raise FileNotFoundError(f"Resume file does not exist: {resume_path}")

    suffix = resume_path.suffix.lower()
    if suffix == ".pdf":
        text = extract_text_from_pdf(resume_path)
    elif suffix in {".txt", ".md"}:
        text = _normalize_whitespace(resume_path.read_text(encoding="utf-8", errors="ignore"))
    elif suffix == ".docx":
        text = extract_text_from_docx(resume_path)
    else:
        raise ValueError(f"Unsupported resume format: {suffix}. Use pdf/txt/md/docx.")

    if not text:
        raise ValueError("Could not extract meaningful text from the resume.")
    return text


def load_job_description(job_description_path: Optional[str], job_description_text: Optional[str]) -> str:
    if job_description_text and job_description_text.strip():
        return _normalize_whitespace(job_description_text)
    if job_description_path:
        p = Path(job_description_path)
        if not p.exists():
            raise FileNotFoundError(f"Job description file does not exist: {p}")
        return _normalize_whitespace(p.read_text(encoding="utf-8", errors="ignore"))
    raise ValueError("Provide either job_description_text or job_description_path.")

