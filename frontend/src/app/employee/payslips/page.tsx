"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function PayslipsPage() {
  const [payslips, setPayslips] = useState<any[]>([]);
  useEffect(() => { api.get("/payroll/employee/me").then(setPayslips).catch(() => []); }, []);

  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Payslips</h1>
      {payslips.length === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No payslips yet</div>
      ) : (
        <div className="space-y-3">
          {payslips.map(p => (
            <div key={p.id} className="bg-white rounded-xl border p-5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{months[p.month]} {p.year}</h3>
                <p className="text-xs text-gray-500">{p.days_present} days present · {p.days_absent} absent</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">₹{p.net_salary.toLocaleString()}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  p.status === "paid" ? "bg-green-100 text-green-700" :
                  p.status === "processed" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"
                }`}>{p.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
