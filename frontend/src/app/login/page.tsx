"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setToken, setUserInfo } from "@/lib/auth";
import type { TokenResponse } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data: TokenResponse = await api.login(email, password);
      setToken(data.access_token);
      setUserInfo(data.role, data.user_name, data.user_id);

      const applyJobId = localStorage.getItem("apply_job_id");
      if (applyJobId && data.role === "candidate") {
        localStorage.removeItem("apply_job_id");
        router.push(`/careers/${applyJobId}/apply`);
      } else if (data.role === "employee") {
        router.push("/employee/dashboard");
      } else if (data.role === "super_admin" || data.role === "accounts") {
        router.push("/admin/dashboard");
      } else if (data.role === "admin") {
        router.push("/hr/dashboard");
      } else {
        router.push("/candidate/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-purple-700 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg font-bold">V</span>
            </div>
            <span className="text-white text-xl font-bold">Vertical AI</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">Welcome back</h1>
          <p className="text-blue-100 text-lg">Sign in to access your dashboard, interviews, and more.</p>
        </div>
        <div className="space-y-3 text-blue-200 text-sm">
          <p>Candidates · Apply & interview for jobs</p>
          <p>HR Admins · Manage hiring pipelines</p>
          <p>Employees · Attendance & payroll</p>
          <p>Accounts · Payroll processing</p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">V</span>
            </div>
            <span className="text-lg font-bold">Vertical AI</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">Sign in</h2>
          <p className="text-sm text-gray-500 mb-6">Enter your credentials to access your account</p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm flex items-center justify-center gap-2">
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />}
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-sm text-gray-500 mt-6 text-center">
            Don't have an account? <a href="/register" className="text-blue-600 hover:underline font-medium">Create one</a>
          </p>
          <p className="text-xs text-gray-400 mt-2 text-center">
            <a href="/careers" className="hover:underline">Browse open positions →</a>
          </p>
        </div>
      </div>
    </div>
  );
}
