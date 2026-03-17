import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { ZodError } from "zod";
import { resumeSchema, ResumePayload } from "../../schemas/resumeSchema";
import { useToast } from "../ui/Toast";

type UploadState = "idle" | "uploading" | "success" | "error";

const PDF_MIME  = "application/pdf";
const JSON_MIME = "application/json";

interface StoredResumePreview {
  summary: string;
  mostRecentTitle?: string;
  mostRecentCompany?: string;
}

function buildPreview(resume: ResumePayload): StoredResumePreview {
  const sorted = [...resume.experience].sort((a, b) => {
    // Treat "present" / missing endDate as most recent
    if (!a.endDate || a.endDate.toLowerCase() === "present") return -1;
    if (!b.endDate || b.endDate.toLowerCase() === "present") return 1;
    return b.endDate.localeCompare(a.endDate);
  });

  return {
    summary: resume.summary,
    mostRecentTitle: sorted[0]?.title,
    mostRecentCompany: sorted[0]?.company,
  };
}

export function ResumeUpload() {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [storedResume, setStoredResume] = useState<StoredResumePreview | null>(null);
  const [loadingStored, setLoadingStored] = useState(true);

  // Fetch currently stored resume on mount
  useEffect(() => {
    axios
      .get<ResumePayload>("/api/resume")
      .then((res) => setStoredResume(buildPreview(res.data)))
      .catch((err) => {
        if (err.response?.status !== 404) {
          addToast("Could not load stored resume.", "error");
        }
      })
      .finally(() => setLoadingStored(false));
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      setParseErrors([]);
      setParseWarnings([]);
      setUploadState("uploading");

      const isPdf  = file.type === PDF_MIME  || file.name.toLowerCase().endsWith(".pdf");
      const isJson = file.type === JSON_MIME || file.name.toLowerCase().endsWith(".json");

      if (!isPdf && !isJson) {
        setParseErrors(["Unsupported file type. Please upload a .pdf or .json file."]);
        setUploadState("error");
        return;
      }

      if (isPdf) {
        // ── PDF path: send raw bytes as multipart to the backend parser ──────
        const formData = new FormData();
        formData.append("file", file);
        try {
          // Do NOT set Content-Type manually — axios must set it automatically
          // so the browser can append the correct multipart boundary parameter.
          const res = await axios.post<ResumePayload & { warnings?: string[] }>(
            "/api/resume/pdf",
            formData
          );
          setStoredResume(buildPreview(res.data));
          if (res.data.warnings?.length) {
            setParseWarnings(res.data.warnings);
          }
          setUploadState("success");
          addToast("PDF resume parsed and saved!", "success");
        } catch (err: unknown) {
          const detail =
            axios.isAxiosError(err) ? err.response?.data?.detail : undefined;
          setParseErrors([detail ?? "Failed to parse PDF. Please try again."]);
          setUploadState("error");
        }
        return;
      }

      // ── JSON path: validate client-side with Zod, then POST ───────────────
      let text: string;
      try {
        text = await file.text();
      } catch {
        setParseErrors(["Could not read file."]);
        setUploadState("error");
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setParseErrors(["File is not valid JSON."]);
        setUploadState("error");
        return;
      }

      const result = resumeSchema.safeParse(parsed);
      if (!result.success) {
        const messages = (result.error as ZodError).errors.map(
          (e) => `${e.path.join(".")}: ${e.message}`
        );
        setParseErrors(messages);
        setUploadState("error");
        return;
      }

      try {
        await axios.post("/api/resume", result.data);
        setStoredResume(buildPreview(result.data));
        setUploadState("success");
        addToast("Resume uploaded successfully!", "success");
      } catch {
        setParseErrors(["Failed to upload resume. Please try again."]);
        setUploadState("error");
      }
    },
    [addToast]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDelete = async () => {
    try {
      await axios.delete("/api/resume");
      setStoredResume(null);
      addToast("Resume removed.", "info");
    } catch {
      addToast("Failed to remove resume.", "error");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-lg w-full">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Master Resume</h2>
      <p className="text-sm text-gray-500 mb-5">
        Upload your master resume as a <strong>PDF</strong> or <strong>JSON</strong> file.
        PDFs are parsed automatically — review any warnings after upload.
        This resume is used to generate tailored applications; document generation
        is disabled without it.
      </p>

      {/* Currently stored resume preview */}
      {loadingStored ? (
        <div className="h-16 animate-pulse bg-gray-100 rounded-lg mb-5" />
      ) : storedResume ? (
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-green-50 border border-green-200 mb-5">
          <div>
            <p className="text-sm font-medium text-green-800">Resume on file</p>
            {storedResume.mostRecentTitle && (
              <p className="text-xs text-green-700 mt-0.5">
                Most recent: {storedResume.mostRecentTitle}
                {storedResume.mostRecentCompany
                  ? ` · ${storedResume.mostRecentCompany}`
                  : ""}
              </p>
            )}
            <p className="text-xs text-green-600 mt-1 line-clamp-2">
              {storedResume.summary}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            className="shrink-0 text-xs text-red-600 hover:text-red-800 font-medium"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 mb-5">
          <p className="text-sm text-yellow-800 font-medium">No resume on file</p>
          <p className="text-xs text-yellow-700 mt-0.5">
            Upload a resume to enable document generation (Step 05).
          </p>
        </div>
      )}

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload resume PDF or JSON file"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
        }}
        className={[
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 cursor-pointer transition-colors",
          dragging
            ? "border-blue-500 bg-blue-50"
            : uploadState === "uploading"
            ? "border-gray-300 bg-gray-50 pointer-events-none"
            : "border-gray-300 hover:border-blue-400 hover:bg-gray-50",
        ].join(" ")}
      >
        <svg
          className="w-8 h-8 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        {uploadState === "uploading" ? (
          <span className="text-sm text-gray-500">Uploading…</span>
        ) : (
          <>
            <span className="text-sm font-medium text-gray-700">
              {storedResume ? "Replace resume" : "Upload resume"}
            </span>
            <span className="text-xs text-gray-400">
              Drag &amp; drop a .pdf or .json file, or click to browse
            </span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.pdf,application/json,application/pdf"
          className="sr-only"
          onChange={handleFileChange}
        />
      </div>

      {/* PDF parse warnings (non-fatal — data was saved but may need review) */}
      {parseWarnings.length > 0 && (
        <div className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-200">
          <p className="text-xs font-semibold text-amber-800 mb-1">
            Parsed from PDF — please review the following:
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {parseWarnings.map((msg, i) => (
              <li key={i} className="text-xs text-amber-700">
                {msg}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Validation errors */}
      {parseErrors.length > 0 && (
        <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-200">
          <p className="text-xs font-semibold text-red-700 mb-1">
            Resume validation failed:
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {parseErrors.map((msg, i) => (
              <li key={i} className="text-xs text-red-600">
                {msg}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Expected schema hint */}
      <details className="mt-4">
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
          Expected JSON schema
        </summary>
        <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded-md p-3 overflow-x-auto text-gray-600 leading-relaxed">
          {JSON.stringify(
            {
              summary: "string",
              skills: ["string"],
              experience: [
                {
                  company: "string",
                  title: "string",
                  startDate: "string",
                  endDate: "string (optional)",
                  description: "string (optional)",
                },
              ],
              education: [
                {
                  institution: "string",
                  degree: "string",
                  field: "string (optional)",
                  graduationYear: "number (optional)",
                },
              ],
            },
            null,
            2
          )}
        </pre>
      </details>
    </div>
  );
}
