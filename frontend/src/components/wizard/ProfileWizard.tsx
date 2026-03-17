import { useCallback, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";

import {
  profileSchema,
  ProfileFormValues,
  STEP_FIELDS,
  step1Schema,
  step2Schema,
  step3Schema,
} from "../../schemas/profileSchema";
import { useWizardDraft } from "../../hooks/useWizardDraft";
import { useToast } from "../ui/Toast";
import { ProgressIndicator } from "./ProgressIndicator";
import { Step1Industry } from "./Step1Industry";
import { Step2Preferences } from "./Step2Preferences";
import { Step3DealBreakers } from "./Step3DealBreakers";

const STEPS = ["Target Role", "Preferences", "Deal-Breakers"];

// Per-step resolvers used only for pre-advance validation
const STEP_RESOLVERS = [
  zodResolver(step1Schema),
  zodResolver(step2Schema),
  zodResolver(step3Schema),
];

const DEFAULT_VALUES: Partial<ProfileFormValues> = {
  industry: "",
  jobTitles: [],
  city: "",
  isRemote: false,
  minSalary: null,
  companySizeMin: null,
  companySizeMax: null,
  dealBreakers: "",
};

export function ProfileWizard() {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const methods = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: DEFAULT_VALUES as ProfileFormValues,
    mode: "onChange",
  });

  const {
    control,
    handleSubmit,
    trigger,
    getValues,
    reset,
    formState: { errors },
  } = methods;

  const { saveDraft, clearDraft } = useWizardDraft(getValues, reset);

  // Validate only the current step's fields before advancing
  const handleNext = useCallback(async () => {
    const fields = STEP_FIELDS[step] as readonly (keyof ProfileFormValues)[];
    const valid = await trigger(fields as (keyof ProfileFormValues)[]);
    if (!valid) return;
    saveDraft();
    setStep((s) => s + 1);
  }, [step, trigger, saveDraft]);

  const handleBack = () => {
    saveDraft();
    setStep((s) => s - 1);
  };

  const onSubmit = async (data: ProfileFormValues) => {
    setSubmitting(true);
    try {
      await axios.post("/api/profile", data);
      clearDraft();
      addToast("Profile saved successfully!", "success");
    } catch {
      addToast("Failed to save profile. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const stepProps = { control, errors };

  return (
    <FormProvider {...methods}>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-lg w-full">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Job Search Profile
        </h2>

        <ProgressIndicator currentStep={step} steps={STEPS} />

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {step === 0 && <Step1Industry {...stepProps} />}
          {step === 1 && <Step2Preferences {...stepProps} />}
          {step === 2 && <Step3DealBreakers {...stepProps} />}

          <div className="flex justify-between mt-8 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 0}
              className="px-4 py-2 text-sm font-medium text-gray-600 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? "Saving…" : "Save Profile"}
              </button>
            )}
          </div>
        </form>
      </div>
    </FormProvider>
  );
}
