"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function CreateJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "", department: "", location: "", job_type: "full_time",
    experience_level: "mid", salary_range: "", description: "",
    requirements: "", skills: "", responsibilities: "", benefits: "",
  });

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const job = await api.post("/jobs/", form);
      router.push(`/hr/jobs/${job.id}`);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Create Job Posting</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-4">
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <p className="text-sm text-gray-500">This will appear on the public careers page. AI will auto-generate screening questions from the description. A 3-round interview pipeline is auto-created.</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
            <input type="text" required value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="e.g., Senior React Developer" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input type="text" value={form.department} onChange={e => set("department", e.target.value)}
              placeholder="e.g., Engineering" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input type="text" value={form.location} onChange={e => set("location", e.target.value)}
              placeholder="e.g., Bangalore, India" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
            <select value={form.job_type} onChange={e => set("job_type", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="contract">Contract</option>
              <option value="intern">Internship</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
            <select value={form.experience_level} onChange={e => set("experience_level", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="entry">Entry Level</option>
              <option value="mid">Mid Level</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Salary Range</label>
          <input type="text" value={form.salary_range} onChange={e => set("salary_range", e.target.value)}
            placeholder="e.g., ₹12-18 LPA" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job Description *</label>
          <textarea required rows={4} value={form.description} onChange={e => set("description", e.target.value)}
            placeholder="Describe the role, team, and what the candidate will work on..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Requirements *</label>
          <textarea required rows={3} value={form.requirements} onChange={e => set("requirements", e.target.value)}
            placeholder="List the qualifications, education, and experience required..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Required Skills * (comma-separated)</label>
          <input type="text" required value={form.skills} onChange={e => set("skills", e.target.value)}
            placeholder="e.g., React, TypeScript, Node.js, PostgreSQL" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Responsibilities</label>
          <textarea rows={3} value={form.responsibilities} onChange={e => set("responsibilities", e.target.value)}
            placeholder="Key responsibilities for this role..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Benefits</label>
          <textarea rows={2} value={form.benefits} onChange={e => set("benefits", e.target.value)}
            placeholder="Health insurance, flexible hours, remote work, etc."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
          {loading ? "Creating Job + Generating Questions..." : "Publish Job Posting"}
        </button>
      </form>
    </div>
  );
}
