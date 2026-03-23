"""
FastAPI application — job search tracker backend.

Run with:
    uvicorn main:app --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import List, Optional

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from models import Base, JobListing, JobStatus, UserProfile, UserResume
from scraper import scrape_and_persist

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL = "sqlite:///./jobsearch.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Scheduler ─────────────────────────────────────────────────────────────────

def scheduled_scrape():
    db = SessionLocal()
    try:
        profiles = db.query(UserProfile).all()
        if not profiles:
            logger.info("Scheduler: no profiles configured, skipping scrape.")
            return
        for profile in profiles:
            logger.info("Scheduler: scraping for profile %d", profile.id)
            count = scrape_and_persist(profile, db)
            logger.info("Scheduler: inserted %d listings for profile %d", count, profile.id)
    except Exception as exc:
        logger.exception("Scheduler scrape failed: %s", exc)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler()
    scheduler.add_job(scheduled_scrape, "interval", minutes=30, id="scrape_jobs")
    scheduler.start()
    logger.info("Scheduler started — scraping every 30 minutes.")
    yield
    scheduler.shutdown(wait=False)


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Job Search Tracker API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ProfileIn(BaseModel):
    jobTitles:          List[str]           = Field(min_length=1)
    city:               Optional[str]       = None
    workArrangements:   List[str]           = Field(default=["hybrid"])
    minSalary:          Optional[int]       = None
    targetCompanies:    List[str]           = Field(default_factory=list)


class ProfileOut(BaseModel):
    id:                int
    jobTitles:         List[str]
    city:              Optional[str]
    workArrangements:  List[str]
    minSalary:         Optional[int]

    class Config:
        from_attributes = True


class ResumeIn(BaseModel):
    experience: list  = Field(default_factory=list)
    education:  list  = Field(default_factory=list)
    skills:     list  = Field(default_factory=list)
    summary:    str


class ResumeOut(ResumeIn):
    id: int

    class Config:
        from_attributes = True


class ListingOut(BaseModel):
    id:              int
    title:           str
    company:         Optional[str]
    location:        Optional[str]
    salary_min:      Optional[float]
    salary_max:      Optional[float]
    pay_interval:    Optional[str]
    job_type:        Optional[str]
    is_remote:       bool
    source_url:      Optional[str]
    source_platform: Optional[str]
    status:          str
    posted_at:       Optional[str]
    target_company:  Optional[str]   # non-null when found via targeted company search

    class Config:
        from_attributes = True


# ── Profile endpoints ─────────────────────────────────────────────────────────

@app.post("/api/profile", response_model=ProfileOut, status_code=201)
def create_or_update_profile(data: ProfileIn, db: Session = Depends(get_db)):
    # Single-user: upsert the first profile row
    profile = db.query(UserProfile).first()
    if profile:
        for key, value in data.model_dump().items():
            # camelCase → snake_case mapping
            snake = _to_snake(key)
            if hasattr(profile, snake):
                setattr(profile, snake, value)
    else:
        profile = UserProfile(
            job_titles        = data.jobTitles,
            city              = data.city,
            work_arrangements = data.workArrangements,
            min_salary        = data.minSalary,
            target_companies  = data.targetCompanies,
        )
        db.add(profile)

    db.commit()
    db.refresh(profile)

    # Trigger an immediate scrape on a fresh session so a scrape error
    # never rolls back the profile transaction above.
    try:
        scrape_db = SessionLocal()
        try:
            scrape_and_persist(profile, scrape_db)
        finally:
            scrape_db.close()
    except Exception as exc:
        logger.warning("Post-profile scrape failed: %s", exc)

    return _profile_to_out(profile)


@app.get("/api/profile", response_model=Optional[ProfileOut])
def get_profile(db: Session = Depends(get_db)):
    profile = db.query(UserProfile).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No profile configured")
    return _profile_to_out(profile)


# ── Resume endpoints ──────────────────────────────────────────────────────────

@app.post("/api/resume", response_model=ResumeOut, status_code=201)
def upsert_resume(data: ResumeIn, db: Session = Depends(get_db)):
    resume = db.query(UserResume).filter_by(user_id=1).first()
    if resume:
        resume.experience = data.experience
        resume.education  = data.education
        resume.skills     = data.skills
        resume.summary    = data.summary
    else:
        resume = UserResume(
            user_id    = 1,
            experience = data.experience,
            education  = data.education,
            skills     = data.skills,
            summary    = data.summary,
        )
        db.add(resume)

    db.commit()
    db.refresh(resume)
    return resume


@app.get("/api/resume", response_model=ResumeOut)
def get_resume(db: Session = Depends(get_db)):
    resume = db.query(UserResume).filter_by(user_id=1).first()
    if not resume:
        raise HTTPException(status_code=404, detail="No resume on file")
    return resume


@app.delete("/api/resume", status_code=204)
def delete_resume(db: Session = Depends(get_db)):
    resume = db.query(UserResume).filter_by(user_id=1).first()
    if resume:
        db.delete(resume)
        db.commit()


@app.post("/api/resume/pdf", status_code=201)
async def upload_resume_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Accept a PDF resume, extract text with pdfplumber, parse into the resume
    schema, and upsert. Returns the stored resume plus any parser warnings.
    """
    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()
    if not filename.endswith(".pdf") and "pdf" not in content_type:
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF.")

    pdf_bytes = await file.read()

    try:
        from pdf_parser import parse_resume_from_pdf
        resume_data, warnings = parse_resume_from_pdf(pdf_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("PDF parsing failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to parse the PDF.")

    # Upsert using the same logic as POST /api/resume
    resume = db.query(UserResume).filter_by(user_id=1).first()
    if resume:
        resume.experience = resume_data["experience"]
        resume.education  = resume_data["education"]
        resume.skills     = resume_data["skills"]
        resume.summary    = resume_data["summary"]
    else:
        resume = UserResume(
            user_id    = 1,
            experience = resume_data["experience"],
            education  = resume_data["education"],
            skills     = resume_data["skills"],
            summary    = resume_data["summary"],
        )
        db.add(resume)

    db.commit()
    db.refresh(resume)

    return {
        "id":         resume.id,
        "experience": resume.experience,
        "education":  resume.education,
        "skills":     resume.skills,
        "summary":    resume.summary,
        "warnings":   warnings,
    }


# ── Listings endpoints ────────────────────────────────────────────────────────

class ListingStatusUpdate(BaseModel):
    status: str


@app.patch("/api/listings/{listing_id}", response_model=ListingOut)
def update_listing_status(
    listing_id: int,
    data: ListingStatusUpdate,
    db: Session = Depends(get_db),
):
    listing = db.query(JobListing).filter(JobListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    try:
        listing.status = JobStatus(data.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {data.status!r}")
    db.commit()
    db.refresh(listing)
    return _listing_to_out(listing)



@app.get("/api/listings", response_model=List[ListingOut])
def get_listings(
    profile_id: Optional[int]  = Query(None),
    status:     Optional[str]  = Query("pending"),
    page:       int            = Query(1, ge=1),
    page_size:  int            = Query(50, ge=1, le=200),
    db: Session                = Depends(get_db),
):
    query = db.query(JobListing)

    if status:
        try:
            job_status = JobStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown status: {status}")
        query = query.filter(JobListing.status == job_status)

    listings = query.order_by(JobListing.created_at.desc()).all()

    # Sort by resume relevance if a resume exists — resume never filters,
    # only re-ranks so all matching jobs remain visible.
    resume = db.query(UserResume).filter_by(user_id=1).first()
    if resume:
        keywords = _resume_keywords(resume)
        listings = sorted(listings, key=lambda l: _relevance_score(l, keywords), reverse=True)

    offset = (page - 1) * page_size
    listings = listings[offset : offset + page_size]

    return [_listing_to_out(l) for l in listings]


def _resume_keywords(resume: UserResume) -> set[str]:
    """Extract lowercase keyword tokens from resume skills and job titles."""
    keywords: set[str] = set()
    for skill in (resume.skills or []):
        keywords.add(str(skill).lower().strip())
    for exp in (resume.experience or []):
        if isinstance(exp, dict):
            title = str(exp.get("title", "") or "").lower().strip()
            if title:
                keywords.add(title)
    return keywords


def _relevance_score(listing: JobListing, keywords: set[str]) -> int:
    """Count how many resume keywords appear in the listing title + description."""
    if not keywords:
        return 0
    haystack = f"{listing.title or ''} {listing.description or ''}".lower()
    return sum(1 for kw in keywords if kw and kw in haystack)


# ── Helpers ───────────────────────────────────────────────────────────────────

import re

def _to_snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def _profile_to_out(p: UserProfile) -> dict:
    return {
        "id":               p.id,
        "jobTitles":        p.job_titles or [],
        "city":             p.city,
        "workArrangements": p.work_arrangements or [],
        "minSalary":        p.min_salary,
        "targetCompanies":  p.target_companies or [],
    }


def _listing_to_out(l: JobListing) -> dict:
    return {
        "id":              l.id,
        "title":           l.title,
        "company":         l.company,
        "location":        l.location,
        "salary_min":      l.salary_min,
        "salary_max":      l.salary_max,
        "pay_interval":    l.pay_interval,
        "job_type":        l.job_type,
        "is_remote":       l.is_remote or False,
        "source_url":      l.source_url,
        "source_platform": l.source_platform,
        "status":          l.status.value if l.status else "pending",
        "posted_at":       l.posted_at.isoformat() if l.posted_at else None,
        "target_company":  l.target_company,
    }
