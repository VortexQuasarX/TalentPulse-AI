"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Candidate {
  session_id: number;
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  interview_id: number;
  interview_title: string;
  job_role: string;
  status: "pending" | "in_progress" | "completed";
  score: number | null;
  started_at: string | null;
  completed_at: string | null;
}

export default function CandidatesPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all");
  const [search, setSearch] = useState("");

  const fetchCandidates = () => {
    api.get("/interviews/candidates").then(setCandidates).finally(() => setLoading(false));
  };

  useEffect(() => { fetchCandidates(); }, []);

  const handleDelete = async (sessionId: number, name: string) => {
    if (!confirm(`Remove ${name}?`)) return;
    try {
      await api.del(`/interviews/sessions/${sessionId}`);
      fetchCandidates();
    } catch (err: any) {
      alert(err.message || "Failed to remove");
    }
  };

  const filtered = candidates.filter((c) => {
    if (filter !== "all" && c.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.candidate_name.toLowerCase().includes(q) ||
        c.candidate_email.toLowerCase().includes(q) ||
        c.interview_title.toLowerCase().includes(q) ||
        c.job_role.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const total = candidates.length;
  const completed = candidates.filter((c) => c.status === "completed").length;
  const pending = candidates.filter((c) => c.status === "pending").length;
  const inProgress = candidates.filter((c) => c.status === "in_progress").length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">All Candidates</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <button onClick={() => setFilter("all")}
          className={`rounded-xl border p-4 text-left ${filter === "all" ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white"}`}>
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold">{total}</p>
        </button>
        <button onClick={() => setFilter("pending")}
          className={`rounded-xl border p-4 text-left ${filter === "pending" ? "ring-2 ring-gray-500 bg-gray-50" : "bg-white"}`}>
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-gray-600">{pending}</p>
        </button>
        <button onClick={() => setFilter("in_progress")}
          className={`rounded-xl border p-4 text-left ${filter === "in_progress" ? "ring-2 ring-yellow-500 bg-yellow-50" : "bg-white"}`}>
          <p className="text-sm text-gray-500">In Progress</p>
          <p className="text-2xl font-bold text-yellow-600">{inProgress}</p>
        </button>
        <button onClick={() => setFilter("completed")}
          className={`rounded-xl border p-4 text-left ${filter === "completed" ? "ring-2 ring-green-500 bg-green-50" : "bg-white"}`}>
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-green-600">{completed}</p>
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, interview, or role..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
          {candidates.length === 0 ? "No candidates yet. Assign candidates from an interview page." : "No candidates match your filter."}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Candidate</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Interview</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Role</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Score</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Date</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.session_id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium">{c.candidate_name}</p>
                    <p className="text-xs text-gray-400">{c.candidate_email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => router.push(`/hr/interviews/${c.interview_id}`)}
                      className="text-blue-600 hover:underline"
                    >
                      {c.interview_title}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{c.job_role}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.status === "completed" ? "bg-green-100 text-green-700" :
                      c.status === "in_progress" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {c.score !== null ? (
                      <span className={`font-semibold ${
                        c.score >= 70 ? "text-green-600" : c.score >= 40 ? "text-yellow-600" : "text-red-600"
                      }`}>
                        {c.score}/100
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {c.completed_at ? new Date(c.completed_at).toLocaleDateString() :
                     c.started_at ? new Date(c.started_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => handleDelete(c.session_id, c.candidate_name)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
