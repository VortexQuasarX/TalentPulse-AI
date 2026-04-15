"use client";
import type { ConversationMessage } from "@/lib/types";

export default function Transcript({ messages }: { messages: ConversationMessage[] }) {
  if (!messages || messages.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Interview Transcript</h3>
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                msg.role === "assistant"
                  ? "bg-blue-50 text-gray-800 border border-blue-100"
                  : "bg-gray-100 text-gray-800 border border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-semibold ${
                  msg.role === "assistant" ? "text-blue-600" : "text-gray-500"
                }`}>
                  {msg.role === "assistant" ? "AI Interviewer" : "Candidate"}
                </span>
                {msg.difficulty_level && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    msg.difficulty_level === "Easy" ? "bg-green-100 text-green-600" :
                    msg.difficulty_level === "Intermediate" ? "bg-yellow-100 text-yellow-600" :
                    "bg-red-100 text-red-600"
                  }`}>
                    {msg.difficulty_level}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
