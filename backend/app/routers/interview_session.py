import os
import re
import json
from io import BytesIO
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from openai import OpenAI
from app.config import get_settings
from app.database import get_db
from app.models import Interview, InterviewSession, User
from app.security import get_current_user
from app.schemas import FinalizeResponse, EvaluationResponse
from app.services.screening_engine import (
    build_screening_first_question, build_screening_adaptive_prompt, build_screening_evaluation_prompt,
)
from app.services.hr_cultural_engine import (
    build_cultural_first_question, build_cultural_adaptive_prompt, build_cultural_evaluation_prompt,
)

settings = get_settings()
router = APIRouter(prefix="/session", tags=["interview-session"])
client = OpenAI(api_key=settings.openai_api_key)

audio_buffers: dict[str, BytesIO] = {}


# ── Question Generation (round-aware) ──

def generate_first_question(interview: Interview, candidate: User) -> str:
    # If HR provided custom questions, use the first one directly
    if interview.question_source == "custom" and interview.custom_questions:
        return interview.custom_questions[0]

    if interview.round_type == "screening":
        resume = candidate.resume_text or "No resume provided."
        prompt = build_screening_first_question(resume, interview.job_role, interview.skills)
    elif interview.round_type == "hr_cultural":
        prompt = build_cultural_first_question(interview.job_role, interview.skills)
    else:  # technical (default)
        prompt = f"""You are a technical interviewer. You're interviewing a candidate for the position of **{interview.job_role}**.
Their key technical skills are: {interview.skills}.

Start the interview with a friendly, open-ended question asking the candidate about one of their recent projects involving any of their technical skills.
The question should be focused on one specific skill from the given list.

Respond with just the question, no prefixes."""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "system", "content": prompt}],
        temperature=0.7,
    )
    return response.choices[0].message.content.strip()


def build_adaptive_prompt(interview: Interview, candidate: User,
                          history: list, triggers: list, question_count: int) -> str:
    if interview.round_type == "screening":
        resume = candidate.resume_text or "No resume provided."
        return build_screening_adaptive_prompt(
            resume, interview.job_role, interview.skills, history, triggers, question_count)
    elif interview.round_type == "hr_cultural":
        return build_cultural_adaptive_prompt(
            interview.job_role, interview.skills, history, triggers, question_count)
    else:  # technical
        return _build_technical_adaptive_prompt(
            interview.job_role, interview.skills, history, triggers, question_count)


def build_evaluation_prompt(interview: Interview, history: list) -> str:
    if interview.round_type == "screening":
        return build_screening_evaluation_prompt(history)
    elif interview.round_type == "hr_cultural":
        return build_cultural_evaluation_prompt(history)
    else:
        return _build_technical_evaluation_prompt(history)


def _build_technical_adaptive_prompt(role: str, skills: str, history: list,
                                      triggers: list, question_count: int) -> str:
    formatted_history = ""
    for msg in history:
        speaker = "Interviewer" if msg["role"] == "assistant" else "Candidate"
        difficulty = msg.get("difficulty_level", "")
        diff_tag = f" [{difficulty}]" if difficulty else ""
        formatted_history += f"{speaker}{diff_tag}: {msg['content']}\n\n"

    return f"""You are an unbiased, highly experienced Technical Interviewer specializing in "{role}" role.
You are conducting a real-time, adaptive, dynamic interview. Your goal is to assess the candidate's ability in the following skills: {skills}.

Instructions:
- Questions should be dynamic — not pre-set. Frame each question based on how the candidate answered the previous ones.
- The difficulty level of assessment should keep increasing - Easy, Intermediate, Advanced.
- If the candidate struggles, go back to easier questions and wrap up.
- Ensure coverage of all listed skills over the course of the interview.
- Do NOT stay stuck on one topic. If a topic has been explored in 2+ questions, switch to a different topic.

Conversation so far:
{formatted_history}

Triggers History: {triggers}
Questions Asked: {question_count}

TRIGGER-ACTION RULES:
- Correct detailed answer → Ask more difficult question
- Correct but short answer → Ask about detail on next question
- Uncertain partial answer → Ask one level easier question
- Incorrect answer → Switch to a new topic at the same difficulty level
- Wrap up (2 consecutive wrong) → Ask one basic last question

STRICT STOPPING RULE:
- When last 2 triggers are Incorrect/Uncertain, trigger Wrap Up

OUTPUT FORMAT:
Trigger: <Correct detailed answer | Correct but short answer | Uncertain partial answer | Incorrect answer | Wrap Up>
Action: <Which action and why>
Difficulty level: <Easy|Intermediate|Advanced>
Next Question: <Next question>"""


def _build_technical_evaluation_prompt(history: list) -> str:
    dialogue = []
    for i in range(0, len(history) - 1, 2):
        if i + 1 < len(history):
            q = history[i]["content"].strip().replace("\n", " ")
            a = history[i + 1]["content"].strip().replace("\n", " ")
            dialogue.append(f"Interviewer: {q}\nCandidate: {a}")

    return f"""Evaluate the following technical interview. Be balanced — not too strict, not too lenient. Score what the candidate actually demonstrated.

Scoring guidelines:
- proficiencyScore 80-100: Excellent — deep knowledge, correct answers, clear explanations
- proficiencyScore 60-79: Good — solid knowledge, mostly correct, some gaps
- proficiencyScore 40-59: Average — basic understanding, significant gaps, vague explanations
- proficiencyScore 20-39: Weak — mostly incorrect or very vague, minimal knowledge shown
- proficiencyScore 0-19: Very poor — no relevant knowledge, nonsensical answers

Be honest. If answers are vague rambling with no technical substance, score 15-30. If they showed real technical knowledge with some gaps, score 55-75. Only score 80+ for genuinely strong technical responses.

Conversation:
{chr(10).join(dialogue)}

Return a JSON object:
{{
  "techAccuracy": <0-10, based on actual correctness of answers>,
  "conceptCoverage": <0-10, how many relevant concepts were covered?>,
  "practicalKnowledge": <0-10, did they show real hands-on experience?>,
  "proficiencyScore": <0-100, follow scoring guidelines strictly>,
  "strongTopics": [<topics>],
  "weakTopics": [<topics>],
  "feedback": "<3-5 sentence constructive assessment>",
  "numQuestions": <number>
}}

Return ONLY the JSON object."""


# ── Endpoints ──

@router.post("/start")
async def start_interview(
    session_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Interview already completed")

    interview = db.query(Interview).filter(Interview.id == session.interview_id).first()
    candidate = db.query(User).filter(User.id == session.candidate_id).first()

    first_question = generate_first_question(interview, candidate)

    session.status = "in_progress"
    session.started_at = datetime.utcnow()
    session.conversation_history = [
        {"role": "assistant", "content": first_question, "difficulty_level": "Easy"}
    ]
    session.triggers = ["Start Interview"]
    session.question_count = 1
    db.commit()

    return {"question": first_question, "session_id": session.id, "round_type": interview.round_type}


@router.post("/audio-chunk")
async def receive_audio_chunk(
    audio: UploadFile = File(...),
    uuid: str = Query(...),
):
    if uuid not in audio_buffers:
        audio_buffers[uuid] = BytesIO()
    chunk = await audio.read()
    audio_buffers[uuid].write(chunk)
    total_size = audio_buffers[uuid].tell()
    print(f"[Audio] Chunk received: uuid={uuid[:8]}... chunk_size={len(chunk)} total_buffer={total_size}")
    return {"message": "Chunk received", "chunk_size": len(chunk), "total_buffer": total_size}


@router.post("/audio-finalize", response_model=FinalizeResponse)
async def finalize_audio(
    uuid: str = Query(...),
    session_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    interview = db.query(Interview).filter(Interview.id == session.interview_id).first()
    candidate = db.query(User).filter(User.id == session.candidate_id).first()

    # Write audio buffer to file
    file_path = f"recordings/{uuid}.webm"
    if uuid in audio_buffers:
        audio_buffers[uuid].seek(0)
        audio_data = audio_buffers[uuid].read()
        file_size = len(audio_data)
        print(f"[Audio] Finalize: uuid={uuid[:8]}... buffer_size={file_size} bytes")

        if file_size < 100:
            print(f"[Audio] WARNING: Buffer too small ({file_size} bytes), likely empty audio")

        with open(file_path, "wb") as f:
            f.write(audio_data)
        del audio_buffers[uuid]
    else:
        print(f"[Audio] ERROR: No buffer found for uuid={uuid[:8]}... Available: {list(audio_buffers.keys())[:5]}")
        raise HTTPException(status_code=400, detail="No audio data found for this UUID")

    # Check file size
    actual_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
    print(f"[Audio] File written: {file_path} size={actual_size} bytes")

    # Transcribe with Whisper
    try:
        with open(file_path, "rb") as f:
            transcript_response = client.audio.transcriptions.create(
                model="whisper-1", file=f, language="en", temperature=0,
            )
        transcription = transcript_response.text.strip()
        print(f"[Audio] Whisper result: '{transcription[:100]}...' (len={len(transcription)})")
    except Exception as e:
        print(f"[Audio] Whisper ERROR: {e}")
        transcription = "[Transcription failed]"
    finally:
        # Keep the file for debugging (don't delete)
        pass

    if not transcription or transcription == "[Transcription failed]":
        transcription = "[No answer provided]"

    # Update conversation history
    history = list(session.conversation_history or [])
    triggers = list(session.triggers or [])
    history.append({"role": "user", "content": transcription})

    last_trigger = triggers[-1] if triggers else ""
    if last_trigger == "Wrap Up":
        session.conversation_history = history
        db.commit()
        return FinalizeResponse(transcription=transcription, next_question=None, is_complete=True)

    # Hard stop: if we've reached max_questions, end the interview
    if session.question_count >= interview.max_questions:
        session.conversation_history = history
        db.commit()
        return FinalizeResponse(transcription=transcription, next_question=None, is_complete=True)

    # Custom questions mode: serve next question from the list
    if interview.question_source == "custom" and interview.custom_questions:
        q_index = session.question_count  # 0-based: question_count is already asked count
        if q_index >= len(interview.custom_questions):
            # All custom questions asked — done
            session.conversation_history = history
            db.commit()
            return FinalizeResponse(transcription=transcription, next_question=None, is_complete=True)

        next_question = interview.custom_questions[q_index]
        trigger = "Custom question"
        difficulty = "Custom"

        history.append({"role": "assistant", "content": next_question, "difficulty_level": "Custom"})
        triggers.append(trigger)
        session.conversation_history = history
        session.triggers = triggers
        session.question_count = (session.question_count or 0) + 1
        db.commit()
        return FinalizeResponse(transcription=transcription, next_question=next_question, is_complete=False)

    # AI-generated mode: adaptive prompt
    prompt = build_adaptive_prompt(interview, candidate, history, triggers, session.question_count)

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "system", "content": prompt}],
        temperature=0.3,
    )
    content = response.choices[0].message.content.strip()

    trigger_match = re.search(r"Trigger:\s*(.*)", content, re.IGNORECASE)
    difficulty_match = re.search(r"Difficulty level:\s*(.*)", content, re.IGNORECASE)
    question_match = re.search(r"Next Question:\s*(.*)", content, re.IGNORECASE)

    trigger = trigger_match.group(1).strip() if trigger_match else "Uncertain partial answer"
    difficulty = difficulty_match.group(1).strip() if difficulty_match else "Easy"
    next_question = question_match.group(1).strip() if question_match else None

    if not next_question:
        lines = content.split("\n")
        next_question = lines[-1].strip() if lines else "Could you tell me more?"

    triggers.append(trigger)
    is_complete = "wrap up" in trigger.lower()

    history.append({"role": "assistant", "content": next_question, "difficulty_level": difficulty})

    session.conversation_history = history
    session.triggers = triggers
    session.question_count = (session.question_count or 0) + 1
    db.commit()

    return FinalizeResponse(transcription=transcription, next_question=next_question, is_complete=is_complete)


@router.post("/evaluate")
async def evaluate_session(
    session_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    interview = db.query(Interview).filter(Interview.id == session.interview_id).first()
    history = session.conversation_history or []
    if len(history) < 2:
        raise HTTPException(status_code=400, detail="Not enough conversation to evaluate")

    prompt = build_evaluation_prompt(interview, history)

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a hiring evaluator. Return only valid JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0,
    )

    raw = response.choices[0].message.content.strip()
    json_match = re.search(r"\{[\s\S]*\}", raw)
    if not json_match:
        raise HTTPException(status_code=500, detail="Failed to parse evaluation")

    try:
        evaluation = json.loads(json_match.group())
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid JSON in evaluation")

    session.evaluation = evaluation
    session.status = "completed"
    session.completed_at = datetime.utcnow()

    # Auto-fetch and attach behavior summary
    from app.models import BehaviorSummary, CandidatePipeline, Notification, AgentAction
    behavior_id = f"session_{session_id}"
    behavior = db.query(BehaviorSummary).filter(BehaviorSummary.interview_id == behavior_id).first()
    if behavior:
        session.behavior_summary = {
            "avg_eye_contact": behavior.avg_eye_contact,
            "avg_posture": behavior.avg_posture,
            "avg_engagement": behavior.avg_engagement,
            "avg_confidence": behavior.avg_confidence,
            "total_anomalies": behavior.total_anomalies,
            "dominant_emotion": behavior.dominant_emotion,
            "behavior_grade": behavior.behavior_grade,
        }

    db.commit()

    # === AUTO HR AGENT: analyze and advance candidates automatically ===
    try:
        _auto_agent_pipeline(session, interview, evaluation, db)
    except Exception as e:
        print(f"[AutoAgent] Error: {e}")

    return evaluation


def _auto_agent_pipeline(session, interview, evaluation, db):
    """After a candidate completes a round, auto-analyze and advance if score >= 60%."""
    from app.models import CandidatePipeline, Notification, AgentAction, InterviewPipeline
    from app.services.email_service import send_shortlist_email, send_rejection_email, send_hired_email

    if not interview.pipeline_id:
        return

    pipeline = db.query(InterviewPipeline).filter(InterviewPipeline.id == interview.pipeline_id).first()
    if not pipeline:
        return

    proficiency = evaluation.get("proficiencyScore", 0)
    round_number = interview.round_number
    candidate_id = session.candidate_id
    candidate = db.query(User).filter(User.id == candidate_id).first()
    candidate_name = candidate.name if candidate else "Unknown"

    # Log agent action
    action = AgentAction(
        agent_type="hr_agent",
        action_type="auto_evaluate",
        target_type="session",
        target_id=session.id,
        pipeline_id=interview.pipeline_id,
        round_number=round_number,
        payload={"candidate_id": candidate_id, "proficiency_score": proficiency},
        status="completed",
        confidence=proficiency,
        requires_approval=False,
    )

    if proficiency >= 60:
        # Auto shortlist
        session.shortlist_status = "approved"
        session.shortlisted_by = "agent"
        session.shortlisted_at = datetime.utcnow()
        session.hr_decision = "approved"
        session.hr_decision_at = datetime.utcnow()

        action.result = {
            "decision": "shortlist",
            "reasoning": f"{candidate_name} scored {proficiency}/100, above 60% threshold. Auto-approved.",
        }
        action.approval_status = "approved"

        if round_number < 3:
            # Auto-advance to next round
            next_round = round_number + 1
            next_interview = db.query(Interview).filter(
                Interview.pipeline_id == interview.pipeline_id,
                Interview.round_number == next_round,
            ).first()

            if next_interview:
                # Check not already assigned
                existing = db.query(InterviewSession).filter(
                    InterviewSession.interview_id == next_interview.id,
                    InterviewSession.candidate_id == candidate_id,
                ).first()

                if not existing:
                    new_session = InterviewSession(
                        interview_id=next_interview.id,
                        candidate_id=candidate_id,
                        round_number=next_round,
                        round_type=next_interview.round_type,
                    )
                    db.add(new_session)

                    # Update candidate pipeline progress
                    cp = db.query(CandidatePipeline).filter(
                        CandidatePipeline.pipeline_id == interview.pipeline_id,
                        CandidatePipeline.candidate_id == candidate_id,
                    ).first()
                    if cp:
                        cp.current_round = next_round
                        cp.overall_status = f"shortlisted_r{round_number}"

                    # Notify candidate
                    round_labels = {1: "Screening", 2: "Technical", 3: "HR & Cultural"}
                    db.add(Notification(
                        user_id=candidate_id,
                        type="shortlisted",
                        title=f"Shortlisted! Round {next_round} ready",
                        message=f"You scored {proficiency}/100 in Round {round_number} ({round_labels.get(round_number, '')})."
                                f" You've been auto-advanced to Round {next_round} ({round_labels.get(next_round, '')}).",
                        link="/candidate/dashboard",
                    ))

                    # Send email
                    try:
                        send_shortlist_email(
                            to_email=candidate.email,
                            candidate_name=candidate_name,
                            pipeline_title=pipeline.title,
                            round_completed=round_number,
                            next_round=next_round,
                            score=int(proficiency),
                        )
                    except Exception as e:
                        print(f"[Email] Shortlist email failed: {e}")

        else:
            # Round 3 completed with passing score — mark as hired candidate
            cp = db.query(CandidatePipeline).filter(
                CandidatePipeline.pipeline_id == interview.pipeline_id,
                CandidatePipeline.candidate_id == candidate_id,
            ).first()
            if cp:
                cp.overall_status = "hired"

            db.add(Notification(
                user_id=candidate_id,
                type="shortlisted",
                title="Congratulations!",
                message=f"You scored {proficiency}/100 in the final round. You've been recommended for hiring!",
                link="/candidate/dashboard",
            ))

            # Send hired email
            try:
                send_hired_email(
                    to_email=candidate.email,
                    candidate_name=candidate_name,
                    pipeline_title=pipeline.title,
                    score=int(proficiency),
                )
            except Exception as e:
                print(f"[Email] Hired email failed: {e}")

            # Auto-onboarding: create employee record
            try:
                from app.services.onboarding_service import create_employee_from_hire, send_onboarding_email
                employee = create_employee_from_hire(candidate_id, interview.pipeline_id, db)
                if employee:
                    send_onboarding_email(
                        to_email=candidate.email,
                        candidate_name=candidate_name,
                        employee_id=employee.employee_id,
                    )
            except Exception as e:
                print(f"[Onboarding] Auto-onboarding failed: {e}")

    else:
        # Below threshold
        session.shortlist_status = "rejected"
        session.shortlisted_by = "agent"
        session.shortlisted_at = datetime.utcnow()

        action.result = {
            "decision": "reject",
            "reasoning": f"{candidate_name} scored {proficiency}/100, below 60% threshold.",
        }
        action.approval_status = "rejected"

        db.add(Notification(
            user_id=candidate_id,
            type="rejected",
            title="Application Update",
            message=f"Thank you for completing Round {round_number}. Your score was {proficiency}/100."
                    f" Unfortunately, the minimum threshold is 60%.",
            link="/candidate/dashboard",
        ))

        # Send rejection email
        try:
            send_rejection_email(
                to_email=candidate.email,
                candidate_name=candidate_name,
                pipeline_title=pipeline.title,
                round_number=round_number,
                score=int(proficiency),
            )
        except Exception as e:
            print(f"[Email] Rejection email failed: {e}")

    db.add(action)

    # Notify HR admins
    admin_users = db.query(User).filter(User.role.in_(["admin", "super_admin"])).all()
    for admin in admin_users:
        status = "PASSED" if proficiency >= 60 else "FAILED"
        db.add(Notification(
            user_id=admin.id,
            type="approval_needed" if proficiency < 60 else "shortlisted",
            title=f"Auto-Analysis: {candidate_name} {status} R{round_number}",
            message=f"{candidate_name} scored {proficiency}/100 in Round {round_number}. "
                    f"{'Auto-advanced to Round ' + str(round_number + 1) if proficiency >= 60 and round_number < 3 else 'Requires review.' if proficiency < 60 else 'Recommended for hiring.'}",
            link=f"/hr/pipelines/{interview.pipeline_id}",
        ))

    db.commit()


@router.post("/save-recording")
async def save_recording(
    audio: UploadFile = File(...),
    session_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Save the full interview audio recording."""
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    rec_dir = "uploads/recordings"
    os.makedirs(rec_dir, exist_ok=True)
    file_path = os.path.join(rec_dir, f"session_{session_id}.webm")

    with open(file_path, "wb") as f:
        content = await audio.read()
        f.write(content)

    session.recording_path = file_path
    db.commit()
    return {"message": "Recording saved", "path": file_path}


@router.post("/save-video")
async def save_video(
    video: UploadFile = File(...),
    session_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Save the candidate's video recording."""
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    vid_dir = "uploads/videos"
    os.makedirs(vid_dir, exist_ok=True)
    file_path = os.path.join(vid_dir, f"session_{session_id}.webm")

    with open(file_path, "wb") as f:
        content = await video.read()
        f.write(content)

    session.video_path = file_path
    db.commit()
    return {"message": "Video saved", "path": file_path}


@router.get("/video/{session_id}")
async def get_video(session_id: int, db: Session = Depends(get_db)):
    """Serve the interview video recording."""
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session or not session.video_path:
        raise HTTPException(status_code=404, detail="No video recording found")

    if not os.path.exists(session.video_path):
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    from fastapi.responses import FileResponse
    return FileResponse(session.video_path, media_type="video/webm")


@router.get("/audio/{session_id}")
async def get_audio(session_id: int, db: Session = Depends(get_db)):
    """Serve the interview audio recording."""
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session or not session.recording_path:
        raise HTTPException(status_code=404, detail="No audio recording found")

    if not os.path.exists(session.recording_path):
        raise HTTPException(status_code=404, detail="Audio file not found on disk")

    from fastapi.responses import FileResponse
    return FileResponse(session.recording_path, media_type="audio/webm")
