export interface User {
  id: number;
  email: string;
  name: string;
  role: "super_admin" | "admin" | "candidate";
  phone?: string;
  resume_path?: string;
  profile_data?: Record<string, any>;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
  user_name: string;
  user_id: number;
}

// Pipeline
export interface Pipeline {
  id: number;
  title: string;
  job_role: string;
  skills: string;
  description?: string;
  status: string;
  created_at: string;
  candidate_count: number;
  round_1_completed: number;
  round_2_completed: number;
  round_3_completed: number;
}

export interface RoundInfo {
  interview_id: number;
  round_number: number;
  round_type: string;
  title: string;
  max_questions: number;
  question_source: string;
  total_sessions: number;
  completed_sessions: number;
}

export interface CandidateSession {
  session_id: number | null;
  round_number: number;
  round_type: string;
  status: string;
  shortlist_status?: string;
  evaluation?: Record<string, any>;
  behavior_summary?: Record<string, any>;
  tab_switch_count?: number;
}

export interface CandidatePipelineInfo {
  id: number;
  pipeline_id: number;
  candidate_id: number;
  candidate_name?: string;
  candidate_email?: string;
  current_round: number;
  overall_status: string;
  sessions?: CandidateSession[];
}

export interface PipelineDetail {
  id: number;
  title: string;
  job_role: string;
  skills: string;
  description?: string;
  status: string;
  created_at: string;
  rounds: RoundInfo[];
  candidates: CandidatePipelineInfo[];
}

// Interview
export interface Interview {
  id: number;
  title: string;
  job_role: string;
  skills: string;
  max_questions: number;
  round_type: string;
  round_number: number;
  pipeline_id?: number;
  created_at: string;
  session_count: number;
  completed_count: number;
}

export interface ConversationMessage {
  role: "assistant" | "user";
  content: string;
  difficulty_level?: string;
}

export interface InterviewSession {
  id: number;
  interview_id: number;
  candidate_id: number;
  candidate_name?: string;
  candidate_email?: string;
  status: string;
  round_number: number;
  round_type: string;
  evaluation?: Record<string, any>;
  conversation_history?: ConversationMessage[];
  behavior_summary?: Record<string, any>;
  shortlist_status: string;
  agent_recommendation?: Record<string, any>;
  hr_decision?: string;
  tab_switch_count: number;
  started_at?: string;
  completed_at?: string;
}

export interface Evaluation {
  techAccuracy?: number;
  conceptCoverage?: number;
  practicalKnowledge?: number;
  resumeAccuracy?: number;
  communicationClarity?: number;
  experienceDepth?: number;
  culturalFit?: number;
  teamworkOrientation?: number;
  communicationSkills?: number;
  leadershipPotential?: number;
  proficiencyScore: number;
  strongTopics: string[];
  weakTopics: string[];
  feedback: string;
  numQuestions: number;
}

export interface FinalizeResponse {
  transcription: string;
  next_question: string | null;
  is_complete: boolean;
}

// Agent
export interface AgentAction {
  id: number;
  agent_type: string;
  action_type: string;
  target_type?: string;
  target_id?: number;
  pipeline_id?: number;
  round_number?: number;
  result?: {
    recommendations?: AgentRecommendation[];
    summary?: string;
    shortlist_count?: number;
    round_quality_assessment?: string;
  };
  status: string;
  confidence?: number;
  approval_status: string;
  approved_by?: number;
  created_at: string;
}

export interface AgentRecommendation {
  candidate_id: number;
  candidate_name: string;
  decision: "shortlist" | "reject";
  confidence: number;
  reasoning: string;
  strengths: string[];
  concerns: string[];
  risk_flags: string[];
}

// Notification
export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  created_at: string;
}

// Behavior
export interface BehaviorSummary {
  interview_id: string;
  avg_eye_contact: number;
  avg_posture: number;
  avg_engagement: number;
  avg_confidence: number;
  total_anomalies: number;
  dominant_emotion?: string;
  behavior_grade?: string;
}

// Candidate Pipeline Status
export interface CandidatePipelineStatus {
  pipeline_id: number;
  pipeline_title: string;
  job_role: string;
  current_round: number;
  overall_status: string;
  rounds: {
    round_number: number;
    round_type: string;
    session_id: number | null;
    status: string;
    evaluation?: Record<string, any>;
  }[];
}
