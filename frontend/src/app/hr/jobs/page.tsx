"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function HRJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/jobs/").then(setJobs).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Job Postings</h1>
        <button onClick={() => router.push("/hr/jobs/new")}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
          + Create Job Posting
        </button>
      </div>

      {loading ? <p className="text-gray-500">Loading...</p> : jobs.length === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
          No job postings yet. Create your first job to start receiving applications.
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map(j => (
            <div key={j.id} className="bg-white rounded-xl border p-5 hover:shadow-sm cursor-pointer"
              onClick={() => router.push(`/hr/jobs/${j.id}`)}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{j.title}</h3>
                  <p className="text-sm text-gray-500">{j.department || ""} {j.location ? `| ${j.location}` : ""}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {j.skills?.split(",").slice(0, 5).map((s: string, i: number) => (
                      <span key={i} className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs">{s.trim()}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-gray-400">Applicants</p>
                    <p className="font-bold text-lg">{j.application_count || 0}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${j.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {j.status}
                  </span>
                  <button onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Delete "${j.title}"?`)) return;
                    await api.del(`/jobs/${j.id}`);
                    setJobs(prev => prev.filter(x => x.id !== j.id));
                  }} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
