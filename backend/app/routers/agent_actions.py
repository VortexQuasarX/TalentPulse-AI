from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, AgentAction, InterviewSession, Interview, Notification, CandidatePipeline
from app.schemas import AgentActionResponse
from app.security import get_current_user, require_admin
from app.services import hr_agent

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/analyze-round")
async def trigger_round_analysis(
    pipeline_id: int,
    round_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        action = await hr_agent.analyze_round(pipeline_id, round_number, db)
        return {
            "message": "Analysis complete",
            "action_id": action.id,
            "result": action.result,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/recommendations/{pipeline_id}/{round_number}")
async def get_recommendations(
    pipeline_id: int,
    round_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    actions = db.query(AgentAction).filter(
        AgentAction.pipeline_id == pipeline_id,
        AgentAction.round_number == round_number,
        AgentAction.action_type == "recommend_shortlist",
    ).order_by(AgentAction.created_at.desc()).all()

    return [AgentActionResponse.model_validate(a) for a in actions]


@router.post("/recommendations/{action_id}/approve")
async def approve_recommendation(
    action_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    action = db.query(AgentAction).filter(AgentAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    action.approval_status = "approved"
    action.approved_by = current_user.id
    action.approved_at = datetime.utcnow()

    # Apply recommendations: update session shortlist statuses
    recs = action.result.get("recommendations", []) if action.result else []
    interview = db.query(Interview).filter(
        Interview.pipeline_id == action.pipeline_id,
        Interview.round_number == action.round_number,
    ).first()

    for rec in recs:
        session = db.query(InterviewSession).filter(
            InterviewSession.interview_id == interview.id,
            InterviewSession.candidate_id == rec["candidate_id"],
        ).first()
        if session:
            decision = rec.get("decision", "reject")
            session.shortlist_status = "approved" if decision == "shortlist" else "rejected"
            session.hr_decision = "approved" if decision == "shortlist" else "rejected"
            session.hr_decision_at = datetime.utcnow()

            # Notify candidate
            if decision == "shortlist":
                notification = Notification(
                    user_id=rec["candidate_id"],
                    type="shortlisted",
                    title=f"Shortlisted for next round!",
                    message=f"Congratulations! You've been shortlisted after Round {action.round_number}.",
                    link="/candidate/dashboard",
                )
                db.add(notification)
            else:
                notification = Notification(
                    user_id=rec["candidate_id"],
                    type="rejected",
                    title="Application Update",
                    message=f"Thank you for your interview. Unfortunately, you were not selected to advance after Round {action.round_number}.",
                    link="/candidate/dashboard",
                )
                db.add(notification)

    db.commit()
    return {"message": "Recommendations approved and applied"}


@router.post("/recommendations/{action_id}/reject")
async def reject_recommendation(
    action_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    action = db.query(AgentAction).filter(AgentAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    action.approval_status = "rejected"
    action.approved_by = current_user.id
    action.approved_at = datetime.utcnow()
    db.commit()
    return {"message": "Recommendations rejected. HR can manually shortlist."}


@router.post("/final-report/{pipeline_id}")
async def generate_final_report(
    pipeline_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    report = await hr_agent.generate_final_report(pipeline_id, db)
    return report


@router.get("/actions", response_model=List[AgentActionResponse])
async def list_actions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    actions = db.query(AgentAction).order_by(AgentAction.created_at.desc()).limit(50).all()
    return actions
