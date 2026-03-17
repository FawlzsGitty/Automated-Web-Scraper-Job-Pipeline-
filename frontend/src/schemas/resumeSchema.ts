import { z } from "zod";

const experienceItemSchema = z.object({
  company: z.string().min(1, "Company is required"),
  title: z.string().min(1, "Job title is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  description: z.string().optional(),
});

const educationItemSchema = z.object({
  institution: z.string().min(1, "Institution is required"),
  degree: z.string().min(1, "Degree is required"),
  field: z.string().optional(),
  graduationYear: z
    .number()
    .int()
    .min(1900)
    .max(2100)
    .optional(),
});

export const resumeSchema = z.object({
  experience: z.array(experienceItemSchema),
  education: z.array(educationItemSchema),
  skills: z.array(z.string().min(1)),
  summary: z.string().min(1, "Summary is required"),
});

export type ResumePayload = z.infer<typeof resumeSchema>;
