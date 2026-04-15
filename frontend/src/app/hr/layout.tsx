"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getUserRole } from "@/lib/auth";
import Navbar from "@/components/Navbar";

export default function HRLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/login"); return; }
    const role = getUserRole();
    if (role !== "admin" && role !== "super_admin") { router.replace("/candidate/dashboard"); return; }
    setReady(true);
  }, [router]);
  if (!ready) return null;
  return (
    <div className="min-h-screen bg-[#fafbfc]">
      <Navbar />
      <main className="ml-[240px] p-8 max-w-[1200px]">{children}</main>
    </div>
  );
}
