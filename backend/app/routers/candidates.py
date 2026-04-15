import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, CandidatePipeline, InterviewSession, InterviewPipeline, Interview
from app.schemas import UserResponse, ProfileUpdate
from app.security import get_current_user
from app.services.resume_parser import extract_text_from_file

router = APIRouter(prefix="/candidates", tags=["candidates"])


@router.get("/profile", response_model=UserResponse)
async def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    data: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.name:
        current_user.name = data.name
    if data.phone:
        current_user.phone = data.phone
    if data.profile_data:
        current_user.profile_data = data.profile_data
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/resume")
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    upload_dir = "uploads/resumes"
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".pdf", ".docx", ".doc", ".txt"):
        raise HTTPException(status_code=400, detail="Supported formats: PDF, DOCX, DOC, TXT")

    file_path = os.path.join(upload_dir, f"resume_{current_user.id}{ext}")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    resume_text = extract_text_from_file(file_path)

    current_user.resume_path = file_path
    current_user.resume_text = resume_text
    db.commit()

    return {
        "message": "Resume uploaded successfully",
        "file_path": file_path,
        "text_length": len(resume_text),
        "preview": resume_text[:500],
    }


@router.get("/applications")
async def get_my_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all job applications for the current candidate."""
    from app.models import JobApplication, JobPosting
    apps = db.query(JobApplication).filter(
        JobApplication.candidate_id == current_user.id
    ).order_by(JobApplication.created_at.desc()).all()

    result = []
    for a in apps:
        job = db.query(JobPosting).filter(JobPosting.id == a.job_id).first()
        result.append({
            "id": a.id,
            "job_id": a.job_id,
            "job_title": job.title if job else "Unknown",
            "department": job.department if job else None,
            "location": job.location if job else None,
            "status": a.status,
            "relevance_score": a.relevance_score,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    return result


@router.get("/pipeline-status")
async def get_pipeline_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cps = db.query(CandidatePipeline).filter(
        CandidatePipeline.candidate_id == current_user.id
    ).all()

    result = []
    for cp in cps:
        pipeline = db.query(InterviewPipeline).filter(InterviewPipeline.id == cp.pipeline_id).first()
        if not pipeline:
            continue

        sessions = []
        interviews = db.query(Interview).filter(
            Interview.pipeline_id == cp.pipeline_id
        ).order_by(Interview.round_number).all()

        for iv in interviews:
            s = db.query(InterviewSession).filter(
                InterviewSession.interview_id == iv.id,
                InterviewSession.candidate_id == current_user.id,
            ).first()
            sessions.append({
                "round_number": iv.round_number,
                "round_type": iv.round_type,
                "session_id": s.id if s else None,
                "status": s.status if s else "locked",
                "evaluation": s.evaluation if s else None,
            })

        result.append({
            "pipeline_id": cp.pipeline_id,
            "pipeline_title": pipeline.title,
            "job_role": pipeline.job_role,
            "current_round": cp.current_round,
            "overall_status": cp.overall_status,
            "rounds": sessions,
        })

    return result
