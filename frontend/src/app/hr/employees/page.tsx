"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function HREmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get("/employees/").then(setEmployees).finally(() => setLoading(false)); }, []);

  const statusConfig: Record<string, { bg: string; text: string }> = {
    pending: { bg: "bg-yellow-100", text: "text-yellow-700" },
    documents_pending: { bg: "bg-orange-100", text: "text-orange-700" },
    completed: { bg: "bg-green-100", text: "text-green-700" },
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Employees</h1>
      {loading ? <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" /> : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Emp ID</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Email</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Department</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Designation</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Onboarding</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Salary</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Attrition Risk</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">No employees yet</td></tr>
              ) : employees.map(e => {
                const sc = statusConfig[e.onboarding_status] || statusConfig.pending;
                return (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/hr/employees/${e.id}`)}>
                    <td className="px-5 py-3 font-mono font-medium text-blue-600">{e.employee_id}</td>
                    <td className="px-5 py-3 font-medium">{e.user_name || "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{e.user_email || "—"}</td>
                    <td className="px-5 py-3">{e.department || "—"}</td>
                    <td className="px-5 py-3">{e.designation || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                        {e.onboarding_status}
                      </span>
                    </td>
                    <td className="px-5 py-3">{e.salary ? `₹${e.salary.toLocaleString()}` : "—"}</td>
                    <td className="px-5 py-3">
                      {e.attrition_risk_score != null ? (
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${
                            e.attrition_risk_category === "low" ? "text-green-600" :
                            e.attrition_risk_category === "medium" ? "text-yellow-600" : "text-red-600"
                          }`}>{Math.round(e.attrition_risk_score)}%</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            e.attrition_risk_category === "low" ? "bg-green-100 text-green-700" :
                            e.attrition_risk_category === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                          }`}>{e.attrition_risk_category}</span>
                        </div>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
