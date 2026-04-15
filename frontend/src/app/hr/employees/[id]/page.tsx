"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [salary, setSalary] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");

  useEffect(() => {
    api.get(`/employees/${params.id}`).then(e => {
      setEmployee(e);
      setSalary(e.salary ? String(e.salary) : "");
      setDepartment(e.department || "");
      setDesignation(e.designation || "");
    }).finally(() => setLoading(false));
  }, [params.id]);

  const handleSave = async () => {
    await api.put(`/employees/${params.id}`, {
      salary: salary ? parseFloat(salary) : null,
      department: department || null,
      designation: designation || null,
    });
    setEditing(false);
    api.get(`/employees/${params.id}`).then(setEmployee);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!employee) return <p className="text-red-500">Employee not found</p>;

  const statusColor = employee.onboarding_status === "completed" ? "bg-green-100 text-green-700" :
    employee.onboarding_status === "documents_pending" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700";

  return (
    <div>
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-4">← Back</button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-teal-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xl font-bold">{(employee.user_name || "?")[0].toUpperCase()}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">{employee.user_name}</h1>
            <p className="text-sm text-gray-500">{employee.employee_id} · {employee.user_email}</p>
          </div>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor}`}>{employee.onboarding_status}</span>
      </div>

      {/* Attrition Risk */}
      {employee.attrition_risk_score != null && (
        <div className={`rounded-xl border p-5 mb-6 ${
          employee.attrition_risk_category === "low" ? "bg-green-50 border-green-200" :
          employee.attrition_risk_category === "medium" ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"
        }`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Attrition Risk Prediction</h2>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${
                employee.attrition_risk_category === "low" ? "text-green-600" :
                employee.attrition_risk_category === "medium" ? "text-yellow-600" : "text-red-600"
              }`}>{Math.round(employee.attrition_risk_score)}%</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                employee.attrition_risk_category === "low" ? "bg-green-200 text-green-800" :
                employee.attrition_risk_category === "medium" ? "bg-yellow-200 text-yellow-800" : "bg-red-200 text-red-800"
              }`}>{employee.attrition_risk_category?.toUpperCase()}</span>
            </div>
          </div>
          {employee.attrition_factors?.length > 0 && (
            <div className="space-y-1.5">
              {employee.attrition_factors.map((f: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    f.direction === "increases" ? "bg-red-500" : "bg-green-500"
                  }`} />
                  <span className="text-gray-700">{f.factor}</span>
                  <span className={`text-xs ${f.impact === "high" ? "text-red-500 font-medium" : "text-gray-400"}`}>
                    ({f.impact} impact)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Details Card */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Employee Details</h2>
            <button onClick={() => setEditing(!editing)} className="text-xs text-blue-600 hover:text-blue-800">
              {editing ? "Cancel" : "Edit"}
            </button>
          </div>
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Department</label>
                <input value={department} onChange={e => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Designation</label>
                <input value={designation} onChange={e => setDesignation(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Monthly Salary (₹)</label>
                <input type="number" value={salary} onChange={e => setSalary(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 w-full">Save</button>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Department</span><span className="font-medium">{employee.department || "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Designation</span><span className="font-medium">{employee.designation || "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Joining Date</span><span className="font-medium">{employee.joining_date ? new Date(employee.joining_date).toLocaleDateString() : "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Salary</span><span className="font-medium">{employee.salary ? `₹${employee.salary.toLocaleString()}/mo` : "—"}</span></div>
            </div>
          )}
        </div>

        {/* Onboarding Checklist */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-base font-semibold mb-4">Onboarding Checklist</h2>
          <div className="space-y-3">
            {Object.entries(employee.onboarding_checklist || {}).map(([key, done]) => (
              <div key={key} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${done ? "bg-green-500" : "bg-gray-200"}`}>
                  {done ? <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : null}
                </div>
                <span className={`text-sm ${done ? "text-gray-900" : "text-gray-400"}`}>{key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bank Details */}
        {employee.bank_details && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-base font-semibold mb-4">Bank Details</h2>
            <div className="space-y-2 text-sm">
              {Object.entries(employee.bank_details).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-500">{k.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                  <span className="font-medium">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Emergency Contact */}
        {employee.emergency_contact && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-base font-semibold mb-4">Emergency Contact</h2>
            <div className="space-y-2 text-sm">
              {Object.entries(employee.emergency_contact).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-500">{k.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                  <span className="font-medium">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
