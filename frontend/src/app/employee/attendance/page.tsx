"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AttendancePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    api.get(`/attendance/history?month=${month}&year=${year}`).then(setLogs).catch(() => setLogs([]));
  }, [month, year]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Attendance History</h1>
        <div className="flex gap-2">
          <select value={month} onChange={e => setMonth(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i + 1}>{new Date(2000, i).toLocaleString("en", { month: "long" })}</option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Date</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Punch In</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Punch Out</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Hours</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Overtime</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No attendance records</td></tr>
            ) : logs.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-5 py-3 font-medium">{l.date}</td>
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
