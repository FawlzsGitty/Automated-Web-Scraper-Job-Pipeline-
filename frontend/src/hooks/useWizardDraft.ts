import { useCallback, useEffect } from "react";
import { UseFormGetValues, UseFormReset } from "react-hook-form";
import { ProfileFormValues } from "../schemas/profileSchema";

const DRAFT_KEY = "profile_wizard_draft";

/**
 * Persists the wizard form values to localStorage on every change,
 * and restores them on first mount so the user can resume mid-session.
 */
export function useWizardDraft(
  getValues: UseFormGetValues<ProfileFormValues>,
  reset: UseFormReset<ProfileFormValues>
) {
  // Restore draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<ProfileFormValues>;
        reset(saved as ProfileFormValues, { keepDefaultValues: true });
      }
    } catch {
      // Corrupt storage — silently ignore
    }
  }, [reset]);

  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(getValues()));
    } catch {
      // Storage quota exceeded — silently ignore
    }
  }, [getValues]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
  }, []);

  return { saveDraft, clearDraft };
}
