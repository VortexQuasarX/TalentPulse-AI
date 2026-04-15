"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

const TYPE_LABELS: Record<string, string> = { full_time: "Full Time", part_time: "Part Time", contract: "Contract", intern: "Internship" };
const LEVEL_LABELS: Record<string, string> = { entry: "Entry Level", mid: "Mid Level", senior: "Senior", lead: "Lead" };

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/jobs/public/${params.id}`).then(r => r.json()).then(setJob).finally(() => setLoading(false));
  }, [params.id]);

  const handleApply = () => {
    if (isAuthenticated()) {
      router.push(`/careers/${params.id}/apply`);
    } else {
      // Store intended job, redirect to register
      localStorage.setItem("apply_job_id", String(params.id));
      router.push("/register");
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!job) return <div className="max-w-3xl mx-auto px-6 py-20 text-center text-red-500">Job not found</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white py-6">
        <div className="max-w-3xl mx-auto px-6">
          <button onClick={() => router.push("/careers")} className="text-blue-200 hover:text-white text-sm mb-4 inline-block">← Back to all jobs</button>
          <h1 className="text-3xl font-bold">{job.title}</h1>
          <div className="flex items-center gap-3 mt-3 text-sm text-blue-100">
            {job.department && <span>{job.department}</span>}
            {job.location && <span>📍 {job.location}</span>}
            <span className="bg-white/20 px-2 py-0.5 rounded">{TYPE_LABELS[job.job_type] || job.job_type}</span>
            <span className="bg-white/20 px-2 py-0.5 rounded">{LEVEL_LABELS[job.experience_level] || job.experience_level}</span>
          </div>
          {job.salary_range && <p className="mt-2 text-lg font-semibold text-green-300">{job.salary_range}</p>}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl border p-8 space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">About the Role</h2>
            <p className="text-gray-600 whitespace-pre-wrap">{job.description}</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Requirements</h2>
            <p className="text-gray-600 whitespace-pre-wrap">{job.requirements}</p>
          </div>

          {job.responsibilities && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Responsibilities</h2>
              <p className="text-gray-600 whitespace-pre-wrap">{job.responsibilities}</p>
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold mb-2">Required Skills</h2>
            <div className="flex flex-wrap gap-2">
              {job.skills.split(",").map((s: string, i: number) => (
                <span key={i} className="bg-purple-50 text-purple-700 px-3 py-1 rounded-lg text-sm">{s.trim()}</span>
              ))}
            </div>
          </div>

          {job.benefits && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Benefits</h2>
              <p className="text-gray-600 whitespace-pre-wrap">{job.benefits}</p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <button onClick={handleApply}
            className="bg-blue-600 text-white px-10 py-3.5 rounded-xl hover:bg-blue-700 text-lg font-semibold shadow-lg">
            Apply Now
          </button>
          <p className="text-xs text-gray-400 mt-2">You'll need to create an account to apply</p>
        </div>
      </div>
    </div>
  );
}
