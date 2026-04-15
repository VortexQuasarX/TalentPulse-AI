import os
import re
import json
import shutil
import threading
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from openai import OpenAI
from app.config import get_settings
from app.database import get_db, SessionLocal
from app.models import (
    User, JobPosting, JobApplication, InterviewPipeline, Interview,
    InterviewSession, CandidatePipeline, Notification,
)
from app.schemas import (
    JobPostingCreate, JobPostingResponse, JobApplicationCreate, JobApplicationResponse,
)
from app.security import get_current_user, require_admin
from app.services.resume_parser import extract_text_from_file
from app.services.email_service import send_shortlist_email

settings = get_settings()
router = APIRouter(prefix="/jobs", tags=["jobs"])
client = OpenAI(api_key=settings.openai_api_key)


def _generate_screening_questions(title: str, description: str, requirements: str, skills: str) -> list:
    """AI generates screening questions from the JD."""
    prompt = f"""Generate 4 screening questions for candidates applying to this job.
Questions should assess basic fit and motivation — not deep technical questions.
Focus on: relevant experience, why they're interested, key skill familiarity, availability.

Job Title: {title}
Description: {description[:1000]}
Requirements: {requirements[:500]}
Skills: {skills}

Return a JSON array of strings, each being one question. Example:
["What relevant experience do you have with...?", "Why are you interested in...?"]

Return ONLY the JSON array."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
        )
        raw = response.choices[0].message.content.strip()
        match = re.search(r"\[[\s\S]*\]", raw)
        if match:
            return json.loads(match.group())
    except Exception as e:
        print(f"[Jobs] Screening question gen failed: {e}")
    return [
        f"What relevant experience do you have for the {title} role?",
        f"Why are you interested in this position?",
        f"Which of these skills do you have the most experience with: {skills}?",
        "When would you be available to start?",
    ]


def _score_resume_relevance(resume_text: str, job: JobPosting) -> dict:
    """AI scores how relevant the resume is to the job posting."""
    prompt = f"""Score how relevant this candidate's resume is to the job posting.

JOB:
Title: {job.title}
Description: {job.description[:800]}
Requirements: {job.requirements[:500]}
Skills: {job.skills}

RESUME:
{resume_text[:3000]}

Return a JSON object:
{{
  "relevance_score": <0-100, how well the resume matches the job>,
  "matched_skills": [<skills from the job that appear in the resume>],
  "missing_skills": [<required skills NOT found in the resume>],
  "experience_match": "<brief assessment of experience relevance>",
  "recommendation": "shortlist" | "review" | "reject",
  "reasoning": "<2-3 sentence explanation>"
}}

Return ONLY the JSON."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an HR recruiter screening resumes. Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )
        raw = response.choices[0].message.content.strip()
        match = re.search(r"\{[\s\S]*\}", raw)
        if match:
            return json.loads(match.group())
    except Exception as e:
        print(f"[Jobs] Resume scoring failed: {e}")
    return {"relevance_score": 0, "reasoning": "Scoring failed"}


# ── Public endpoints (no auth) ──

@router.get("/public", response_model=List[JobPostingResponse])
async def list_public_jobs(db: Session = Depends(get_db)):
    """Public careers page — list all active jobs."""
    jobs = db.query(JobPosting).filter(JobPosting.status == "active").order_by(JobPosting.created_at.desc()).all()
    result = []
    for j in jobs:
        app_count = db.query(JobApplication).filter(JobApplication.job_id == j.id).count()
        result.append(JobPostingResponse(
            id=j.id, title=j.title, department=j.department, location=j.location,
            job_type=j.job_type, experience_level=j.experience_level,
            salary_range=j.salary_range, description=j.description,
            requirements=j.requirements, skills=j.skills,
            responsibilities=j.responsibilities, benefits=j.benefits,
            screening_questions=j.screening_questions, status=j.status,
            pipeline_id=j.pipeline_id, application_count=app_count,
            created_at=j.created_at,
        ))
    return result


@router.get("/public/{job_id}")
async def get_public_job(job_id: int, db: Session = Depends(get_db)):
    """Public job detail with screening questions."""
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.status == "active").first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": job.id, "title": job.title, "department": job.department,
        "location": job.location, "job_type": job.job_type,
        "experience_level": job.experience_level, "salary_range": job.salary_range,
        "description": job.description, "requirements": job.requirements,
        "skills": job.skills, "responsibilities": job.responsibilities,
        "benefits": job.benefits, "screening_questions": job.screening_questions or [],
        "created_at": job.created_at.isoformat(),
    }


# ── HR endpoints ──

@router.post("/", response_model=JobPostingResponse)
async def create_job(data: JobPostingCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """HR creates a job posting. AI auto-generates screening questions."""
    # Generate screening questions from JD
    questions = _generate_screening_questions(data.title, data.description, data.requirements, data.skills)

    # Auto-create a pipeline for this job
    pipeline = InterviewPipeline(
        title=data.title,
        job_role=data.title,
        skills=data.skills,
        description=data.description,
        created_by=current_user.id,
    )
    db.add(pipeline)
    db.flush()

    # Create 3 rounds
    round_config = [
        {"round_number": 1, "round_type": "screening", "suffix": "Screening", "questions": 3},
        {"round_number": 2, "round_type": "technical", "suffix": "Technical", "questions": 5},
        {"round_number": 3, "round_type": "hr_cultural", "suffix": "HR & Cultural", "questions": 4},
    ]
    for rc in round_config:
        db.add(Interview(
            title=f"{data.title} - {rc['suffix']}",
            job_role=data.title, skills=data.skills,
            max_questions=rc["questions"], round_type=rc["round_type"],
            round_number=rc["round_number"], pipeline_id=pipeline.id,
            created_by=current_user.id,
        ))

    job = JobPosting(
        title=data.title, department=data.department, location=data.location,
        job_type=data.job_type, experience_level=data.experience_level,
        salary_range=data.salary_range, description=data.description,
        requirements=data.requirements, skills=data.skills,
        responsibilities=data.responsibilities, benefits=data.benefits,
        screening_questions=questions, pipeline_id=pipeline.id,
        created_by=current_user.id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return JobPostingResponse(
        id=job.id, title=job.title, department=job.department, location=job.location,
        job_type=job.job_type, experience_level=job.experience_level,
        salary_range=job.salary_range, description=job.description,
        requirements=job.requirements, skills=job.skills,
        responsibilities=job.responsibilities, benefits=job.benefits,
        screening_questions=job.screening_questions, status=job.status,
        pipeline_id=job.pipeline_id, created_at=job.created_at,
    )


@router.get("/", response_model=List[JobPostingResponse])
async def list_jobs(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """HR lists all jobs they created."""
    jobs = db.query(JobPosting).filter(JobPosting.created_by == current_user.id).order_by(JobPosting.created_at.desc()).all()
    result = []
    for j in jobs:
        app_count = db.query(JobApplication).filter(JobApplication.job_id == j.id).count()
        result.append(JobPostingResponse(
            id=j.id, title=j.title, department=j.department, location=j.location,
            job_type=j.job_type, experience_level=j.experience_level,
            salary_range=j.salary_range, description=j.description,
            requirements=j.requirements, skills=j.skills,
            responsibilities=j.responsibilities, benefits=j.benefits,
            screening_questions=j.screening_questions, status=j.status,
            pipeline_id=j.pipeline_id, application_count=app_count,
            created_at=j.created_at,
        ))
    return result


@router.get("/{job_id}/rounds")
async def get_job_rounds(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Get interview rounds for a job's pipeline."""
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job or not job.pipeline_id:
        raise HTTPException(status_code=404, detail="Job or pipeline not found")

    interviews = db.query(Interview).filter(
        Interview.pipeline_id == job.pipeline_id
    ).order_by(Interview.round_number).all()

    return [
        {
            "id": iv.id, "round_number": iv.round_number, "round_type": iv.round_type,
            "title": iv.title, "max_questions": iv.max_questions,
            "question_source": iv.question_source,
            "custom_questions": iv.custom_questions,
        }
        for iv in interviews
    ]


@router.put("/{job_id}/rounds/{round_number}")
async def update_round_questions(
    job_id: int, round_number: int,
    question_source: str = Query("ai_generated"),
    custom_questions: str = Query("[]"),
    max_questions: int = Query(5),
    db: Session = Depends(get_db), current_user: User = Depends(require_admin),
):
    """HR updates round question config: AI-generated or custom questions."""
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job or not job.pipeline_id:
        raise HTTPException(status_code=404, detail="Job or pipeline not found")

    iv = db.query(Interview).filter(
        Interview.pipeline_id == job.pipeline_id,
        Interview.round_number == round_number,
    ).first()
    if not iv:
        raise HTTPException(status_code=404, detail=f"Round {round_number} not found")

    if question_source == "custom":
        try:
            questions = json.loads(custom_questions)
        except:
            questions = []
        iv.question_source = "custom"
        iv.custom_questions = questions
        iv.max_questions = len(questions) if questions else max_questions
    else:
        iv.question_source = "ai_generated"
        iv.custom_questions = None
        iv.max_questions = max_questions

    db.commit()
    return {"message": f"Round {round_number} updated", "question_source": iv.question_source, "max_questions": iv.max_questions}


@router.get("/{job_id}/applications", response_model=List[JobApplicationResponse])
async def list_applications(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """HR views all applications for a job."""
    apps = db.query(JobApplication).filter(JobApplication.job_id == job_id).order_by(JobApplication.created_at.desc()).all()
    result = []
    for a in apps:
        candidate = db.query(User).filter(User.id == a.candidate_id).first()
        result.append(JobApplicationResponse(
            id=a.id, job_id=a.job_id, candidate_id=a.candidate_id,
            candidate_name=candidate.name if candidate else None,
            candidate_email=candidate.email if candidate else None,
            resume_path=a.resume_path, screening_answers=a.screening_answers,
            relevance_score=a.relevance_score, relevance_analysis=a.relevance_analysis,
            status=a.status, shortlisted_by=a.shortlisted_by,
            created_at=a.created_at,
        ))
    return result


@router.post("/{job_id}/close")
async def close_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.status = "closed"
    db.commit()
    return {"message": "Job closed"}


@router.delete("/{job_id}")
async def delete_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.query(JobApplication).filter(JobApplication.job_id == job_id).delete()
    db.delete(job)
    db.commit()
    return {"message": "Job deleted"}


@router.post("/{job_id}/manual-shortlist/{application_id}")
async def manual_shortlist(
    job_id: int, application_id: int,
    db: Session = Depends(get_db), current_user: User = Depends(require_admin),
):
    """HR manually shortlists a candidate regardless of score."""
    app = db.query(JobApplication).filter(JobApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    app.status = "shortlisted"
    app.shortlisted_by = "hr"

    # Add to pipeline
    _add_to_pipeline(app, db)

    db.commit()
    return {"message": "Candidate manually shortlisted for Round 1"}


# ── Candidate endpoints ──

@router.post("/{job_id}/apply")
async def apply_to_job(
    job_id: int,
    background_tasks: BackgroundTasks,
    resume: UploadFile = File(...),
    screening_answers: str = Query("{}"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Candidate applies — instant response, AI analysis runs in background."""
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.status == "active").first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or closed")

    existing = db.query(JobApplication).filter(
        JobApplication.job_id == job_id, JobApplication.candidate_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already applied to this job")

    # Save resume file (fast, no AI)
    upload_dir = "uploads/resumes"
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(resume.filename)[1].lower()
    file_path = os.path.join(upload_dir, f"app_{current_user.id}_{job_id}{ext}")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(resume.file, f)

    resume_text = extract_text_from_file(file_path)
    current_user.resume_path = file_path
    current_user.resume_text = resume_text

    try:
        answers = json.loads(screening_answers)
    except:
        answers = {}

    # Create application with "submitted" status — no AI yet
    application = JobApplication(
        job_id=job_id, candidate_id=current_user.id,
        resume_path=file_path, resume_text=resume_text,
        screening_answers=answers, status="submitted",
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    # Kick off background AI analysis
    app_id = application.id
    candidate_email = current_user.email
    candidate_name = current_user.name
    candidate_id = current_user.id

    def _background_analyze():
        """Runs in a separate thread — scores resume, shortlists, sends email."""
        bg_db = SessionLocal()
        try:
            bg_app = bg_db.query(JobApplication).filter(JobApplication.id == app_id).first()
            bg_job = bg_db.query(JobPosting).filter(JobPosting.id == job_id).first()
            if not bg_app or not bg_job:
                return

            bg_app.status = "screening"
            bg_db.commit()

            # AI resume relevance scoring
            relevance = _score_resume_relevance(resume_text, bg_job)
            score = relevance.get("relevance_score", 0)
            bg_app.relevance_score = score
            bg_app.relevance_analysis = relevance

            if score >= 50:
                bg_app.status = "shortlisted"
                bg_app.shortlisted_by = "agent"
                _add_to_pipeline(bg_app, bg_db)

                bg_db.add(Notification(
                    user_id=candidate_id, type="shortlisted",
                    title="Application Shortlisted!",
                    message=f"Great news! You've been shortlisted for '{bg_job.title}'. Round 1 (Screening) is ready.",
                    link="/candidate/dashboard",
                ))

                try:
                    send_shortlist_email(
                        to_email=candidate_email, candidate_name=candidate_name,
                        pipeline_title=bg_job.title, round_completed=0, next_round=1, score=int(score),
                    )
                except Exception as e:
                    print(f"[Email] Shortlist failed: {e}")
            else:
                bg_app.status = "submitted"
                bg_db.add(Notification(
                    user_id=candidate_id, type="round_available",
                    title="Application Received",
                    message=f"Your application for '{bg_job.title}' is under review.",
                    link="/candidate/dashboard",
                ))

            # Notify HR
            admins = bg_db.query(User).filter(User.role.in_(["admin", "super_admin"])).all()
            status_text = f"AUTO-SHORTLISTED ({int(score)}%)" if score >= 50 else f"Needs review ({int(score)}%)"
            for admin in admins:
                bg_db.add(Notification(
                    user_id=admin.id, type="approval_needed",
                    title=f"New Application: {candidate_name}",
                    message=f"{candidate_name} applied for '{bg_job.title}'. Relevance: {int(score)}%. {status_text}",
                    link=f"/hr/jobs/{job_id}",
                ))

            bg_db.commit()
            print(f"[Agent] Background analysis done: {candidate_name} → {int(score)}% → {'shortlisted' if score >= 50 else 'submitted'}")

        except Exception as e:
            import traceback
            print(f"[Agent] Background analysis error: {e}")
            traceback.print_exc()
            bg_db.rollback()
        finally:
            bg_db.close()

    # FastAPI BackgroundTasks — runs after response is sent, survives --reload
    background_tasks.add_task(_background_analyze)

    return {
        "message": "Application submitted successfully",
        "status": "received",
    }


def _add_to_pipeline(application: JobApplication, db: Session):
    """Add a shortlisted candidate to the interview pipeline for Round 1."""
    job = db.query(JobPosting).filter(JobPosting.id == application.job_id).first()
    if not job or not job.pipeline_id:
        return

    # Check not already in pipeline
    existing = db.query(CandidatePipeline).filter(
        CandidatePipeline.pipeline_id == job.pipeline_id,
        CandidatePipeline.candidate_id == application.candidate_id,
    ).first()
    if existing:
        return

    cp = CandidatePipeline(
        pipeline_id=job.pipeline_id,
        candidate_id=application.candidate_id,
        current_round=1,
    )
    db.add(cp)

    round_1 = db.query(Interview).filter(
        Interview.pipeline_id == job.pipeline_id, Interview.round_number == 1
    ).first()
    if round_1:
        db.add(InterviewSession(
            interview_id=round_1.id,
            candidate_id=application.candidate_id,
            round_number=1, round_type="screening",
        ))
