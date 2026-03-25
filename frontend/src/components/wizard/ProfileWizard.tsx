import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";

import { profileSchema, ProfileFormValues } from "../../schemas/profileSchema";
import { useToast } from "../ui/Toast";

const ARRANGEMENTS: { value: "remote" | "hybrid" | "onsite"; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

export function ProfileWizard() {
  const [submitting, setSubmitting] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [companyInput, setCompanyInput] = useState("");
  const { addToast } = useToast();

  const DRAFT_KEY = "profile_draft";

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: (() => {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) return JSON.parse(saved);
      } catch {}
      return { jobTitles: [], city: "", workArrangements: ["hybrid"], minSalary: null, targetCompanies: [], hoursOld: 168 };
    })(),
  });

  const jobTitles        = watch("jobTitles") ?? [];
  const workArrangements = watch("workArrangements") ?? [];
  const targetCompanies  = watch("targetCompanies") ?? [];
  const hoursOld         = watch("hoursOld") ?? 168;

  // Persist form values to localStorage on every change
  useEffect(() => {
    const sub = watch((values) => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(values)); } catch {}
    });
    return () => sub.unsubscribe();
  }, [watch]);

  const addTitle = () => {
    const trimmed = titleInput.trim();
    if (!trimmed || jobTitles.includes(trimmed)) return;
    setValue("jobTitles", [...jobTitles, trimmed], { shouldValidate: true });
    setTitleInput("");
  };

  const removeTitle = (t: string) =>
    setValue("jobTitles", jobTitles.filter((x) => x !== t), { shouldValidate: true });

  const addCompany = () => {
    const trimmed = companyInput.trim();
    if (!trimmed || targetCompanies.map(c => c.toLowerCase()).includes(trimmed.toLowerCase())) return;
    setValue("targetCompanies", [...targetCompanies, trimmed], { shouldValidate: true });
    setCompanyInput("");
  };

  const removeCompany = (c: string) =>
    setValue("targetCompanies", targetCompanies.filter((x) => x !== c), { shouldValidate: true });

  const toggleArrangement = (val: "remote" | "hybrid" | "onsite") => {
    const updated = workArrangements.includes(val)
      ? workArrangements.filter((x) => x !== val)
      : [...workArrangements, val];
    setValue("workArrangements", updated, { shouldValidate: true });
  };

  const onSubmit = async (data: ProfileFormValues) => {
    setSubmitting(true);
    try {
      await axios.post("/api/profile", data);
      addToast("Profile saved! Scraping jobs now…", "success");
    } catch {
      addToast("Failed to save profile.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-lg w-full">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Job Search Profile</h2>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

        {/* Job Titles */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Job Titles <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {jobTitles.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium"
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeTitle(t)}
                  className="hover:text-blue-600 leading-none"
                  aria-label={`Remove ${t}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addTitle(); }
              }}
              placeholder="e.g. Software Engineer"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={addTitle}
              className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              Add
            </button>
          </div>
          {errors.jobTitles && (
            <p className="mt-1 text-xs text-red-600">
              {errors.jobTitles.message ?? (errors.jobTitles as { root?: { message?: string } }).root?.message}
            </p>
          )}
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <Controller
            name="city"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="text"
                placeholder="e.g. Austin, TX"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          />
        </div>

        {/* Work Arrangement */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Work Arrangement <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3">
            {ARRANGEMENTS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleArrangement(value)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  workArrangements.includes(value)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {errors.workArrangements && (
            <p className="mt-1 text-xs text-red-600">{errors.workArrangements.message}</p>
          )}
        </div>

        {/* Target Companies */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Companies{" "}
            <span className="text-gray-400 font-normal">(optional — triggers direct company searches)</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {targetCompanies.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-100 text-violet-800 text-xs font-medium"
              >
                🎯 {c}
                <button
                  type="button"
                  onClick={() => removeCompany(c)}
                  className="hover:text-violet-600 leading-none"
                  aria-label={`Remove ${c}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={companyInput}
              onChange={(e) => setCompanyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addCompany(); }
              }}
              placeholder="e.g. Google, Microsoft, Stripe"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              type="button"
              onClick={addCompany}
              className="px-3 py-2 rounded-md bg-violet-600 text-white text-sm font-medium hover:bg-violet-700"
            >
              Add
            </button>
          </div>
        </div>

        {/* Min Salary */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Minimum Salary <span className="text-gray-400 font-normal">(annual, optional)</span>
          </label>
          <Controller
            name="minSalary"
            control={control}
            render={({ field }) => (
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : Number(e.target.value))
                  }
                  placeholder="e.g. 80000"
                  className="w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          />
          {errors.minSalary && (
            <p className="mt-1 text-xs text-red-600">{errors.minSalary.message}</p>
          )}
        </div>

        {/* Listing Age */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Listing Age{" "}
            <span className="text-gray-400 font-normal">(how recent?)</span>
          </label>
          <div className="flex gap-3">
            {([24, 168] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setValue("hoursOld", h, { shouldValidate: true })}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  hoursOld === h
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                }`}
              >
                {h === 24 ? "Last 24 hours" : "Last 7 days"}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
