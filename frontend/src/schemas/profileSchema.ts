import { z } from "zod";

export const profileSchema = z.object({
  jobTitles: z
    .array(z.string().min(1))
    .min(1, "Add at least one job title")
    .max(10, "Maximum 10 job titles"),
  city: z.string().optional(),
  workArrangements: z
    .array(z.enum(["remote", "hybrid", "onsite"]))
    .min(1, "Select at least one work arrangement"),
  minSalary: z
    .number({ invalid_type_error: "Enter a number" })
    .min(0, "Must be positive")
    .optional()
    .nullable(),
  targetCompanies: z.array(z.string().min(1)).optional().default([]),
  hoursOld: z.union([z.literal(24), z.literal(168)]).default(168),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
