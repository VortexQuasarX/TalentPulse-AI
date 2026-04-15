"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getUserName, getUserRole, clearAuth } from "@/lib/auth";
import { api } from "@/lib/api";

const HR_NAV = [
  { label: "Dashboard", path: "/hr/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { label: "Jobs", path: "/hr/jobs", icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { label: "Candidates", path: "/hr/candidates", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { label: "Employees", path: "/hr/employees", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { label: "Leave Requests", path: "/hr/leaves", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
];

const CANDIDATE_NAV = [
  { label: "Dashboard", path: "/candidate/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { label: "Browse Jobs", path: "/careers", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { label: "My Profile", path: "/candidate/profile", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
];

const EMPLOYEE_NAV = [
  { label: "Dashboard", path: "/employee/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { label: "Attendance", path: "/employee/attendance", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  { label: "Leaves", path: "/employee/leaves", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { label: "My Payslips", path: "/employee/payslips", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
  { label: "My Profile", path: "/employee/profile", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
];

const ACCOUNTS_NAV = [
  { label: "Dashboard", path: "/admin/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { label: "Payroll", path: "/admin/payroll", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
  { label: "Attendance", path: "/admin/attendance", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
];

const SUPER_ADMIN_NAV = [
  { label: "Platform", path: "/admin/dashboard", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  { label: "User Mgmt", path: "/admin/users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { label: "Payroll", path: "/admin/payroll", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
  { label: "Attendance", path: "/admin/attendance", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const name = getUserName();
  const role = getUserRole();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!name) return; // Not logged in yet
    api.get("/notifications/unread-count").then(r => setUnread(r.count)).catch(() => {});
    const interval = setInterval(() => {
      api.get("/notifications/unread-count").then(r => setUnread(r.count)).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [name]);

  const handleLogout = () => { clearAuth(); router.push("/login"); };

  const navItems = role === "super_admin" ? [...SUPER_ADMIN_NAV, ...HR_NAV] :
    role === "accounts" ? ACCOUNTS_NAV :
    role === "admin" ? HR_NAV :
    role === "employee" ? EMPLOYEE_NAV : CANDIDATE_NAV;

  const roleLabel = role === "super_admin" ? "Super Admin" : role === "accounts" ? "Accounts" : role === "admin" ? "HR" : role === "employee" ? "Employee" : "User";
  const roleBg = role === "super_admin" ? "bg-red-500" : role === "accounts" ? "bg-purple-500" : role === "admin" ? "bg-blue-500" : role === "employee" ? "bg-teal-500" : "bg-green-500";

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-white border-r border-gray-200 flex flex-col z-50">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">V</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-tight">Vertical AI</h1>
            <p className="text-[10px] text-gray-400">People Operations</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
          return (
            <button key={item.path} onClick={() => router.push(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                isActive ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}>
              <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Bottom: user info */}
      <div className="border-t border-gray-100 px-3 py-3">
        {/* Notification */}
        {unread > 0 && (
          <div className="mb-2 px-3 py-2 bg-blue-50 rounded-lg flex items-center justify-between">
            <span className="text-xs text-blue-700">{unread} notification{unread > 1 ? "s" : ""}</span>
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          </div>
        )}

        {/* User card */}
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className={`w-8 h-8 ${roleBg} rounded-full flex items-center justify-center`}>
            <span className="text-white text-xs font-bold">{(name || "U")[0].toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
            <p className="text-[10px] text-gray-400">{roleLabel}</p>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 p-1" title="Logout">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
