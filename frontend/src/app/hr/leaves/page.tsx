"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function HRLeavesPage() {
  const [pending, setPending] = useState<any[]>([]);
  const [all, setAll] = useState<any[]>([]);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    Promise.all([
      api.get("/leaves/pending").catch(() => []),
      api.get("/leaves/all").catch(() => []),
    ]).then(([p, a]) => { setPending(p); setAll(a); }).finally(() => setLoading(false));
  };
  useEffect(() => { fetchData(); }, []);

  const handleAction = async (id: number, action: "approve" | "reject") => {
    try {
      await api.post(`/leaves/${id}/${action}`);
      fetchData();
    } catch (err: any) { alert(err.message); }
  };

  const items = tab === "pending" ? pending : all;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Leave Requests</h1>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("pending")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "pending" ? "bg-blue-600 text-white" : "bg-white border text-gray-600"}`}>
          Pending ({pending.length})
        </button>
        <button onClick={() => setTab("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "all" ? "bg-blue-600 text-white" : "bg-white border text-gray-600"}`}>
          All ({all.length})
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Employee</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Date</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Type</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Reason</th>
              {tab === "pending" && <th className="text-left px-5 py-3 font-medium text-gray-500">Balance</th>}
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              {tab === "pending" && <th className="text-left px-5 py-3 font-medium text-gray-500">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" /></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">
                {tab === "pending" ? "No pending leave requests" : "No leave requests"}
              </td></tr>
            ) : items.map((l: any) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="px-5 py-3">
                  <p className="font-medium">{l.employee_name}</p>
                  <p className="text-[10px] text-gray-400">{l.employee_id}</p>
                </td>
                <td className="px-5 py-3">{l.date}</td>
                <td className="px-5 py-3">{l.type === "full_day" ? "Full Day" : "Half Day"}</td>
                <td className="px-5 py-3 text-gray-500">{l.reason || "—"}</td>
                {tab === "pending" && <td className="px-5 py-3 text-sm">{l.leaves_remaining} left</td>}
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    l.status === "approved" ? "bg-green-100 text-green-700" :
                    l.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                  }`}>{l.status}</span>
                </td>
                {tab === "pending" && (
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => handleAction(l.id, "approve")}
                        className="text-xs bg-green-600 text-white px-2.5 py-1 rounded hover:bg-green-700">Approve</button>
                      <button onClick={() => handleAction(l.id, "reject")}
                        className="text-xs bg-red-600 text-white px-2.5 py-1 rounded hover:bg-red-700">Reject</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
