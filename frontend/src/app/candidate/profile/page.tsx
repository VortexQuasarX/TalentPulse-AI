"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [experience, setExperience] = useState("");
  const [education, setEducation] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [resumePreview, setResumePreview] = useState("");

  useEffect(() => {
    api.get("/candidates/profile").then(p => {
      setProfile(p);
      setName(p.name || "");
      setPhone(p.phone || "");
      setExperience(p.profile_data?.experience || "");
      setEducation(p.profile_data?.education || "");
      if (p.resume_path) setResumePreview("Resume uploaded");
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg("");
    try {
      await api.put("/candidates/profile", {
        name, phone,
        profile_data: { experience, education },
      });
      setMsg("Profile saved!");
    } catch (err: any) { setMsg(err.message); }
    finally { setSaving(false); }
  };

  const handleResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = getToken();
      const res = await fetch(`${API}/candidates/resume`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setResumePreview(data.preview || "Resume uploaded");
      setMsg("Resume uploaded and parsed!");
    } catch (err: any) { setMsg(err.message); }
    finally { setUploading(false); }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>

      <div className="bg-white rounded-xl border p-6 space-y-4">
        {msg && <p className="text-sm text-green-600">{msg}</p>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience</label>
          <input type="text" value={experience} onChange={e => setExperience(e.target.value)}
            placeholder="e.g., 3 years in full-stack development"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Education</label>
          <input type="text" value={education} onChange={e => setEducation(e.target.value)}
            placeholder="e.g., B.Tech in Computer Science, XYZ University"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>

      <div className="bg-white rounded-xl border p-6 mt-6">
        <h2 className="text-lg font-semibold mb-3">Resume</h2>
        <p className="text-sm text-gray-500 mb-3">Upload your resume (PDF, DOCX). AI will parse it for the screening round.</p>
        <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleResume}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
        {uploading && <p className="text-sm text-gray-400 mt-2">Uploading and parsing...</p>}
        {resumePreview && (
          <div className="mt-3 bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Parsed preview:</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{resumePreview}</p>
          </div>
        )}
      </div>
    </div>
  );
}
