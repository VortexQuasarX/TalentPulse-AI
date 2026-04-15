"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getUserName } from "@/lib/auth";

export default function EmployeeProfilePage() {
  const name = getUserName();
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/employees/me").then(setEmployee).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;
  if (!employee) return <p className="text-gray-500">No employee record found.</p>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center">
          <span className="text-white text-2xl font-bold">{(name || "?")[0].toUpperCase()}</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold">{employee.user_name}</h1>
          <p className="text-sm text-gray-500">{employee.employee_id} · {employee.user_email}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
            employee.onboarding_status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
          }`}>{employee.onboarding_status}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-base font-semibold mb-4">Work Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Department</span><p className="font-medium mt-0.5">{employee.department || "—"}</p></div>
            <div><span className="text-gray-500">Designation</span><p className="font-medium mt-0.5">{employee.designation || "—"}</p></div>
            <div><span className="text-gray-500">Joining Date</span><p className="font-medium mt-0.5">{employee.joining_date ? new Date(employee.joining_date).toLocaleDateString() : "—"}</p></div>
            <div><span className="text-gray-500">Salary</span><p className="font-medium mt-0.5">{employee.salary ? `₹${employee.salary.toLocaleString()}/mo` : "—"}</p></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-base font-semibold mb-4">Onboarding Checklist</h2>
          <div className="space-y-2">
            {Object.entries(employee.onboarding_checklist || {}).map(([key, done]) => (
              <div key={key} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${done ? "bg-green-500" : "bg-gray-200"}`}>
                  {done ? <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : null}
                </div>
                <span className={`text-sm ${done ? "text-gray-900" : "text-gray-400"}`}>
                  {key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
