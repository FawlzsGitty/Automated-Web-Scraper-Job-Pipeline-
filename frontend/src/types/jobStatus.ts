/**
 * Mirrors the backend JobStatus enum from models.py.
 * Import this everywhere a status string is used — never hardcode raw strings.
 */
export const JobStatus = {
  PENDING:      "pending",
  APPROVED:     "approved",
  SKIPPED:      "skipped",
  BOOKMARKED:   "bookmarked",
  RESEARCHED:   "researched",
  DOCS_READY:   "docs_ready",
  APPLIED:      "applied",
  INTERVIEWING: "interviewing",
  OFFERED:      "offered",
  REJECTED:     "rejected",
  ACCEPTED:     "accepted",
  NEEDS_REVIEW: "needs_review",
} as const;

export type JobStatusValue = (typeof JobStatus)[keyof typeof JobStatus];
