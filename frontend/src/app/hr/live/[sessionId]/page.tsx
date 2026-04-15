"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const WS_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001").replace("http", "ws");

interface LiveScore {
  eye_contact_score: number;
  posture_score: number;
  engagement_score: number;
  confidence_score: number;
  emotion_label: string;
  face_count: number;
  anomaly_flags: { type: string; timestamp: number; message: string; severity: string }[];
  timestamp: string;
}

interface ChartPoint {
  time: string;
  eye: number;
  posture: number;
  engagement: number;
  confidence: number;
}

interface AnomalyLog {
  time: string;
  elapsed: string;
  message: string;
  severity: string;
  type: string;
}

export default function HRLiveMonitorPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const interviewId = `session_${sessionId}`;

  const [connected, setConnected] = useState(false);
  const [latestScores, setLatestScores] = useState<LiveScore | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [anomalyLog, setAnomalyLog] = useState<AnomalyLog[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef(Date.now());

  // Load session info
  useEffect(() => {
    api.get(`/interviews/sessions/${sessionId}/results`).then(setSessionInfo).catch(() => {});
  }, [sessionId]);

  // WebSocket connection for live scores
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/behavior/live/${interviewId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      startTimeRef.current = Date.now();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "pong") return;

        const score: LiveScore = data;
        setLatestScores(score);

        // Add to chart (keep last 60 points)
        const now = new Date();
        const timeLabel = `${now.getMinutes()}:${String(now.getSeconds()).padStart(2, "0")}`;
        setChartData(prev => {
          const next = [...prev, {
            time: timeLabel,
            eye: Math.round(score.eye_contact_score),
            posture: Math.round(score.posture_score),
            engagement: Math.round(score.engagement_score),
            confidence: Math.round(score.confidence_score),
          }];
          return next.slice(-60);
        });

        // Add anomalies to log
        if (score.anomaly_flags?.length > 0) {
          const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
          const newLogs = score.anomaly_flags.map(f => ({
            time: now.toLocaleTimeString(),
            elapsed: `${elapsed}s`,
            message: f.message,
            severity: f.severity,
            type: f.type,
          }));
          setAnomalyLog(prev => [...prev, ...newLogs].slice(-100));
        }
      } catch {}
    };

    ws.onerror = () => setConnected(false);
    ws.onclose = () => setConnected(false);

    // Heartbeat ping every 30s
    pingRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send("ping");
    }, 30000);

    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      ws.close();
    };
  }, [interviewId]);

  // Poll summary every 10s
  useEffect(() => {
    const poll = () => {
      api.get(`/behavior/summary/${interviewId}`).then(setSummary).catch(() => {});
    };
    poll();
    pollRef.current = setInterval(poll, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [interviewId]);

  // Auto-scroll anomaly log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [anomalyLog]);

  const ScoreGauge = ({ label, value, color }: { label: string; value: number; color: string }) => {
    const pct = Math.min(100, Math.max(0, value));
    const barColor = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
    return (
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">{label}</span>
          <span className={`text-2xl font-bold ${pct >= 70 ? "text-green-600" : pct >= 40 ? "text-yellow-600" : "text-red-600"}`}>
            {Math.round(value)}
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Live Interview Monitor</h1>
          <p className="text-sm text-gray-500">
            Session #{sessionId}
            {sessionInfo && <span> | {sessionInfo.candidate_name} | {sessionInfo.round_type?.replace("_", " ")}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            connected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}>
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            {connected ? "LIVE" : "Disconnected"}
          </div>
          {summary?.behavior_grade && (
            <div className={`px-4 py-1.5 rounded-full text-lg font-bold ${
              ["A+", "A"].includes(summary.behavior_grade) ? "bg-green-100 text-green-700" :
              ["B", "C"].includes(summary.behavior_grade) ? "bg-yellow-100 text-yellow-700" :
              "bg-red-100 text-red-700"
            }`}>
              {summary.behavior_grade}
            </div>
          )}
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">Back</button>
        </div>
      </div>

      {/* Live Score Gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <ScoreGauge label="Eye Contact" value={latestScores?.eye_contact_score || 0} color="blue" />
        <ScoreGauge label="Posture" value={latestScores?.posture_score || 0} color="green" />
        <ScoreGauge label="Engagement" value={latestScores?.engagement_score || 0} color="purple" />
        <ScoreGauge label="Confidence" value={latestScores?.confidence_score || 0} color="orange" />
      </div>

      {/* Status Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xs text-gray-400">Emotion</p>
          <p className="text-xl font-bold capitalize">{latestScores?.emotion_label || "—"}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xs text-gray-400">Face Count</p>
          <p className={`text-xl font-bold ${
            (latestScores?.face_count || 0) === 1 ? "text-green-600" :
            (latestScores?.face_count || 0) === 0 ? "text-yellow-600" : "text-red-600"
          }`}>
            {latestScores?.face_count ?? "—"}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xs text-gray-400">Total Anomalies</p>
          <p className={`text-xl font-bold ${(summary?.total_anomalies || 0) === 0 ? "text-green-600" : "text-red-600"}`}>
            {summary?.total_anomalies || 0}
          </p>
        </div>
      </div>

      {/* Rolling Chart */}
      <div className="bg-white rounded-xl border p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Score Timeline (Live)</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="eye" stroke="#3b82f6" name="Eye Contact" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="posture" stroke="#10b981" name="Posture" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="engagement" stroke="#8b5cf6" name="Engagement" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="confidence" stroke="#f59e0b" name="Confidence" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
            Waiting for score data...
          </div>
        )}
      </div>

      {/* Anomaly Log with Timestamps */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Anomaly Log</h3>
          <span className="text-xs text-gray-400">{anomalyLog.length} events</span>
        </div>
        <div className="max-h-[300px] overflow-y-auto space-y-1.5">
          {anomalyLog.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No anomalies detected yet</p>
          ) : (
            anomalyLog.map((log, i) => (
              <div key={i} className={`flex items-start gap-3 px-3 py-2 rounded-lg text-sm ${
                log.severity === "critical" ? "bg-red-50 border border-red-200" :
                log.severity === "warning" ? "bg-yellow-50 border border-yellow-200" :
                "bg-blue-50 border border-blue-200"
              }`}>
                <span className={`text-xs font-mono shrink-0 mt-0.5 ${
                  log.severity === "critical" ? "text-red-500" :
                  log.severity === "warning" ? "text-yellow-600" : "text-blue-500"
                }`}>
                  {log.elapsed}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                  log.severity === "critical" ? "bg-red-200 text-red-800" :
                  log.severity === "warning" ? "bg-yellow-200 text-yellow-800" :
                  "bg-blue-200 text-blue-800"
                }`}>
                  {log.severity}
                </span>
                <span className="text-gray-700">{log.message}</span>
                <span className="text-xs text-gray-400 ml-auto shrink-0">{log.time}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
