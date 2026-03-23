"""
SQLAlchemy 2.0 models.

JobStatus is the single source of truth for all status values used
across the pipeline — import this enum everywhere; never use raw strings.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    Integer,
    String,
    Text,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# ── Status enum ──────────────────────────────────────────────────────────────

class JobStatus(str, PyEnum):
    PENDING      = "pending"
    APPROVED     = "approved"
    SKIPPED      = "skipped"
    BOOKMARKED   = "bookmarked"
    RESEARCHED   = "researched"
    DOCS_READY   = "docs_ready"
    APPLIED      = "applied"
    INTERVIEWING = "interviewing"
    OFFERED      = "offered"
    REJECTED     = "rejected"
    ACCEPTED     = "accepted"
    NEEDS_REVIEW = "needs_review"


# ── Tables ───────────────────────────────────────────────────────────────────

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id                 = Column(Integer, primary_key=True)
    job_titles         = Column(JSON, nullable=False)          # list[str]
    city               = Column(String(200))
    work_arrangements  = Column(JSON, default=list)            # ["remote","hybrid","onsite"]
    min_salary         = Column(Integer)
    target_companies   = Column(JSON, default=list)            # list[str] — targeted company searches
    created_at         = Column(DateTime, default=datetime.utcnow)
    updated_at         = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserResume(Base):
    """One master resume per user (upsert on user_id)."""

    __tablename__ = "user_resumes"
    __table_args__ = (UniqueConstraint("user_id", name="uq_user_resume"),)

    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, nullable=False, default=1)  # single-user for now
    experience = Column(JSON, nullable=False, default=list)
    education  = Column(JSON, nullable=False, default=list)
    skills     = Column(JSON, nullable=False, default=list)
    summary    = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class JobListing(Base):
    __tablename__ = "job_listings"

    id              = Column(Integer, primary_key=True)

    # Source identifiers
    source_url      = Column(String(1000))          # JOB_URL — read-only after insert
    careers_url     = Column(String(1000))           # populated later by Step 04
    source_platform = Column(String(100))            # SITE (indeed / linkedin / …)
    listing_hash    = Column(String(64), unique=True, index=True)
    target_company  = Column(String(500))            # set when found via targeted search; NULL = general

    # Core fields
    title           = Column(String(500), nullable=False)
    company         = Column(String(500))
    location        = Column(String(500))            # "{CITY}, {STATE}"
    description     = Column(Text)                   # full text stored at ingest
    job_type        = Column(String(100))
    is_remote       = Column(Boolean, default=False) # inferred — not from JobSpy
    posted_at       = Column(DateTime)

    # Salary (normalized to annual; original interval preserved)
    salary_min      = Column(Float)
    salary_max      = Column(Float)
    pay_interval    = Column(String(50))             # "yearly" / "hourly"

    # Pipeline status
    status          = Column(
        Enum(JobStatus, name="jobstatus"),
        nullable=False,
        default=JobStatus.PENDING,
    )
    follow_up_due   = Column(Boolean, default=False) # flag, not a status

    # Retry counters — each step increments before attempting work
    research_attempts    = Column(Integer, default=0)
    generation_attempts  = Column(Integer, default=0)
    apply_attempts       = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
