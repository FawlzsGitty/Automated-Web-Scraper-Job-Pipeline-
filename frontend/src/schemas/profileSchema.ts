import { z } from "zod";

// ── Step-level schemas (used for per-step validation before advancing) ──────

export const step1Schema = z.object({
  industry: z.string().min(1, "Industry is required"),
  jobTitles: z
    .array(z.string().min(1))
    .min(1, "Add at least one job title")
    .max(10, "Maximum 10 job titles"),
  city: z.string().optional(),
  isRemote: z.boolean(),
});

export const step2Schema = z.object({
  remotePreference: z.enum(["remote", "onsite", "hybrid"], {
    required_error: "Select a work arrangement",
  }),
  minSalary: z
    .number({ invalid_type_error: "Enter a number" })
    .min(0, "Salary must be positive")
    .optional()
    .nullable(),
  companySizeMin: z
    .number({ invalid_type_error: "Enter a number" })
    .min(1)
    .optional()
    .nullable(),
  companySizeMax: z
    .number({ invalid_type_error: "Enter a number" })
    .min(1)
    .optional()
    .nullable(),
});

export const step3Schema = z.object({
  dealBreakers: z.string().max(2000, "Maximum 2 000 characters").optional(),
});

// ── Full profile schema (merged for final POST) ───────────────────────────

export const profileSchema = step1Schema.merge(step2Schema).merge(step3Schema);

export type ProfileFormValues = z.infer<typeof profileSchema>;

// Keys belonging to each step — used by `trigger()` before advancing
export const STEP_FIELDS = [
  ["industry", "jobTitles", "city", "isRemote"] as const,
  ["remotePreference", "minSalary", "companySizeMin", "companySizeMax"] as const,
  ["dealBreakers"] as const,
] as const;
