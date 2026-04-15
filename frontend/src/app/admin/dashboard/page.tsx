"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getUserName } from "@/lib/auth";

export default function AdminDashboard() {
  const router = useRouter();
  const name = getUserName();
  const [employees, setEmployees] = useState<any[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  useEffect(() => {
    Promise.all([
      api.get("/employees/").catch(() => []),
      api.get(`/payroll/summary?month=${month}&year=${year}`).catch(() => null),
    ]).then(([e, ps]) => {
      setEmployees(e);
      setPayrollSummary(ps);
    }).finally(() => setLoading(false));
  }, []);

  const onboarded = employees.filter(e => e.onboarding_status === "completed").length;
  const pending = employees.filter(e => e.onboarding_status !== "completed").length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Accounts Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Welcome back, {name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
        <div className="bg-white rounded-xl border p-5 cursor-pointer card-hover" onClick={() => router.push("/hr/employees")}>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Employees</p>
          <p className="text-3xl font-bold mt-1.5 text-blue-600">{employees.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Onboarded</p>
          <p className="text-3xl font-bold mt-1.5 text-green-600">{onboarded}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Onboarding</p>
          <p className="text-3xl font-bold mt-1.5 text-yellow-600">{pending}</p>
        </div>
        <div className="bg-white rounded-xl border p-5 cursor-pointer card-hover" onClick={() => router.push("/admin/payroll")}>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Payroll This Month</p>
          <p className="text-3xl font-bold mt-1.5 text-purple-600">
            {payrollSummary ? `₹${payrollSummary.total_payout?.toLocaleString()}` : "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Employees List */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Employees</h2>
            <button onClick={() => router.push("/hr/employees")} className="text-xs text-blue-600 hover:text-blue-800">View all</button>
          </div>
          {loading ? (
            <div className="bg-white rounded-xl border p-10 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" /></div>
          ) : employees.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
              No employees yet. Employees are created when candidates are hired.
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Employee</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Dept</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Salary</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Risk</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.slice(0, 8).map((e: any) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/hr/employees/${e.id}`)}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{e.user_name}</p>
                        <p className="text-[10px] text-gray-400">{e.employee_id}</p>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{e.department || "—"}</td>
                      <td className="px-4 py-2.5">{e.salary ? `₹${e.salary.toLocaleString()}` : "—"}</td>
                      <td className="px-4 py-2.5">
                        {e.attrition_risk_score != null ? (
                          <span className={`text-xs font-bold ${
                            e.attrition_risk_category === "low" ? "text-green-600" :
                            e.attrition_risk_category === "medium" ? "text-yellow-600" : "text-red-600"
                          }`}>{Math.round(e.attrition_risk_score)}%</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          e.onboarding_status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                        }`}>{e.onboarding_status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-base font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button onClick={() => router.push("/admin/payroll")}
              className="w-full bg-white rounded-xl border p-4 text-left hover:bg-gray-50 card-hover">
              <p className="font-medium text-gray-900">Payroll</p>
              <p className="text-xs text-gray-500">Generate, approve, and process salaries</p>
            </button>
            <button onClick={() => router.push("/admin/attendance")}
              className="w-full bg-white rounded-xl border p-4 text-left hover:bg-gray-50 card-hover">
              <p className="font-medium text-gray-900">Attendance</p>
              <p className="text-xs text-gray-500">View all employee attendance records</p>
            </button>
            <button onClick={() => router.push("/hr/employees")}
              className="w-full bg-white rounded-xl border p-4 text-left hover:bg-gray-50 card-hover">
              <p className="font-medium text-gray-900">Employees</p>
              <p className="text-xs text-gray-500">Manage employee records and onboarding</p>
            </button>
            <button onClick={() => router.push("/hr/jobs")}
              className="w-full bg-white rounded-xl border p-4 text-left hover:bg-gray-50 card-hover">
              <p className="font-medium text-gray-900">Job Postings</p>
              <p className="text-xs text-gray-500">View hiring pipelines</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
