# Automated Job Pipeline

> A full-stack job search automation tool built with **React**, **TypeScript**, **FastAPI**, and **SQLAlchemy**.

The app eliminates the manual grind of job hunting by automatically aggregating listings from LinkedIn and Indeed, ranking them against your resume, and presenting them in a clean triage queue — so instead of spending hours searching, you spend minutes reviewing.

---

## How It Works

### 1. Profile Setup
Configure your search parameters once:
- Target job titles
- Location & work arrangement preferences (remote, hybrid, on-site)
- Minimum salary
- Optional target company list

The backend scrapes **LinkedIn** and **Indeed** every 30 minutes using those parameters, normalizing salary data, inferring remote status, and deduplicating results before storing them.

### 2. Resume Upload
Upload your master resume once as a **PDF** or **JSON**.

> The app never uses your resume to filter jobs out — only to re-rank the queue so the most relevant listings surface first.

### 3. Approval Queue
The triage interface where you spend most of your time. Each job surfaces as a card showing:

| Field | Details |
|-------|---------|
| Title | Job title |
| Company | Employer name |
| Salary | Normalized pay range |
| Location | City / remote status |
| Link | Direct link to the original posting |

**Actions per listing:**
- ✅ **Approve** — single click or keyboard shortcut
- ⏭️ **Skip** — move to next without saving
- 🔖 **Bookmark** — save for later review
- ☑️ **Bulk approve** — select multiple with checkboxes

> 🟣 Listings sourced from your targeted company list are flagged with a **purple badge** so you always know their origin.

---

## Job Lifecycle

Each listing tracks status across a **12-state pipeline**:
```
Pending → Reviewed → Approved → Applied → Interviewing → Offered → Accepted
                   ↘ Skipped
                   ↘ Bookmarked
```

Downstream steps — resume tailoring, document generation, and auto-apply — are designed to plug directly into the same data pipeline.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript |
| Backend | FastAPI |
| Database | SQLAlchemy |
| Scrapers | LinkedIn, Indeed |
