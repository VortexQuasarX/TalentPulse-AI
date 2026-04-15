# AI-Powered People Operations System — Complete Technical Deep Dive

This document explains every component, every evaluation metric, every API call, and every decision in the system. Use this to explain the project to judges, interviewers, or teammates.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [The Complete User Journey](#2-the-complete-user-journey)
3. [AI Interview Engine — How Questions Are Generated](#3-ai-interview-engine)
4. [All Evaluation Metrics Explained](#4-all-evaluation-metrics-explained)
5. [Video Anomaly Detection — How It Works](#5-video-anomaly-detection)
6. [HR Agent — How Auto-Decisions Work](#6-hr-agent)
7. [Attrition Prediction — The ML Model](#7-attrition-prediction)
8. [Payroll Computation — The Formula](#8-payroll-computation)
9. [Email System](#9-email-system)
10. [Authentication & Security](#10-authentication--security)
11. [All API Endpoints](#11-all-api-endpoints)
12. [Database Schema](#12-database-schema)
13. [Frontend Pages Map](#13-frontend-pages-map)
14. [How to Demo](#14-how-to-demo)

---

## 1. System Overview

This is a **full-lifecycle people operations platform** that covers:

```
HIRING PHASE                          POST-HIRE PHASE
─────────────                         ──────────────
Job Posting                           Employee Onboarding
  ↓                                     ↓
Resume Screening (AI Agent)           Attrition Risk Prediction (ML)
  ↓                                     ↓
3-Round AI Interview                  Daily Attendance (Punch In/Out)
  ↓                                     ↓
Video Anomaly Detection               Leave Management
  ↓                                     ↓
AI Evaluation + HR Agent              Monthly Payroll (Accounts Agent)
  ↓                                     ↓
Hire Decision                         Salary Payment
```

**Three AI Agents:**
1. **HR Agent** — Screens resumes, evaluates interviews, recommends shortlists
2. **Accounts Agent** — Computes payroll, applies deductions, manages salary
3. **Anomaly Detection Agent** — Real-time behavioral analysis during interviews

---

## 2. The Complete User Journey

### Phase 1: Job Posting (HR)
1. HR logs in → Dashboard → "Post New Job"
2. Fills: title, department, location, salary, description, requirements, skills
3. On submit:
   - **AI generates 4 screening questions** from the job description (GPT-4o-mini)
   - **3-round interview pipeline auto-created** (Screening → Technical → HR/Cultural)
   - Job appears on public `/careers` page

### Phase 2: Application (Candidate)
1. Anyone browses `/careers` — no login needed
2. Clicks job → sees full description → clicks "Apply Now"
3. Redirected to register (if not logged in) → creates account → logs in
4. Application form: upload resume + answer 4 AI-generated screening questions
5. Clicks submit → **instant "Thank you"** (< 1 second response)
6. **Background (async):** AI parses resume → scores relevance → shortlists/rejects

### Phase 3: Resume Screening (AI Agent — Background)
```
Resume Text + Job Description
         ↓
    GPT-4o-mini analyzes:
    - matched_skills: ["React", "TypeScript"]
    - missing_skills: ["Docker", "AWS"]
    - experience_match: "3 years relevant"
    - relevance_score: 72%
    - recommendation: "shortlist"
         ↓
    Score ≥ 50% → Auto-shortlist → Add to Round 1 → Email sent
    Score < 50% → Submitted for HR review
```

### Phase 4: AI Interview (Candidate)
1. Candidate sees "Start Round 1: Screening" on dashboard
2. Clicks → Camera consent → ML models load (TF.js) → Fullscreen mode
3. AI speaks question (ElevenLabs TTS) → Candidate answers via microphone
4. Audio recorded → sent to backend → Whisper transcribes → AI evaluates → generates next question
5. Repeat until max questions reached
6. Final evaluation computed → score + feedback shown
7. If score ≥ 60% → auto-advanced to Round 2 → email sent

### Phase 5: Post-Interview Analytics (HR)
1. HR opens job → "Open Pipeline" → sees all candidates per round
2. Clicks candidate → sees: video recording (with anomaly overlay), audio, evaluation scores, transcript, behavior metrics
3. "Analytics" button → full timeline chart, anomaly distribution, clickable anomaly events

### Phase 6: Hiring & Onboarding
1. Candidate passes Round 3 → auto-hired OR HR manually moves
2. **Auto-onboarding triggers:**
   - Employee record created (EMP001)
   - User role: candidate → employee
   - Salary auto-filled from job posting
   - Hired email + onboarding email sent
3. Employee logs in → redirected to onboarding form
4. 4-step form: Personal → Bank → Emergency → Employee Survey
5. Survey data feeds attrition prediction model

### Phase 7: Daily Operations (Employee)
- Punch in/out from dashboard
- Request leaves (full/half day with reason)
- View attendance history + payslips

### Phase 8: Payroll (Accounts)
- Generate monthly payroll → auto-computes from attendance + leaves
- Review → Approve → Mark as Paid

---

## 3. AI Interview Engine

### How Questions Are Generated

**NOT hardcoded.** Every question is dynamically generated by GPT-4o-mini based on context.

#### First Question Generation
```
Input to GPT-4o-mini:
  - Job role: "Frontend Developer"
  - Skills: "React, TypeScript, CSS"
  - Round type: screening | technical | hr_cultural
  - Candidate's resume text (for screening round)

Output: A single question tailored to the candidate
```

#### Adaptive Follow-Up Questions
After each answer, GPT-4o-mini receives:
```
System Prompt includes:
  - Full conversation history (all Q&A so far)
  - Triggers history: ["Start Interview", "Correct detailed answer", "Uncertain partial answer"]
  - Questions asked count
  - Difficulty progression rules

Trigger-Action Rules:
  - Correct detailed answer → Ask harder question
  - Correct but short answer → Ask for more detail
  - Uncertain partial answer → Ask easier question on same topic
  - Incorrect answer → Switch to different topic
  - 2 consecutive wrong → Wrap Up (end interview)

Output Format (parsed with regex):
  Trigger: <what happened>
  Action: <what to do next>
  Difficulty level: <Easy|Intermediate|Advanced>
  Next Question: <the actual question>
```

#### Custom Questions Mode
If HR selects "Custom Questions" for a round:
- Questions served in order from the stored list
- No GPT call for question generation
- AI still evaluates each answer

### How Audio Works
```
Browser MediaRecorder (WebM/Opus, 128kbps)
  → Audio chunks accumulated in memory
  → On submit: all chunks sent as one blob to backend
  → Backend writes to temp file
  → OpenAI Whisper-1 transcribes (language=en, temperature=0)
  → Transcription fed to GPT for evaluation + next question
  → Temp file deleted
```

### How TTS Works
```
Question text → ElevenLabs API (voice: Rachel, model: eleven_monolingual_v1)
  → Returns MP3 bytes
  → Frontend plays via Audio API
  → Fallback: OpenAI TTS-1 (voice: alloy)
  → Fallback 2: Browser SpeechSynthesis API
```

---

## 4. All Evaluation Metrics Explained

### 4.1 Screening Round Metrics (Round 1)

| Metric | Range | What It Measures |
|--------|-------|-----------------|
| **resumeAccuracy** | 0-10 | How well the candidate's answers match their resume claims |
| **communicationClarity** | 0-10 | How clearly and articulately they communicated |
| **experienceDepth** | 0-10 | Depth of real experience demonstrated (not surface level) |
| **proficiencyScore** | 0-100 | Overall screening score |
| **strongTopics** | array | Topics where candidate was convincing |
| **weakTopics** | array | Topics where claims seemed weak |
| **feedback** | text | 3-5 sentence constructive assessment |

**Scoring guidelines given to GPT:**
- 80-100: Excellent — answers match resume, clear communication, detailed
- 60-79: Good — relevant answers, some detail, mostly consistent
- 40-59: Average — vague answers, some relevance but lacking specifics
- 20-39: Weak — answers don't match resume, very vague
- 0-19: Very poor — no relevant information, nonsensical

### 4.2 Technical Round Metrics (Round 2)

| Metric | Range | What It Measures |
|--------|-------|-----------------|
| **techAccuracy** | 0-10 | Correctness of technical answers |
| **conceptCoverage** | 0-10 | Breadth of concepts covered across skills |
| **practicalKnowledge** | 0-10 | Real hands-on experience vs. textbook knowledge |
| **proficiencyScore** | 0-100 | Overall technical proficiency |
| **strongTopics** | array | Technical areas where candidate excelled |
| **weakTopics** | array | Technical areas where candidate struggled |
| **feedback** | text | Constructive technical assessment |

**Scoring guidelines:**
- 80-100: Deep knowledge, correct answers, clear explanations
- 60-79: Solid knowledge, mostly correct, some gaps
- 40-59: Basic understanding, significant gaps
- 20-39: Mostly incorrect or very vague
- 0-19: No relevant technical knowledge

### 4.3 HR/Cultural Round Metrics (Round 3)

| Metric | Range | What It Measures |
|--------|-------|-----------------|
| **culturalFit** | 0-10 | Alignment with professional values and team dynamics |
| **teamworkOrientation** | 0-10 | Evidence of real collaboration and team skills |
| **communicationSkills** | 0-10 | Clarity, empathy, professional communication |
| **leadershipPotential** | 0-10 | Initiative, ownership, leadership traits |
| **proficiencyScore** | 0-100 | Overall cultural fit score |
| **strongTopics** | array | Behavioral areas where candidate excelled |
| **weakTopics** | array | Behavioral areas needing improvement |
| **feedback** | text | Behavioral assessment |

**Scoring guidelines:**
- 80-100: Excellent STAR examples, strong communication, genuine insight
- 60-79: Relevant examples, decent communication
- 40-59: Attempted to answer but vague
- 20-39: Off-topic, no real examples
- 0-19: Nonsensical, disengaged

### 4.4 Resume Relevance Score (Application Screening)

| Metric | Range | What It Measures |
|--------|-------|-----------------|
| **relevance_score** | 0-100 | How well resume matches the job posting |
| **matched_skills** | array | Skills from JD found in resume |
| **missing_skills** | array | Required skills NOT in resume |
| **experience_match** | text | Assessment of experience relevance |
| **recommendation** | enum | "shortlist" / "review" / "reject" |
| **reasoning** | text | 2-3 sentence explanation |

Threshold: **≥ 50% → auto-shortlist**, < 50% → HR review

### 4.5 Video Anomaly Detection Metrics

| Metric | Range | How It's Computed |
|--------|-------|------------------|
| **Eye Contact** | 0-100% | Iris position (landmarks 468, 473) relative to eye corners (33, 133, 263, 362). Horizontal deviation (70% weight) + vertical deviation (30% weight). Score = (1 - combinedDeviation × 2.5) × 100 |
| **Posture** | 0-100% | Shoulder tilt (landmarks 11, 12) × 300 penalty + Head forward (ears 7,8 vs shoulders) × 150 penalty + Lateral lean (shoulder-hip alignment) × 200 penalty. Score = 100 - penalties |
| **Engagement** | 0-100% | Composite: 40% eye contact + 30% posture + 20% head nod frequency + 10% facial expressiveness |
| **Confidence** | 0-100% | 50% posture + 30% expressiveness - fidget penalty + 20 base |
| **Emotion** | label | Facial landmarks: smile curvature > 0.008 = happy, mouth openness > 0.05 = surprised, brow raise < 0.015 = confused, smile < -0.003 = nervous, else neutral |
| **Face Count** | integer | BlazeFace multi-face detector. 0 = not visible, 1 = normal, 2+ = someone else in frame |
| **Behavior Grade** | A+ to F | Average of all 4 scores: A+ (≥90), A (≥80), B (≥70), C (≥60), D (≥50), F (<50) |

**Anomaly Flags (triggered automatically):**
| Condition | Severity | Message |
|-----------|----------|---------|
| face_count > 1 | critical | "Multiple faces detected" |
| face_count == 0 | warning | "Candidate not visible" |
| eye_contact < 20% | warning | "Prolonged gaze away" |
| posture < 30% | info | "Posture deterioration" |

### 4.6 Attrition Risk Prediction Metrics

| Factor | Weight | Risk Impact |
|--------|--------|------------|
| Age < 25 | high | +12% risk |
| Age 25-30 | low | +5% risk |
| Age > 40 | low | -5% risk |
| Income < ₹20K/mo | high | +18% risk |
| Income < ₹40K/mo | medium | +8% risk |
| Income > ₹80K/mo | medium | -8% risk |
| Job satisfaction 1 | high | +15% risk |
| Job satisfaction 4 | medium | -8% risk |
| Regular overtime | high | +10% risk |
| Work-life balance 1 | high | +12% risk |
| Work-life balance 4 | medium | -6% risk |
| 5+ companies worked | high | +12% risk |
| 3-4 companies | medium | +5% risk |
| Commute > 25km | medium | +8% risk |
| New hire (year 0) | low | +5% risk |
| Tenure > 5 years | medium | -5% risk |
| Low job involvement | high | +10% risk |
| High job involvement | medium | -5% risk |

Base score: 20%. Final clamped to 0-100%.
Categories: Low (< 30%), Medium (30-59%), High (≥ 60%)

---

## 5. Video Anomaly Detection

### Architecture
```
Candidate's Browser
  ├─ getUserMedia({video: 640×480})
  ├─ Hidden processing video (off-screen, full resolution for TF.js)
  ├─ Canvas (640×480) — video frames + overlay drawn here
  │
  ├─ Every 2nd frame (~15fps):
  │   ├─ MediaPipe Face Mesh → 468 landmarks → eye contact + emotion
  │   ├─ BlazePose → 33 landmarks → posture
  │   └─ BlazeFace → face count
  │
  ├─ Every 5 seconds: POST scores to /behavior/scores
  │
  ├─ canvas.captureStream(15fps) → MediaRecorder records canvas
  │   (overlay is BURNED INTO the recording)
  │
  └─ On interview end: recording uploaded to /session/save-video
```

### Scoring Algorithms (from `utils/scoring.ts`)

**Eye Contact:**
```
1. Get iris centers: landmarks[468] (left), landmarks[473] (right)
2. Normalize to 0-1 range (pixel / video_width)
3. Calculate iris position within eye corners
4. Horizontal deviation from center: leftIrisPos - 0.5
5. Vertical deviation: iris Y within eye height
6. Combined: horizontal × 0.7 + vertical × 0.3
7. Score = (1 - combined × 2.5) × 100
```

**Posture:**
```
1. Get shoulders (11, 12), ears (7, 8), hips (23, 24)
2. Shoulder tilt: abs(left.y - right.y) × 300
3. Head forward: abs(ear_mid.y - shoulder_mid.y) > 0.12 → penalty
4. Lean: abs(shoulder.x - hip.x) + abs(ear.x - shoulder.x) × 200
5. Score = 100 - all penalties
```

### WebSocket Live Streaming
```
HR opens /hr/live/{sessionId}
  ↓
WebSocket connects to ws://localhost:8001/behavior/live/session_{id}
  ↓
Every score POST from candidate browser triggers:
  → manager.broadcast_to_interview(id, live_data)
  → All connected HR dashboards receive real-time scores
  ↓
HR sees: rolling line chart, anomaly log, emotion, face count
```

---

## 6. HR Agent

### Auto-Decision Flow
```
Candidate completes interview round
  ↓
_auto_agent_pipeline() fires automatically
  ↓
Reads: evaluation.proficiencyScore
  ↓
Score ≥ 60%:
  ├─ shortlist_status = "approved"
  ├─ Create next round session
  ├─ Update candidate_pipeline.current_round
  ├─ Send shortlist email
  ├─ Create notification
  └─ Log AgentAction (type="auto_evaluate", confidence=score)
  ↓
Score < 60%:
  ├─ shortlist_status = "rejected"
  ├─ Send rejection email
  ├─ Create notification
  └─ Log AgentAction
  ↓
Round 3 pass:
  ├─ overall_status = "hired"
  ├─ Create Employee record (EMP001)
  ├─ Change user role → employee
  ├─ Send hired email + onboarding email
  └─ Attrition risk computed
```

### Manual Override
HR can always click "Move to Next Stage" on any completed candidate, regardless of score. This triggers the same pipeline (create session, notify, advance).

---

## 7. Attrition Prediction

### The Trained Model
- **Framework:** AutoGluon Tabular (stacking ensemble)
- **Best model:** WeightedEnsemble_L2
- **Base models:** LightGBM, XGBoost, CatBoost, Random Forest, ExtraTrees, Neural Net
- **Accuracy:** 68.4%
- **Features:** 24 (Age, Income, Satisfaction, Overtime, etc.)

### How We Use It
Since AutoGluon is heavy (2GB+), we DON'T load the full model at runtime. Instead:
1. Extracted `feature_importance` from `training_results.json`
2. Built a **weighted scoring function** that approximates the model
3. Employee fills survey during onboarding → real data feeds the scoring
4. Score computed instantly, no ML inference needed

### Data Collection Points
| Feature | Collected At | Source |
|---------|-------------|--------|
| Age | Onboarding survey | Employee input |
| MonthlyIncome | Job posting | salary_range parsed |
| JobSatisfaction | Onboarding survey | 1-4 scale |
| OverTime | Onboarding survey | Yes/No |
| WorkLifeBalance | Onboarding survey | 1-4 scale |
| NumCompaniesWorked | Onboarding survey | Employee input |
| DistanceFromHome | Onboarding survey | Employee input |
| JobInvolvement | Onboarding survey | 1-4 scale |
| YearsAtCompany | Auto-computed | 0 (new hire) |
| Department | Job posting | Auto-filled |
| Designation | Job posting | Auto-filled (job title) |

---

## 8. Payroll Computation

### The Formula
```
per_day_rate = monthly_salary / 22 (working days)

base_pay = per_day_rate × days_present_effective
  where days_present_effective = full_days + (half_days × 0.5)

approved_leave_pay = per_day_rate × approved_leave_days
  (Paid leaves — no deduction)

overtime_pay = overtime_hours × (per_day_rate / 8) × 1.5
  (1.5x hourly rate for hours beyond 8)

absence_deduction = per_day_rate × rejected_leave_days
  (Leave requested but rejected by HR)

unlogged_deduction = per_day_rate × unlogged_days
  (Days with no punch-in AND no leave request)

total_deductions = absence_deduction + unlogged_deduction

NET SALARY = base_pay + approved_leave_pay + overtime_pay - total_deductions
```

### Example
```
Monthly salary: ₹60,000
Per day: ₹2,727

Month: 22 working days
- 18 days present (punched in/out)
- 2 days approved leave
- 1 day rejected leave (didn't come)
- 1 day no punch-in, no leave request

base_pay = 2,727 × 18 = ₹49,086
approved_leave_pay = 2,727 × 2 = ₹5,454
overtime (3 hours total) = 3 × (2,727/8) × 1.5 = ₹1,534
absence_deduction = 2,727 × 1 = ₹2,727
unlogged_deduction = 2,727 × 1 = ₹2,727

NET = 49,086 + 5,454 + 1,534 - 2,727 - 2,727 = ₹50,620
```

---

## 9. Email System

### Emails Sent Automatically

| Event | Email | Template |
|-------|-------|---------|
| Resume shortlisted (≥50%) | Shortlist email | "You've been shortlisted for Round 1" + login CTA |
| Round passed (≥60%) | Advance email | "Advanced to Round X" + score |
| Round failed (<60%) | Rejection email | "Score was X/100, threshold is 60%" |
| All 3 rounds passed | Hired email | "Welcome aboard!" + score |
| Employee created | Onboarding email | "Complete your onboarding" + link |
| Leave approved | Notification email | "Leave on X approved" |
| Leave rejected | Notification email | "Leave rejected, absence unpaid" |

### Configuration
```
SMTP: Gmail (smtp.gmail.com:587)
Auth: App password (not regular password)
Sender: configurable via SMTP_FROM_NAME
```

---

## 10. Authentication & Security

### Role Hierarchy
```
Super Admin (seeded on startup)
  ├─ Creates Admin (HR) accounts
  ├─ Creates other Super Admin (Accounts) accounts
  ├─ Full platform access
  └─ User management (change roles, delete users)

Admin (HR)
  ├─ Post jobs, manage candidates
  ├─ Approve/reject leaves
  ├─ View employee records, analytics
  └─ Cannot create other admins

Employee (auto-created on hire)
  ├─ Punch in/out, request leaves
  ├─ View own payslips, profile
  └─ Onboarding form

Candidate (self-register)
  ├─ Apply to jobs, take interviews
  ├─ View own results
  └─ Auto-upgraded to Employee when hired
```

### JWT Token Flow
```
POST /auth/token (email + password)
  → Server validates → creates JWT with {sub, role, user_id, exp}
  → Token returned to frontend
  → Stored in localStorage
  → Attached as Authorization: Bearer <token> on every API call
  → Server decodes → extracts user → checks role guards
```

### Public vs Protected Endpoints
- `/auth/signup`, `/auth/token` — public
- `/jobs/public`, `/jobs/public/{id}` — public (careers page)
- `/careers/*` pages — public (no login)
- Everything else — requires JWT

---

## 11. All API Endpoints

### Auth (`/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/signup` | Public | Register as candidate |
| POST | `/auth/token` | Public | Login, get JWT |
| POST | `/auth/create-user` | Super Admin | Create admin/accounts user |
| GET | `/auth/users` | Super Admin | List all users |
| PUT | `/auth/users/{id}/role` | Super Admin | Change user role |
| DELETE | `/auth/users/{id}` | Super Admin | Delete user |

### Jobs (`/jobs`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/jobs/public` | Public | List active jobs (careers page) |
| GET | `/jobs/public/{id}` | Public | Job detail |
| POST | `/jobs/` | Admin | Create job posting |
| GET | `/jobs/` | Admin | List own jobs |
| GET | `/jobs/{id}/applications` | Admin | List applications |
| GET | `/jobs/{id}/rounds` | Admin | Get round configs |
| PUT | `/jobs/{id}/rounds/{round}` | Admin | Update round questions |
| POST | `/jobs/{id}/apply` | Candidate | Apply with resume |
| POST | `/jobs/{id}/close` | Admin | Close job |
| POST | `/jobs/{id}/manual-shortlist/{app_id}` | Admin | Manual shortlist |
| DELETE | `/jobs/{id}` | Admin | Delete job |

### Pipelines (`/pipelines`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/pipelines/` | Admin | Create pipeline |
| GET | `/pipelines/` | Any auth | List pipelines |
| GET | `/pipelines/{id}` | Any auth | Pipeline detail |
| POST | `/pipelines/{id}/candidates` | Admin | Assign candidate |
| POST | `/pipelines/{id}/advance/{round}` | Admin | Bulk advance |
| POST | `/pipelines/{id}/manual-advance/{candidate}` | Admin | Manual advance |
| DELETE | `/pipelines/{id}` | Admin | Delete pipeline |

### Interview Session (`/session`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/session/start` | Candidate | Start interview, get first question |
| POST | `/session/audio-chunk` | Candidate | Send audio chunk |
| POST | `/session/audio-finalize` | Candidate | Transcribe + get next question |
| POST | `/session/evaluate` | Candidate | Final evaluation |
| POST | `/session/save-recording` | Candidate | Save audio recording |
| POST | `/session/save-video` | Candidate | Save video recording |
| GET | `/session/video/{id}` | Any | Serve video file |
| GET | `/session/audio/{id}` | Any | Serve audio file |

### Behavior (`/behavior`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/behavior/scores` | Any | Submit behavior score |
| POST | `/behavior/scores/batch` | Any | Batch submit |
| GET | `/behavior/summary/{id}` | Any | Aggregated summary |
| GET | `/behavior/timeline/{id}` | Any | Timestamped history |
| GET | `/behavior/report/{id}` | Any | Full report |
| POST | `/behavior/tab-switch/{id}` | Any | Track tab switch |
| WS | `/behavior/live/{id}` | Any | WebSocket live stream |
| GET | `/behavior/active` | Any | Active sessions |

### Agent (`/agent`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/agent/analyze-round` | Admin | Trigger HR agent analysis |
| GET | `/agent/recommendations/{pipeline}/{round}` | Admin | Get recommendations |
| POST | `/agent/recommendations/{id}/approve` | Admin | Approve recommendation |
| POST | `/agent/recommendations/{id}/reject` | Admin | Reject recommendation |
| POST | `/agent/final-report/{pipeline}` | Admin | Generate final report |
| GET | `/agent/actions` | Admin | List all agent actions |

### Employees (`/employees`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/employees/me` | Employee | Own record |
| POST | `/employees/onboarding` | Employee | Submit onboarding form |
| GET | `/employees/` | Admin | List all employees |
| GET | `/employees/{id}` | Admin | Employee detail |
| PUT | `/employees/{id}` | Admin | Update employee |

### Attendance (`/attendance`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/attendance/punch-in` | Employee | Punch in |
| POST | `/attendance/punch-out` | Employee | Punch out |
| GET | `/attendance/today` | Employee | Today's log |
| GET | `/attendance/summary` | Employee | Weekly + monthly summary |
| GET | `/attendance/history` | Employee | Monthly history |
| GET | `/attendance/all` | Admin | All employees attendance |

### Payroll (`/payroll`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/payroll/generate` | Super Admin | Generate monthly payroll |
| GET | `/payroll/` | Super Admin | List payrolls |
| GET | `/payroll/{id}` | Super Admin | Payroll detail |
| PUT | `/payroll/{id}` | Super Admin | Edit payroll |
| POST | `/payroll/{id}/approve` | Super Admin | Approve payroll |
| POST | `/payroll/{id}/pay` | Super Admin | Mark as paid |
| GET | `/payroll/summary` | Super Admin | Monthly summary |
| GET | `/payroll/employee/me` | Employee | Own payslips |

### Leaves (`/leaves`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/leaves/apply` | Employee | Request leave |
| GET | `/leaves/my-leaves` | Employee | Own leaves + balance |
| GET | `/leaves/pending` | Admin | Pending requests |
| GET | `/leaves/all` | Admin | All requests |
| POST | `/leaves/{id}/approve` | Admin | Approve leave |
| POST | `/leaves/{id}/reject` | Admin | Reject leave |

### Other
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/tts/synthesize` | Any auth | Text-to-speech |
| GET | `/notifications/` | Any auth | List notifications |
| POST | `/notifications/{id}/read` | Any auth | Mark as read |
| GET | `/notifications/unread-count` | Any auth | Badge count |
| GET | `/candidates/profile` | Candidate | Own profile |
| PUT | `/candidates/profile` | Candidate | Update profile |
| POST | `/candidates/resume` | Candidate | Upload resume |
| GET | `/candidates/pipeline-status` | Candidate | Interview progress |
| GET | `/candidates/applications` | Candidate | Job applications |
| GET | `/health` | Public | Health check |

---

## 12. Database Schema

### 16 Tables

```sql
users (id, email, password_hash, name, role, phone, resume_path, resume_text, profile_data)
organizations (id, name, slug, created_by, settings)
interview_pipelines (id, title, job_role, skills, description, status, created_by)
candidate_pipelines (id, pipeline_id, candidate_id, current_round, overall_status)
interviews (id, title, job_role, skills, max_questions, round_type, round_number, pipeline_id, custom_questions, question_source)
interview_sessions (id, interview_id, candidate_id, status, conversation_history, triggers, evaluation, behavior_summary, shortlist_status, tab_switch_count, recording_path, video_path)
agent_actions (id, agent_type, action_type, target_type, target_id, pipeline_id, round_number, payload, result, status, confidence, approval_status)
notifications (id, user_id, type, title, message, read, link)
behavior_scores (id, interview_id, eye_contact_score, posture_score, engagement_score, confidence_score, emotion_label, face_count, anomaly_flags)
behavior_summaries (id, interview_id, avg_eye_contact, avg_posture, avg_engagement, avg_confidence, total_anomalies, anomaly_timeline, dominant_emotion, behavior_grade)
job_postings (id, title, department, location, job_type, experience_level, salary_range, description, requirements, skills, screening_questions, pipeline_id)
job_applications (id, job_id, candidate_id, resume_path, resume_text, screening_answers, relevance_score, relevance_analysis, status)
employees (id, employee_id, user_id, department, designation, salary, bank_details, emergency_contact, onboarding_status, attrition_risk_score, attrition_factors, total_leaves, leaves_used, leaves_remaining)
work_logs (id, employee_id, date, punch_in, punch_out, total_hours, overtime, status)
payrolls (id, employee_id, month, year, days_present, days_absent, base_salary, overtime_pay, deductions, net_salary, breakdown, status)
leave_requests (id, employee_id, leave_date, leave_type, reason, status, approved_by)
```

---

## 13. Frontend Pages Map

### Public (no login)
- `/careers` — Job board
- `/careers/[id]` — Job detail
- `/careers/[id]/apply` — Application form (requires login)
- `/login` — Sign in
- `/register` — Create candidate account

### Candidate
- `/candidate/dashboard` — Applications + interview progress
- `/candidate/interview/[id]` — Take interview (fullscreen)
- `/candidate/profile` — Edit profile + upload resume

### Employee
- `/employee/dashboard` — Punch in/out + stats
- `/employee/onboarding` — 4-step onboarding form
- `/employee/attendance` — Monthly attendance history
- `/employee/leaves` — Leave balance + request leaves
- `/employee/payslips` — Salary history
- `/employee/profile` — Employee profile

### HR Admin
- `/hr/dashboard` — Jobs overview + notifications
- `/hr/jobs` — Job postings list
- `/hr/jobs/new` — Create job posting
- `/hr/jobs/[id]` — Job detail + applications + round config
- `/hr/candidates` — All candidates across jobs
- `/hr/employees` — All employees
- `/hr/employees/[id]` — Employee detail + attrition risk
- `/hr/leaves` — Leave approval
- `/hr/pipelines/[id]` — Pipeline detail (video, analytics, agent)
- `/hr/interviews/[id]` — Interview detail (video, scores, move stage)
- `/hr/live/[id]` — Live interview monitoring
- `/hr/analytics/[id]` — Post-interview analytics

### Accounts (Super Admin)
- `/admin/dashboard` — Platform overview
- `/admin/users` — User management (create/edit/delete)
- `/admin/payroll` — Generate, approve, pay salaries
- `/admin/attendance` — All employee attendance

---

## 14. How to Demo

### Quick Demo Script (10 minutes)

**Setup (1 min):**
1. Delete DB, restart backend, clear `.next`, start frontend
2. Backend auto-seeds super admin: `admin@verticalai.com` / `admin123`

**Super Admin → Create HR (1 min):**
1. Login as super admin
2. Go to User Management → Create staff account (HR Admin)

**HR → Post Job (2 min):**
1. Login as HR → Post New Job
2. Fill details → AI generates screening questions → 3 rounds created
3. Show round question configuration (AI/Custom toggle)

**Candidate → Apply (2 min):**
1. Open `/careers` (incognito) → click job → Apply
2. Register → login → upload resume → answer questions → submit
3. Show "Thank you" instant response
4. Show backend: `[Agent] Background analysis done: → 72% → shortlisted`

**Candidate → Interview (3 min):**
1. Candidate dashboard → Start Round 1 → consent → camera on
2. Show: question spoken by TTS → answer → transcription → next question
3. Show: anomaly detection running (small camera preview)
4. After evaluation → show score + transcript

**HR → Review (2 min):**
1. Switch to HR → Open Pipeline → candidate row
2. Show: video with anomaly overlay, analytics page
3. Show: "Move to Next Stage" / auto-advanced
4. Show: employee created after Round 3

**Employee → Onboarding (1 min):**
1. Login as employee → onboarding form → punch in/out
2. Show: leave request → HR approval

**Accounts → Payroll (1 min):**
1. Login as super admin → Payroll → Generate → Show breakdown
2. Show: deductions for absent days

### Key Talking Points for Judges
1. **"Everything is AI-generated, not hardcoded"** — questions, evaluations, screening, recommendations
2. **"Video anomaly detection runs in the browser"** — no GPU server, privacy-friendly, overlay burned into recording
3. **"Three AI agents work autonomously"** — HR agent screens + shortlists, anomaly agent monitors, accounts agent computes payroll
4. **"Full lifecycle"** — job posting to salary payment in one platform
5. **"Industry-level auth"** — no one can self-assign admin, super admin seeds on startup, JWT role-based
6. **"Balanced evaluation"** — 5-tier scoring guidelines prevent AI from being too harsh or lenient
7. **"Real attrition prediction"** — trained model's feature importance, real data from employee survey
