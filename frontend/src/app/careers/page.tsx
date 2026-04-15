"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface Job {
  id: number; title: string; department?: string; location?: string;
  job_type: string; experience_level: string; salary_range?: string;
  description: string; skills: string; created_at: string; application_count: number;
}

const TYPE_LABELS: Record<string, string> = { full_time: "Full Time", part_time: "Part Time", contract: "Contract", intern: "Internship" };
const LEVEL_LABELS: Record<string, string> = { entry: "Entry Level", mid: "Mid Level", senior: "Senior", lead: "Lead" };

export default function CareersPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`${API}/jobs/public`).then(r => r.json()).then(setJobs).finally(() => setLoading(false));
  }, []);

  const filtered = jobs.filter(j =>
    !search || j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.skills.toLowerCase().includes(search.toLowerCase()) ||
    (j.department || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h1 className="text-4xl font-bold mb-2">Vertical AI Careers</h1>
          <p className="text-blue-100 text-lg mb-8">Join our team and shape the future of AI-powered hiring</p>
          <div className="relative">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by job title, skill, or department..."
              className="w-full px-5 py-3 rounded-xl text-gray-900 text-lg focus:ring-2 focus:ring-blue-300 focus:outline-none" />
            <span className="absolute right-4 top-3.5 text-gray-400 text-lg">🔍</span>
          </div>
        </div>
      </div>

      {/* Jobs */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <p className="text-sm text-gray-500 mb-6">{filtered.length} open position{filtered.length !== 1 ? "s" : ""}</p>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
            {jobs.length === 0 ? "No open positions right now. Check back soon!" : "No jobs match your search."}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(j => (
              <div key={j.id} className="bg-white rounded-xl border p-6 hover:shadow-md transition cursor-pointer"
                onClick={() => router.push(`/careers/${j.id}`)}>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{j.title}</h2>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                      {j.department && <span>{j.department}</span>}
                      {j.location && <span>📍 {j.location}</span>}
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{TYPE_LABELS[j.job_type] || j.job_type}</span>
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{LEVEL_LABELS[j.experience_level] || j.experience_level}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {j.skills.split(",").map((s, i) => (
                        <span key={i} className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs">{s.trim()}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {j.salary_range && <p className="text-sm font-semibold text-green-600">{j.salary_range}</p>}
                    <p className="text-xs text-gray-400 mt-1">{j.application_count} applicant{j.application_count !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t bg-white py-8 text-center text-sm text-gray-400">
        Vertical AI © 2026 | Powered by AI Interview Platform
      </div>
    </div>
  );
}
