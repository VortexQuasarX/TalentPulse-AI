"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getUserName, clearAuth } from "@/lib/auth";
import type { CandidatePipelineStatus, Notification } from "@/lib/types";

const ROUND_LABELS: Record<string, string> = { screening: "Screening", technical: "Technical", hr_cultural: "HR & Cultural" };

export default function CandidateDashboard() {
  const router = useRouter();
  const name = getUserName();
  const [pipelines, setPipelines] = useState<CandidatePipelineStatus[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/candidates/pipeline-status").catch(() => []),
      api.get("/candidates/applications").catch(() => []),
      api.get("/notifications/").catch(() => []),
    ]).then(([p, a, n]) => {
      setPipelines(p);
      setApplications(a);
      setNotifications(n.filter((x: Notification) => !x.read).slice(0, 5));
    }).finally(() => setLoading(false));
  }, []);

  // Check if user has been hired — their role changed server-side but token is stale
  const isHired = pipelines.some(p => p.overall_status === "hired");
  const [showHiredPopup, setShowHiredPopup] = useState(false);

  useEffect(() => {
    if (isHired && !loading) {
      setShowHiredPopup(true);
    }
  }, [isHired, loading]);

  const handleHiredRedirect = () => {
    // Clear old token, force re-login to get employee role
    clearAuth();
    router.push("/login");
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  const activeInterviews = pipelines.flatMap(p =>
    p.rounds.filter(r => r.status === "pending" || r.status === "in_progress").map(r => ({ ...r, pipeline: p }))
  );

  return (
    <div>
      {/* Hired Popup */}
      {showHiredPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-xl">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Congratulations!</h2>
            <p className="text-gray-600 mb-2">You've been selected for hiring!</p>
            <p className="text-sm text-gray-500 mb-6">Your account is being upgraded to Employee access. Please log in again to access your employee dashboard, onboarding, and more.</p>
            <button onClick={handleHiredRedirect}
              className="bg-teal-600 text-white px-8 py-3 rounded-xl hover:bg-teal-700 font-medium shadow-sm w-full">
              Log In as Employee
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your applications and upcoming interviews</p>
        </div>
        <button onClick={() => router.push("/careers")}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm">
          Browse Jobs
        </button>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="mb-6 space-y-2">
          {notifications.map(n => (
            <div key={n.id} className={`rounded-xl px-4 py-3 flex items-center justify-between ${
              n.type === "shortlisted" ? "bg-green-50 border border-green-200" :
              n.type === "rejected" ? "bg-red-50 border border-red-200" :
              "bg-blue-50 border border-blue-200"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  n.type === "shortlisted" ? "bg-green-500" : n.type === "rejected" ? "bg-red-500" : "bg-blue-500"
                }`} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="text-xs text-gray-500">{n.message}</p>
                </div>
              </div>
              <button onClick={async () => {
                await api.post(`/notifications/${n.id}/read`);
                setNotifications(prev => prev.filter(x => x.id !== n.id));
              }} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">Dismiss</button>
            </div>
          ))}
        </div>
      )}

      {/* Quick action: pending interviews */}
      {activeInterviews.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Action Required</h2>
          <div className="grid gap-3">
            {activeInterviews.map((r, i) => (
              <div key={i} className="bg-white rounded-xl border border-blue-200 p-5 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold">R{r.round_number}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{r.pipeline.pipeline_title}</h3>
                    <p className="text-sm text-gray-500">Round {r.round_number}: {ROUND_LABELS[r.round_type] || r.round_type}</p>
                  </div>
                </div>
                <button onClick={(e) => {
                    const btn = e.currentTarget;
                    btn.disabled = true;
                    btn.innerHTML = '<div class="flex items-center gap-2"><div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>Loading...</div>';
                    router.push(`/candidate/interview/${r.session_id}`);
                  }}
                  className={`px-5 py-2.5 rounded-lg text-sm font-medium shadow-sm ${
                    r.status === "in_progress"
                      ? "bg-yellow-500 text-white hover:bg-yellow-600"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}>
                  {r.status === "in_progress" ? "Continue" : "Start Interview"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Applications — 2 cols */}
        <div className="col-span-2">
          <h2 className="text-base font-semibold text-gray-900 mb-3">My Applications</h2>
          {applications.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 mb-2">No applications yet</p>
              <button onClick={() => router.push("/careers")}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium">Browse open positions</button>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((a: any) => {
                const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
                  shortlisted: { label: "Shortlisted", bg: "bg-green-100", text: "text-green-700" },
                  interview: { label: "Interviewing", bg: "bg-blue-100", text: "text-blue-700" },
                  rejected: { label: "Not Selected", bg: "bg-red-100", text: "text-red-700" },
                  submitted: { label: "Under Review", bg: "bg-yellow-100", text: "text-yellow-700" },
                  screening: { label: "Analyzing", bg: "bg-purple-100", text: "text-purple-700" },
                };
                const sc = statusConfig[a.status] || { label: a.status, bg: "bg-gray-100", text: "text-gray-600" };

                return (
                  <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 card-hover">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{a.job_title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {a.department || ""} {a.location ? `· ${a.location}` : ""}
                          {a.created_at && <span> · Applied {new Date(a.created_at).toLocaleDateString()}</span>}
                        </p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sc.bg} ${sc.text}`}>{sc.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Interview Progress — 1 col */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Interview Progress</h2>
          {pipelines.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <p className="text-xs text-gray-400">No active interviews</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pipelines.map(p => (
                <div key={p.pipeline_id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">{p.pipeline_title}</h3>
                  <div className="space-y-2">
                    {p.rounds.map((r, i) => {
                      const isDone = r.status === "completed";
                      const isActive = r.status === "pending" || r.status === "in_progress";
                      return (
                        <div key={i} className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            isDone ? "bg-green-500 text-white" :
                            isActive ? "bg-blue-500 text-white" :
                            "bg-gray-100 text-gray-400"
                          }`}>{r.round_number}</div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs ${isDone ? "text-green-700 font-medium" : isActive ? "text-blue-700 font-medium" : "text-gray-400"}`}>
                              {ROUND_LABELS[r.round_type] || r.round_type}
                            </p>
                          </div>
                          {isDone && <span className="text-green-500"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></span>}
                          {isActive && <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
                        </div>
                      );
                    })}
                  </div>
                  {p.rounds.some(r => r.status === "completed" && r.session_id) && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                      {p.rounds.filter(r => r.status === "completed" && r.session_id).map(r => (
                        <button key={r.round_number}
                          onClick={() => router.push(`/candidate/interview/${r.session_id}`)}
                          className="text-[10px] text-blue-600 hover:text-blue-800">
                          R{r.round_number} Results
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
