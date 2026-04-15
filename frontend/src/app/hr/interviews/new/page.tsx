"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function CreateInterviewPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [skills, setSkills] = useState("");
  const [maxQuestions, setMaxQuestions] = useState(5);
  const [candidateEmail, setCandidateEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [assignMsg, setAssignMsg] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const iv = await api.post("/interviews/", {
        title, job_role: jobRole, skills, max_questions: maxQuestions,
      });
      setCreatedId(iv.id);
    } catch (err: any) {
      setError(err.message || "Failed to create interview");
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!createdId || !candidateEmail) return;
    setAssignMsg("");
    try {
      await api.post(`/interviews/${createdId}/assign`, { candidate_email: candidateEmail });
      setAssignMsg(`Assigned to ${candidateEmail}`);
      setCandidateEmail("");
    } catch (err: any) {
      setAssignMsg(err.message || "Failed to assign");
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Create Interview</h1>

      {!createdId ? (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border p-6 space-y-4">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Senior React Developer Interview"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Role</label>
            <input type="text" required value={jobRole} onChange={(e) => setJobRole(e.target.value)}
              placeholder="e.g., Frontend Developer"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma-separated)</label>
            <input type="text" required value={skills} onChange={(e) => setSkills(e.target.value)}
              placeholder="e.g., React, TypeScript, CSS, Node.js"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Questions</label>
            <input type="number" min={2} max={15} value={maxQuestions} onChange={(e) => setMaxQuestions(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Creating..." : "Create Interview"}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-green-800 font-medium">Interview created successfully!</p>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-4">Assign Candidate</h2>
            <div className="flex gap-2">
              <input type="email" value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)}
                placeholder="candidate@email.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              <button onClick={handleAssign}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                Assign
              </button>
            </div>
            {assignMsg && <p className="text-sm mt-2 text-gray-600">{assignMsg}</p>}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setCreatedId(null)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              Create Another
            </button>
            <button onClick={() => router.push(`/hr/interviews/${createdId}`)}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900">
              View Interview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
