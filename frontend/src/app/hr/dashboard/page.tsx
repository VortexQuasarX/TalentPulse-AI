"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getUserName } from "@/lib/auth";
import type { Notification } from "@/lib/types";

export default function HRDashboard() {
  const router = useRouter();
  const name = getUserName();
  const [jobs, setJobs] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/jobs/").catch(() => []),
      api.get("/notifications/").catch(() => []),
    ]).then(([j, n]) => {
      setJobs(j);
      setNotifications(n.filter((x: Notification) => !x.read).slice(0, 8));
    }).finally(() => setLoading(false));
  }, []);

  const totalApplicants = jobs.reduce((a: number, j: any) => a + (j.application_count || 0), 0);
  const activeJobs = jobs.filter((j: any) => j.status === "active").length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Here's what's happening with your hiring pipeline</p>
        </div>
        <button onClick={() => router.push("/hr/jobs/new")}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm">
          + Post New Job
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {[
          { label: "Active Jobs", value: activeJobs, color: "text-blue-600", bg: "bg-blue-50", icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
          { label: "Total Applicants", value: totalApplicants, color: "text-purple-600", bg: "bg-purple-50", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
          { label: "Total Jobs", value: jobs.length, color: "text-green-600", bg: "bg-green-50", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
          { label: "Careers Page", value: "Open", color: "text-orange-600", bg: "bg-orange-50", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1", click: () => window.open("/careers", "_blank") },
        ].map((stat, i) => (
          <div key={i} className={`bg-white rounded-xl border border-gray-200 p-5 ${stat.click ? "cursor-pointer card-hover" : ""}`}
            onClick={stat.click}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
                <p className={`text-3xl font-bold mt-1.5 ${stat.color}`}>{stat.value}</p>
              </div>
              <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center`}>
                <svg className={`w-5 h-5 ${stat.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Jobs list — 2 cols */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Job Postings</h2>
            <button onClick={() => router.push("/hr/jobs")} className="text-xs text-blue-600 hover:text-blue-800">View all</button>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl border p-10 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" /></div>
          ) : jobs.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 mb-2">No job postings yet</p>
              <button onClick={() => router.push("/hr/jobs/new")}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium">Create your first job</button>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.slice(0, 5).map((j: any) => (
                <div key={j.id} className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer card-hover"
                  onClick={() => router.push(`/hr/jobs/${j.id}`)}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate">{j.title}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                          j.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>{j.status}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{j.department || ""} {j.location ? `· ${j.location}` : ""}</p>
                      <div className="flex gap-1 mt-1.5">
                        {j.skills?.split(",").slice(0, 3).map((s: string, i: number) => (
                          <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s.trim()}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-2xl font-bold text-gray-900">{j.application_count || 0}</p>
                      <p className="text-[10px] text-gray-400">applicants</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity feed — 1 col */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">No recent activity</div>
            ) : (
              notifications.slice(0, 6).map(n => (
                <div key={n.id} className="px-4 py-3 hover:bg-gray-50 cursor-pointer"
                  onClick={async () => {
                    await api.post(`/notifications/${n.id}/read`);
                    setNotifications(prev => prev.filter(x => x.id !== n.id));
                    if (n.link) router.push(n.link);
                  }}>
                  <div className="flex items-start gap-2.5">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      n.type === "shortlisted" ? "bg-green-500" :
                      n.type === "rejected" ? "bg-red-500" :
                      n.type === "approval_needed" ? "bg-orange-500" : "bg-blue-500"
                    }`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{n.title}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
