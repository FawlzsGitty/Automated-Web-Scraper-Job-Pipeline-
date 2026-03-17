import { useState } from "react";
import { Control, Controller, FieldErrors, useFormContext } from "react-hook-form";
import { ProfileFormValues } from "../../schemas/profileSchema";

interface Props {
  control: Control<ProfileFormValues>;
  errors: FieldErrors<ProfileFormValues>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export function Step1Industry({ control, errors }: Props) {
  const { getValues, setValue } = useFormContext<ProfileFormValues>();
  const [titleInput, setTitleInput] = useState("");

  const addTitle = () => {
    const trimmed = titleInput.trim();
    if (!trimmed) return;
    const current = getValues("jobTitles") ?? [];
    if (!current.includes(trimmed)) {
      setValue("jobTitles", [...current, trimmed], { shouldValidate: true });
    }
    setTitleInput("");
  };

  const removeTitle = (title: string) => {
    const current = getValues("jobTitles") ?? [];
    setValue(
      "jobTitles",
      current.filter((t) => t !== title),
      { shouldValidate: true }
    );
  };

  return (
    <div className="space-y-6">
      {/* Industry */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Industry <span className="text-red-500">*</span>
        </label>
        <Controller
          name="industry"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              type="text"
              placeholder="e.g. Software / FinTech / Healthcare"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        />
        <FieldError message={errors.industry?.message} />
      </div>

      {/* Job titles — tag input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Target Job Titles <span className="text-red-500">*</span>
        </label>
        <Controller
          name="jobTitles"
          control={control}
          render={({ field }) => (
            <>
              {/* Tag list */}
              <div className="flex flex-wrap gap-2 mb-2">
                {(field.value ?? []).map((title) => (
                  <span
                    key={title}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium"
                  >
                    {title}
                    <button
                      type="button"
                      onClick={() => removeTitle(title)}
                      className="hover:text-blue-600"
                      aria-label={`Remove ${title}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {/* Input + Add button */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTitle();
                    }
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
            </>
          )}
        />
        <FieldError message={errors.jobTitles?.message ?? (errors.jobTitles as { root?: { message?: string } })?.root?.message} />
      </div>

      {/* City + Remote toggle */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City
          </label>
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

        <div className="flex flex-col justify-end pb-2">
          <Controller
            name="isRemote"
            control={control}
            render={({ field }) => (
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <span className="relative inline-block w-10 h-6">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                  <span className="block w-10 h-6 rounded-full bg-gray-200 peer-checked:bg-blue-600 transition-colors" />
                  <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                </span>
                <span className="text-sm font-medium text-gray-700">
                  Open to remote
                </span>
              </label>
            )}
          />
        </div>
      </div>
    </div>
  );
}
