const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

interface Keypoint {
  x: number;
  y: number;
  z?: number;
  score?: number;
}

function norm(kp: Keypoint) {
  return { x: kp.x / VIDEO_WIDTH, y: kp.y / VIDEO_HEIGHT, z: kp.z || 0 };
}

export function computeEyeContactScore(landmarks: Keypoint[]): number {
  if (!landmarks || landmarks.length < 478) return 50;
  try {
    const leftIris = norm(landmarks[468]);
    const rightIris = norm(landmarks[473]);
    const leftEyeInner = norm(landmarks[133]);
    const leftEyeOuter = norm(landmarks[33]);
    const rightEyeInner = norm(landmarks[362]);
    const rightEyeOuter = norm(landmarks[263]);

    const leftEyeWidth = Math.abs(leftEyeOuter.x - leftEyeInner.x);
    const rightEyeWidth = Math.abs(rightEyeOuter.x - rightEyeInner.x);
    if (leftEyeWidth < 0.001 || rightEyeWidth < 0.001) return 50;

    const leftIrisPos = (leftIris.x - leftEyeOuter.x) / leftEyeWidth;
    const rightIrisPos = (rightIris.x - rightEyeOuter.x) / rightEyeWidth;
    const leftDeviation = Math.abs(leftIrisPos - 0.5);
    const rightDeviation = Math.abs(rightIrisPos - 0.5);
    const avgDeviation = (leftDeviation + rightDeviation) / 2;

    const leftEyeTop = norm(landmarks[159]);
    const leftEyeBottom = norm(landmarks[145]);
    const leftEyeHeight = Math.abs(leftEyeTop.y - leftEyeBottom.y);
    const leftIrisYPos = leftEyeHeight > 0.001 ? (leftIris.y - leftEyeTop.y) / leftEyeHeight : 0.5;
    const yDeviation = Math.abs(leftIrisYPos - 0.5);

    const combinedDeviation = avgDeviation * 0.7 + yDeviation * 0.3;
    return Math.round(Math.max(0, Math.min(100, (1 - combinedDeviation * 2.5) * 100)));
  } catch { return 50; }
}

export function computePostureScore(poseLandmarks: Keypoint[]): number {
  if (!poseLandmarks || poseLandmarks.length < 25) return 50;
  try {
    const ls = norm(poseLandmarks[11]);
    const rs = norm(poseLandmarks[12]);
    const le = norm(poseLandmarks[7]);
    const re = norm(poseLandmarks[8]);
    const lh = norm(poseLandmarks[23]);
    const rh = norm(poseLandmarks[24]);

    if ((poseLandmarks[11].score || 0) < 0.3 || (poseLandmarks[12].score || 0) < 0.3) return 50;

    const shoulderPenalty = Math.min(Math.abs(ls.y - rs.y) * 300, 25);
    const earMidY = (le.y + re.y) / 2;
    const shoulderMidY = (ls.y + rs.y) / 2;
    const headForward = Math.abs(earMidY - shoulderMidY);
    const headPenalty = headForward > 0.12 ? (headForward - 0.12) * 150 : 0;

    const shoulderMidX = (ls.x + rs.x) / 2;
    const hipMidX = (lh.x + rh.x) / 2;
    const earMidX = (le.x + re.x) / 2;
    const lean = Math.abs(shoulderMidX - hipMidX) + Math.abs(earMidX - shoulderMidX);
    const leanPenalty = Math.min(lean * 200, 25);

    return Math.round(Math.max(0, Math.min(100, 100 - shoulderPenalty - headPenalty - leanPenalty)));
  } catch { return 50; }
}

export function computeEngagementScore(eyeContact: number, posture: number): number {
  if (isNaN(eyeContact)) eyeContact = 50;
  if (isNaN(posture)) posture = 50;
  return Math.round(0.4 * eyeContact + 0.3 * posture + 0.2 * 50 + 0.1 * 50);
}

export function computeConfidenceScore(posture: number): number {
  if (isNaN(posture)) posture = 50;
  return Math.round(Math.max(0, Math.min(100, 0.5 * posture + 0.3 * 50 - 12 + 20)));
}

export interface AnomalyFlag {
  type: string;
  timestamp: number;
  message: string;
  severity: string;
}

export function detectAnomalies(
  data: { eyeContactScore: number; postureScore: number; faceCount: number },
  interviewStartTime: number
): AnomalyFlag[] {
  const flags: AnomalyFlag[] = [];
  const elapsed = (Date.now() - interviewStartTime) / 1000;

  if (data.faceCount > 1) {
    flags.push({ type: "multi_face", timestamp: elapsed, message: `${data.faceCount} faces detected`, severity: "critical" });
  }
  if (data.faceCount === 0) {
    flags.push({ type: "no_face", timestamp: elapsed, message: "Candidate not visible", severity: "warning" });
  }
  if (data.eyeContactScore < 20) {
    flags.push({ type: "eyes_away", timestamp: elapsed, message: "Prolonged gaze away", severity: "warning" });
  }
  if (data.postureScore < 30 && !isNaN(data.postureScore)) {
    flags.push({ type: "poor_posture", timestamp: elapsed, message: "Posture deterioration", severity: "info" });
  }
  return flags;
}

export function detectEmotion(landmarks: Keypoint[]): string {
  if (!landmarks || landmarks.length < 468) return "neutral";
  try {
    const mouthOpen = Math.abs(landmarks[13].y - landmarks[14].y) / VIDEO_HEIGHT;
    const browRaise = Math.abs(landmarks[66].y - landmarks[159].y) / VIDEO_HEIGHT;
    const mouthCenterY = (landmarks[13].y + landmarks[14].y) / 2;
    const smile = (mouthCenterY - (landmarks[61].y + landmarks[291].y) / 2) / VIDEO_HEIGHT;

    if (smile > 0.008) return "happy";
    if (mouthOpen > 0.05) return "surprised";
    if (browRaise < 0.015) return "confused";
    if (smile < -0.003) return "nervous";
    return "neutral";
  } catch { return "neutral"; }
}
