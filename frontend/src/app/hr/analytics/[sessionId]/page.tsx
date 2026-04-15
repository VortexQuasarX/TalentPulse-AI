"use client";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell, ReferenceLine,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface Scores {
  eye_contact: number;
  posture: number;
  engagement: number;
  confidence: number;
}

interface AnomalyFlag {
  type: string;
  timestamp: number;
  message: string;
  severity: string;
}

interface TimelineEntry {
  timestamp: string;
  scores: Scores;
  emotion: string;
  face_count: number;
  anomaly_flags: AnomalyFlag[];
}

interface Summary {
  avg_eye_contact: number;
  avg_posture: number;
  avg_engagement: number;
  avg_confidence: number;
  total_anomalies: number;
  anomaly_timeline: any[];
  dominant_emotion: string;
  behavior_grade: string;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export default function AnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const interviewId = `session_${sessionId}`;

  const [summary, setSummary] = useState<Summary | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [overlayScores, setOverlayScores] = useState<Scores | null>(null);
  const [overlayEmotion, setOverlayEmotion] = useState("neutral");
  const [overlayFaceCount, setOverlayFaceCount] = useState(1);
  const [overlayAnomalies, setOverlayAnomalies] = useState<AnomalyFlag[]>([]);
  const [videoDuration, setVideoDuration] = useState(0);

  // Compute interval between timeline entries
  const entryInterval = useMemo(() => {
    if (timeline.length < 2) return 5;
    const t0 = new Date(timeline[0].timestamp).getTime();
    const t1 = new Date(timeline[1].timestamp).getTime();
    return Math.max(1, (t1 - t0) / 1000);
  }, [timeline]);

  useEffect(() => {
    (async () => {
      try {
        const [reportRes, sessRes] = await Promise.all([
          api.get(`/behavior/report/${interviewId}`).catch(() => null),
          api.get(`/interviews/sessions/${sessionId}/results`).catch(() => null),
        ]);
        if (reportRes) {
          setSummary(reportRes.summary);
          setTimeline(reportRes.timeline || []);
          setTotalPoints(reportRes.total_data_points || 0);
        }
        if (sessRes) setSessionInfo(sessRes);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, interviewId]);

  // Smooth interpolation: on every timeupdate (~4fps), interpolate between timeline entries
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || timeline.length === 0) return;
    const t = videoRef.current.currentTime;
    setCurrentVideoTime(t);

    // Map video time to timeline position
    const floatIndex = t / entryInterval;
    const idx = Math.floor(floatIndex);
    const frac = floatIndex - idx;

    if (idx < 0 || idx >= timeline.length) return;

    const entry = timeline[idx];
    const nextEntry = idx + 1 < timeline.length ? timeline[idx + 1] : entry;

    // Interpolate scores smoothly
    setOverlayScores({
      eye_contact: lerp(entry.scores.eye_contact, nextEntry.scores.eye_contact, frac),
      posture: lerp(entry.scores.posture, nextEntry.scores.posture, frac),
      engagement: lerp(entry.scores.engagement, nextEntry.scores.engagement, frac),
      confidence: lerp(entry.scores.confidence, nextEntry.scores.confidence, frac),
    });

    // Discrete values: use current entry
    setOverlayEmotion(entry.emotion || "neutral");
    setOverlayFaceCount(entry.face_count ?? 1);
    setOverlayAnomalies(entry.anomaly_flags || []);
  }, [timeline, entryInterval]);

  // All anomaly events flattened with video time mapping
  const allAnomalies = useMemo(() => {
    return timeline.flatMap((t, i) =>
      (t.anomaly_flags || []).map(f => ({
        videoTime: i * entryInterval,
        elapsed: `${(i * entryInterval).toFixed(0)}s`,
        wallTime: t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : "",
        ...f,
      }))
    );
  }, [timeline, entryInterval]);

  // Chart data
  const chartData = useMemo(() => {
    return timeline.map((t, i) => ({
      time: `${Math.floor(i * entryInterval / 60)}:${String(Math.floor((i * entryInterval) % 60)).padStart(2, "0")}`,
      seconds: i * entryInterval,
      eye: Math.round(t.scores.eye_contact),
      posture: Math.round(t.scores.posture),
      engagement: Math.round(t.scores.engagement),
      confidence: Math.round(t.scores.confidence),
    }));
  }, [timeline, entryInterval]);

  // Anomaly frequency by type
  const anomalyBarData = useMemo(() => {
    const counts: Record<string, number> = {};
    timeline.forEach(t => {
      t.anomaly_flags?.forEach(f => { counts[f.type] = (counts[f.type] || 0) + 1; });
    });
    return Object.entries(counts).map(([type, count]) => ({ type: type.replace(/_/g, " "), count }));
  }, [timeline]);

  const OverlayBar = ({ label, value }: { label: string; value: number }) => {
    const v = Math.round(value);
    const color = v >= 70 ? "bg-green-400" : v >= 40 ? "bg-yellow-400" : "bg-red-400";
    return (
      <div className="flex items-center gap-2">
        <span className="w-14 text-gray-300 text-xs">{label}</span>
        <div className="flex-1 h-2 bg-gray-600 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-200 ${color}`} style={{ width: `${Math.min(100, v)}%` }} />
        </div>
        <span className="w-8 text-right text-xs font-mono">{v}</span>
      </div>
    );
  };

  const MetricCard = ({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) => {
    const color = value >= 70 ? "text-green-600" : value >= 40 ? "text-yellow-600" : "text-red-600";
    const barColor = value >= 70 ? "bg-green-500" : value >= 40 ? "bg-yellow-500" : "bg-red-500";
    return (
      <div className="bg-white rounded-xl border p-4">
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{Math.round(value)}{suffix}</p>
        <div className="h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, value)}%` }} />
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Anomaly Detection Analytics</h1>
          <p className="text-sm text-gray-500">
            Session #{sessionId}
            {sessionInfo && <span> | {sessionInfo.candidate_name} | Round {sessionInfo.round_number} ({sessionInfo.round_type?.replace("_", " ")})</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {summary?.behavior_grade && (
            <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center ${
              ["A+", "A"].includes(summary.behavior_grade) ? "text-green-600 border-green-500" :
              ["B", "C"].includes(summary.behavior_grade) ? "text-yellow-600 border-yellow-500" : "text-red-600 border-red-500"
            }`}>
              <span className="text-2xl font-bold">{summary.behavior_grade}</span>
            </div>
          )}
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 border px-3 py-1.5 rounded-lg">Back</button>
        </div>
      </div>

      {/* Video with LIVE Anomaly Overlay */}
      <div className="bg-white rounded-xl border p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Interview Recording with Real-Time Anomaly Overlay</h3>
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            controls
            className="w-full"
            src={`${API}/session/video/${sessionId}`}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => { if (videoRef.current) setVideoDuration(videoRef.current.duration); }}
            style={{ maxHeight: "520px" }}
          />

          {/* Real-time overlay synced to video playback */}
          {overlayScores && (
            <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-sm rounded-lg p-3 text-white space-y-1.5 min-w-[200px] pointer-events-none">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[10px] uppercase tracking-wider text-blue-400">ANOMALY DETECTION</span>
                <span className="text-[10px] text-gray-400 font-mono">{Math.floor(currentVideoTime)}s</span>
              </div>
              <OverlayBar label="Eye" value={overlayScores.eye_contact} />
              <OverlayBar label="Posture" value={overlayScores.posture} />
              <OverlayBar label="Engage" value={overlayScores.engagement} />
              <OverlayBar label="Confid" value={overlayScores.confidence} />
              <div className="flex items-center justify-between pt-1.5 border-t border-gray-600 text-xs">
                <span className="capitalize">{overlayEmotion}</span>
                <span className={overlayFaceCount === 1 ? "text-green-400" : overlayFaceCount === 0 ? "text-yellow-400" : "text-red-400"}>
                  {overlayFaceCount === 0 ? "No face" : overlayFaceCount === 1 ? "1 face" : `${overlayFaceCount} faces!`}
                </span>
              </div>
              {overlayAnomalies.length > 0 && (
                <div className="pt-1 border-t border-gray-600 space-y-0.5">
                  {overlayAnomalies.map((f, i) => (
                    <div key={i} className={`flex items-center gap-1 text-[10px] ${
                      f.severity === "critical" ? "text-red-400" : f.severity === "warning" ? "text-yellow-400" : "text-blue-400"
                    }`}>
                      <span>{f.severity === "critical" ? "!!" : "!"}</span>
                      <span>{f.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Current time indicator on bottom */}
          {videoDuration > 0 && (
            <div className="absolute bottom-12 right-3 bg-black/60 rounded px-2 py-1 text-[10px] text-gray-300 font-mono pointer-events-none">
              {Math.floor(currentVideoTime / 60)}:{String(Math.floor(currentVideoTime % 60)).padStart(2, "0")} / {Math.floor(videoDuration / 60)}:{String(Math.floor(videoDuration % 60)).padStart(2, "0")}
            </div>
          )}
        </div>
      </div>

      {/* Summary Metrics */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <MetricCard label="Avg Eye Contact" value={summary.avg_eye_contact} suffix="%" />
          <MetricCard label="Avg Posture" value={summary.avg_posture} suffix="%" />
          <MetricCard label="Avg Engagement" value={summary.avg_engagement} suffix="%" />
          <MetricCard label="Avg Confidence" value={summary.avg_confidence} suffix="%" />
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xs text-gray-400">Data Points</p>
          <p className="text-2xl font-bold">{totalPoints}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xs text-gray-400">Total Anomalies</p>
          <p className={`text-2xl font-bold ${(summary?.total_anomalies || 0) === 0 ? "text-green-600" : "text-red-600"}`}>
            {summary?.total_anomalies || 0}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xs text-gray-400">Dominant Emotion</p>
          <p className="text-2xl font-bold capitalize">{summary?.dominant_emotion || "—"}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-xs text-gray-400">Tab Switches</p>
          <p className={`text-2xl font-bold ${(sessionInfo?.tab_switch_count || 0) === 0 ? "text-green-600" : "text-red-600"}`}>
            {sessionInfo?.tab_switch_count || 0}
          </p>
        </div>
      </div>

      {/* Score Timeline Chart with current position marker */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Score Timeline</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine x={chartData[Math.min(Math.floor(currentVideoTime / entryInterval), chartData.length - 1)]?.time} stroke="#ef4444" strokeDasharray="3 3" label="" />
              <Line type="monotone" dataKey="eye" stroke="#3b82f6" name="Eye Contact" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="posture" stroke="#10b981" name="Posture" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="engagement" stroke="#8b5cf6" name="Engagement" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="confidence" stroke="#f59e0b" name="Confidence" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-gray-400 mt-1">Red dashed line = current video position</p>
        </div>
      )}

      {/* Anomaly Distribution + Anomaly Log side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Distribution Chart */}
        {anomalyBarData.length > 0 && (
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Anomaly Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={anomalyBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="type" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {anomalyBarData.map((_, i) => (
                    <Cell key={i} fill={["#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6"][i % 4]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Anomaly Log with timestamps + jump to video */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Anomaly Event Log</h3>
            <span className="text-xs text-gray-400">{allAnomalies.length} events</span>
          </div>
          <div className="max-h-[260px] overflow-y-auto space-y-1.5">
            {allAnomalies.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No anomalies detected during this interview.</p>
            ) : (
              allAnomalies.map((a, i) => (
                <div key={i}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer hover:brightness-95 transition ${
                    a.severity === "critical" ? "bg-red-50 border border-red-200" :
                    a.severity === "warning" ? "bg-yellow-50 border border-yellow-200" :
                    "bg-blue-50 border border-blue-200"
                  } ${Math.abs(a.videoTime - currentVideoTime) < entryInterval ? "ring-2 ring-blue-400" : ""}`}
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = a.videoTime;
                      videoRef.current.play();
                    }
                  }}
                >
                  <span className="font-mono text-gray-500 shrink-0 w-10">{a.elapsed}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                    a.severity === "critical" ? "bg-red-200 text-red-800" :
                    a.severity === "warning" ? "bg-yellow-200 text-yellow-800" : "bg-blue-200 text-blue-800"
                  }`}>{a.severity}</span>
                  <span className="text-gray-700 truncate">{a.message}</span>
                  <span className="text-gray-400 ml-auto shrink-0 text-[10px]">{a.wallTime}</span>
                  <span className="text-blue-500 shrink-0 font-medium">Jump</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* No anomaly distribution? Show standalone log */}
      {anomalyBarData.length === 0 && allAnomalies.length === 0 && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-6 text-center mb-6">
          <p className="text-green-700 font-medium">No anomalies detected during this interview session.</p>
          <p className="text-green-600 text-sm mt-1">The candidate maintained good behavior throughout.</p>
        </div>
      )}
    </div>
  );
}
