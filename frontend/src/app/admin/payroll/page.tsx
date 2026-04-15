"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function PayrollDashboard() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get(`/payroll/?month=${month}&year=${year}`).catch(() => []),
      api.get(`/payroll/summary?month=${month}&year=${year}`).catch(() => null),
    ]).then(([p, s]) => { setPayrolls(p); setSummary(s); }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [month, year]);

  const generatePayroll = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/payroll/generate?month=${month}&year=${year}`);
      alert(res.message);
      fetchData();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const months = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Payroll — {months[month]} {year}</h1>
        <div className="flex gap-2">
          <select value={month} onChange={e => setMonth(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{months[i + 1]}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={generatePayroll} disabled={loading}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
            Generate Payroll
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-5">
            <p className="text-xs text-gray-400 uppercase">Total Payout</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">₹{summary.total_payout?.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-xs text-gray-400 uppercase">Pending</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{summary.pending}</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-xs text-gray-400 uppercase">Processed</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{summary.processed}</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-xs text-gray-400 uppercase">Paid</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{summary.paid}</p>
          </div>
        </div>
      )}

      {/* Payroll Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Employee</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Days</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Hours</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Base</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">OT</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Deductions</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Net</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payrolls.length === 0 ? (
              <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-400">No payroll records. Click "Generate Payroll" to compute.</td></tr>
            ) : payrolls.map(p => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-5 py-3">
                  <p className="font-medium">{p.employee_name}</p>
                  <p className="text-[10px] text-gray-400">{p.employee_code}</p>
                </td>
                <td className="px-5 py-3"><span className="text-green-600">{p.days_present}</span>/<span className="text-red-600">{p.days_absent}</span></td>
                <td className="px-5 py-3">{p.total_hours}h</td>
                <td className="px-5 py-3">₹{p.base_salary?.toLocaleString()}</td>
                <td className="px-5 py-3 text-orange-600">{p.overtime_pay > 0 ? `₹${p.overtime_pay?.toLocaleString()}` : "—"}</td>
                <td className="px-5 py-3 text-red-600">{p.deductions > 0 ? `₹${p.deductions?.toLocaleString()}` : "—"}</td>
                <td className="px-5 py-3 font-bold">₹{p.net_salary?.toLocaleString()}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    p.status === "paid" ? "bg-green-100 text-green-700" :
                    p.status === "processed" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"
                  }`}>{p.status}</span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-1">
                    {p.status === "pending" && (
                      <button onClick={async () => { await api.post(`/payroll/${p.id}/approve`); fetchData(); }}
                        className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700">Approve</button>
                    )}
                    {p.status === "processed" && (
                      <button onClick={async () => { await api.post(`/payroll/${p.id}/pay`); fetchData(); }}
                        className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700">Pay</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
