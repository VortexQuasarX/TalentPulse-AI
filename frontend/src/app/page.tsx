"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getUserRole } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/login"); return; }
    const role = getUserRole();
    if (role === "super_admin" || role === "accounts") router.replace("/admin/dashboard");
    else if (role === "admin") router.replace("/hr/dashboard");
    else if (role === "employee") router.replace("/employee/dashboard");
    else router.replace("/candidate/dashboard");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
