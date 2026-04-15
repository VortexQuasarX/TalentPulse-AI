"use client";
import { useRef, useState, useCallback, useEffect } from "react";
import { getToken } from "@/lib/auth";
import {
  computeEyeContactScore, computePostureScore, computeEngagementScore,
  computeConfidenceScore, detectAnomalies, detectEmotion,
  type AnomalyFlag,
} from "@/utils/scoring";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export interface BehaviorScores {
  eyeContact: number;
  posture: number;
  engagement: number;
  confidence: number;
  emotion: string;
  faceCount: number;
  anomalies: AnomalyFlag[];
}

export default function useBehaviorDetection(interviewId: string) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const processingVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceMeshRef = useRef<any>(null);
  const poseRef = useRef<any>(null);
  const blazefaceRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastPostRef = useRef<number>(0);
  const interviewStartRef = useRef<number>(Date.now());
  const scoreBufferRef = useRef<BehaviorScores[]>([]);
  const latestScoresRef = useRef<BehaviorScores>({
    eyeContact: 0, posture: 0, engagement: 0, confidence: 0,
    emotion: "neutral", faceCount: 1, anomalies: [],
  });
  const runningRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentScores, setCurrentScores] = useState<BehaviorScores>({
    eyeContact: 0, posture: 0, engagement: 0, confidence: 0,
    emotion: "neutral", faceCount: 1, anomalies: [],
  });
  const [error, setError] = useState<string | null>(null);

  const postScoresToBackend = useCallback(async (data: Record<string, any>) => {
    try {
      const token = getToken();
      await fetch(`${API}/behavior/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.error("[Behavior] Score post failed:", err);
    }
  }, []);

  const loadModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const tf = await import("@tensorflow/tfjs");
      await tf.ready();
      console.log("[ML] TF.js ready, backend:", tf.getBackend());

      const faceLandmarks = await import("@tensorflow-models/face-landmarks-detection");
      faceMeshRef.current = await faceLandmarks.createDetector(
        faceLandmarks.SupportedModels.MediaPipeFaceMesh,
        { runtime: "tfjs", refineLandmarks: true, maxFaces: 1 }
      );
      console.log("[ML] Face Mesh loaded");

      const poseDetection = await import("@tensorflow-models/pose-detection");
      poseRef.current = await poseDetection.createDetector(
        poseDetection.SupportedModels.BlazePose,
        { runtime: "tfjs", modelType: "lite", enableSmoothing: true }
      );
      console.log("[ML] Pose detector loaded");

      const blazeface = await import("@tensorflow-models/blazeface");
      blazefaceRef.current = await blazeface.load();
      console.log("[ML] BlazeFace loaded");

      setIsLoading(false);
      return true;
    } catch (err: any) {
      console.error("[ML] Model loading failed:", err);
      setError("Failed to load ML models: " + err.message);
      setIsLoading(false);
      return false;
    }
  }, []);

  // Draw detection overlay onto the canvas (burned into recording)
  const drawOverlay = useCallback((ctx: CanvasRenderingContext2D, scores: BehaviorScores) => {
    const w = 640, h = 480;

    // Draw the video frame first
    if (processingVideoRef.current) {
      ctx.drawImage(processingVideoRef.current, 0, 0, w, h);
    }

    // Semi-transparent overlay panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 200, 155, 8);
    ctx.fill();

    // Title
    ctx.fillStyle = "#60a5fa";
    ctx.font = "bold 10px monospace";
    ctx.fillText("ANOMALY DETECTION", 20, 28);

    const elapsed = ((Date.now() - interviewStartRef.current) / 1000).toFixed(0);
    ctx.fillStyle = "#9ca3af";
    ctx.font = "9px monospace";
    ctx.fillText(`${elapsed}s`, 170, 28);

    // Score bars
    const drawBar = (label: string, value: number, y: number) => {
      ctx.fillStyle = "#d1d5db";
      ctx.font = "10px sans-serif";
      ctx.fillText(label, 20, y);

      // Bar background
      ctx.fillStyle = "#374151";
      ctx.beginPath();
      ctx.roundRect(80, y - 8, 100, 8, 3);
      ctx.fill();

      // Bar fill
      const pct = Math.min(100, Math.max(0, value));
      ctx.fillStyle = pct >= 70 ? "#22c55e" : pct >= 40 ? "#eab308" : "#ef4444";
      ctx.beginPath();
      ctx.roundRect(80, y - 8, pct, 8, 3);
      ctx.fill();

      // Value
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px monospace";
      ctx.fillText(String(Math.round(value)), 185, y);
    };

    drawBar("Eye", scores.eyeContact, 48);
    drawBar("Posture", scores.posture, 65);
    drawBar("Engage", scores.engagement, 82);
    drawBar("Confid", scores.confidence, 99);

    // Emotion + Face count
    ctx.fillStyle = "#6b7280";
    ctx.beginPath();
    ctx.moveTo(20, 110);
    ctx.lineTo(200, 110);
    ctx.stroke();

    ctx.fillStyle = "#e5e7eb";
    ctx.font = "10px sans-serif";
    ctx.fillText(scores.emotion, 20, 125);

    const faceColor = scores.faceCount === 1 ? "#22c55e" : scores.faceCount === 0 ? "#eab308" : "#ef4444";
    ctx.fillStyle = faceColor;
    ctx.font = "bold 10px sans-serif";
    ctx.fillText(`Faces: ${scores.faceCount}`, 140, 125);

    // Anomaly alerts
    if (scores.anomalies.length > 0) {
      let ay = 142;
      for (const a of scores.anomalies.slice(0, 2)) {
        ctx.fillStyle = a.severity === "critical" ? "#fca5a5" : a.severity === "warning" ? "#fde68a" : "#93c5fd";
        ctx.font = "9px sans-serif";
        ctx.fillText(`⚠ ${a.message}`, 20, ay);
        ay += 13;
      }
    }
  }, []);

  const processFrame = useCallback(async () => {
    const video = processingVideoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return;

    try {
      let eyeContact = 50, posture = 50, faceCount = 1, emotion = "neutral";

      if (faceMeshRef.current) {
        const faces = await faceMeshRef.current.estimateFaces(video);
        if (faces.length > 0) {
          eyeContact = computeEyeContactScore(faces[0].keypoints);
          emotion = detectEmotion(faces[0].keypoints);
        } else {
          eyeContact = 0;
        }
      }

      if (poseRef.current) {
        const poses = await poseRef.current.estimatePoses(video);
        if (poses.length > 0) posture = computePostureScore(poses[0].keypoints);
      }

      if (blazefaceRef.current) {
        const predictions = await blazefaceRef.current.estimateFaces(video, false);
        faceCount = predictions.length;
      }

      const engagement = computeEngagementScore(eyeContact, posture);
      const confidence = computeConfidenceScore(posture);
      const anomalies = detectAnomalies(
        { eyeContactScore: eyeContact, postureScore: posture, faceCount },
        interviewStartRef.current
      );

      const scores: BehaviorScores = { eyeContact, posture, engagement, confidence, emotion, faceCount, anomalies };
      setCurrentScores(scores);
      latestScoresRef.current = scores;
      scoreBufferRef.current.push(scores);

      // Draw overlay on canvas (this gets recorded)
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) drawOverlay(ctx, scores);
      }

      // POST every 5 seconds
      const now = Date.now();
      if (now - lastPostRef.current >= 5000) {
        lastPostRef.current = now;
        const latest = scoreBufferRef.current[scoreBufferRef.current.length - 1];
        scoreBufferRef.current = [];

        const safe = (v: number) => isNaN(v) ? 50 : Math.max(0, Math.min(100, v));
        postScoresToBackend({
          interview_id: interviewId,
          eye_contact_score: safe(latest.eyeContact),
          posture_score: safe(latest.posture),
          engagement_score: safe(latest.engagement),
          confidence_score: safe(latest.confidence),
          emotion_label: latest.emotion || "neutral",
          face_count: latest.faceCount || 1,
          anomaly_flags: latest.anomalies || [],
        });
      }
    } catch (err) {
      console.error("[ML] Frame processing error:", err);
    }
  }, [interviewId, postScoresToBackend, drawOverlay]);

  const runDetection = useCallback(() => {
    let frameCount = 0;
    const loop = async () => {
      if (!runningRef.current) return;
      frameCount++;
      if (frameCount % 2 === 0) await processFrame();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();
  }, [processFrame]);

  const start = useCallback(async () => {
    setError(null);
    try {
      // Video only for ML detection — audio handled separately by interview page
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;

      // Hidden processing video at 640x480
      const procVideo = document.createElement("video");
      procVideo.srcObject = stream;
      procVideo.width = 640;
      procVideo.height = 480;
      procVideo.autoplay = true;
      procVideo.playsInline = true;
      procVideo.muted = true;
      procVideo.style.position = "fixed";
      procVideo.style.top = "-9999px";
      procVideo.style.left = "-9999px";
      procVideo.style.width = "640px";
      procVideo.style.height = "480px";
      document.body.appendChild(procVideo);
      await procVideo.play();
      processingVideoRef.current = procVideo;

      // Canvas for recording with overlay burned in
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      canvas.style.position = "fixed";
      canvas.style.top = "-9999px";
      canvas.style.left = "-9999px";
      document.body.appendChild(canvas);
      canvasRef.current = canvas;

      // Create a stream from the canvas for recording
      canvasStreamRef.current = canvas.captureStream(15); // 15fps

      // Display video ref (small preview for candidate)
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      console.log("[ML] Camera active, dimensions:", procVideo.videoWidth, procVideo.videoHeight);

      const ready = await loadModels();
      if (!ready) return;

      interviewStartRef.current = Date.now();
      lastPostRef.current = Date.now();
      runningRef.current = true;
      setIsRunning(true);
      runDetection();
      console.log("[ML] Detection loop started");
    } catch (err: any) {
      console.error("[ML] Start failed:", err);
      setError("Camera access denied: " + err.message);
    }
  }, [loadModels, runDetection]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (processingVideoRef.current) {
      processingVideoRef.current.pause();
      processingVideoRef.current.srcObject = null;
      processingVideoRef.current.remove();
      processingVideoRef.current = null;
    }
    if (canvasRef.current) {
      canvasRef.current.remove();
      canvasRef.current = null;
    }
    canvasStreamRef.current = null;
    setIsRunning(false);
  }, []);

  useEffect(() => { return () => { stop(); }; }, [stop]);

  return {
    videoRef,
    canvasStreamRef, // Use this for video recording — has overlay burned in
    streamRef,       // Full stream with audio — use for mic recording
    isRunning, isLoading, currentScores, error, start, stop,
  };
}
