from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ── Auth ──
class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    role: str = "candidate"  # super_admin, admin, candidate


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    phone: Optional[str] = None
    resume_path: Optional[str] = None
    profile_data: Optional[dict] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_name: str
    user_id: int


# ── Pipeline ──
class PipelineCreate(BaseModel):
    title: str
    job_role: str
    skills: str
    description: Optional[str] = None
    screening_questions: Optional[int] = 3
    technical_questions: Optional[int] = 5
    hr_questions: Optional[int] = 4
    r1_question_source: Optional[str] = "ai_generated"
    r2_question_source: Optional[str] = "ai_generated"
    r3_question_source: Optional[str] = "ai_generated"
    r1_custom_questions: Optional[List[str]] = None
    r2_custom_questions: Optional[List[str]] = None
    r3_custom_questions: Optional[List[str]] = None


class PipelineResponse(BaseModel):
    id: int
    title: str
    job_role: str
    skills: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    candidate_count: int = 0
    round_1_completed: int = 0
    round_2_completed: int = 0
    round_3_completed: int = 0

    class Config:
        from_attributes = True


class CandidatePipelineResponse(BaseModel):
    id: int
    pipeline_id: int
    candidate_id: int
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    current_round: int
    overall_status: str
    sessions: Optional[list] = None

    class Config:
        from_attributes = True


class PipelineDetailResponse(BaseModel):
    id: int
    title: str
    job_role: str
    skills: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    rounds: List[dict] = []
    candidates: List[CandidatePipelineResponse] = []

    class Config:
        from_attributes = True


class AssignCandidateRequest(BaseModel):
    candidate_email: str


# ── Interview ──
class InterviewCreate(BaseModel):
    title: str
    job_role: str
    skills: str
    max_questions: int = 5


class InterviewResponse(BaseModel):
    id: int
    title: str
    job_role: str
    skills: str
    max_questions: int
    round_type: str = "technical"
    round_number: int = 1
    pipeline_id: Optional[int] = None
    question_source: str = "ai_generated"
    created_at: datetime
    session_count: int = 0
    completed_count: int = 0

    class Config:
        from_attributes = True


class InterviewDetailResponse(BaseModel):
    id: int
    title: str
    job_role: str
    skills: str
    max_questions: int
    round_type: str = "technical"
    round_number: int = 1
    pipeline_id: Optional[int] = None
    created_at: datetime
    sessions: list = []

    class Config:
        from_attributes = True


# ── Session ──
class SessionResponse(BaseModel):
    id: int
    interview_id: int
    candidate_id: int
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    status: str
    round_number: int = 1
    round_type: str = "technical"
    evaluation: Optional[dict] = None
    conversation_history: Optional[list] = None
    behavior_summary: Optional[dict] = None
    shortlist_status: str = "pending"
    agent_recommendation: Optional[dict] = None
    hr_decision: Optional[str] = None
    tab_switch_count: int = 0
    recording_path: Optional[str] = None
    video_path: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AssignRequest(BaseModel):
    candidate_email: str


# ── Interview Session Flow ──
class FinalizeResponse(BaseModel):
    transcription: str
    next_question: Optional[str] = None
    is_complete: bool = False


class EvaluationResponse(BaseModel):
    techAccuracy: float = 0
    conceptCoverage: float = 0
    practicalKnowledge: float = 0
    proficiencyScore: float = 0
    strongTopics: List[str] = []
    weakTopics: List[str] = []
    feedback: str = ""
    numQuestions: int = 0


class TTSRequest(BaseModel):
    text: str


# ── Agent Actions ──
class AgentActionResponse(BaseModel):
    id: int
    agent_type: str
    action_type: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    pipeline_id: Optional[int] = None
    round_number: Optional[int] = None
    result: Optional[dict] = None
    status: str
    confidence: Optional[float] = None
    approval_status: str = "pending"
    approved_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Notifications ──
class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    read: bool
    link: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Behavior (ported from hackathon) ──
class AnomalyFlag(BaseModel):
    type: str
    timestamp: float = 0
    message: str = ""
    severity: str = "info"


class BehaviorScorePayload(BaseModel):
    interview_id: str
    eye_contact_score: float = 50
    posture_score: float = 50
    engagement_score: float = 50
    confidence_score: float = 50
    emotion_label: Optional[str] = "neutral"
    face_count: int = 1
    anomaly_flags: List[AnomalyFlag] = []


class BehaviorSummaryResponse(BaseModel):
    interview_id: str
    avg_eye_contact: float = 0
    avg_posture: float = 0
    avg_engagement: float = 0
    avg_confidence: float = 0
    total_anomalies: int = 0
    dominant_emotion: Optional[str] = None
    behavior_grade: Optional[str] = None

    class Config:
        from_attributes = True


# ── Candidate Profile ──
class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    profile_data: Optional[dict] = None


class CustomQuestionsUpdate(BaseModel):
    questions: List[str]


# ── Job Postings ──
class JobPostingCreate(BaseModel):
    title: str
    department: Optional[str] = None
    location: Optional[str] = None
    job_type: str = "full_time"
    experience_level: str = "mid"
    salary_range: Optional[str] = None
    description: str
    requirements: str
    skills: str
    responsibilities: Optional[str] = None
    benefits: Optional[str] = None


class JobPostingResponse(BaseModel):
    id: int
    title: str
    department: Optional[str] = None
    location: Optional[str] = None
    job_type: str
    experience_level: str
    salary_range: Optional[str] = None
    description: str
    requirements: str
    skills: str
    responsibilities: Optional[str] = None
    benefits: Optional[str] = None
    screening_questions: Optional[list] = None
    status: str
    pipeline_id: Optional[int] = None
    application_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class JobApplicationCreate(BaseModel):
    screening_answers: Optional[dict] = None


class JobApplicationResponse(BaseModel):
    id: int
    job_id: int
    candidate_id: int
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    resume_path: Optional[str] = None
    screening_answers: Optional[dict] = None
    relevance_score: Optional[float] = None
    relevance_analysis: Optional[dict] = None
    status: str
    shortlisted_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Employee Onboarding ──
class OnboardingFormData(BaseModel):
    department: Optional[str] = None
    designation: Optional[str] = None
    joining_date: Optional[str] = None
    salary: Optional[float] = None
    bank_details: Optional[dict] = None
    emergency_contact: Optional[dict] = None
    attrition_survey: Optional[dict] = None


class EmployeeResponse(BaseModel):
    id: int
    employee_id: str
    user_id: int
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    joining_date: Optional[datetime] = None
    salary: Optional[float] = None
    onboarding_status: str
    onboarding_checklist: Optional[dict] = None
    attrition_risk_score: Optional[float] = None
    attrition_risk_category: Optional[str] = None
    attrition_factors: Optional[list] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Work Hours ──
class WorkLogResponse(BaseModel):
    id: int
    date: str
    punch_in: Optional[datetime] = None
    punch_out: Optional[datetime] = None
    total_hours: float = 0
    overtime: float = 0
    status: str = "present"

    class Config:
        from_attributes = True


class WorkSummaryResponse(BaseModel):
    today: Optional[dict] = None
    weekly_hours: float = 0
    weekly_days_present: int = 0
    monthly_hours: float = 0
    monthly_days_present: int = 0
    monthly_days_absent: int = 0


# ── Payroll ──
class PayrollResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    month: int
    year: int
    days_present: int = 0
    days_absent: int = 0
    total_hours: float = 0
    total_working_days: int = 22
    base_salary: float = 0
    overtime_pay: float = 0
    deductions: float = 0
    net_salary: float = 0
    breakdown: Optional[dict] = None
    status: str = "pending"
    created_at: datetime

    class Config:
        from_attributes = True
