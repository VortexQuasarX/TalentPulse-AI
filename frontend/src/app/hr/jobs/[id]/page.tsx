"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

const ROUND_LABELS: Record<string, string> = { screening: "Screening", technical: "Technical", hr_cultural: "HR & Cultural" };

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRound, setEditingRound] = useState<number | null>(null);
  const [editSource, setEditSource] = useState<"ai_generated" | "custom">("ai_generated");
  const [editQuestions, setEditQuestions] = useState("");
  const [editMaxQ, setEditMaxQ] = useState(5);

  const fetchData = () => {
    Promise.all([
      api.get(`/jobs/public/${params.id}`),
      api.get(`/jobs/${params.id}/applications`),
      api.get(`/jobs/${params.id}/rounds`),
    ]).then(([j, apps, r]) => { setJob(j); setApplications(apps); setRounds(r); }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [params.id]);

  const startEditRound = (round: any) => {
    setEditingRound(round.round_number);
    setEditSource(round.question_source || "ai_generated");
    setEditQuestions(round.custom_questions ? round.custom_questions.join("\n") : "");
    setEditMaxQ(round.max_questions || 5);
  };

  const saveRound = async () => {
    if (!editingRound) return;
    const questions = editSource === "custom" ? editQuestions.split("\n").filter(q => q.trim()) : [];
    await api.put(
      `/jobs/${params.id}/rounds/${editingRound}?question_source=${editSource}&custom_questions=${encodeURIComponent(JSON.stringify(questions))}&max_questions=${editSource === "custom" ? questions.length : editMaxQ}`
    );
    setEditingRound(null);
    fetchData();
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!job) return <p className="text-red-500">Job not found</p>;

  const shortlisted = applications.filter(a => a.status === "shortlisted" || a.status === "interview");
  const pending = applications.filter(a => a.status === "submitted" || a.status === "screening");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <p className="text-sm text-gray-500">{job.department || ""} {job.location ? `| ${job.location}` : ""} | {job.skills}</p>
        </div>
        <div className="flex gap-2">
          {job.pipeline_id && (
            <button onClick={() => router.push(`/hr/pipelines/${job.pipeline_id}`)}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900">View Pipeline</button>
          )}
          <button onClick={() => window.open(`/careers/${params.id}`, "_blank")}
            className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">View Public Page</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xs text-gray-400">Total</p><p className="text-2xl font-bold">{applications.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xs text-gray-400">Shortlisted</p><p className="text-2xl font-bold text-green-600">{shortlisted.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xs text-gray-400">Pending</p><p className="text-2xl font-bold text-yellow-600">{pending.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xs text-gray-400">Rejected</p><p className="text-2xl font-bold text-red-600">{applications.filter(a => a.status === "rejected").length}</p>
        </div>
      </div>

      {/* Interview Round Configuration */}
      <div className="bg-white rounded-xl border p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Interview Rounds — Question Configuration</h3>
        <div className="space-y-3">
          {rounds.map(r => (
            <div key={r.round_number} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">Round {r.round_number}: {ROUND_LABELS[r.round_type] || r.round_type}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${r.question_source === "custom" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                    {r.question_source === "custom" ? `Custom (${r.custom_questions?.length || 0} questions)` : `AI Generated (${r.max_questions} questions)`}
                  </span>
                </div>
                <button onClick={() => editingRound === r.round_number ? setEditingRound(null) : startEditRound(r)}
                  className="text-xs text-blue-600 hover:text-blue-800">
                  {editingRound === r.round_number ? "Cancel" : "Edit"}
                </button>
              </div>

              {r.custom_questions && r.custom_questions.length > 0 && editingRound !== r.round_number && (
                <div className="mt-2 text-sm text-gray-500">
                  {r.custom_questions.map((q: string, i: number) => (
                    <p key={i} className="text-xs text-gray-400">{i + 1}. {q}</p>
                  ))}
                </div>
              )}

              {editingRound === r.round_number && (
                <div className="mt-3 space-y-3 border-t pt-3">
                  <div className="flex gap-2">
                    <button onClick={() => setEditSource("ai_generated")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${editSource === "ai_generated" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                      AI Generated
                    </button>
                    <button onClick={() => setEditSource("custom")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${editSource === "custom" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                      Custom Questions
                    </button>
                  </div>

                  {editSource === "ai_generated" ? (
                    <div>
                      <label className="text-xs text-gray-500">Number of questions</label>
                      <input type="number" min={2} max={15} value={editMaxQ} onChange={e => setEditMaxQ(+e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-gray-500">Enter questions (one per line)</label>
                      <textarea value={editQuestions} onChange={e => setEditQuestions(e.target.value)} rows={5}
                        placeholder="What is your experience with React?\nExplain the difference between..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                      <p className="text-xs text-gray-400 mt-1">{editQuestions.split("\n").filter(q => q.trim()).length} questions</p>
                    </div>
                  )}

                  <button onClick={saveRound}
                    className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs hover:bg-blue-700">
                    Save Round {r.round_number}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Screening Questions */}
      {job.screening_questions?.length > 0 && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-6">
          <h3 className="text-sm font-semibold text-blue-700 mb-2">Application Screening Questions (AI-Generated)</h3>
          <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
            {job.screening_questions.map((q: string, i: number) => <li key={i}>{q}</li>)}
          </ol>
        </div>
      )}

      {/* Interview Pipeline Link */}
      {job.pipeline_id && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-5 mb-6 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Interview Pipeline</h3>
            <p className="text-sm text-gray-500">View interview rounds, candidate videos, anomaly detection analytics, and AI agent recommendations</p>
          </div>
          <button onClick={() => router.push(`/hr/pipelines/${job.pipeline_id}`)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm shrink-0">
            Open Pipeline →
          </button>
        </div>
      )}

      {/* Applications */}
      <h2 className="text-lg font-semibold mb-4">Applications ({applications.length})</h2>
      {applications.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
          No applications yet. Share the careers page: <span className="text-blue-600">/careers/{params.id}</span>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map(a => (
            <div key={a.id} className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{a.candidate_name || "Unknown"}</p>
                  <p className="text-sm text-gray-500">{a.candidate_email}</p>
                </div>
                <div className="flex items-center gap-3">
                  {a.relevance_score != null && (
                    <span className={`text-lg font-bold ${a.relevance_score >= 50 ? "text-green-600" : "text-red-600"}`}>
                      {Math.round(a.relevance_score)}%
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    a.status === "shortlisted" || a.status === "interview" ? "bg-green-100 text-green-700" :
                    a.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                  }`}>{a.status}</span>
                  {a.shortlisted_by && <span className="text-[10px] text-gray-400">by {a.shortlisted_by}</span>}
                  {(a.status === "submitted" || a.status === "screening") && (
                    <button onClick={async () => {
                      await api.post(`/jobs/${params.id}/manual-shortlist/${a.id}`);
                      fetchData();
                    }} className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700">
                      Shortlist
                    </button>
                  )}
                </div>
              </div>

              {a.relevance_analysis && (
                <div className="mt-3 bg-gray-50 rounded-lg p-3 text-sm">
                  {a.relevance_analysis.matched_skills?.length > 0 && (
                    <div className="mb-1"><span className="text-green-700 font-medium">Matched: </span>{a.relevance_analysis.matched_skills.join(", ")}</div>
                  )}
                  {a.relevance_analysis.missing_skills?.length > 0 && (
                    <div className="mb-1"><span className="text-red-600 font-medium">Missing: </span>{a.relevance_analysis.missing_skills.join(", ")}</div>
                  )}
                  {a.relevance_analysis.reasoning && <p className="text-gray-500 text-xs mt-1">{a.relevance_analysis.reasoning}</p>}
                </div>
              )}

              {a.screening_answers && Object.keys(a.screening_answers).length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-blue-600 cursor-pointer">View screening answers</summary>
                  <div className="mt-2 text-sm space-y-2">
                    {Object.entries(a.screening_answers).map(([key, val]) => (
                      <div key={key} className="bg-gray-50 rounded p-2">
                        <p className="text-xs text-gray-400">{job.screening_questions?.[parseInt(key.replace("q", ""))] || key}</p>
                        <p className="text-gray-700">{val as string}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
