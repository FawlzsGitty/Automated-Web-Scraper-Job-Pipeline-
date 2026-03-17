"""
Job listing aggregator — wraps python-jobspy, normalizes, deduplicates,
filters against the user profile, and persists to the DB.

Column name conventions:
  - JobSpy returns UPPERCASE column names (TITLE, COMPANY, SITE, …).
  - We map them to snake_case DB columns on insert.
  - Never assume `is_remote` exists in the DataFrame — infer it here.
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

HOURLY_TO_ANNUAL = 2080      # standard full-time hours per year
MAX_ATTEMPTS     = 3         # escalate to NEEDS_REVIEW after this many retries


# ── Helpers ──────────────────────────────────────────────────────────────────

def _combine_location(row: pd.Series) -> str:
    city  = str(row.get("CITY",  "") or "").strip()
    state = str(row.get("STATE", "") or "").strip()
    if city and state:
        return f"{city}, {state}"
    return city or state or ""


def _normalize_salary(amount: Optional[float], interval: str) -> Optional[float]:
    if amount is None or pd.isna(amount):
        return None
    return float(amount) * HOURLY_TO_ANNUAL if interval == "hourly" else float(amount)


def _infer_remote(row: pd.Series) -> bool:
    """
    JobSpy has no `is_remote` column.
    Infer by checking JOB_TYPE or CITY/STATE for the word "remote".
    """
    text = " ".join([
        str(row.get("JOB_TYPE", "") or ""),
        str(row.get("CITY",     "") or ""),
        str(row.get("STATE",    "") or ""),
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
    search_terms = ", ".join(profile.job_titles) if profile.job_titles else ""
    location     = profile.city or ""

    # ── 1. Fetch from JobSpy ─────────────────────────────────────────────────
    df_parts: list[pd.DataFrame] = []

    for site in ("indeed", "linkedin"):
        try:
            part = jobspy.scrape_jobs(
                site_name      = site,
                search_term    = search_terms,
                location       = location,
                results_wanted = 50,
                hours_old      = 72,
            )
            if part is not None and not part.empty:
                df_parts.append(part)
                logger.info("Fetched %d listings from %s", len(part), site)
        except Exception as exc:
            # LinkedIn rate limits are expected — continue with other sources
            logger.warning("Skipping %s due to error: %s", site, exc)

    if not df_parts:
        logger.warning("No listings returned from any source.")
        return 0

    df = pd.concat(df_parts, ignore_index=True)

    # ── 2. Normalize ─────────────────────────────────────────────────────────
    interval_col = df.get("INTERVAL", pd.Series([""] * len(df)))
    df["pay_interval"] = interval_col.fillna("").str.lower()
    df["location"]     = df.apply(_combine_location, axis=1)
    df["is_remote"]    = df.apply(_infer_remote, axis=1)

    df["salary_min"] = df.apply(
        lambda r: _normalize_salary(r.get("MIN_AMOUNT"), r["pay_interval"]), axis=1
    )
    df["salary_max"] = df.apply(
        lambda r: _normalize_salary(r.get("MAX_AMOUNT"), r["pay_interval"]), axis=1
    )

    df["listing_hash"] = df.apply(
        lambda r: _listing_hash(
            str(r.get("TITLE",   "") or ""),
            str(r.get("COMPANY", "") or ""),
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
        logger.debug("After salary filter: %d listings", len(df))

    if profile.remote_preference:
        want_remote = profile.remote_preference == "remote"
        # Only apply if is_remote can be inferred (don't blindly drop)
        df = df[df["is_remote"] == want_remote]
        logger.debug("After remote filter: %d listings", len(df))

    # ── 4. Deduplicate against DB ─────────────────────────────────────────────
    known_hashes = {
        h for (h,) in db.query(JobListing.listing_hash).filter(
            JobListing.listing_hash.in_(df["listing_hash"].tolist())
        ).all()
    }

    new_rows = df[~df["listing_hash"].isin(known_hashes)]
    logger.debug(
        "Dedup: %d total, %d already known, %d new",
        len(df), len(known_hashes), len(new_rows),
    )

    # ── 5. Persist ────────────────────────────────────────────────────────────
    inserted = 0
    for _, row in new_rows.iterrows():
        # Parse posted_at safely
        posted_at: Optional[datetime] = None
        if "date_posted" in row and row["date_posted"] and not pd.isna(row.get("date_posted")):
            try:
                posted_at = pd.to_datetime(row["date_posted"]).to_pydatetime()
            except Exception:
                pass

        listing = JobListing(
            source_url      = str(row.get("JOB_URL",      "") or ""),
            source_platform = str(row.get("SITE",         "") or ""),
            title           = str(row.get("TITLE",        "") or ""),
            company         = str(row.get("COMPANY",      "") or ""),
            location        = row["location"],
            description     = str(row.get("DESCRIPTION",  "") or ""),
            job_type        = str(row.get("JOB_TYPE",     "") or ""),
            is_remote       = bool(row["is_remote"]),
            salary_min      = row["salary_min"],
            salary_max      = row["salary_max"],
            pay_interval    = row["pay_interval"],
            listing_hash    = row["listing_hash"],
            posted_at       = posted_at,
            status          = JobStatus.PENDING,
            # careers_url left NULL — populated by Step 04
        )
        db.add(listing)
        inserted += 1

    db.commit()
    logger.info("Inserted %d new listings.", inserted)
    return inserted
