"""
Behavior scoring API routes. Ported from hackathon/backend/app/api/routes.py.
Adapted from async to sync SQLAlchemy. Removed Redis (not needed for SQLite demo).
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import BehaviorScore, BehaviorSummary, InterviewSession
from app.schemas import BehaviorScorePayload, BehaviorSummaryResponse
from app.services.behavior_scoring import (
    store_score, store_score_batch, update_summary,
    get_summary, get_timeline, get_report,
)
from app.services.ws_manager import manager

router = APIRouter(prefix="/behavior", tags=["behavior"])


@router.post("/scores", status_code=201)
async def submit_score(payload: BehaviorScorePayload, db: Session = Depends(get_db)):
    """Submit a single behavior score. Mirrors hackathon POST /api/behavior/scores."""
    score = store_score(db, payload)
    db.commit()

    update_summary(db, payload.interview_id)
    db.commit()

    # Broadcast to HR dashboard via WebSocket
    live_data = {
        "type": "score_update",
        "interview_id": payload.interview_id,
        "eye_contact_score": payload.eye_contact_score,
        "posture_score": payload.posture_score,
        "engagement_score": payload.engagement_score,
        "confidence_score": payload.confidence_score,
        "emotion_label": payload.emotion_label,
        "face_count": payload.face_count,
        "anomaly_flags": [f.model_dump() for f in payload.anomaly_flags],
        "timestamp": score.created_at.isoformat() if score.created_at else datetime.utcnow().isoformat(),
    }
    await manager.broadcast_to_interview(payload.interview_id, live_data)

    return {
        "id": score.id,
        "interview_id": score.interview_id,
        "timestamp": score.created_at.isoformat() if score.created_at else None,
        "eye_contact_score": score.eye_contact_score,
        "posture_score": score.posture_score,
        "engagement_score": score.engagement_score,
        "confidence_score": score.confidence_score,
        "emotion_label": score.emotion_label,
        "face_count": score.face_count,
        "anomaly_flags": score.anomaly_flags or [],
    }


@router.post("/scores/batch", status_code=201)
async def submit_batch(scores: list[BehaviorScorePayload], db: Session = Depends(get_db)):
    """Submit batch of scores. Mirrors hackathon POST /api/behavior/scores/batch."""
    if not scores:
        raise HTTPException(status_code=400, detail="Empty batch")

    stored = store_score_batch(db, scores[:100])
    db.commit()

    interview_ids = set(p.interview_id for p in scores)
    for iid in interview_ids:
        update_summary(db, iid)
    db.commit()

    # Broadcast latest
    latest = scores[-1]
    interview_id = latest.interview_id
    live_data = {
        "type": "score_update",
        "interview_id": interview_id,
        "eye_contact_score": latest.eye_contact_score,
        "posture_score": latest.posture_score,
        "engagement_score": latest.engagement_score,
        "confidence_score": latest.confidence_score,
        "emotion_label": latest.emotion_label,
        "face_count": latest.face_count,
        "anomaly_flags": [f.model_dump() for f in latest.anomaly_flags],
        "timestamp": datetime.utcnow().isoformat(),
    }
    await manager.broadcast_to_interview(interview_id, live_data)

    return {"stored": len(stored), "interview_id": interview_id}


@router.get("/summary/{interview_id}")
async def get_behavior_summary(interview_id: str, db: Session = Depends(get_db)):
    """Get aggregated summary. Mirrors hackathon GET /api/behavior/summary/{id}."""
    summary = get_summary(db, interview_id)
    if not summary:
        raise HTTPException(status_code=404, detail="No summary found for this interview")
    return {
        "interview_id": summary.interview_id,
        "avg_eye_contact": summary.avg_eye_contact,
        "avg_posture": summary.avg_posture,
        "avg_engagement": summary.avg_engagement,
        "avg_confidence": summary.avg_confidence,
        "total_anomalies": summary.total_anomalies,
        "anomaly_timeline": summary.anomaly_timeline or [],
        "dominant_emotion": summary.dominant_emotion,
        "behavior_grade": summary.behavior_grade,
    }


@router.get("/timeline/{interview_id}")
async def get_behavior_timeline(interview_id: str, db: Session = Depends(get_db)):
    """Timestamped score history. Mirrors hackathon GET /api/behavior/timeline/{id}."""
    timeline = get_timeline(db, interview_id)
    if not timeline:
        raise HTTPException(status_code=404, detail="No data found for this interview")
    return {"interview_id": interview_id, "entries": timeline}


@router.get("/report/{interview_id}")
async def get_behavior_report(interview_id: str, db: Session = Depends(get_db)):
    """Full behavioral report. Mirrors hackathon GET /api/behavior/report/{id}."""
    report = get_report(db, interview_id)
    if not report:
        raise HTTPException(status_code=404, detail="No data found for this interview")
    return report


@router.websocket("/live/{interview_id}")
async def live_scores(interview_id: str, websocket: WebSocket):
    """WebSocket live score stream. Mirrors hackathon WS /api/behavior/live/{id}."""
    await manager.connect(interview_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type": "pong"}')
    except WebSocketDisconnect:
        manager.disconnect(interview_id, websocket)
    except Exception:
        manager.disconnect(interview_id, websocket)


@router.post("/tab-switch/{session_id}")
async def track_tab_switch(session_id: int, db: Session = Depends(get_db)):
    """Track tab switches during interview."""
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if session:
        session.tab_switch_count = (session.tab_switch_count or 0) + 1
        db.commit()
    return {"tab_switches": session.tab_switch_count if session else 0}


@router.get("/active")
async def get_active_interviews():
    """List active WebSocket interview sessions. Mirrors hackathon GET /api/behavior/active."""
    interviews = manager.get_active_interviews()
    return {"active_interviews": interviews, "count": len(interviews)}
