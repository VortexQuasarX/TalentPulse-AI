"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AdminAttendancePage() {
  const now = new Date();
  const [startDate, setStartDate] = useState(now.toISOString().split("T")[0].slice(0, 8) + "01");
  const [endDate, setEndDate] = useState(now.toISOString().split("T")[0]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    api.get(`/attendance/all?start_date=${startDate}&end_date=${endDate}`)
      .then(setLogs).catch(() => setLogs([])).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [startDate, endDate]);

  const totalHours = logs.reduce((a, l) => a + (l.total_hours || 0), 0);
  const presentCount = logs.filter(l => l.status === "present").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Attendance Overview</h1>
        <div className="flex gap-2 items-center">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm" />
          <span className="text-gray-400">to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-gray-400 uppercase">Total Records</p>
          <p className="text-2xl font-bold mt-1">{logs.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-gray-400 uppercase">Present Days</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{presentCount}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-gray-400 uppercase">Total Hours</p>
          <p className="text-2xl font-bold mt-1">{totalHours.toFixed(1)}h</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Employee</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Date</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Punch In</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Punch Out</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Hours</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Overtime</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" /></td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">No attendance records for this period</td></tr>
            ) : logs.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-5 py-3">
                  <p className="font-medium">{l.employee_name || "—"}</p>
                  <p className="text-[10px] text-gray-400">{l.employee_id}</p>
                </td>
                <td className="px-5 py-3">{l.date}</td>
                <td className="px-5 py-3 text-gray-600">{l.punch_in ? new Date(l.punch_in).toLocaleTimeString() : "—"}</td>
                <td className="px-5 py-3 text-gray-600">{l.punch_out ? new Date(l.punch_out).toLocaleTimeString() : "—"}</td>
                <td className="px-5 py-3">{l.total_hours}h</td>
                <td className="px-5 py-3 text-orange-600">{l.overtime > 0 ? `+${l.overtime}h` : "—"}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    l.status === "present" ? "bg-green-100 text-green-700" :
                    l.status === "half_day" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"
                  }`}>{l.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
