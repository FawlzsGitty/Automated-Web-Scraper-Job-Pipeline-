"""
Best-effort resume parser for PDF files.

Strategy:
  1. Extract all text with pdfplumber (handles multi-column layouts better than pypdf).
  2. Split into sections by detecting common resume section headers.
  3. Apply section-specific parsers for experience, education, skills, and summary.

All parsing is heuristic — the output conforms to the resume schema but may be
incomplete for unusual formats. Callers receive a warnings list alongside the data
so the UI can prompt the user to review what was parsed.
"""

from __future__ import annotations

import io
import re
from typing import Optional

import pdfplumber


# ── Regexes ───────────────────────────────────────────────────────────────────

# Matches common section headers that appear alone on a line (with optional colon)
_SECTION_HEADER = re.compile(
    r"^[ \t]*"
    r"(SUMMARY|OBJECTIVE|PROFESSIONAL SUMMARY|PROFILE|ABOUT(?: ME)?|"
    r"EXPERIENCE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EMPLOYMENT(?: HISTORY)?|"
    r"WORK HISTORY|CAREER(?: HISTORY)?|"
    r"EDUCATION|ACADEMIC(?: BACKGROUND| HISTORY)?|"
    r"SKILLS|TECHNICAL SKILLS|CORE COMPETENCIES|TECHNOLOGIES|KEY SKILLS|COMPETENCIES|"
    r"CERTIFICATIONS?|PROJECTS?|AWARDS?|ACHIEVEMENTS?|PUBLICATIONS?)"
    r"[ \t]*:?[ \t]*$",
    re.IGNORECASE | re.MULTILINE,
)

# "Jan 2020 – Mar 2022" / "2019 - Present" / "2018–2021"
_DATE_RANGE = re.compile(
    r"((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?"
    r"|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\.?\s+\d{4}|\d{4})"
    r"\s*[-–—]\s*"
    r"((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?"
    r"|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\.?\s+\d{4}|\d{4}|[Pp]resent|[Cc]urrent|[Nn]ow)",
    re.IGNORECASE,
)

_GRAD_YEAR = re.compile(r"\b((?:19|20)\d{2})\b")


# ── Text extraction ───────────────────────────────────────────────────────────

def _extract_text(pdf_bytes: bytes) -> str:
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        pages = []
        for page in pdf.pages:
            text = page.extract_text(x_tolerance=2, y_tolerance=2)
            if text:
                pages.append(text)
    return "\n".join(pages)


# ── Section splitter ──────────────────────────────────────────────────────────

def _split_sections(text: str) -> dict[str, str]:
    """Return {CANONICAL_HEADER: body_text, ...}. Pre-header content is stored as '_header'."""
    matches = list(_SECTION_HEADER.finditer(text))
    if not matches:
        return {"_body": text}

    sections: dict[str, str] = {}
    if matches[0].start() > 0:
        sections["_header"] = text[: matches[0].start()].strip()

    for i, match in enumerate(matches):
        key = match.group(1).upper()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        sections[key] = text[start:end].strip()

    return sections


def _first_matching(sections: dict[str, str], *prefixes: str) -> str:
    """Return the body of the first section whose key starts with any prefix."""
    for key, body in sections.items():
        for prefix in prefixes:
            if key.startswith(prefix):
                return body
    return ""


# ── Section parsers ───────────────────────────────────────────────────────────

def _parse_skills(text: str) -> list[str]:
    if not text.strip():
        return []
    raw = re.split(r"[,•·▪▸|;\n]+", text)
    return [
        item.strip(" \t-–—")
        for item in raw
        if item.strip(" \t-–—") and len(item.strip()) < 80
    ]


def _parse_experience(text: str) -> list[dict]:
    """
    Split the experience section on date-range anchors.
    Lines immediately before each date range are treated as title / company.
    Lines after (until the next date range) are the description.
    """
    if not text.strip():
        return []

    ranges = list(_DATE_RANGE.finditer(text))
    if not ranges:
        # No dates — return the whole section as a single entry
        lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
        if not lines:
            return []
        return [{
            "title":       lines[0],
            "company":     lines[1] if len(lines) > 1 else "",
            "startDate":   "",
            "description": "\n".join(lines[2:]),
        }]

    entries: list[dict] = []
    for i, rng in enumerate(ranges):
        # Lines before the date range = company/title
        block_start = ranges[i - 1].end() if i > 0 else 0
        pre_lines = [
            l.strip()
            for l in text[block_start : rng.start()].strip().splitlines()
            if l.strip()
        ]

        # Text after date range until next = description
        post_end = ranges[i + 1].start() if i + 1 < len(ranges) else len(text)
        description = text[rng.end() : post_end].strip()

        start_date = rng.group(1).strip()
        raw_end    = rng.group(2).strip()
        end_date   = "Present" if raw_end.lower() in ("present", "current", "now") else raw_end

        title   = pre_lines[-1] if pre_lines else ""
        company = pre_lines[-2] if len(pre_lines) >= 2 else (pre_lines[0] if pre_lines else "")

        # Swap heuristic: the longer string is usually the company name
        if title and company and len(company) > len(title) * 1.6:
            title, company = company, title

        entry: dict = {
            "title":     title,
            "company":   company,
            "startDate": start_date,
            "endDate":   end_date,
        }
        if description:
            entry["description"] = description

        entries.append(entry)

    return entries


def _parse_education(text: str) -> list[dict]:
    if not text.strip():
        return []

    entries: list[dict] = []
    # Split on double newlines — each block is typically one institution
    blocks = re.split(r"\n{2,}", text.strip())

    for block in blocks:
        lines = [l.strip() for l in block.splitlines() if l.strip()]
        if not lines:
            continue

        year_match = _GRAD_YEAR.search(block)
        grad_year: Optional[int] = int(year_match.group(1)) if year_match else None

        institution = lines[0]
        degree      = lines[1] if len(lines) > 1 else ""

        field: Optional[str] = None
        field_match = re.search(r"\bin\s+([A-Za-z &]+)", degree, re.IGNORECASE)
        if field_match:
            field = field_match.group(1).strip()

        entry: dict = {"institution": institution, "degree": degree}
        if field:
            entry["field"] = field
        if grad_year:
            entry["graduationYear"] = grad_year

        entries.append(entry)

    return entries


# ── Public API ─────────────────────────────────────────────────────────────────

def parse_resume_from_pdf(pdf_bytes: bytes) -> tuple[dict, list[str]]:
    """
    Parse a PDF resume into the resume schema dict.

    Returns:
        (resume_dict, warnings)
        resume_dict: { summary, experience, education, skills }
        warnings:    advisory messages for the user (non-fatal)

    Raises:
        ValueError if the PDF yields no extractable text (e.g. image-only scan).
    """
    text = _extract_text(pdf_bytes)
    if not text.strip():
        raise ValueError(
            "No text could be extracted from this PDF. "
            "If it is a scanned image, please convert it to a text-based PDF first."
        )

    sections = _split_sections(text)
    warnings: list[str] = []

    # ── Summary ──────────────────────────────────────────────────────────────
    summary = _first_matching(sections, "SUMMARY", "OBJECTIVE", "PROFILE", "ABOUT")
    if not summary:
        summary = sections.get("_header", "") or sections.get("_body", "")[:600]
        warnings.append(
            "No Summary/Objective section detected — used the document header as the summary. "
            "Please review and edit."
        )

    # ── Experience ────────────────────────────────────────────────────────────
    exp_text   = _first_matching(sections, "EXPERIENCE", "EMPLOYMENT", "WORK", "CAREER")
    experience = _parse_experience(exp_text)
    if not experience:
        warnings.append(
            "Could not extract Experience entries automatically. "
            "The section may use a non-standard layout — please fill it in manually."
        )

    # ── Education ─────────────────────────────────────────────────────────────
    edu_text  = _first_matching(sections, "EDUCATION", "ACADEMIC")
    education = _parse_education(edu_text)
    if not education:
        warnings.append("Could not extract Education entries — please review.")

    # ── Skills ────────────────────────────────────────────────────────────────
    skills_text = _first_matching(sections, "SKILLS", "TECHNICAL", "COMPETENCIES", "TECHNOLOGIES", "KEY")
    skills      = _parse_skills(skills_text)
    if not skills:
        warnings.append("Could not find a Skills section — please add your skills manually.")

    return {
        "summary":    summary.strip(),
        "experience": experience,
        "education":  education,
        "skills":     skills,
    }, warnings
