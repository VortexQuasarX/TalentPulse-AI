from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import (
    User, Interview, InterviewSession, InterviewPipeline,
    CandidatePipeline, Notification,
)
from app.schemas import (
    PipelineCreate, PipelineResponse, PipelineDetailResponse,
    CandidatePipelineResponse, AssignCandidateRequest,
)
from app.security import get_current_user, require_admin

router = APIRouter(prefix="/pipelines", tags=["pipelines"])

ROUND_CONFIG = [
    {"round_number": 1, "round_type": "screening", "title_suffix": "Screening"},
    {"round_number": 2, "round_type": "technical", "title_suffix": "Technical"},
    {"round_number": 3, "round_type": "hr_cultural", "title_suffix": "HR & Cultural"},
]


@router.post("/", response_model=PipelineResponse)
async def create_pipeline(
    data: PipelineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    pipeline = InterviewPipeline(
        title=data.title,
        job_role=data.job_role,
        skills=data.skills,
        description=data.description,
        created_by=current_user.id,
    )
    db.add(pipeline)
    db.flush()

    question_counts = [
        data.screening_questions or 3,
        data.technical_questions or 5,
        data.hr_questions or 4,
    ]
    question_sources = [
        data.r1_question_source or "ai_generated",
        data.r2_question_source or "ai_generated",
        data.r3_question_source or "ai_generated",
    ]
    custom_questions = [
        data.r1_custom_questions,
        data.r2_custom_questions,
        data.r3_custom_questions,
    ]

    for i, rc in enumerate(ROUND_CONFIG):
        cq = custom_questions[i]
        source = question_sources[i]
        if source == "custom" and cq:
            q_count = len(cq)
        else:
            q_count = question_counts[i]
            cq = None
            source = "ai_generated"

        interview = Interview(
            title=f"{data.title} - {rc['title_suffix']}",
            job_role=data.job_role,
            skills=data.skills,
            max_questions=q_count,
            round_type=rc["round_type"],
            round_number=rc["round_number"],
            pipeline_id=pipeline.id,
            question_source=source,
            custom_questions=cq,
            created_by=current_user.id,
        )
        db.add(interview)

    db.commit()
    db.refresh(pipeline)

    return PipelineResponse(
        id=pipeline.id,
        title=pipeline.title,
        job_role=pipeline.job_role,
        skills=pipeline.skills,
        description=pipeline.description,
        status=pipeline.status,
        created_at=pipeline.created_at,
    )


@router.delete("/{pipeline_id}")
async def delete_pipeline(
    pipeline_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    pipeline = db.query(InterviewPipeline).filter(InterviewPipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if pipeline.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Delete all related data: sessions, interviews, candidate_pipelines, agent_actions, notifications
    interviews = db.query(Interview).filter(Interview.pipeline_id == pipeline_id).all()
    for iv in interviews:
        db.query(InterviewSession).filter(InterviewSession.interview_id == iv.id).delete()
        db.delete(iv)

    from app.models import AgentAction
    db.query(AgentAction).filter(AgentAction.pipeline_id == pipeline_id).delete()
    db.query(CandidatePipeline).filter(CandidatePipeline.pipeline_id == pipeline_id).delete()
    db.delete(pipeline)
    db.commit()
    return {"message": "Pipeline deleted"}


@router.get("/", response_model=List[PipelineResponse])
async def list_pipelines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role in ("admin", "super_admin"):
        pipelines = db.query(InterviewPipeline).filter(
            InterviewPipeline.created_by == current_user.id
        ).all()
    else:
        cp_ids = db.query(CandidatePipeline.pipeline_id).filter(
            CandidatePipeline.candidate_id == current_user.id
        ).all()
        p_ids = [c[0] for c in cp_ids]
        pipelines = db.query(InterviewPipeline).filter(
            InterviewPipeline.id.in_(p_ids)
        ).all() if p_ids else []

    result = []
    for p in pipelines:
        cands = db.query(CandidatePipeline).filter(CandidatePipeline.pipeline_id == p.id).count()
        r1 = _count_completed(db, p.id, 1)
        r2 = _count_completed(db, p.id, 2)
        r3 = _count_completed(db, p.id, 3)
        result.append(PipelineResponse(
            id=p.id, title=p.title, job_role=p.job_role, skills=p.skills,
            description=p.description, status=p.status, created_at=p.created_at,
            candidate_count=cands, round_1_completed=r1, round_2_completed=r2, round_3_completed=r3,
        ))
    return result


@router.get("/{pipeline_id}", response_model=PipelineDetailResponse)
async def get_pipeline(
    pipeline_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pipeline = db.query(InterviewPipeline).filter(InterviewPipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    interviews = db.query(Interview).filter(Interview.pipeline_id == pipeline_id).order_by(Interview.round_number).all()
    rounds = []
    for iv in interviews:
        total = db.query(InterviewSession).filter(InterviewSession.interview_id == iv.id).count()
        completed = db.query(InterviewSession).filter(
            InterviewSession.interview_id == iv.id, InterviewSession.status == "completed"
        ).count()
        rounds.append({
            "interview_id": iv.id, "round_number": iv.round_number, "round_type": iv.round_type,
            "title": iv.title, "max_questions": iv.max_questions, "question_source": iv.question_source,
            "total_sessions": total, "completed_sessions": completed,
        })

    cps = db.query(CandidatePipeline).filter(CandidatePipeline.pipeline_id == pipeline_id).all()
    candidates = []
    for cp in cps:
        candidate = db.query(User).filter(User.id == cp.candidate_id).first()
        sess_list = []
        for iv in interviews:
            s = db.query(InterviewSession).filter(
                InterviewSession.interview_id == iv.id,
                InterviewSession.candidate_id == cp.candidate_id,
            ).first()
            if s:
                sess_list.append({
                    "session_id": s.id, "round_number": iv.round_number, "round_type": iv.round_type,
                    "status": s.status, "shortlist_status": s.shortlist_status,
                    "evaluation": s.evaluation, "behavior_summary": s.behavior_summary,
                    "tab_switch_count": s.tab_switch_count,
                })
        candidates.append(CandidatePipelineResponse(
            id=cp.id, pipeline_id=cp.pipeline_id, candidate_id=cp.candidate_id,
            candidate_name=candidate.name if candidate else None,
            candidate_email=candidate.email if candidate else None,
            current_round=cp.current_round, overall_status=cp.overall_status,
            sessions=sess_list,
        ))

    return PipelineDetailResponse(
        id=pipeline.id, title=pipeline.title, job_role=pipeline.job_role,
        skills=pipeline.skills, description=pipeline.description,
        status=pipeline.status, created_at=pipeline.created_at,
        rounds=rounds, candidates=candidates,
    )


@router.post("/{pipeline_id}/candidates")
async def assign_candidate_to_pipeline(
    pipeline_id: int,
    data: AssignCandidateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    pipeline = db.query(InterviewPipeline).filter(InterviewPipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    candidate = db.query(User).filter(User.email == data.candidate_email.lower().strip()).first()
    if not candidate:
        candidate = User(
            email=data.candidate_email.lower().strip(),
            name=data.candidate_email.split("@")[0],
            password_hash=User.hash_password("changeme123"),
            role="candidate",
        )
        db.add(candidate)
        db.flush()

    existing = db.query(CandidatePipeline).filter(
        CandidatePipeline.pipeline_id == pipeline_id,
        CandidatePipeline.candidate_id == candidate.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Candidate already in this pipeline")

    cp = CandidatePipeline(
        pipeline_id=pipeline_id,
        candidate_id=candidate.id,
        current_round=1,
    )
    db.add(cp)

    round_1 = db.query(Interview).filter(
        Interview.pipeline_id == pipeline_id, Interview.round_number == 1
    ).first()
    if round_1:
        session = InterviewSession(
            interview_id=round_1.id,
            candidate_id=candidate.id,
            round_number=1,
            round_type="screening",
        )
        db.add(session)

    notification = Notification(
        user_id=candidate.id,
        type="round_available",
        title="Interview Assigned",
        message=f"You have been assigned to '{pipeline.title}'. Round 1 (Screening) is ready.",
        link=f"/candidate/dashboard",
    )
    db.add(notification)

    db.commit()
    return {"message": f"Candidate {candidate.email} assigned to pipeline", "candidate_id": candidate.id}


@router.post("/{pipeline_id}/advance/{round_number}")
async def advance_candidates(
    pipeline_id: int,
    round_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Advance approved candidates from round N to round N+1."""
    if round_number >= 3:
        raise HTTPException(status_code=400, detail="No round after Round 3")

    next_round = round_number + 1
    next_interview = db.query(Interview).filter(
        Interview.pipeline_id == pipeline_id, Interview.round_number == next_round
    ).first()
    if not next_interview:
        raise HTTPException(status_code=404, detail=f"Round {next_round} interview not found")

    current_interview = db.query(Interview).filter(
        Interview.pipeline_id == pipeline_id, Interview.round_number == round_number
    ).first()

    approved_sessions = db.query(InterviewSession).filter(
        InterviewSession.interview_id == current_interview.id,
        InterviewSession.shortlist_status == "approved",
    ).all()

    advanced = 0
    for s in approved_sessions:
        existing = db.query(InterviewSession).filter(
            InterviewSession.interview_id == next_interview.id,
            InterviewSession.candidate_id == s.candidate_id,
        ).first()
        if existing:
            continue

        new_session = InterviewSession(
            interview_id=next_interview.id,
            candidate_id=s.candidate_id,
            round_number=next_round,
            round_type=next_interview.round_type,
        )
        db.add(new_session)

        cp = db.query(CandidatePipeline).filter(
            CandidatePipeline.pipeline_id == pipeline_id,
            CandidatePipeline.candidate_id == s.candidate_id,
        ).first()
        if cp:
            cp.current_round = next_round
            cp.overall_status = f"shortlisted_r{round_number}"

        notification = Notification(
            user_id=s.candidate_id,
            type="shortlisted",
            title=f"Shortlisted for Round {next_round}!",
            message=f"Congratulations! You've been shortlisted for Round {next_round} ({next_interview.round_type.replace('_', ' ').title()}).",
            link="/candidate/dashboard",
        )
        db.add(notification)
        advanced += 1

    db.commit()
    return {"message": f"Advanced {advanced} candidates to Round {next_round}"}


@router.post("/{pipeline_id}/manual-advance/{candidate_id}")
async def manual_advance_candidate(
    pipeline_id: int,
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """HR manually advances a specific candidate to next round, regardless of score."""
    pipeline = db.query(InterviewPipeline).filter(InterviewPipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    cp = db.query(CandidatePipeline).filter(
        CandidatePipeline.pipeline_id == pipeline_id,
        CandidatePipeline.candidate_id == candidate_id,
    ).first()
    if not cp:
        raise HTTPException(status_code=404, detail="Candidate not in pipeline")

    current_round = cp.current_round
    if current_round >= 3:
        # Mark as hired
        cp.overall_status = "hired"
        db.add(Notification(
            user_id=candidate_id, type="shortlisted",
            title="Congratulations!", message="You've been selected for hiring by the HR team!",
            link="/employee/onboarding",
        ))

        # Auto-onboarding: create employee record + send emails
        candidate = db.query(User).filter(User.id == candidate_id).first()
        try:
            from app.services.onboarding_service import create_employee_from_hire, send_onboarding_email
            from app.services.email_service import send_hired_email
            employee = create_employee_from_hire(candidate_id, pipeline_id, db)
            if employee and candidate:
                send_hired_email(
                    to_email=candidate.email,
                    candidate_name=candidate.name,
                    pipeline_title=pipeline.title,
                    score=0,
                )
                send_onboarding_email(
                    to_email=candidate.email,
                    candidate_name=candidate.name,
                    employee_id=employee.employee_id,
                )
        except Exception as e:
            print(f"[Onboarding] Manual hire onboarding failed: {e}")

        db.commit()
        return {"message": "Candidate hired! Employee record created, onboarding email sent."}

    next_round = current_round + 1
    next_interview = db.query(Interview).filter(
        Interview.pipeline_id == pipeline_id, Interview.round_number == next_round,
    ).first()
    if not next_interview:
        raise HTTPException(status_code=404, detail=f"Round {next_round} not found")

    # Mark current round session as approved by HR
    current_interview = db.query(Interview).filter(
        Interview.pipeline_id == pipeline_id, Interview.round_number == current_round,
    ).first()
    if current_interview:
        current_session = db.query(InterviewSession).filter(
            InterviewSession.interview_id == current_interview.id,
            InterviewSession.candidate_id == candidate_id,
        ).first()
        if current_session:
            current_session.shortlist_status = "approved"
            current_session.shortlisted_by = "hr"
            current_session.hr_decision = "approved"
            current_session.hr_decision_at = datetime.utcnow()
            current_session.hr_notes = f"Manually advanced by {current_user.name}"

    # Create next round session
    existing = db.query(InterviewSession).filter(
        InterviewSession.interview_id == next_interview.id,
        InterviewSession.candidate_id == candidate_id,
    ).first()
    if not existing:
        db.add(InterviewSession(
            interview_id=next_interview.id,
            candidate_id=candidate_id,
            round_number=next_round,
            round_type=next_interview.round_type,
        ))

    cp.current_round = next_round
    cp.overall_status = f"shortlisted_r{current_round}"

    candidate = db.query(User).filter(User.id == candidate_id).first()
    round_labels = {1: "Screening", 2: "Technical", 3: "HR & Cultural"}
    db.add(Notification(
        user_id=candidate_id, type="shortlisted",
        title=f"Advanced to Round {next_round}!",
        message=f"HR has manually advanced you to Round {next_round} ({round_labels.get(next_round, '')}).",
        link="/candidate/dashboard",
    ))

    db.commit()
    return {"message": f"Candidate manually advanced to Round {next_round}"}


def _count_completed(db: Session, pipeline_id: int, round_number: int) -> int:
    iv = db.query(Interview).filter(
        Interview.pipeline_id == pipeline_id, Interview.round_number == round_number
    ).first()
    if not iv:
        return 0
    return db.query(InterviewSession).filter(
        InterviewSession.interview_id == iv.id, InterviewSession.status == "completed"
    ).count()
