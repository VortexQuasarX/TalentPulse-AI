"""
Behavior scoring service. Ported from hackathon/backend/app/services/scoring.py.
Adapted from async SQLAlchemy (asyncpg) to sync SQLAlchemy (SQLite).
"""
from collections import Counter
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from app.models import BehaviorScore, BehaviorSummary


def compute_grade(avg_score: float) -> str:
    if avg_score >= 90:
        return "A+"
    elif avg_score >= 80:
        return "A"
    elif avg_score >= 70:
        return "B"
    elif avg_score >= 60:
        return "C"
    elif avg_score >= 50:
        return "D"
    return "F"


def store_score(db: Session, payload) -> BehaviorScore:
    """Store a single behavior score. Mirrors hackathon's store_score()."""
    score = BehaviorScore(
        interview_id=payload.interview_id,
        eye_contact_score=payload.eye_contact_score,
        posture_score=payload.posture_score,
        engagement_score=payload.engagement_score,
        confidence_score=payload.confidence_score,
        emotion_label=payload.emotion_label,
        face_count=payload.face_count,
        anomaly_flags=[f.model_dump() for f in payload.anomaly_flags],
    )
    db.add(score)
    db.flush()
    db.refresh(score)
    return score


def store_score_batch(db: Session, payloads: list) -> list[BehaviorScore]:
    """Store a batch of scores. Mirrors hackathon's store_score_batch()."""
    scores = []
    for payload in payloads:
        score = BehaviorScore(
            interview_id=payload.interview_id,
            eye_contact_score=payload.eye_contact_score,
            posture_score=payload.posture_score,
            engagement_score=payload.engagement_score,
            confidence_score=payload.confidence_score,
            emotion_label=payload.emotion_label,
            face_count=payload.face_count,
            anomaly_flags=[f.model_dump() for f in payload.anomaly_flags],
        )
        db.add(score)
        scores.append(score)
    db.flush()
    for s in scores:
        db.refresh(s)
    return scores


def update_summary(db: Session, interview_id: str) -> BehaviorSummary:
    """Update running summary. Mirrors hackathon's update_summary() using SQL aggregates."""
    # Compute averages via SQL
    result = db.query(
        func.avg(BehaviorScore.eye_contact_score),
        func.avg(BehaviorScore.posture_score),
        func.avg(BehaviorScore.engagement_score),
        func.avg(BehaviorScore.confidence_score),
    ).filter(BehaviorScore.interview_id == interview_id).one()

    avg_eye = round(result[0] or 0, 2)
    avg_posture = round(result[1] or 0, 2)
    avg_engagement = round(result[2] or 0, 2)
    avg_confidence = round(result[3] or 0, 2)

    # Collect anomaly flags with timestamps
    scores_with_anomalies = db.query(BehaviorScore).filter(
        BehaviorScore.interview_id == interview_id,
    ).order_by(BehaviorScore.created_at).all()

    anomaly_timeline = []
    total_anomalies = 0
    for s in scores_with_anomalies:
        if s.anomaly_flags:
            for flag in s.anomaly_flags:
                if isinstance(flag, dict) and flag.get("type"):
                    flag["recorded_at"] = s.created_at.isoformat() if s.created_at else None
                    anomaly_timeline.append(flag)
                    total_anomalies += 1

    # Dominant emotion via Counter
    emotions = db.query(BehaviorScore.emotion_label).filter(
        BehaviorScore.interview_id == interview_id,
        BehaviorScore.emotion_label.isnot(None),
    ).all()
    emotion_list = [e[0] for e in emotions if e[0]]
    dominant_emotion = Counter(emotion_list).most_common(1)[0][0] if emotion_list else None

    # Grade from overall average
    overall_avg = (avg_eye + avg_posture + avg_engagement + avg_confidence) / 4
    grade = compute_grade(overall_avg)

    # Upsert (same pattern as hackathon)
    summary = db.query(BehaviorSummary).filter(
        BehaviorSummary.interview_id == interview_id
    ).first()

    if summary:
        summary.avg_eye_contact = avg_eye
        summary.avg_posture = avg_posture
        summary.avg_engagement = avg_engagement
        summary.avg_confidence = avg_confidence
        summary.total_anomalies = total_anomalies
        summary.anomaly_timeline = anomaly_timeline
        summary.dominant_emotion = dominant_emotion
        summary.behavior_grade = grade
    else:
        summary = BehaviorSummary(
            interview_id=interview_id,
            avg_eye_contact=avg_eye,
            avg_posture=avg_posture,
            avg_engagement=avg_engagement,
            avg_confidence=avg_confidence,
            total_anomalies=total_anomalies,
            anomaly_timeline=anomaly_timeline,
            dominant_emotion=dominant_emotion,
            behavior_grade=grade,
        )
        db.add(summary)

    db.flush()
    return summary


def get_summary(db: Session, interview_id: str) -> BehaviorSummary | None:
    return db.query(BehaviorSummary).filter(
        BehaviorSummary.interview_id == interview_id
    ).first()


def get_timeline(db: Session, interview_id: str) -> list[dict]:
    """Return timestamped score entries. Mirrors hackathon's get_timeline()."""
    scores = db.query(BehaviorScore).filter(
        BehaviorScore.interview_id == interview_id
    ).order_by(BehaviorScore.created_at).all()

    entries = []
    for s in scores:
        entries.append({
            "timestamp": s.created_at.isoformat() if s.created_at else None,
            "scores": {
                "eye_contact": s.eye_contact_score,
                "posture": s.posture_score,
                "engagement": s.engagement_score,
                "confidence": s.confidence_score,
            },
            "emotion": s.emotion_label,
            "face_count": s.face_count,
            "anomaly_flags": s.anomaly_flags or [],
        })
    return entries


def get_report(db: Session, interview_id: str) -> dict | None:
    """Full report. Mirrors hackathon's get_report()."""
    summary = get_summary(db, interview_id)
    if not summary:
        return None
    timeline = get_timeline(db, interview_id)
    score_count = db.query(func.count(BehaviorScore.id)).filter(
        BehaviorScore.interview_id == interview_id
    ).scalar()

    return {
        "summary": {
            "interview_id": summary.interview_id,
            "avg_eye_contact": summary.avg_eye_contact,
            "avg_posture": summary.avg_posture,
            "avg_engagement": summary.avg_engagement,
            "avg_confidence": summary.avg_confidence,
            "total_anomalies": summary.total_anomalies,
            "anomaly_timeline": summary.anomaly_timeline or [],
            "dominant_emotion": summary.dominant_emotion,
            "behavior_grade": summary.behavior_grade,
        },
        "timeline": timeline,
        "total_data_points": score_count,
    }
