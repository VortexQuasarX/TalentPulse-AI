"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function EmployeeLeavesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveType, setLeaveType] = useState("full_day");
  const [reason, setReason] = useState("");
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchData = () => {
    api.get("/leaves/my-leaves").then(setData).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { fetchData(); }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveDate) return;
    setApplying(true); setMsg("");
    try {
      await api.post(`/leaves/apply?leave_date=${leaveDate}&leave_type=${leaveType}&reason=${encodeURIComponent(reason)}`);
      setMsg("Leave request submitted!");
      setLeaveDate(""); setReason("");
      fetchData();
    } catch (err: any) { setMsg(err.message); }
    finally { setApplying(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  const balance = data?.balance || { total: 15, used: 0, remaining: 15 };
  const requests = data?.requests || [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Leave Management</h1>

      {/* Balance Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-5 text-center">
          <p className="text-xs text-gray-400 uppercase">Total Leaves</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{balance.total}</p>
          <p className="text-xs text-gray-400">per year</p>
        </div>
        <div className="bg-white rounded-xl border p-5 text-center">
          <p className="text-xs text-gray-400 uppercase">Used</p>
          <p className="text-3xl font-bold text-orange-600 mt-1">{balance.used}</p>
        </div>
        <div className="bg-white rounded-xl border p-5 text-center">
          <p className="text-xs text-gray-400 uppercase">Remaining</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{balance.remaining}</p>
        </div>
      </div>

      {/* Apply Form */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="text-base font-semibold mb-4">Request Leave</h2>
        {msg && <p className={`text-sm mb-3 ${msg.includes("submitted") ? "text-green-600" : "text-red-600"}`}>{msg}</p>}
        <form onSubmit={handleApply} className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="text-xs text-gray-500">Date</label>
            <input type="date" required value={leaveDate} onChange={e => setLeaveDate(e.target.value)}
              className="block px-3 py-2 border rounded-lg text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Type</label>
            <select value={leaveType} onChange={e => setLeaveType(e.target.value)}
              className="block px-3 py-2 border rounded-lg text-sm mt-1">
              <option value="full_day">Full Day</option>
              <option value="half_day">Half Day</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500">Reason</label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Optional reason..." className="block w-full px-3 py-2 border rounded-lg text-sm mt-1" />
          </div>
          <button type="submit" disabled={applying}
            className="bg-teal-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">
            {applying ? "Submitting..." : "Apply Leave"}
          </button>
        </form>
      </div>

      {/* Leave History */}
      <h2 className="text-base font-semibold mb-3">Leave History</h2>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Date</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Type</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Reason</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400">No leave requests yet</td></tr>
            ) : requests.map((r: any) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-5 py-3 font-medium">{r.date}</td>
                <td className="px-5 py-3">{r.type === "full_day" ? "Full Day" : "Half Day"}</td>
                <td className="px-5 py-3 text-gray-500">{r.reason || "—"}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.status === "approved" ? "bg-green-100 text-green-700" :
                    r.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                  }`}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
