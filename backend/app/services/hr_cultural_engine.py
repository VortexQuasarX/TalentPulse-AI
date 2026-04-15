def build_cultural_first_question(job_role: str, skills: str, candidate_history: str = "") -> str:
    context = ""
    if candidate_history:
        context = f"\nThe candidate has already passed earlier rounds with this context:\n{candidate_history[:1000]}\n"

    return f"""You are an experienced HR interviewer conducting a cultural fit and behavioral assessment for the position of **{job_role}**.
{context}
Ask a warm, open-ended behavioral question using the STAR method framework.
Focus on one of these areas: teamwork, conflict resolution, communication, leadership, or adaptability.

Respond with just the question, no prefixes. Make it conversational."""


def build_cultural_adaptive_prompt(job_role: str, skills: str, history: list,
                                    triggers: list, question_count: int) -> str:
    formatted_history = ""
    for msg in history:
        speaker = "Interviewer" if msg["role"] == "assistant" else "Candidate"
        formatted_history += f"{speaker}: {msg['content']}\n\n"

    return f"""You are an HR interviewer conducting a behavioral and cultural fit assessment for **{job_role}**.

Focus areas: teamwork, conflict resolution, communication style, leadership, adaptability, work-life balance, motivation.
Use STAR method follow-ups (Situation, Task, Action, Result).

Conversation so far:
{formatted_history}

Triggers History: {triggers}
Questions Asked: {question_count}

RULES:
- Rotate through different behavioral themes (don't repeat the same area)
- If candidate gives shallow answers, probe deeper with "Can you give a specific example?"
- Assess both what they say AND how they communicate
- After {question_count + 2} questions, wrap up with a closing question

OUTPUT FORMAT:
Trigger: <Strong behavioral evidence | Adequate response | Vague response | Wrap Up>
Action: <Brief note on behavioral theme being assessed>
Difficulty level: <Behavioral>
Next Question: <Next behavioral/cultural question>"""


def build_cultural_evaluation_prompt(history: list) -> str:
    dialogue = []
    for i in range(0, len(history) - 1, 2):
        if i + 1 < len(history):
            q = history[i]["content"].strip()
            a = history[i + 1]["content"].strip()
            dialogue.append(f"Interviewer: {q}\nCandidate: {a}")

    return f"""Evaluate this HR/cultural fit interview. Be balanced — not too strict, not too lenient. Score what the candidate actually demonstrated.

Scoring guidelines:
- proficiencyScore 80-100: Excellent — clear STAR examples, strong communication, genuine insight
- proficiencyScore 60-79: Good — relevant examples given, decent communication, shows potential
- proficiencyScore 40-59: Average — attempted to answer but vague, lacked specifics
- proficiencyScore 20-39: Weak — off-topic, no real examples, poor communication
- proficiencyScore 0-19: Very poor — nonsensical, disengaged, no effort at all

Be honest. If the answer is vague rambling with no real content, score 15-25. If they gave a real example but lacked detail, score 50-65. Only score 70+ for genuinely good behavioral responses with specific examples.

Conversation:
{chr(10).join(dialogue)}

Return a JSON object:
{{
  "culturalFit": <0-10, based on actual content quality>,
  "teamworkOrientation": <0-10, did they describe real teamwork?>,
  "communicationSkills": <0-10, were they clear and articulate?>,
  "leadershipPotential": <0-10, did they show initiative?>,
  "proficiencyScore": <0-100, following scoring guidelines strictly>,
  "strongTopics": [<behavioral areas where candidate excelled>],
  "weakTopics": [<behavioral areas where candidate was weak>],
  "feedback": "<3-5 sentence behavioral assessment>",
  "numQuestions": <number of questions asked>
}}

Return ONLY the JSON object."""
