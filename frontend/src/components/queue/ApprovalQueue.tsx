import { useCallback, useEffect, useRef, useState } from "react";
import { usePendingListings, useUpdateListingStatus } from "../../hooks/useListings";
import { JobStatus } from "../../types/jobStatus";
import { ListingCard } from "./ListingCard";

export function ApprovalQueue() {
  const { data: listings = [], isPending, isError, refetch, isFetching } = usePendingListings();
  const { mutate, mutateAsync } = useUpdateListingStatus();

  const [focusedId, setFocusedId]   = useState<number | null>(null);
  const [selected, setSelected]     = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Auto-focus first card when list loads / changes
  useEffect(() => {
    if (listings.length > 0 && (focusedId === null || !listings.find((l) => l.id === focusedId))) {
      setFocusedId(listings[0].id);
    }
    if (listings.length === 0) setFocusedId(null);
  }, [listings]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if focus is inside an input / textarea / button
      if (["INPUT", "TEXTAREA", "BUTTON", "A"].includes((e.target as HTMLElement).tagName)) return;
      if (focusedId === null) return;

      const focusedIndex = listings.findIndex((l) => l.id === focusedId);

      if (e.key === "a" || e.key === "A") {
        mutate({ id: focusedId, status: JobStatus.APPROVED });
      } else if (e.key === "s" || e.key === "S") {
        mutate({ id: focusedId, status: JobStatus.SKIPPED });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = listings[focusedIndex + 1];
        if (next) setFocusedId(next.id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = listings[focusedIndex - 1];
        if (prev) setFocusedId(prev.id);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [focusedId, listings, mutate]);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const allSelected = listings.length > 0 && listings.every((l) => selected.has(l.id));

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(listings.map((l) => l.id)));
  };

  const bulkApprove = async () => {
    setBulkLoading(true);
    try {
      await Promise.all(
        [...selected].map((id) => mutateAsync({ id, status: JobStatus.APPROVED }))
      );
      setSelected(new Set());
    } finally {
      setBulkLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (isPending) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-36 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        Failed to load listings. Check that the backend is running.
      </div>
    );
  }

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">Approval Queue</h2>
          {listings.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
              {listings.length} to review
            </span>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40"
            aria-label="Refresh queue"
          >
            {isFetching ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>

        {/* Bulk controls — only visible when something is selected */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{selected.size} selected</span>
            <button
              type="button"
              onClick={bulkApprove}
              disabled={bulkLoading}
              className="px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-60"
            >
              {bulkLoading ? "Approving…" : "Approve Selected"}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Select-all row */}
      {listings.length > 1 && (
        <label className="flex items-center gap-2 mb-3 text-xs text-gray-500 cursor-pointer select-none w-fit">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-gray-300 text-blue-600"
          />
          Select all
        </label>
      )}

      {/* Empty state */}
      {listings.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <svg
            className="mx-auto w-10 h-10 text-gray-300 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm font-medium text-gray-500">Queue is clear</p>
          <p className="text-xs text-gray-400 mt-1">New listings appear here after the next scrape.</p>
        </div>
      )}

      {/* Card list */}
      <div className="space-y-3">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            isFocused={listing.id === focusedId}
            isSelected={selected.has(listing.id)}
            onAction={(status) => mutate({ id: listing.id, status })}
            onToggleSelect={toggleSelect}
            onClick={setFocusedId}
          />
        ))}
      </div>
    </section>
  );
}
