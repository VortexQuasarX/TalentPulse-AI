from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, JSON, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from passlib.context import CryptContext
from app.database import Base

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Organizations ──
class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    settings = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Users ──
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False, default="candidate")  # super_admin, admin, candidate
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    phone = Column(String, nullable=True)
    resume_path = Column(String, nullable=True)
    resume_text = Column(Text, nullable=True)
    profile_data = Column(JSON, nullable=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    created_interviews = relationship("Interview", back_populates="creator")
    sessions = relationship("InterviewSession", back_populates="candidate")
    created_pipelines = relationship("InterviewPipeline", back_populates="creator")

    @staticmethod
    def hash_password(plain: str) -> str:
        return pwd_context.hash(plain)

    def verify_password(self, plain: str) -> bool:
        return pwd_context.verify(plain, self.password_hash)


# ── Interview Pipelines ──
class InterviewPipeline(Base):
    __tablename__ = "interview_pipelines"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    title = Column(String, nullable=False)
    job_role = Column(String, nullable=False)
    skills = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="active")  # active, completed, archived
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    creator = relationship("User", back_populates="created_pipelines")
    interviews = relationship("Interview", back_populates="pipeline")
    candidate_pipelines = relationship("CandidatePipeline", back_populates="pipeline")


# ── Candidate Pipeline Progress ──
class CandidatePipeline(Base):
    __tablename__ = "candidate_pipelines"

    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(Integer, ForeignKey("interview_pipelines.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    current_round = Column(Integer, default=0)  # 0=not started, 1/2/3
    overall_status = Column(String, default="active")  # active, shortlisted_r1, shortlisted_r2, hired, rejected
    final_recommendation = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    pipeline = relationship("InterviewPipeline", back_populates="candidate_pipelines")
    candidate = relationship("User")


# ── Interviews (rounds within a pipeline) ──
class Interview(Base):
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    job_role = Column(String, nullable=False)
    skills = Column(String, nullable=False)
    max_questions = Column(Integer, default=5)
    round_type = Column(String, default="technical")  # screening, technical, hr_cultural
    round_number = Column(Integer, default=1)  # 1, 2, 3
    pipeline_id = Column(Integer, ForeignKey("interview_pipelines.id"), nullable=True)
    custom_questions = Column(JSON, nullable=True)  # HR-provided question set
    question_source = Column(String, default="ai_generated")  # ai_generated, custom
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User", back_populates="created_interviews")
    pipeline = relationship("InterviewPipeline", back_populates="interviews")
    sessions = relationship("InterviewSession", back_populates="interview")


# ── Interview Sessions ──
class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="pending")  # pending, in_progress, completed
    round_number = Column(Integer, default=1)
    round_type = Column(String, default="technical")
    conversation_history = Column(JSON, default=list)
    triggers = Column(JSON, default=list)
    question_count = Column(Integer, default=0)
    evaluation = Column(JSON, nullable=True)
    behavior_summary = Column(JSON, nullable=True)
    agent_recommendation = Column(JSON, nullable=True)
    shortlist_status = Column(String, default="pending")  # pending, recommended, approved, rejected
    shortlisted_by = Column(String, nullable=True)  # agent, hr
    shortlisted_at = Column(DateTime, nullable=True)
    hr_decision = Column(String, nullable=True)  # approved, rejected
    hr_decision_at = Column(DateTime, nullable=True)
    hr_notes = Column(Text, nullable=True)
    tab_switch_count = Column(Integer, default=0)
    recording_path = Column(String, nullable=True)
    video_path = Column(String, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    interview = relationship("Interview", back_populates="sessions")
    candidate = relationship("User", back_populates="sessions")


# ── Agent Actions ──
class AgentAction(Base):
    __tablename__ = "agent_actions"

    id = Column(Integer, primary_key=True, index=True)
    agent_type = Column(String, nullable=False)  # hr_agent, accounts_agent
    action_type = Column(String, nullable=False)  # recommend_shortlist, generate_report, analyze_scores
    target_type = Column(String, nullable=True)  # session, pipeline, candidate
    target_id = Column(Integer, nullable=True)
    pipeline_id = Column(Integer, ForeignKey("interview_pipelines.id"), nullable=True)
    round_number = Column(Integer, nullable=True)
    payload = Column(JSON, nullable=False)
    result = Column(JSON, nullable=True)
    status = Column(String, default="pending")  # pending, completed, failed
    confidence = Column(Float, nullable=True)
    requires_approval = Column(Boolean, default=True)
    approval_status = Column(String, default="pending")  # pending, approved, rejected
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Notifications ──
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)  # shortlisted, rejected, round_available, approval_needed
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False)
    link = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


# ── Behavior Scores (ported from hackathon) ──
class BehaviorScore(Base):
    __tablename__ = "behavior_scores"

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(String(50), index=True, nullable=False)  # format: session_{session_id}
    eye_contact_score = Column(Float, default=0)
    posture_score = Column(Float, default=0)
    engagement_score = Column(Float, default=0)
    confidence_score = Column(Float, default=0)
    emotion_label = Column(String(20), nullable=True)
    face_count = Column(Integer, default=1)
    anomaly_flags = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)


class BehaviorSummary(Base):
    __tablename__ = "behavior_summaries"

    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(String(50), unique=True, index=True, nullable=False)
    avg_eye_contact = Column(Float, default=0)
    avg_posture = Column(Float, default=0)
    avg_engagement = Column(Float, default=0)
    avg_confidence = Column(Float, default=0)
    total_anomalies = Column(Integer, default=0)
    anomaly_timeline = Column(JSON, default=list)
    dominant_emotion = Column(String(20), nullable=True)
    behavior_grade = Column(String(2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Job Postings ──
class JobPosting(Base):
    __tablename__ = "job_postings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    department = Column(String, nullable=True)
    location = Column(String, nullable=True)
    job_type = Column(String, default="full_time")  # full_time, part_time, contract, intern
    experience_level = Column(String, default="mid")  # entry, mid, senior, lead
    salary_range = Column(String, nullable=True)
    description = Column(Text, nullable=False)
    requirements = Column(Text, nullable=False)
    skills = Column(String, nullable=False)  # comma-separated
    responsibilities = Column(Text, nullable=True)
    benefits = Column(Text, nullable=True)
    screening_questions = Column(JSON, nullable=True)  # AI-generated from JD
    status = Column(String, default="active")  # active, closed, draft
    pipeline_id = Column(Integer, ForeignKey("interview_pipelines.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    applications = relationship("JobApplication", back_populates="job")


# ── Job Applications ──
class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("job_postings.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    resume_path = Column(String, nullable=True)
    resume_text = Column(Text, nullable=True)
    screening_answers = Column(JSON, nullable=True)  # candidate's answers to screening questions
    relevance_score = Column(Float, nullable=True)  # AI resume-JD match score (0-100)
    relevance_analysis = Column(JSON, nullable=True)  # AI analysis details
    status = Column(String, default="submitted")  # submitted, screening, shortlisted, rejected, interview
    shortlisted_by = Column(String, nullable=True)  # agent, hr
    hr_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    job = relationship("JobPosting", back_populates="applications")
    candidate = relationship("User")


# ── Employees (post-hire) ──
class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    pipeline_id = Column(Integer, ForeignKey("interview_pipelines.id"), nullable=True)
    department = Column(String, nullable=True)
    designation = Column(String, nullable=True)
    joining_date = Column(DateTime, nullable=True)
    salary = Column(Float, nullable=True)
    bank_details = Column(JSON, nullable=True)
    emergency_contact = Column(JSON, nullable=True)
    onboarding_status = Column(String, default="pending")  # pending, documents_pending, completed
    onboarding_checklist = Column(JSON, default=dict)
    attrition_risk_score = Column(Float, nullable=True)
    attrition_risk_category = Column(String, nullable=True)
    attrition_factors = Column(JSON, nullable=True)
    total_leaves = Column(Integer, default=15)  # 15 paid leaves per year
    leaves_used = Column(Integer, default=0)
    leaves_remaining = Column(Integer, default=15)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


# ── Leave Requests ──
class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    leave_date = Column(String, nullable=False)  # YYYY-MM-DD
    leave_type = Column(String, default="full_day")  # full_day, half_day
    reason = Column(Text, nullable=True)
    status = Column(String, default="pending")  # pending, approved, rejected
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee")


# ── Work Logs (attendance) ──
class WorkLog(Base):
    __tablename__ = "work_logs"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    date = Column(String, nullable=False)
    punch_in = Column(DateTime, nullable=True)
    punch_out = Column(DateTime, nullable=True)
    total_hours = Column(Float, default=0.0)
    break_time = Column(Float, default=0.0)
    overtime = Column(Float, default=0.0)
    status = Column(String, default="present")  # present, absent, half_day, leave
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee")

    __table_args__ = (UniqueConstraint("employee_id", "date", name="uq_employee_date"),)


# ── Payroll ──
class Payroll(Base):
    __tablename__ = "payrolls"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    days_present = Column(Integer, default=0)
    days_absent = Column(Integer, default=0)
    total_hours = Column(Float, default=0.0)
    total_working_days = Column(Integer, default=22)
    base_salary = Column(Float, default=0.0)
    overtime_pay = Column(Float, default=0.0)
    deductions = Column(Float, default=0.0)
    net_salary = Column(Float, default=0.0)
    breakdown = Column(JSON, nullable=True)
    status = Column(String, default="pending")  # pending, processed, paid
    processed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    processed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee")

    __table_args__ = (UniqueConstraint("employee_id", "month", "year", name="uq_employee_month_year"),)
