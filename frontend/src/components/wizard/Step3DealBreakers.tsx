import { Control, Controller, FieldErrors } from "react-hook-form";
import { ProfileFormValues } from "../../schemas/profileSchema";

interface Props {
  control: Control<ProfileFormValues>;
  errors: FieldErrors<ProfileFormValues>;
}

export function Step3DealBreakers({ control, errors }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Deal-Breakers
        </label>
        <p className="text-xs text-gray-500 mb-2">
          List anything that would disqualify a role — industries, company types,
          technologies, travel requirements, etc.
        </p>
        <Controller
          name="dealBreakers"
          control={control}
          render={({ field }) => (
            <textarea
              {...field}
              rows={6}
              placeholder="e.g. No on-call rotations. No defense/surveillance industries. No relocation required."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          )}
        />
        {errors.dealBreakers?.message && (
          <p className="mt-1 text-xs text-red-600">{errors.dealBreakers.message}</p>
        )}
      </div>

      <p className="text-xs text-gray-400">
        This field is optional. You can always update your profile later.
      </p>
    </div>
  );
}
