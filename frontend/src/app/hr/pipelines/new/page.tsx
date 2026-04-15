"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type QuestionSource = "ai" | "custom";

export default function CreatePipelinePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [skills, setSkills] = useState("");
  const [description, setDescription] = useState("");

  // Per-round config
  const [r1Source, setR1Source] = useState<QuestionSource>("ai");
  const [r2Source, setR2Source] = useState<QuestionSource>("ai");
  const [r3Source, setR3Source] = useState<QuestionSource>("ai");
  const [r1Count, setR1Count] = useState(3);
  const [r2Count, setR2Count] = useState(5);
  const [r3Count, setR3Count] = useState(4);
  const [r1Custom, setR1Custom] = useState("");
  const [r2Custom, setR2Custom] = useState("");
  const [r3Custom, setR3Custom] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [candidateEmail, setCandidateEmail] = useState("");
  const [assignMsg, setAssignMsg] = useState("");

  const parseCustomQuestions = (text: string): string[] =>
    text.split("\n").map(q => q.trim()).filter(q => q.length > 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r1Questions = r1Source === "custom" ? parseCustomQuestions(r1Custom) : null;
      const r2Questions = r2Source === "custom" ? parseCustomQuestions(r2Custom) : null;
      const r3Questions = r3Source === "custom" ? parseCustomQuestions(r3Custom) : null;

      const p = await api.post("/pipelines/", {
        title, job_role: jobRole, skills, description,
        screening_questions: r1Source === "custom" ? (r1Questions?.length || 3) : r1Count,
        technical_questions: r2Source === "custom" ? (r2Questions?.length || 5) : r2Count,
        hr_questions: r3Source === "custom" ? (r3Questions?.length || 4) : r3Count,
        r1_question_source: r1Source === "custom" ? "custom" : "ai_generated",
        r2_question_source: r2Source === "custom" ? "custom" : "ai_generated",
        r3_question_source: r3Source === "custom" ? "custom" : "ai_generated",
        r1_custom_questions: r1Questions,
        r2_custom_questions: r2Questions,
        r3_custom_questions: r3Questions,
      });
      setCreatedId(p.id);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleAssign = async () => {
    if (!createdId || !candidateEmail.trim()) return;
    setAssignMsg("");
    try {
      await api.post(`/pipelines/${createdId}/candidates`, { candidate_email: candidateEmail });
      setAssignMsg(`Assigned ${candidateEmail}`);
      setCandidateEmail("");
    } catch (err: any) { setAssignMsg(err.message); }
  };

  const RoundConfig = ({ label, roundNum, source, setSource, count, setCount, custom, setCustom }: {
    label: string; roundNum: number; source: QuestionSource; setSource: (v: QuestionSource) => void;
    count: number; setCount: (v: number) => void; custom: string; setCustom: (v: string) => void;
  }) => (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Round {roundNum}: {label}</h3>
        <div className="flex gap-1">
          <button type="button" onClick={() => setSource("ai")}
            className={`px-3 py-1 rounded-md text-xs font-medium ${source === "ai" ? "bg-blue-600 text-white" : "bg-white border text-gray-600"}`}>
            AI Generated
          </button>
          <button type="button" onClick={() => setSource("custom")}
            className={`px-3 py-1 rounded-md text-xs font-medium ${source === "custom" ? "bg-blue-600 text-white" : "bg-white border text-gray-600"}`}>
            Custom Questions
          </button>
        </div>
      </div>
      {source === "ai" ? (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Number of questions AI should ask</label>
          <input type="number" min={2} max={15} value={count} onChange={e => setCount(+e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
      ) : (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Enter questions (one per line)</label>
          <textarea value={custom} onChange={e => setCustom(e.target.value)} rows={4}
            placeholder={"What is your experience with...?\nExplain the difference between...?\nDescribe a time when...?"}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
          <p className="text-xs text-gray-400 mt-1">{parseCustomQuestions(custom).length} questions entered</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Create Hiring Pipeline</h1>
      {!createdId ? (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border p-6 space-y-5">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <p className="text-sm text-gray-500">Creates a 3-round pipeline: Screening → Technical → HR/Cultural. For each round, choose AI-generated or provide your own questions.</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pipeline Title</label>
            <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Senior React Developer Hiring" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Role</label>
            <input type="text" required value={jobRole} onChange={e => setJobRole(e.target.value)}
              placeholder="e.g., Frontend Developer" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma-separated)</label>
            <input type="text" required value={skills} onChange={e => setSkills(e.target.value)}
              placeholder="e.g., React, TypeScript, Node.js" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          <div className="border-t pt-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Round Configuration</h2>
            <div className="space-y-4">
              <RoundConfig label="Screening" roundNum={1} source={r1Source} setSource={setR1Source}
                count={r1Count} setCount={setR1Count} custom={r1Custom} setCustom={setR1Custom} />
              <RoundConfig label="Technical" roundNum={2} source={r2Source} setSource={setR2Source}
                count={r2Count} setCount={setR2Count} custom={r2Custom} setCustom={setR2Custom} />
              <RoundConfig label="HR & Cultural" roundNum={3} source={r3Source} setSource={setR3Source}
                count={r3Count} setCount={setR3Count} custom={r3Custom} setCustom={setR3Custom} />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {loading ? "Creating Pipeline..." : "Create 3-Round Pipeline"}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-green-800 font-medium">Pipeline created with 3 rounds!</p>
          </div>
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-3">Assign Candidates</h2>
            <div className="flex gap-2">
              <input type="email" value={candidateEmail} onChange={e => setCandidateEmail(e.target.value)}
                placeholder="candidate@email.com" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                onKeyDown={e => e.key === "Enter" && handleAssign()} />
              <button onClick={handleAssign} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">Add</button>
            </div>
            {assignMsg && <p className="text-sm mt-2 text-green-600">{assignMsg}</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push(`/hr/pipelines/${createdId}`)}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900">View Pipeline</button>
            <button onClick={() => router.push("/hr/dashboard")}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Back to Dashboard</button>
          </div>
        </div>
      )}
    </div>
  );
}
