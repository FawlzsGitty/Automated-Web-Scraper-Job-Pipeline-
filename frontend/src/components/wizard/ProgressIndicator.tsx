interface ProgressIndicatorProps {
  currentStep: number; // 0-indexed
  steps: string[];
}

export function ProgressIndicator({ currentStep, steps }: ProgressIndicatorProps) {
  return (
    <nav aria-label="Form progress" className="mb-8">
      <ol className="flex items-center gap-0">
        {steps.map((label, idx) => {
          const done = idx < currentStep;
          const active = idx === currentStep;

          return (
            <li key={label} className="flex items-center flex-1 last:flex-none">
              {/* Circle */}
              <div className="flex flex-col items-center">
                <div
                  aria-current={active ? "step" : undefined}
                  className={[
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors",
                    done
                      ? "bg-blue-600 border-blue-600 text-white"
                      : active
                      ? "border-blue-600 text-blue-600 bg-white"
                      : "border-gray-300 text-gray-400 bg-white",
                  ].join(" ")}
                >
                  {done ? (
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={`mt-1 text-xs font-medium ${
                    active ? "text-blue-600" : done ? "text-gray-600" : "text-gray-400"
                  }`}
                >
                  {label}
                </span>
              </div>

              {/* Connector line — not rendered after last step */}
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mt-[-14px] transition-colors ${
                    done ? "bg-blue-600" : "bg-gray-200"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
