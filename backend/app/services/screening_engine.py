def build_screening_first_question(resume_text: str, job_role: str, skills: str) -> str:
    return f"""You are a technical screener conducting an initial screening interview for the position of **{job_role}**.
Required skills: {skills}.

The candidate has submitted their resume. Based on the resume below, ask a friendly opening screening question to verify their claimed experience.
Focus on: their most recent relevant role or project, and how it connects to the required skills.

Resume:
{resume_text[:3000]}

Respond with just the question, no prefixes. Keep it conversational and specific to what's in the resume."""


def build_screening_adaptive_prompt(resume_text: str, job_role: str, skills: str,
                                     history: list, triggers: list, question_count: int) -> str:
    formatted_history = ""
    for msg in history:
        speaker = "Interviewer" if msg["role"] == "assistant" else "Candidate"
        formatted_history += f"{speaker}: {msg['content']}\n\n"

    return f"""You are a technical screener for the position of **{job_role}**.
Required skills: {skills}.

You are verifying the candidate's resume claims through conversation. Your goals:
1. Verify timeline and employment claims
2. Assess depth of involvement in listed projects
3. Check if claimed skills match actual experience
4. Evaluate communication clarity

Candidate's Resume:
{resume_text[:2000]}

Conversation so far:
{formatted_history}

Triggers History: {triggers}
Questions Asked: {question_count}

RULES:
- Ask questions that probe specific resume claims
- If candidate's answers don't match resume, note it
- Keep questions focused and screening-level (not deep technical)
- After {question_count + 2} questions OR 2 consecutive vague answers, wrap up

OUTPUT FORMAT:
Trigger: <Consistent with resume | Partially consistent | Inconsistent | Wrap Up>
Action: <Brief note on what you observed>
Difficulty level: <Screening>
Next Question: <Next screening question>"""


def build_screening_evaluation_prompt(history: list) -> str:
    dialogue = []
    for i in range(0, len(history) - 1, 2):
        if i + 1 < len(history):
            q = history[i]["content"].strip()
            a = history[i + 1]["content"].strip()
            dialogue.append(f"Interviewer: {q}\nCandidate: {a}")

    return f"""Evaluate this screening interview. Be balanced — not too strict, not too lenient.

Scoring guidelines:
- proficiencyScore 80-100: Excellent — answers match resume well, clear communication, detailed
- proficiencyScore 60-79: Good — relevant answers, some detail, mostly consistent with resume
- proficiencyScore 40-59: Average — vague answers, some relevance but lacking specifics
- proficiencyScore 20-39: Weak — answers don't match resume claims, very vague
- proficiencyScore 0-19: Very poor — no relevant information, nonsensical, or disengaged

Be honest. If the candidate rambled without substance, score 15-30. If they gave a decent overview of real experience, score 55-75.

Conversation:
{chr(10).join(dialogue)}

Return a JSON object:
{{
  "resumeAccuracy": <0-10, based on actual match between answer and resume>,
  "communicationClarity": <0-10, how clearly did they actually communicate?>,
  "experienceDepth": <0-10, did they show real depth or just surface level?>,
  "proficiencyScore": <0-100, follow the scoring guidelines strictly>,
  "strongTopics": [<topics where candidate was convincing>],
  "weakTopics": [<topics where claims seemed weak>],
  "feedback": "<3-5 sentence constructive screening assessment>",
  "numQuestions": <number of questions asked>
}}

Return ONLY the JSON object."""
