from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, Interview, InterviewSession
from app.schemas import (
    InterviewCreate, InterviewResponse, InterviewDetailResponse,
    SessionResponse, AssignRequest,
)
from app.security import get_current_user, require_admin

router = APIRouter(prefix="/interviews", tags=["interviews"])


@router.post("/", response_model=InterviewResponse)
async def create_interview(
    data: InterviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    interview = Interview(
        title=data.title,
        job_role=data.job_role,
        skills=data.skills,
        max_questions=data.max_questions,
        created_by=current_user.id,
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return InterviewResponse(
        id=interview.id,
        title=interview.title,
        job_role=interview.job_role,
        skills=interview.skills,
        max_questions=interview.max_questions,
        created_at=interview.created_at,
    )


@router.get("/", response_model=List[InterviewResponse])
async def list_interviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "hr":
        interviews = db.query(Interview).filter(Interview.created_by == current_user.id).all()
    else:
        session_ids = db.query(InterviewSession.interview_id).filter(
            InterviewSession.candidate_id == current_user.id
        ).all()
        interview_ids = [s[0] for s in session_ids]
        interviews = db.query(Interview).filter(Interview.id.in_(interview_ids)).all() if interview_ids else []

    result = []
    for iv in interviews:
        total = db.query(InterviewSession).filter(InterviewSession.interview_id == iv.id).count()
        completed = db.query(InterviewSession).filter(
            InterviewSession.interview_id == iv.id,
            InterviewSession.status == "completed",
        ).count()
        result.append(InterviewResponse(
            id=iv.id,
            title=iv.title,
            job_role=iv.job_role,
            skills=iv.skills,
            max_questions=iv.max_questions,
            created_at=iv.created_at,
            session_count=total,
            completed_count=completed,
        ))
    return result


@router.get("/candidates")
async def list_candidates(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    my_interviews = db.query(Interview).filter(Interview.created_by == current_user.id).all()
    iv_ids = [iv.id for iv in my_interviews]
    if not iv_ids:
        return []

    sessions = db.query(InterviewSession).filter(InterviewSession.interview_id.in_(iv_ids)).all()

    results = []
    for s in sessions:
        candidate = db.query(User).filter(User.id == s.candidate_id).first()
        interview = next((iv for iv in my_interviews if iv.id == s.interview_id), None)
        results.append({
            "session_id": s.id,
            "candidate_id": s.candidate_id,
            "candidate_name": candidate.name if candidate else "Unknown",
            "candidate_email": candidate.email if candidate else "",
            "interview_id": s.interview_id,
            "interview_title": interview.title if interview else "",
            "job_role": interview.job_role if interview else "",
            "status": s.status,
            "score": s.evaluation.get("proficiencyScore") if s.evaluation else None,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        })
    return results


@router.get("/{interview_id}", response_model=InterviewDetailResponse)
async def get_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    sessions = db.query(InterviewSession).filter(InterviewSession.interview_id == interview_id).all()
    session_list = []
    for s in sessions:
        candidate = db.query(User).filter(User.id == s.candidate_id).first()
        session_list.append(SessionResponse(
            id=s.id,
            interview_id=s.interview_id,
            candidate_id=s.candidate_id,
            candidate_name=candidate.name if candidate else None,
            candidate_email=candidate.email if candidate else None,
            status=s.status,
            round_number=s.round_number,
            round_type=s.round_type,
            evaluation=s.evaluation,
            conversation_history=s.conversation_history,
            behavior_summary=s.behavior_summary,
            shortlist_status=s.shortlist_status,
            tab_switch_count=s.tab_switch_count or 0,
            started_at=s.started_at,
            completed_at=s.completed_at,
        ))

    return InterviewDetailResponse(
        id=interview.id,
        title=interview.title,
        job_role=interview.job_role,
        skills=interview.skills,
        max_questions=interview.max_questions,
        round_type=interview.round_type,
        round_number=interview.round_number,
        pipeline_id=interview.pipeline_id,
        created_at=interview.created_at,
        sessions=session_list,
    )


@router.post("/{interview_id}/assign", response_model=SessionResponse)
async def assign_candidate(
    interview_id: int,
    data: AssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    candidate = db.query(User).filter(User.email == data.candidate_email.lower().strip()).first()
    if not candidate:
        candidate = User(
            email=data.candidate_email.lower().strip(),
            name=data.candidate_email.split("@")[0],
            password_hash=User.hash_password("changeme123"),
            role="candidate",
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)

    existing = db.query(InterviewSession).filter(
        InterviewSession.interview_id == interview_id,
        InterviewSession.candidate_id == candidate.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Candidate already assigned to this interview")

    session = InterviewSession(
        interview_id=interview_id,
        candidate_id=candidate.id,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return SessionResponse(
        id=session.id,
        interview_id=session.interview_id,
        candidate_id=session.candidate_id,
        candidate_name=candidate.name,
        candidate_email=candidate.email,
        status=session.status,
    )


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    interview = db.query(Interview).filter(Interview.id == session.interview_id).first()
    if not interview or interview.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    db.delete(session)
    db.commit()
    return {"message": "Candidate removed"}


@router.get("/sessions/{session_id}/results", response_model=SessionResponse)
async def get_session_results(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    candidate = db.query(User).filter(User.id == session.candidate_id).first()
    return SessionResponse(
        id=session.id,
        interview_id=session.interview_id,
        candidate_id=session.candidate_id,
        candidate_name=candidate.name if candidate else None,
        candidate_email=candidate.email if candidate else None,
        status=session.status,
        evaluation=session.evaluation,
        conversation_history=session.conversation_history,
        started_at=session.started_at,
        completed_at=session.completed_at,
    )
