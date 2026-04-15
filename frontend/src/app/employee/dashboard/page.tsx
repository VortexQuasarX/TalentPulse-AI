"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getUserName } from "@/lib/auth";

export default function EmployeeDashboard() {
  const router = useRouter();
  const name = getUserName();
  const [employee, setEmployee] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [today, setToday] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);

  const fetchData = async () => {
    try {
      const emp = await api.get("/employees/me");
      setEmployee(emp);
      if (emp.onboarding_status !== "completed") {
        router.replace("/employee/onboarding");
        return;
      }
      const [t, s] = await Promise.all([
        api.get("/attendance/today").catch(() => null),
        api.get("/attendance/summary").catch(() => null),
      ]);
      setToday(t);
      setSummary(s);
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handlePunchIn = async () => {
    setPunching(true);
    try { await api.post("/attendance/punch-in"); await fetchData(); }
    catch (e: any) { alert(e.message); }
    finally { setPunching(false); }
  };

  const handlePunchOut = async () => {
    setPunching(true);
    try { await api.post("/attendance/punch-out"); await fetchData(); }
    catch (e: any) { alert(e.message); }
    finally { setPunching(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  const isPunchedIn = today?.punch_in && !today?.punch_out;
  const isPunchedOut = today?.punch_out;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hello, {name}</h1>
          <p className="text-sm text-gray-500">Employee ID: {employee?.employee_id} · {employee?.department || "No department"}</p>
        </div>
      </div>

      {/* Punch Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6 text-center shadow-sm">
        <p className="text-sm text-gray-500 mb-2">{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>

        {!today?.punch_in && (
          <>
            <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <button onClick={handlePunchIn} disabled={punching}
              className="bg-teal-600 text-white px-10 py-3.5 rounded-xl text-lg font-semibold hover:bg-teal-700 shadow-md disabled:opacity-50">
              {punching ? "Punching In..." : "Punch In"}
            </button>
          </>
        )}

        {isPunchedIn && (
          <>
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="w-4 h-4 bg-green-500 rounded-full animate-pulse" />
            </div>
            <p className="text-sm text-green-600 font-medium mb-1">Working since {new Date(today.punch_in).toLocaleTimeString()}</p>
            <button onClick={handlePunchOut} disabled={punching}
              className="bg-red-600 text-white px-10 py-3.5 rounded-xl text-lg font-semibold hover:bg-red-700 shadow-md disabled:opacity-50 mt-3">
              {punching ? "Punching Out..." : "Punch Out"}
            </button>
          </>
        )}

        {isPunchedOut && (
          <>
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">Day complete</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{today.total_hours}h</p>
            {today.overtime > 0 && <p className="text-sm text-orange-600">+{today.overtime}h overtime</p>}
          </>
        )}
      </div>

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-5">
            <p className="text-xs text-gray-400 uppercase">Weekly Hours</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.weekly_hours}h</p>
            <p className="text-xs text-gray-400">{summary.weekly_days_present} days</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-xs text-gray-400 uppercase">Monthly Hours</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.monthly_hours}h</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-xs text-gray-400 uppercase">Days Present</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{summary.monthly_days_present}</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-xs text-gray-400 uppercase">Days Absent</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{summary.monthly_days_absent}</p>
          </div>
        </div>
      )}
    </div>
  );
}
