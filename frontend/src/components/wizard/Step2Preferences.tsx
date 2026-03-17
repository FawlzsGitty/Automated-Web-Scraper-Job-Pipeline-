import { Control, Controller, FieldErrors } from "react-hook-form";
import { ProfileFormValues } from "../../schemas/profileSchema";

interface Props {
  control: Control<ProfileFormValues>;
  errors: FieldErrors<ProfileFormValues>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

const REMOTE_OPTIONS: { value: ProfileFormValues["remotePreference"]; label: string }[] =
  [
    { value: "remote", label: "Remote" },
    { value: "hybrid", label: "Hybrid" },
    { value: "onsite", label: "On-site" },
  ];

export function Step2Preferences({ control, errors }: Props) {
  return (
    <div className="space-y-6">
      {/* Work arrangement */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Work Arrangement <span className="text-red-500">*</span>
        </label>
        <Controller
          name="remotePreference"
          control={control}
          render={({ field }) => (
            <div className="flex gap-3">
              {REMOTE_OPTIONS.map(({ value, label }) => (
                <label
                  key={value}
                  className={[
                    "flex-1 cursor-pointer rounded-lg border-2 px-4 py-3 text-center text-sm font-medium transition-colors",
                    field.value === value
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    value={value}
                    checked={field.value === value}
                    onChange={() => field.onChange(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
        />
        <FieldError message={errors.remotePreference?.message} />
      </div>

      {/* Minimum salary */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Minimum Annual Salary (USD)
        </label>
        <Controller
          name="minSalary"
          control={control}
          render={({ field }) => (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                $
              </span>
              <input
                type="number"
                min={0}
                step={1000}
                placeholder="e.g. 90000"
                value={field.value ?? ""}
                onChange={(e) =>
                  field.onChange(e.target.value === "" ? null : Number(e.target.value))
                }
                className="w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        />
        <FieldError message={errors.minSalary?.message} />
      </div>

      {/* Company size range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Company Size (employees)
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Controller
              name="companySizeMin"
              control={control}
              render={({ field }) => (
                <input
                  type="number"
                  min={1}
                  placeholder="Min (e.g. 50)"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : Number(e.target.value))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            />
            <FieldError message={errors.companySizeMin?.message} />
          </div>
          <div>
            <Controller
              name="companySizeMax"
              control={control}
              render={({ field }) => (
                <input
                  type="number"
                  min={1}
                  placeholder="Max (e.g. 500)"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : Number(e.target.value))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            />
            <FieldError message={errors.companySizeMax?.message} />
          </div>
        </div>
      </div>
    </div>
  );
}
