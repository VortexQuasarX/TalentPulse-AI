"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import EvaluationReport from "@/components/EvaluationReport";
import Transcript from "@/components/Transcript";
import type { InterviewSession } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export default function InterviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    api.get(`/interviews/${params.id}`).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!data) return <p className="text-red-500">Interview not found.</p>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{data.title}</h1>
        <p className="text-gray-500">{data.job_role} | {data.skills}</p>
        {data.pipeline_id && (
          <button onClick={() => router.push(`/hr/pipelines/${data.pipeline_id}`)}
            className="text-sm text-blue-600 hover:underline mt-1">View full pipeline</button>
        )}
      </div>

      <h2 className="text-lg font-semibold mb-4">Sessions ({data.sessions?.length || 0})</h2>
      <div className="space-y-3">
        {(data.sessions || []).map((s: InterviewSession) => (
          <div key={s.id} className="bg-white rounded-xl border">
            <div className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
              <div>
                <p className="font-medium">{s.candidate_name || "Unknown"}</p>
                <p className="text-sm text-gray-500">{s.candidate_email}</p>
              </div>
              <div className="flex items-center gap-3">
                {s.evaluation?.proficiencyScore != null && (
                  <span className="font-bold text-blue-600">{s.evaluation.proficiencyScore}/100</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  s.status === "completed" ? "bg-green-100 text-green-700" :
                  s.status === "in_progress" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"
                }`}>{s.status}</span>
                {s.status === "in_progress" && (
                  <button onClick={(e) => { e.stopPropagation(); router.push(`/hr/live/${s.id}`); }}
                    className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg hover:bg-red-700 animate-pulse">LIVE</button>
                )}
                {s.status === "completed" && (
                  <button onClick={(e) => { e.stopPropagation(); router.push(`/hr/analytics/${s.id}`); }}
                    className="text-xs bg-purple-600 text-white px-2.5 py-1 rounded-lg hover:bg-purple-700">Analytics</button>
                )}
                {s.status === "completed" && s.shortlist_status === "approved" && (
                  <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-lg font-medium">Moved ✓</span>
                )}
                {s.status === "completed" && s.shortlist_status !== "approved" && (
                  <button onClick={async (e) => {
                    e.stopPropagation();
                    const pid = data.pipeline_id;
                    if (!pid) { alert("No pipeline linked to this interview"); return; }
                    if (!confirm(`Move ${s.candidate_name || "this candidate"} to next stage?`)) return;
                    try {
                      await api.post(`/pipelines/${pid}/manual-advance/${s.candidate_id}`);
                      api.get(`/interviews/${params.id}`).then(setData);
                    } catch (err: any) { alert(err.message); }
                  }}
                    className="text-xs bg-orange-600 text-white px-2.5 py-1 rounded-lg hover:bg-orange-700">
                    Move to Next Stage
                  </button>
                )}
              </div>
            </div>
            {expanded === s.id && (
              <div className="border-t px-5 py-5 space-y-4">
                {/* Video + Audio */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Interview Video</h4>
                    <video controls className="w-full rounded-lg bg-black"
                      src={`${API}/session/video/${s.id}`}
                      onError={(e) => { (e.target as HTMLVideoElement).style.display = "none"; }} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Interview Audio</h4>
                    <audio controls className="w-full"
                      src={`${API}/session/audio/${s.id}`}
                      onError={(e) => { (e.target as HTMLAudioElement).style.display = "none"; }} />
                  </div>
                </div>

                {/* Evaluation */}
                {s.evaluation && <EvaluationReport evaluation={s.evaluation} />}

                {/* Anomaly Detection Metrics */}
                {s.behavior_summary && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold mb-3">Anomaly Detection Metrics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                      {[
                        { label: "Eye Contact", value: s.behavior_summary.avg_eye_contact },
                        { label: "Posture", value: s.behavior_summary.avg_posture },
                        { label: "Engagement", value: s.behavior_summary.avg_engagement },
                        { label: "Anomalies", value: s.behavior_summary.total_anomalies, isCount: true },
                        { label: "Grade", value: s.behavior_summary.behavior_grade, isGrade: true },
                      ].map((m, i) => (
                        <div key={i} className="bg-white rounded-lg p-3 text-center border">
                          <p className="text-xs text-gray-400">{m.label}</p>
                          <p className={`text-xl font-bold ${
                            m.isGrade ? (["A+","A"].includes(String(m.value)) ? "text-green-600" : ["B","C"].includes(String(m.value)) ? "text-yellow-600" : "text-red-600") :
                            m.isCount ? ((m.value || 0) === 0 ? "text-green-600" : "text-red-600") :
                            ((m.value || 0) >= 70 ? "text-green-600" : (m.value || 0) >= 40 ? "text-yellow-600" : "text-red-600")
                          }`}>
                            {m.isGrade ? (m.value || "N/A") : m.isCount ? (m.value || 0) : `${Math.round(m.value || 0)}%`}
                          </p>
                        </div>
                      ))}
                    </div>
                    {(s.tab_switch_count || 0) > 0 && (
                      <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                        <span className="text-sm text-red-700 font-medium">Tab Switches: {s.tab_switch_count}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Transcript */}
                {s.conversation_history && s.conversation_history.length > 0 && (
                  <Transcript messages={s.conversation_history} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
