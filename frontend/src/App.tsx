import { ToastProvider } from "./components/ui/Toast";
import { ProfileWizard } from "./components/wizard/ProfileWizard";
import { ResumeUpload } from "./components/resume/ResumeUpload";
import { ApprovalQueue } from "./components/queue/ApprovalQueue";

export default function App() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-900">Job Search Tracker</h1>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">
          <ApprovalQueue />
          <ProfileWizard />
          <ResumeUpload />
        </main>
      </div>
    </ToastProvider>
  );
}
