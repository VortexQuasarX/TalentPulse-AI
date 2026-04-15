"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { isAuthenticated, getToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export default function ApplyPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resume, setResume] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      localStorage.setItem("apply_job_id", jobId);
      router.push("/register");
      return;
    }
    fetch(`${API}/jobs/public/${jobId}`).then(r => r.json()).then(setJob).finally(() => setLoading(false));
  }, [jobId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resume) { setError("Please upload your resume"); return; }
    setError("");
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("resume", resume);
      formData.append("screening_answers", JSON.stringify(answers));

      const token = getToken();
      if (!token) {
        localStorage.setItem("apply_job_id", jobId);
        router.push("/login");
        return;
      }

      const res = await fetch(`${API}/jobs/${jobId}/apply?screening_answers=${encodeURIComponent(JSON.stringify(answers))}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.status === 401) {
        // Token expired — redirect to login
        localStorage.setItem("apply_job_id", jobId);
        router.push("/login");
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Application failed");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!job) return <div className="text-center py-20 text-red-500">Job not found</div>;

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-xl border p-8 max-w-lg w-full text-center">
          <div className="text-6xl mb-4">📨</div>
          <h2 className="text-2xl font-bold mb-2">Thank You for Applying!</h2>
          <p className="text-gray-500 mb-2">
            Your application has been submitted successfully. Our team will review your profile and get back to you.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            If shortlisted, you'll receive an email notification with next steps.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push("/candidate/dashboard")}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
              Go to Dashboard
            </button>
            <button onClick={() => router.push("/careers")}
              className="border border-gray-300 px-6 py-2 rounded-lg hover:bg-gray-50">
              Browse More Jobs
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white py-6">
        <div className="max-w-2xl mx-auto px-6">
          <button onClick={() => router.push(`/careers/${jobId}`)} className="text-blue-200 hover:text-white text-sm mb-2 inline-block">← Back to job</button>
          <h1 className="text-2xl font-bold">Apply: {job.title}</h1>
          {job.department && <p className="text-blue-100 mt-1">{job.department} {job.location ? `| ${job.location}` : ""}</p>}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3"><p className="text-red-700 text-sm">{error}</p></div>}

          {/* Resume Upload */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-3">Resume / CV</h2>
            <p className="text-sm text-gray-500 mb-3">Upload your resume. AI will analyze it against the job requirements.</p>
            <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={e => setResume(e.target.files?.[0] || null)} required
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            {resume && <p className="text-xs text-green-600 mt-2">Selected: {resume.name}</p>}
          </div>

          {/* Screening Questions */}
          {job.screening_questions && job.screening_questions.length > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-1">Screening Questions</h2>
              <p className="text-sm text-gray-400 mb-4">Answer these briefly to help us understand your fit.</p>
              <div className="space-y-4">
                {job.screening_questions.map((q: string, i: number) => (
                  <div key={i}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{q}</label>
                    <textarea
                      value={answers[`q${i}`] || ""} rows={3}
                      onChange={e => setAnswers(prev => ({ ...prev, [`q${i}`]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Your answer..."
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold text-lg">
            {submitting ? "Submitting & Analyzing Resume..." : "Submit Application"}
          </button>
        </form>
      </div>
    </div>
  );
}
