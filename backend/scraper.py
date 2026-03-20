"""
Job listing aggregator — wraps python-jobspy, normalizes, deduplicates,
filters against the user profile, and persists to the DB.

Column name conventions:
  - JobSpy column names are normalized to lowercase immediately after fetch.
  - We map them to snake_case DB columns on insert.
  - `is_remote` may exist in newer JobSpy versions; we use it if present,
    otherwise infer it from available text fields.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

try:
    import jobspy
except ImportError as exc:
    raise ImportError("Install python-jobspy: pip install python-jobspy") from exc

from models import JobListing, JobStatus, UserProfile

logger = logging.getLogger(__name__)

HOURLY_TO_ANNUAL = 2080   # standard full-time hours per year
MAX_ATTEMPTS     = 3      # escalate to NEEDS_REVIEW after this many retries


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_str(val) -> str:
    """Convert a value to string, returning '' for None/NaN."""
    if val is None:
        return ""
    try:
        if pd.isna(val):
            return ""
    except (TypeError, ValueError):
        pass
    return str(val)


def _combine_location(row: pd.Series) -> str:
    """Combine city + state into a single location string (lowercase columns)."""
    city  = _safe_str(row.get("city",  "")).strip()
    state = _safe_str(row.get("state", "")).strip()
    if city and state:
        return f"{city}, {state}"
    return city or state or ""


def _normalize_salary(amount, interval: str) -> Optional[float]:
    if amount is None:
        return None
    try:
        if pd.isna(amount):
            return None
    except (TypeError, ValueError):
        pass
    return float(amount) * HOURLY_TO_ANNUAL if interval == "hourly" else float(amount)


def _infer_remote(row: pd.Series) -> bool:
    """
    Infer remote status from text fields (lowercase column names).
    Checks title, city, state, job_type, and the first 500 chars of description.
    """
    text = " ".join([
        _safe_str(row.get("job_type")),
        _safe_str(row.get("city")),
        _safe_str(row.get("state")),
        _safe_str(row.get("title")),
        _safe_str(row.get("description"))[:500],
    ]).lower()
    return "remote" in text


def _listing_hash(title: str, company: str, location: str) -> str:
    key = f"{title}|{company}|{location}".lower()
    return hashlib.sha256(key.encode()).hexdigest()


# ── Core scrape + persist function ───────────────────────────────────────────

def scrape_and_persist(profile: UserProfile, db: Session) -> int:
    """
    Fetch jobs from Indeed and LinkedIn, normalize, filter against *profile*,
    deduplicate, and insert new listings.

    Returns the number of new listings inserted.
    """
    job_titles = profile.job_titles or []
    location   = profile.city or ""

    if not job_titles:
        logger.warning("No job titles on profile — skipping scrape.")
        return 0

    # ── 1. Fetch from JobSpy — one query per job title per site ──────────────
    df_parts: list[pd.DataFrame] = []

    for title in job_titles:
        for site in ("indeed", "linkedin"):
            try:
                part = jobspy.scrape_jobs(
                    site_name      = site,
                    search_term    = title,
                    location       = location,
                    results_wanted = 25,
                    hours_old      = 168,  # 7 days
                    is_remote      = (profile.work_arrangements == ["remote"]),
                )
                if part is not None and not part.empty:
                    df_parts.append(part)
                    logger.info("Fetched %d listings for %r from %s", len(part), title, site)
            except Exception as exc:
                logger.warning("Skipping %s / %r due to error: %s", site, title, exc)

    if not df_parts:
        logger.warning("No listings returned from any source.")
        return 0

    df = pd.concat(df_parts, ignore_index=True)

    # Normalize all column names to lowercase immediately — jobspy may return
    # either lowercase or uppercase depending on the installed version.
    df.columns = [c.lower() for c in df.columns]
    logger.debug("DataFrame columns after fetch: %s", df.columns.tolist())

    # ── 2. Normalize ─────────────────────────────────────────────────────────
    interval_col   = df["interval"] if "interval" in df.columns else pd.Series([""] * len(df))
    df["pay_interval"] = interval_col.fillna("").astype(str).str.lower()

    # Location: use existing column if present, fill blanks with city+state
    if "location" in df.columns:
        df["location"] = df["location"].apply(lambda v: _safe_str(v).strip())
        blank_mask = df["location"] == ""
        if blank_mask.any():
            df.loc[blank_mask, "location"] = df[blank_mask].apply(_combine_location, axis=1)
    else:
        df["location"] = df.apply(_combine_location, axis=1)

    # is_remote: use existing column if present (newer jobspy versions supply it)
    if "is_remote" in df.columns:
        df["is_remote"] = df["is_remote"].fillna(False).astype(bool)
    else:
        df["is_remote"] = df.apply(_infer_remote, axis=1)

    df["salary_min"] = df.apply(
        lambda r: _normalize_salary(r.get("min_amount"), r["pay_interval"]), axis=1
    )
    df["salary_max"] = df.apply(
        lambda r: _normalize_salary(r.get("max_amount"), r["pay_interval"]), axis=1
    )

    df["listing_hash"] = df.apply(
        lambda r: _listing_hash(
            _safe_str(r.get("title")),
            _safe_str(r.get("company")),
            r["location"],
        ),
        axis=1,
    )

    # ── 3. Filter against profile ─────────────────────────────────────────────
    # Never drop rows with null salary — only filter when salary_min is present
    if profile.min_salary:
        mask_has_salary = df["salary_min"].notna()
        mask_meets_min  = df["salary_min"] >= profile.min_salary
        df = df[~mask_has_salary | mask_meets_min]
        logger.info("Salary filter (min $%s/yr): %d listings remain", profile.min_salary, len(df))

    prefs  = set(profile.work_arrangements or ["hybrid"])
    before = len(df)
    if "hybrid" not in prefs:
        if prefs == {"remote"}:
            df = df[df["is_remote"] == True]
        elif prefs == {"onsite"}:
            df = df[df["is_remote"] == False]
    logger.info("Remote filter %s: %d → %d listings", prefs, before, len(df))

    # ── 4. Drop blank rows and deduplicate ────────────────────────────────────
    # Rows with no title, company, or location all hash identically — remove them.
    blank_hash = _listing_hash("", "", "")
    df = df[df["listing_hash"] != blank_hash]
    df = df.drop_duplicates(subset=["listing_hash"])

    # ── 5. Deduplicate against DB ─────────────────────────────────────────────
    known_hashes = {
        h for (h,) in db.query(JobListing.listing_hash).filter(
            JobListing.listing_hash.in_(df["listing_hash"].tolist())
        ).all()
    }

    new_rows = df[~df["listing_hash"].isin(known_hashes)]
    logger.info(
        "Dedup: %d total, %d already known, %d new",
        len(df), len(known_hashes), len(new_rows),
    )

    # ── 6. Persist ────────────────────────────────────────────────────────────
    inserted = 0
    for _, row in new_rows.iterrows():
        posted_at: Optional[datetime] = None
        raw_date = row.get("date_posted")
        if raw_date is not None:
            try:
                if not pd.isna(raw_date):
                    posted_at = pd.to_datetime(raw_date).to_pydatetime()
            except Exception:
                pass

        listing = JobListing(
            source_url      = _safe_str(row.get("job_url")),
            source_platform = _safe_str(row.get("site")),
            title           = _safe_str(row.get("title")),
            company         = _safe_str(row.get("company")),
            location        = row["location"],
            description     = _safe_str(row.get("description"))[:50_000],
            job_type        = _safe_str(row.get("job_type")),
            is_remote       = bool(row["is_remote"]),
            salary_min      = row["salary_min"],
            salary_max      = row["salary_max"],
            pay_interval    = row["pay_interval"],
            listing_hash    = row["listing_hash"],
            posted_at       = posted_at,
            status          = JobStatus.PENDING,
            # careers_url left NULL — populated by Step 04
        )
        try:
            db.add(listing)
            db.flush()
            inserted += 1
        except Exception as exc:
            db.rollback()
            logger.debug("Skipping duplicate listing (%s): %s", row.get("title"), exc)

    db.commit()
    logger.info("Inserted %d new listings.", inserted)
    return inserted
