import json
import re
from openai import OpenAI
from sqlalchemy.orm import Session
from app.config import get_settings
from app.models import (
    Interview, InterviewSession, InterviewPipeline, User,
    AgentAction, Notification, BehaviorSummary,
)

settings = get_settings()
client = OpenAI(api_key=settings.openai_api_key)

HR_AGENT_CONFIG = {
    "name": "HR Agent",
    "role": "Senior Hiring Manager AI",
    "personality": "Analytical, fair, data-driven. Always provides reasoning.",
    "constraints": [
        "Never auto-approve — always recommend for human review",
        "Consider both technical scores AND behavioral scores",
        "Flag anomalies explicitly in recommendations",
        "Maintain consistent evaluation criteria across candidates",
    ],
}


async def analyze_round(pipeline_id: int, round_number: int, db: Session) -> AgentAction:
    """Analyze all completed sessions for a round and produce shortlist recommendations."""

    pipeline = db.query(InterviewPipeline).filter(InterviewPipeline.id == pipeline_id).first()
    if not pipeline:
        raise ValueError("Pipeline not found")

    interview = db.query(Interview).filter(
        Interview.pipeline_id == pipeline_id,
        Interview.round_number == round_number,
    ).first()
    if not interview:
        raise ValueError(f"Round {round_number} not found")

    sessions = db.query(InterviewSession).filter(
        InterviewSession.interview_id == interview.id,
        InterviewSession.status == "completed",
    ).all()

    if not sessions:
        raise ValueError("No completed sessions to analyze")

    # Build candidate data for the prompt
    candidates_data = []
    for s in sessions:
        candidate = db.query(User).filter(User.id == s.candidate_id).first()
        behavior = db.query(BehaviorSummary).filter(
            BehaviorSummary.interview_id == f"session_{s.id}"
        ).first()

        entry = {
            "candidate_id": s.candidate_id,
            "candidate_name": candidate.name if candidate else "Unknown",
            "evaluation": s.evaluation or {},
            "tab_switches": s.tab_switch_count or 0,
        }
        if behavior:
            entry["behavior"] = {
                "eye_contact": round(behavior.avg_eye_contact, 1),
                "posture": round(behavior.avg_posture, 1),
                "engagement": round(behavior.avg_engagement, 1),
                "confidence": round(behavior.avg_confidence, 1),
                "grade": behavior.behavior_grade,
                "anomalies": behavior.total_anomalies,
            }
        candidates_data.append(entry)

    constraints_text = "\n".join(f"- {c}" for c in HR_AGENT_CONFIG["constraints"])

    prompt = f"""You are {HR_AGENT_CONFIG['role']}. {HR_AGENT_CONFIG['personality']}

Rules:
{constraints_text}

Analyze the following Round {round_number} ({interview.round_type}) results for pipeline "{pipeline.title}" ({pipeline.job_role}).

CANDIDATES:
{json.dumps(candidates_data, indent=2)}

Produce a JSON response:
{{
  "recommendations": [
    {{
      "candidate_id": <int>,
      "candidate_name": "<str>",
      "decision": "shortlist" | "reject",
      "confidence": <float 0-100>,
      "reasoning": "<2-3 sentences>",
      "strengths": ["<str>"],
      "concerns": ["<str>"],
      "risk_flags": ["<str based on anomalies/tab switches>"]
    }}
  ],
  "summary": "<overall round summary>",
  "shortlist_count": <int>,
  "round_quality_assessment": "<brief assessment of candidate pool quality>"
}}

Return ONLY the JSON object."""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are an HR hiring agent. Return only valid JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )

    raw = response.choices[0].message.content.strip()
    json_match = re.search(r"\{[\s\S]*\}", raw)
    if not json_match:
        raise ValueError("Failed to parse agent response")

    result = json.loads(json_match.group())

    # Calculate average confidence
    recs = result.get("recommendations", [])
    avg_confidence = sum(r.get("confidence", 0) for r in recs) / len(recs) if recs else 0

    # Create agent action
    action = AgentAction(
        agent_type="hr_agent",
        action_type="recommend_shortlist",
        target_type="pipeline",
        target_id=pipeline_id,
        pipeline_id=pipeline_id,
        round_number=round_number,
        payload={"candidates_analyzed": len(candidates_data)},
        result=result,
        status="completed",
        confidence=avg_confidence,
        requires_approval=True,
        approval_status="pending",
    )
    db.add(action)

    # Update each session with the agent recommendation
    for rec in recs:
        s = db.query(InterviewSession).filter(
            InterviewSession.interview_id == interview.id,
            InterviewSession.candidate_id == rec["candidate_id"],
        ).first()
        if s:
            s.agent_recommendation = rec
            s.shortlist_status = "recommended" if rec["decision"] == "shortlist" else "rejected"
            s.shortlisted_by = "agent"

    # Notify HR users
    admin_users = db.query(User).filter(User.role.in_(["admin", "super_admin"])).all()
    for admin in admin_users:
        notification = Notification(
            user_id=admin.id,
            type="approval_needed",
            title=f"Agent Recommendations Ready",
            message=f"HR Agent has analyzed Round {round_number} for '{pipeline.title}'. {len(recs)} recommendations pending approval.",
            link=f"/hr/pipelines/{pipeline_id}",
        )
        db.add(notification)

    db.commit()
    return action


async def generate_final_report(pipeline_id: int, db: Session) -> dict:
    """Generate comprehensive hiring report after all rounds."""
    pipeline = db.query(InterviewPipeline).filter(InterviewPipeline.id == pipeline_id).first()

    all_sessions = []
    interviews = db.query(Interview).filter(Interview.pipeline_id == pipeline_id).order_by(Interview.round_number).all()

    for iv in interviews:
        sessions = db.query(InterviewSession).filter(
            InterviewSession.interview_id == iv.id,
            InterviewSession.status == "completed",
        ).all()
        for s in sessions:
            candidate = db.query(User).filter(User.id == s.candidate_id).first()
            all_sessions.append({
                "round": iv.round_number,
                "round_type": iv.round_type,
                "candidate_name": candidate.name if candidate else "Unknown",
                "candidate_id": s.candidate_id,
                "evaluation": s.evaluation,
                "shortlist_status": s.shortlist_status,
            })

    prompt = f"""You are a Senior HR Director. Generate a comprehensive hiring report for pipeline "{pipeline.title}" ({pipeline.job_role}).

All round results:
{json.dumps(all_sessions, indent=2)}

Return a JSON report:
{{
  "executive_summary": "<paragraph summarizing the hiring process>",
  "candidate_rankings": [
    {{
      "rank": <int>,
      "candidate_name": "<str>",
      "candidate_id": <int>,
      "recommendation": "hire" | "strong_consider" | "reject",
      "overall_score": <0-100>,
      "cross_round_analysis": "<how they performed across rounds>"
    }}
  ],
  "process_insights": "<observations about the candidate pool and process>"
}}

Return ONLY the JSON."""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are an HR director. Return only valid JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )

    raw = response.choices[0].message.content.strip()
    json_match = re.search(r"\{[\s\S]*\}", raw)
    return json.loads(json_match.group()) if json_match else {"error": "Failed to generate report"}
