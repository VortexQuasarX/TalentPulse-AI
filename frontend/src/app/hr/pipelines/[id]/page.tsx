"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { PipelineDetail, AgentAction } from "@/lib/types";
import EvaluationReport from "@/components/EvaluationReport";
import Transcript from "@/components/Transcript";

const ROUND_LABELS: Record<string, string> = {
  screening: "Screening", technical: "Technical", hr_cultural: "HR & Cultural",
};

export default function PipelineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<PipelineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRound, setActiveRound] = useState(1);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentResult, setAgentResult] = useState<any>(null);
  const [expandedCandidate, setExpandedCandidate] = useState<number | null>(null);
  const [candidateEmail, setCandidateEmail] = useState("");
  const [assignMsg, setAssignMsg] = useState("");

  const fetchData = () => {
    api.get(`/pipelines/${params.id}`).then(setData).finally(() => setLoading(false));
  };
  useEffect(() => { fetchData(); }, [params.id]);

  const triggerAgent = async () => {
    setAgentLoading(true);
    setAgentResult(null);
    try {
      const res = await api.post(`/agent/analyze-round?pipeline_id=${params.id}&round_number=${activeRound}`);
      setAgentResult(res.result);
      fetchData();
    } catch (err: any) { alert(err.message); }
    finally { setAgentLoading(false); }
  };

  const approveAction = async () => {
    try {
      const actions = await api.get(`/agent/recommendations/${params.id}/${activeRound}`);
      if (actions.length > 0) {
        await api.post(`/agent/recommendations/${actions[0].id}/approve`);
        fetchData();
        alert("Recommendations approved! Candidates notified.");
      }
    } catch (err: any) { alert(err.message); }
  };

  const advanceRound = async () => {
    try {
      const res = await api.post(`/pipelines/${params.id}/advance/${activeRound}`);
      alert(res.message);
      fetchData();
    } catch (err: any) { alert(err.message); }
  };

  const handleAssign = async () => {
    if (!candidateEmail.trim()) return;
    setAssignMsg("");
    try {
      await api.post(`/pipelines/${params.id}/candidates`, { candidate_email: candidateEmail });
      setAssignMsg(`Added ${candidateEmail}`);
      setCandidateEmail("");
      fetchData();
    } catch (err: any) { setAssignMsg(err.message); }
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!data) return <p className="text-red-500">Pipeline not found.</p>;

  const currentRound = data.rounds.find(r => r.round_number === activeRound);
  const roundCandidates = data.candidates.map(c => {
    const session = c.sessions?.find(s => s.round_number === activeRound);
    return { ...c, roundSession: session };
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{data.title}</h1>
        <p className="text-gray-500">{data.job_role} | {data.skills}</p>
      </div>

      {/* Add Candidate */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex gap-2">
          <input type="email" value={candidateEmail} onChange={e => setCandidateEmail(e.target.value)}
            placeholder="Add candidate by email..." className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            onKeyDown={e => e.key === "Enter" && handleAssign()} />
          <button onClick={handleAssign} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Add</button>
        </div>
        {assignMsg && <p className="text-sm mt-2 text-green-600">{assignMsg}</p>}
      </div>

      {/* Round Tabs */}
      <div className="flex gap-2 mb-6">
        {data.rounds.map(r => (
          <button key={r.round_number}
            onClick={() => { setActiveRound(r.round_number); setAgentResult(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              activeRound === r.round_number ? "bg-blue-600 text-white" : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}>
            R{r.round_number}: {ROUND_LABELS[r.round_type] || r.round_type}
            <span className="ml-2 text-xs opacity-70">{r.completed_sessions}/{r.total_sessions}</span>
            {r.question_source === "custom" && <span className="ml-1 text-[10px] opacity-60">(Custom Q)</span>}
          </button>
        ))}
      </div>

      {/* Agent Actions Bar */}
      <div className="bg-white rounded-xl border p-4 mb-6 flex items-center gap-3 flex-wrap">
        <button onClick={triggerAgent} disabled={agentLoading}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
          {agentLoading ? "Analyzing..." : "Run HR Agent Analysis"}
        </button>
        <button onClick={approveAction}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
          Approve Recommendations
        </button>
        {activeRound < 3 && (
          <button onClick={advanceRound}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700">
            Move to Stage {activeRound + 1}
          </button>
        )}
        {activeRound === 3 && (
          <button onClick={async () => {
            const report = await api.post(`/agent/final-report/${params.id}`);
            setAgentResult(report);
          }} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900">
            Generate Final Report
          </button>
        )}
      </div>

      {/* Agent Result */}
      {agentResult && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-purple-800 mb-3">HR Agent Analysis</h3>
          {agentResult.summary && <p className="text-sm text-gray-700 mb-3">{agentResult.summary}</p>}
          {agentResult.executive_summary && <p className="text-sm text-gray-700 mb-3">{agentResult.executive_summary}</p>}
          {agentResult.recommendations?.map((rec: any, i: number) => (
            <div key={i} className={`p-3 rounded-lg mb-2 ${rec.decision === "shortlist" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{rec.candidate_name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${rec.decision === "shortlist" ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"}`}>
                  {rec.decision.toUpperCase()} ({rec.confidence}%)
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{rec.reasoning}</p>
              {rec.risk_flags?.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {rec.risk_flags.map((f: string, j: number) => (
                    <span key={j} className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">{f}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {agentResult.candidate_rankings?.map((r: any, i: number) => (
            <div key={i} className="p-3 bg-white rounded-lg mb-2 border">
              <span className="font-bold text-lg mr-2">#{r.rank}</span>
              <span className="font-medium">{r.candidate_name}</span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                r.recommendation === "hire" ? "bg-green-200 text-green-800" : "bg-yellow-200 text-yellow-800"
              }`}>{r.recommendation}</span>
              <span className="ml-2 text-sm text-gray-500">Score: {r.overall_score}/100</span>
              <p className="text-sm text-gray-600 mt-1">{r.cross_round_analysis}</p>
            </div>
          ))}
        </div>
      )}

      {/* Candidate List for Active Round */}
      <h2 className="text-lg font-semibold mb-4">
        Candidates — Round {activeRound} ({ROUND_LABELS[currentRound?.round_type || ""] || ""})
      </h2>
      <div className="space-y-3">
        {roundCandidates.map(c => (
          <div key={c.candidate_id} className="bg-white rounded-xl border">
            <div className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedCandidate(expandedCandidate === c.candidate_id ? null : c.candidate_id)}>
              <div>
                <p className="font-medium">{c.candidate_name}</p>
                <p className="text-sm text-gray-500">{c.candidate_email}</p>
              </div>
              <div className="flex items-center gap-3">
                {c.roundSession?.evaluation?.proficiencyScore != null && (
                  <span className="font-bold text-blue-600">{c.roundSession.evaluation.proficiencyScore}/100</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  c.roundSession?.status === "completed" ? "bg-green-100 text-green-700" :
                  c.roundSession?.status === "in_progress" ? "bg-yellow-100 text-yellow-700" :
                  !c.roundSession ? "bg-gray-50 text-gray-400" : "bg-gray-100 text-gray-600"
                }`}>
                  {c.roundSession?.status || "not assigned"}
                </span>
                {c.roundSession?.shortlist_status && c.roundSession.shortlist_status !== "pending" && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    c.roundSession.shortlist_status === "approved" ? "bg-green-200 text-green-800" :
                    c.roundSession.shortlist_status === "recommended" ? "bg-purple-100 text-purple-700" :
                    "bg-red-100 text-red-700"
                  }`}>{c.roundSession.shortlist_status}</span>
                )}
                {(c.roundSession?.tab_switch_count || 0) > 0 && (
                  <span className="text-xs text-red-500">Tab: {c.roundSession?.tab_switch_count}</span>
                )}
                {c.roundSession?.status === "in_progress" && c.roundSession?.session_id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/hr/live/${c.roundSession!.session_id}`); }}
                    className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg hover:bg-red-700 animate-pulse"
                  >
                    LIVE
                  </button>
                )}
                {c.roundSession?.status === "completed" && c.roundSession?.session_id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/hr/analytics/${c.roundSession!.session_id}`); }}
                    className="text-xs bg-purple-600 text-white px-2.5 py-1 rounded-lg hover:bg-purple-700"
                  >
                    Analytics
                  </button>
                )}
                {c.roundSession?.status === "completed" && c.roundSession?.shortlist_status === "approved" && (
                  <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-lg font-medium">Moved ✓</span>
                )}
                {c.roundSession?.status === "completed" && c.roundSession?.shortlist_status !== "approved" && activeRound < 3 && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm(`Manually advance ${c.candidate_name} to Round ${activeRound + 1}?`)) return;
                      try {
                        await api.post(`/pipelines/${params.id}/manual-advance/${c.candidate_id}`);
                        fetchData();
                      } catch (err: any) { alert(err.message); }
                    }}
                    className="text-xs bg-orange-600 text-white px-2.5 py-1 rounded-lg hover:bg-orange-700"
                  >
                    Move to Next Stage
                  </button>
                )}
              </div>
            </div>
            {expandedCandidate === c.candidate_id && (
              <div className="border-t px-5 py-5 space-y-4">
                {/* Video + Audio Playback */}
                {c.roundSession?.session_id && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Interview Video</h4>
                      <video
                        controls className="w-full rounded-lg bg-black"
                        src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001"}/session/video/${c.roundSession.session_id}`}
                        onError={(e) => { (e.target as HTMLVideoElement).style.display = "none"; }}
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Interview Audio</h4>
                      <audio
                        controls className="w-full"
                        src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001"}/session/audio/${c.roundSession.session_id}`}
                        onError={(e) => { (e.target as HTMLAudioElement).style.display = "none"; }}
                      />
                    </div>
                  </div>
                )}

                {/* Evaluation Scores */}
                {c.roundSession?.evaluation && (
                  <EvaluationReport evaluation={c.roundSession.evaluation} />
                )}

                {/* Behavior / Anomaly Metrics */}
                {c.roundSession?.behavior_summary && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold mb-3">Anomaly Detection Metrics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                      <div className="bg-white rounded-lg p-3 text-center border">
                        <p className="text-xs text-gray-400">Eye Contact</p>
                        <p className={`text-xl font-bold ${(c.roundSession.behavior_summary.avg_eye_contact || 0) >= 70 ? "text-green-600" : (c.roundSession.behavior_summary.avg_eye_contact || 0) >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                          {Math.round(c.roundSession.behavior_summary.avg_eye_contact || 0)}%
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center border">
                        <p className="text-xs text-gray-400">Posture</p>
                        <p className={`text-xl font-bold ${(c.roundSession.behavior_summary.avg_posture || 0) >= 70 ? "text-green-600" : (c.roundSession.behavior_summary.avg_posture || 0) >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                          {Math.round(c.roundSession.behavior_summary.avg_posture || 0)}%
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center border">
                        <p className="text-xs text-gray-400">Engagement</p>
                        <p className={`text-xl font-bold ${(c.roundSession.behavior_summary.avg_engagement || 0) >= 70 ? "text-green-600" : (c.roundSession.behavior_summary.avg_engagement || 0) >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                          {Math.round(c.roundSession.behavior_summary.avg_engagement || 0)}%
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center border">
                        <p className="text-xs text-gray-400">Anomalies</p>
                        <p className={`text-xl font-bold ${(c.roundSession.behavior_summary.total_anomalies || 0) === 0 ? "text-green-600" : "text-red-600"}`}>
                          {c.roundSession.behavior_summary.total_anomalies || 0}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center border">
                        <p className="text-xs text-gray-400">Grade</p>
                        <p className={`text-xl font-bold ${
                          ["A+","A"].includes(c.roundSession.behavior_summary.behavior_grade || "") ? "text-green-600" :
                          ["B","C"].includes(c.roundSession.behavior_summary.behavior_grade || "") ? "text-yellow-600" : "text-red-600"
                        }`}>
                          {c.roundSession.behavior_summary.behavior_grade || "N/A"}
                        </p>
                      </div>
                    </div>
                    {(c.roundSession.tab_switch_count || 0) > 0 && (
                      <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                        <span className="text-sm text-red-700 font-medium">
                          Tab Switches: {c.roundSession.tab_switch_count} — candidate switched away from interview tab
                        </span>
                      </div>
                    )}
                    {c.roundSession.behavior_summary.dominant_emotion && (
                      <p className="text-xs text-gray-500 mt-2">
                        Dominant emotion: <span className="font-medium capitalize">{c.roundSession.behavior_summary.dominant_emotion}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* If no evaluation yet */}
                {!c.roundSession?.evaluation && !c.roundSession?.behavior_summary && (
                  <p className="text-sm text-gray-400">Interview not completed yet.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
