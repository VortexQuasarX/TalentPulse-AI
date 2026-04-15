"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { FinalizeResponse, ConversationMessage } from "@/lib/types";
import EvaluationReport from "@/components/EvaluationReport";
import Transcript from "@/components/Transcript";
import useBehaviorDetection from "@/hooks/useBehaviorDetection";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const MAX_ANSWER_TIME = 60000;    // 60 seconds max per answer

type Phase = "loading" | "consent" | "ready" | "playing" | "recording" | "processing" | "completed";

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = Number(params.id);

  const [phase, setPhase] = useState<Phase>("loading");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [questionNumber, setQuestionNumber] = useState(0);
  const [transcription, setTranscription] = useState("");
  const [evaluation, setEvaluation] = useState<Record<string, any> | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [roundType, setRoundType] = useState("");
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [consentLoading, setConsentLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [selectedMic, setSelectedMic] = useState<string>("");

  // Audio recording refs
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioBuffer = useRef<Blob[]>([]);
  const fullRecordingChunks = useRef<Blob[]>([]);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const autoSubmitTimer = useRef<NodeJS.Timeout | null>(null);
  const currentUuid = useRef<string>("");
  const streamRef = useRef<MediaStream | null>(null);

  // Video recording refs
  const videoRecorder = useRef<MediaRecorder | null>(null);
  const videoChunks = useRef<Blob[]>([]);

  // Behavior detection (camera + ML)
  const behavior = useBehaviorDetection(`session_${sessionId}`);

  // Tab switch tracking
  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        fetch(`${API}/behavior/tab-switch/${sessionId}`, { method: "POST" }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [sessionId]);

  // Check session state on mount
  useEffect(() => {
    (async () => {
      try {
        const session = await api.get(`/interviews/sessions/${sessionId}/results`);
        if (session.status === "completed" && session.evaluation) {
          setEvaluation(session.evaluation);
          if (session.conversation_history) setConversationHistory(session.conversation_history);
          setPhase("completed");
        } else {
          setPhase("consent");
        }
      } catch {
        setPhase("consent");
      }
    })();
  }, [sessionId]);

  const stopRecording = useCallback(() => {
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    if (autoSubmitTimer.current) clearTimeout(autoSubmitTimer.current);
    if (mediaRecorder.current?.state === "recording") {
      mediaRecorder.current.requestData();
      mediaRecorder.current.stop();
    }
  }, []);

  const saveFullRecording = useCallback(async () => {
    const token = getToken();
    // Save audio recording
    if (fullRecordingChunks.current.length > 0) {
      const audioBlob = new Blob(fullRecordingChunks.current, { type: "audio/webm" });
      const audioForm = new FormData();
      audioForm.append("audio", audioBlob, `session_${sessionId}.webm`);
      await fetch(`${API}/session/save-recording?session_id=${sessionId}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: audioForm,
      }).catch(() => {});
    }
    // Save video recording
    if (videoRecorder.current?.state === "recording") {
      videoRecorder.current.stop();
    }
    // Wait a moment for final chunks
    await new Promise(r => setTimeout(r, 500));
    if (videoChunks.current.length > 0) {
      const videoBlob = new Blob(videoChunks.current, { type: "video/webm" });
      const videoForm = new FormData();
      videoForm.append("video", videoBlob, `session_${sessionId}_video.webm`);
      await fetch(`${API}/session/save-video?session_id=${sessionId}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: videoForm,
      }).catch(() => {});
    }
  }, [sessionId]);

  const finalizeRecording = useCallback(async () => {
    stopRecording();
    setPhase("processing");

    // Wait for MediaRecorder to flush final data event
    await new Promise(r => setTimeout(r, 500));

    // Send ALL accumulated audio as one combined blob
    const allChunks = [...audioBuffer.current];
    audioBuffer.current = [];
    console.log(`[Audio] Finalizing: ${allChunks.length} chunks, total size: ${allChunks.reduce((a, b) => a + b.size, 0)} bytes`);

    if (allChunks.length > 0) {
      const allAudio = new Blob(allChunks, { type: "audio/webm" });
      console.log(`[Audio] Combined blob size: ${allAudio.size} bytes`);
      const formData = new FormData();
      formData.append("audio", allAudio, "final_chunk.webm");
      const token = getToken();
      const chunkRes = await fetch(`${API}/session/audio-chunk?uuid=${currentUuid.current}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData,
      }).catch(e => { console.error("[Audio] Chunk send failed:", e); return null; });
      if (chunkRes) console.log(`[Audio] Chunk sent: status=${chunkRes.status}`);
    } else {
      console.warn("[Audio] WARNING: No audio chunks to send!");
    }

    // Don't stop tracks here — they're shared with behavior detection
    // They get cleaned up when behavior.stop() is called

    try {
      const res: FinalizeResponse = await api.post(
        `/session/audio-finalize?uuid=${currentUuid.current}&session_id=${sessionId}`
      );
      setTranscription(res.transcription);

      if (res.is_complete || !res.next_question) {
        await saveFullRecording();
        const evalRes = await api.post(`/session/evaluate?session_id=${sessionId}`);
        setEvaluation(evalRes);
        behavior.stop();
        exitFullscreen();
        const sess = await api.get(`/interviews/sessions/${sessionId}/results`);
        if (sess.conversation_history) setConversationHistory(sess.conversation_history);
        setPhase("completed");
      } else {
        setCurrentQuestion(res.next_question);
        setQuestionNumber(n => n + 1);
        playQuestion(res.next_question);
      }
    } catch (err: any) {
      setError(err.message || "Failed to process answer");
      setPhase("ready");
    }
  }, [sessionId, stopRecording, saveFullRecording, behavior]);

  const recordingStartTime = useRef<number>(0);

  const startRecording = useCallback(async () => {
    try {
      // Get audio stream with the selected mic device
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
      };
      if (selectedMic) {
        audioConstraints.deviceId = { exact: selectedMic };
      }

      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      streamRef.current = audioStream;

      const audioTrack = audioStream.getAudioTracks()[0];
      console.log("[Audio] Recording mic:", audioTrack?.label);

      currentUuid.current = uuidv4();
      audioBuffer.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(audioStream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioBuffer.current.push(e.data);
          fullRecordingChunks.current.push(e.data);
        }
      };

      recorder.start(3000);
      setPhase("recording");
      setRecordingTime(0);
      recordingStartTime.current = Date.now();
      recordingTimer.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
      autoSubmitTimer.current = setTimeout(() => finalizeRecording(), MAX_ANSWER_TIME);
    } catch (err) {
      setError("Microphone access denied.");
    }
  }, [finalizeRecording, selectedMic]);

  const playQuestion = useCallback(async (text: string) => {
    setPhase("playing");
    try {
      const token = getToken();
      const res = await fetch(`${API}/tts/synthesize?text=${encodeURIComponent(text)}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); startRecording(); };
      audio.play();
    } catch {
      const u = new SpeechSynthesisUtterance(text);
      u.onend = () => startRecording();
      speechSynthesis.speak(u);
    }
  }, [startRecording]);

  const handleConsent = async () => {
    setConsentLoading(true);
    // Enumerate mic devices so user can pick the right one
    try {
      // Need a temp audio permission to list devices with labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach(t => t.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === "audioinput");
      setMicDevices(mics);
      // Default to first non-virtual mic, or first one
      const realMic = mics.find(m => !m.label.toLowerCase().includes("virtual") && !m.label.toLowerCase().includes("cable"));
      setSelectedMic(realMic?.deviceId || mics[0]?.deviceId || "");
      console.log("[Audio] Available mics:", mics.map(m => m.label));
    } catch (e) {
      console.error("[Audio] Mic enumeration failed:", e);
    }

    await behavior.start();
    // Wait for video stream + ML models to initialize
    await new Promise(r => setTimeout(r, 2000));
    // Record from the CANVAS stream (has anomaly overlay burned into frames)
    const canvasStream = behavior.canvasStreamRef.current;
    if (canvasStream) {
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      const recorder = new MediaRecorder(canvasStream, { mimeType });
      videoChunks.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunks.current.push(e.data);
      };
      recorder.start(1000);
      videoRecorder.current = recorder;
      console.log("[Recording] Canvas stream recording started (with overlay)");
    } else {
      console.warn("[Recording] No canvas stream available, falling back to raw camera");
      // Fallback to raw camera
      if (behavior.videoRef.current?.srcObject) {
        const stream = behavior.videoRef.current.srcObject as MediaStream;
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
        const recorder = new MediaRecorder(stream, { mimeType });
        videoChunks.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) videoChunks.current.push(e.data);
        };
        recorder.start(1000);
        videoRecorder.current = recorder;
      }
    }
    setConsentLoading(false);
    setPhase("ready");
  };

  const enterFullscreen = () => {
    try { document.documentElement.requestFullscreen?.(); } catch {}
  };
  const exitFullscreen = () => {
    try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch {}
  };

  const startInterview = async () => {
    setError("");
    setStartLoading(true);
    setPhase("processing");
    fullRecordingChunks.current = [];
    enterFullscreen();
    try {
      const res = await api.post(`/session/start?session_id=${sessionId}`);
      setCurrentQuestion(res.question);
      setQuestionNumber(1);
      setRoundType(res.round_type || "");
      playQuestion(res.question);
    } catch (err: any) {
      setError(err.message || "Failed to start");
      setStartLoading(false);
      setPhase("ready");
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // COMPLETED
  if (phase === "completed" && evaluation) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Interview Complete</h1>
            <p className="text-sm text-gray-500">Your responses have been evaluated</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <EvaluationReport evaluation={evaluation} />
        </div>
        {conversationHistory.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mt-4 shadow-sm">
            <Transcript messages={conversationHistory} />
          </div>
        )}
        <button onClick={() => router.push("/candidate/dashboard")}
          className="mt-6 w-full py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 font-medium text-gray-600">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex gap-6">
        {/* Main interview area */}
        <div className="flex-1">
          {/* Header bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">AI Interview</h1>
                {roundType && <p className="text-xs text-gray-500">{roundType.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</p>}
              </div>
            </div>
            {(phase === "recording" || phase === "playing") && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">Q{questionNumber}</span>
                {phase === "recording" && (
                  <span className="text-sm text-red-500 font-mono bg-red-50 px-2 py-0.5 rounded">{formatTime(recordingTime)}</span>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* CONSENT */}
          {phase === "consent" && (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center shadow-sm">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Camera & Microphone Required</h2>
              <p className="text-sm text-gray-500 mb-1">Your camera is used for behavioral analysis.</p>
              <p className="text-xs text-gray-400 mb-6">Video is processed locally. Only scores are sent to the server.</p>
              <button onClick={handleConsent} disabled={consentLoading}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 font-medium shadow-sm disabled:opacity-70 flex items-center justify-center gap-2 mx-auto">
                {consentLoading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />}
                {consentLoading ? "Setting up camera & ML models..." : "I Consent — Enable Camera"}
              </button>
            </div>
          )}

          {/* LOADING */}
          {phase === "loading" && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}

          {/* READY */}
          {phase === "ready" && (
            <div className="bg-white rounded-xl border p-8 text-center">
              <div className="text-5xl mb-4">🎤</div>
              <h2 className="text-xl font-semibold mb-2">Ready to begin?</h2>
              <p className="text-gray-500 mb-4 text-sm">
                AI will ask you questions. Speak your answers clearly.
              </p>

              {/* Mic selector */}
              {micDevices.length > 1 && (
                <div className="mb-4 text-left max-w-xs mx-auto">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Microphone</label>
                  <select value={selectedMic} onChange={e => setSelectedMic(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    {micDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 8)}`}</option>
                    ))}
                  </select>
                </div>
              )}
              {micDevices.length === 1 && (
                <p className="text-xs text-gray-400 mb-4">Mic: {micDevices[0].label}</p>
              )}

              {behavior.isLoading && <p className="text-sm text-blue-500 mb-4">Loading ML models...</p>}
              <button onClick={startInterview} disabled={behavior.isLoading || startLoading}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 text-lg disabled:opacity-70 flex items-center justify-center gap-2 mx-auto">
                {startLoading && <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />}
                {startLoading ? "Preparing interview..." : "Start Interview"}
              </button>
            </div>
          )}

          {/* ACTIVE INTERVIEW */}
          {(phase === "playing" || phase === "recording" || phase === "processing") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Question {questionNumber}</span>
                {phase === "recording" && (
                  <span className="text-sm text-red-500 font-mono">{formatTime(recordingTime)}</span>
                )}
              </div>

              <div className="bg-white rounded-xl border p-6">
                <p className="text-lg">{currentQuestion}</p>
              </div>

              {phase === "playing" && (
                <div className="flex items-center justify-center gap-2 text-blue-600">
                  <span className="flex gap-1">
                    {[1,2,3,4].map(i => (
                      <span key={i} className="w-1 h-4 bg-blue-500 rounded animate-pulse" style={{ animationDelay: `${i*0.1}s` }} />
                    ))}
                  </span>
                  <span className="text-sm ml-2">AI is speaking...</span>
                </div>
              )}

              {phase === "recording" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm text-red-600">Recording...</span>
                  </div>
                  <button onClick={finalizeRecording}
                    className="w-full py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-sm">
                    Submit Answer
                  </button>
                  <p className="text-xs text-gray-400 text-center">
                    Click Submit when done. Auto-submits after 60 seconds.
                  </p>
                </div>
              )}

              {phase === "processing" && (
                <div className="flex items-center justify-center gap-2 text-gray-500">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                  <span className="text-sm">Processing...</span>
                </div>
              )}

              {transcription && phase !== "processing" && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Your answer:</p>
                  <p className="text-sm text-gray-600">{transcription}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Camera preview — always mounted so videoRef works, hidden during consent/loading/completed */}
        <div className={`shrink-0 ${phase === "loading" || phase === "consent" || phase === "completed" ? "w-0 overflow-hidden" : "w-48"}`}>
          <div className="bg-black rounded-xl overflow-hidden">
            <video ref={behavior.videoRef} className="w-full h-auto" style={{ transform: "scaleX(-1)" }}
              autoPlay playsInline muted />
          </div>
          {behavior.isRunning && phase !== "completed" && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-gray-400">Camera active</span>
            </div>
          )}
          {behavior.isLoading && (
            <p className="text-[10px] text-gray-400 text-center mt-2">Setting up camera...</p>
          )}
        </div>
      </div>
    </div>
  );
}
