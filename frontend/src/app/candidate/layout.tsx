"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getUserRole } from "@/lib/auth";
import Navbar from "@/components/Navbar";

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/login"); return; }
    if (getUserRole() !== "candidate") { router.replace("/hr/dashboard"); return; }
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
