"use client";

function ScoreBar({ label, score, max }: { label: string; score: number; max: number }) {
  if (score == null || isNaN(score)) return null;
  const pct = Math.round((score / max) * 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{score}/{max}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const SCORE_KEYS: Record<string, [string, number]> = {
  techAccuracy: ["Technical Accuracy", 10],
  conceptCoverage: ["Concept Coverage", 10],
  practicalKnowledge: ["Practical Knowledge", 10],
  resumeAccuracy: ["Resume Accuracy", 10],
  communicationClarity: ["Communication Clarity", 10],
  experienceDepth: ["Experience Depth", 10],
  culturalFit: ["Cultural Fit", 10],
  teamworkOrientation: ["Teamwork", 10],
  communicationSkills: ["Communication Skills", 10],
  leadershipPotential: ["Leadership Potential", 10],
};

export default function EvaluationReport({ evaluation }: { evaluation: Record<string, any> }) {
  const e = evaluation || {};
  const profScore = e.proficiencyScore ?? 0;
  const profColor = profScore >= 70 ? "text-green-600" : profScore >= 40 ? "text-yellow-600" : "text-red-600";

  const scores = Object.entries(SCORE_KEYS)
    .filter(([key]) => e[key] != null && !isNaN(e[key]))
    .map(([key, [label, max]]) => ({ label, score: e[key], max }));

  const strongTopics = e.strongTopics || [];
  const weakTopics = e.weakTopics || [];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-gray-500 mb-1">Proficiency Score</p>
        <p className={`text-5xl font-bold ${profColor}`}>{profScore}</p>
        <p className="text-sm text-gray-400 mt-1">out of 100</p>
      </div>

      {scores.length > 0 && (
        <div className={`grid grid-cols-1 ${scores.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4`}>
          {scores.map((s, i) => <ScoreBar key={i} {...s} />)}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {strongTopics.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Strong Topics</p>
            <div className="flex flex-wrap gap-1">
              {strongTopics.map((t: string, i: number) => (
                <span key={i} className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs">{t}</span>
              ))}
            </div>
          </div>
        )}
        {weakTopics.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Weak Topics</p>
            <div className="flex flex-wrap gap-1">
              {weakTopics.map((t: string, i: number) => (
                <span key={i} className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs">{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {e.feedback && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Feedback</p>
          <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">{e.feedback}</p>
        </div>
      )}

      {e.numQuestions && <p className="text-xs text-gray-400">Questions asked: {e.numQuestions}</p>}
    </div>
  );
}
