import { Listing } from "../../types/listing";
import { JobStatus, JobStatusValue } from "../../types/jobStatus";

interface Props {
  listing:        Listing;
  isFocused:      boolean;
  isSelected:     boolean;
  onAction:       (status: JobStatusValue) => void;
  onToggleSelect: (id: number) => void;
  onClick:        (id: number) => void;
}

// ── Salary formatter ─────────────────────────────────────────────────────────

function formatSalary(
  min: number | null,
  max: number | null,
  interval: string | null
): string | null {
  if (min == null && max == null) return null;
  const isHourly = interval === "hourly";
  const suffix   = isHourly ? "/hr" : "/yr";
  const fmt      = (n: number) =>
    isHourly ? `$${Math.round(n)}` : `$${Math.round(n / 1_000)}k`;
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)} ${suffix}`;
  if (min != null) return `${fmt(min)}+ ${suffix}`;
  return `Up to ${fmt(max!)} ${suffix}`;
}

// ── Platform badge ────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  indeed:        "bg-blue-100 text-blue-700",
  linkedin:      "bg-sky-100 text-sky-700",
  zip_recruiter: "bg-purple-100 text-purple-700",
};

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return null;
  const label  = platform.replace("_", " ");
  const colors = PLATFORM_COLORS[platform] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${colors}`}>
      {label}
    </span>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function ListingCard({
  listing,
  isFocused,
  isSelected,
  onAction,
  onToggleSelect,
  onClick,
}: Props) {
  const salary = formatSalary(listing.salary_min, listing.salary_max, listing.pay_interval);

  return (
    <div
      tabIndex={0}
      onClick={() => onClick(listing.id)}
      onFocus={() => onClick(listing.id)}
      className={[
        "relative rounded-xl border bg-white p-5 transition-shadow cursor-pointer select-none",
        isFocused
          ? "border-blue-500 ring-2 ring-blue-200 shadow-md"
          : "border-gray-200 hover:border-gray-300 hover:shadow-sm",
      ].join(" ")}
    >
      {/* Checkbox (top-left) */}
      <div
        className="absolute top-4 left-4"
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(listing.id);
        }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(listing.id)}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
          aria-label={`Select ${listing.title}`}
        />
      </div>

      {/* Main content */}
      <div className="pl-7">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            {/* Title — links directly to the posting; falls back if empty */}
            {listing.source_url ? (
              <a
                href={listing.source_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-semibold text-blue-700 hover:underline truncate block"
              >
                {listing.title || "Untitled Listing"}
              </a>
            ) : (
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {listing.title || "Untitled Listing"}
              </h3>
            )}
            {listing.company && (
              <p className="text-xs text-gray-500 mt-0.5">{listing.company}</p>
            )}
            {/* Always show the URL so the user can verify the link */}
            {listing.source_url && (
              <p className="text-xs text-gray-400 truncate mt-0.5">{listing.source_url}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {listing.target_company && (
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-violet-100 text-violet-700 whitespace-nowrap">
                🎯 {listing.target_company}
              </span>
            )}
            <PlatformBadge platform={listing.source_platform} />
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mb-3">
          {listing.location && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {listing.location}
            </span>
          )}

          {salary && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {salary}
            </span>
          )}

          {listing.is_remote && (
            <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
              Remote
            </span>
          )}
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAction(JobStatus.APPROVED); }}
            className="px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAction(JobStatus.SKIPPED); }}
            className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors"
          >
            Skip
          </button>
        </div>

        {/* Keyboard hint — only shown on focused card */}
        {isFocused && (
          <p className="mt-2 text-xs text-gray-400">
            <kbd className="font-mono bg-gray-100 px-1 rounded">A</kbd> approve ·{" "}
            <kbd className="font-mono bg-gray-100 px-1 rounded">S</kbd> skip
          </p>
        )}
      </div>
    </div>
  );
}
