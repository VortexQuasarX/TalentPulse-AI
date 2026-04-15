# AI-Powered People Operations System

End-to-end hiring intelligence platform that automates the complete employee lifecycle — from job posting to payroll processing — using AI agents, real-time video anomaly detection, and adaptive interviews.

## The Complete Pipeline

```
Job Posting → Candidate Applies → AI Scores Resume → Auto-Shortlist →
3-Round AI Interview (Screening → Technical → HR) → Anomaly Detection →
Auto-Evaluate → HR Agent Recommends → Hired → Employee Onboarding →
Daily Punch In/Out → Leave Management → Monthly Payroll → Salary Paid
```

## Key Features

### 1. Public Careers Portal
- Public job board at `/careers` — no login required to browse
- HR creates job postings with title, department, salary, description, requirements
- AI auto-generates screening questions from the job description
- 3-round interview pipeline auto-created per job

### 2. AI-Powered Application Screening
- Candidate uploads resume + answers AI-generated screening questions
- **Instant "Thank you"** response — AI analysis runs in background
- Resume parsed and scored against JD (0-100% relevance)
- Score ≥ 50%: auto-shortlisted for Round 1, email sent
- Score < 50%: submitted for HR manual review
- HR can manually shortlist any candidate regardless of score

### 3. 3-Round Adaptive AI Interview
- **Round 1 — Screening**: Resume-based questions, verifies claimed experience
- **Round 2 — Technical**: Adaptive difficulty (Easy → Intermediate → Advanced), skill rotation, trigger-based progression
- **Round 3 — HR & Cultural**: STAR method behavioral questions (teamwork, leadership, communication)
- HR can provide custom questions OR let AI generate per round
- Speech-to-Text via OpenAI Whisper | Text-to-Speech via ElevenLabs
- Full interview transcript with difficulty badges
- Balanced evaluation: 5-tier scoring (0-19 to 80-100)

### 4. Real-Time Video Anomaly Detection
- Runs in browser via TensorFlow.js — no server GPU needed
- **MediaPipe Face Mesh** (468 landmarks) → eye contact + emotion detection
- **BlazePose** (33 landmarks) → posture analysis
- **BlazeFace** → multi-face detection
- Detection overlay **burned into video recording** (visible on playback)
- Anomaly flags: multiple faces, gaze away, poor posture, candidate not visible
- Tab switch tracking
- Scores POST to backend every 5 seconds via REST + WebSocket live streaming

### 5. HR Agent (AI-Powered, Approval-Gated)
- Auto-analyzes scores when candidate completes any round
- Score ≥ 60%: auto-shortlist → auto-create next round → email sent
- Score < 60%: auto-reject → email sent
- HR can manually "Move to Next Stage" regardless of score
- Final round pass → auto-hire → employee record created → onboarding triggered
- Notifications to HR for every agent action

### 6. HR Live Monitoring
- WebSocket real-time score streaming during interviews
- Rolling line chart (eye contact, posture, engagement, confidence)
- Timestamped anomaly log with severity levels
- LIVE button on pipeline page for in-progress interviews

### 7. Post-Interview Analytics
- Video playback with **synchronized anomaly overlay** (scores update as video plays)
- Score timeline chart with video position marker
- Anomaly distribution bar chart
- Clickable anomaly events → jump to video timestamp
- Behavior grade (A+ through F)

### 8. Employee Onboarding
- Auto-triggered when candidate is hired (auto or manual)
- Employee record created with auto-generated ID (EMP001, EMP002...)
- Salary, department, designation auto-filled from job posting
- 4-step onboarding form: Personal → Bank → Emergency Contact → Employee Survey
- Employee survey data feeds attrition prediction model
- Onboarding email with welcome message + link
- User role auto-changes: candidate → employee

### 9. Attrition Risk Prediction
- Uses trained AutoGluon model's feature importance weights
- Computed from employee survey: age, income, satisfaction, overtime, work-life balance, job changes, commute
- Risk score 0-100% with category (Low/Medium/High)
- Factor-by-factor breakdown (what increases/decreases risk)
- Visible on HR employee detail page

### 10. Attendance & Work Hours
- Employee punch in/out from dashboard
- Daily work log: punch times, total hours, overtime (>8h), status
- Weekly + monthly summary with stats
- HR views all employee attendance with date range filter
- Half day detection (<4 hours)

### 11. Leave Management
- 15 paid leaves per year per employee
- Employee requests leave: date, full/half day, reason
- HR approves or rejects from Leave Requests page
- Approved = paid leave (no salary deduction)
- Rejected = salary deducted in payroll
- Balance tracking (total, used, remaining)
- Notifications on both sides

### 12. Payroll Processing (Accounts Agent)
- Monthly payroll auto-computed from attendance + leaves
- **Salary formula**: `(monthly / 22) × days_present + approved_leave_pay + overtime × 1.5x - deductions`
- Deductions: rejected leave days + unlogged days (no punch-in, no leave request)
- Accounts generates → reviews → approves → marks as paid
- Full breakdown: base pay, overtime, leave pay, absence deductions
- Employee views own payslips

### 13. Industry-Level Auth & User Management
- Public signup = candidates only (no role selector)
- Default super admin seeded on startup: `admin@verticalai.com` / `admin123`
- Super admin creates HR/Accounts staff via User Management page
- Role hierarchy: Super Admin → Admin (HR) → Employee → Candidate
- JWT auth with role-based routing and guards
- SMTP email notifications (Gmail) for shortlisting, rejection, hiring, onboarding

## User Roles

| Role | How Created | Access |
|------|------------|--------|
| **Candidate** | Self-register at `/register` | Apply to jobs, take interviews, view results |
| **Admin (HR)** | Created by super admin | Post jobs, manage candidates, approve leaves, view analytics |
| **Accounts** | Created by super admin | Payroll, attendance overview, user management |
| **Employee** | Auto-created when hired | Punch in/out, request leaves, view payslips, onboarding |
| **Super Admin** | Seeded on startup | Full platform access + user management |

## Tech Stack

### Backend
| Technology | Purpose |
|-----------|---------|
| FastAPI | API framework (75+ endpoints) |
| SQLAlchemy 2.0 | ORM |
| SQLite | Database (PostgreSQL-ready) |
| OpenAI GPT-4o-mini | Question gen, evaluation, agent analysis |
| OpenAI Whisper | Speech-to-text |
| ElevenLabs | Text-to-speech |
| python-jose + bcrypt | JWT auth + password hashing |
| WebSocket | Real-time behavior score streaming |
| Gmail SMTP | Email notifications |

### Frontend
| Technology | Purpose |
|-----------|---------|
| Next.js 14 | React framework (App Router, 25+ pages) |
| TypeScript | Type safety |
| Tailwind CSS | Styling (Modern SaaS design) |
| TensorFlow.js | Browser-based ML inference |
| MediaPipe | Face mesh + pose + face detection |
| Recharts | Analytics charts |

### ML Models
| Model | Purpose | Runs Where |
|-------|---------|-----------|
| MediaPipe Face Mesh | 468 face landmarks, eye tracking, emotion | Browser |
| BlazePose | 33 body keypoints, posture analysis | Browser |
| BlazeFace | Multi-face detection | Browser |
| AutoGluon ensemble | Attrition risk prediction | Backend (feature weights) |

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- OpenAI API key
- ElevenLabs API key (optional)
- Gmail app password (for emails)

### Setup

```bash
# Clone
git clone https://github.com/likhith05072002/AI-powered-people-operation-system-pipeline-.git
cd AI-interview

# Backend
cd backend
cp .env.example .env
# Edit .env with your API keys
pip install -r requirements.txt
python -B -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload

# Frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3001

### Default Login
- **Super Admin**: `admin@verticalai.com` / `admin123`
- Create HR/Accounts users from User Management page

### Full Test Flow
1. Login as super admin → create HR account
2. Login as HR → post job → set round questions
3. Open `/careers` → apply as candidate → upload resume
4. AI scores resume in background → auto-shortlist email
5. Candidate takes 3-round interview (camera + mic)
6. HR views video with anomaly overlay + analytics
7. Auto-advance on pass / manual "Move to Next Stage"
8. Candidate hired → employee created → onboarding email
9. Employee completes onboarding form + survey
10. Employee punches in/out daily
11. Employee requests leaves → HR approves/rejects
12. Accounts generates monthly payroll → approves → pays

## Database (16 tables)

`users` · `organizations` · `interview_pipelines` · `candidate_pipelines` · `interviews` · `interview_sessions` · `agent_actions` · `notifications` · `behavior_scores` · `behavior_summaries` · `job_postings` · `job_applications` · `employees` · `work_logs` · `payrolls` · `leave_requests`

## API Endpoints (75+)

| Category | Count | Examples |
|----------|-------|---------|
| Auth | 6 | signup, login, create-user, users, role change, delete |
| Jobs | 10 | CRUD, public listing, apply, rounds config, manual shortlist |
| Pipelines | 5 | CRUD, assign candidates, advance rounds, manual advance |
| Interview Session | 6 | start, audio-chunk, finalize, evaluate, save-recording, save-video |
| Behavior | 8 | scores, batch, summary, timeline, report, tab-switch, live WS |
| Agent | 5 | analyze-round, recommendations, approve, reject, final-report |
| Employees | 5 | me, onboarding, list, detail, update |
| Attendance | 7 | punch-in, punch-out, today, summary, history, all |
| Payroll | 8 | generate, list, detail, edit, approve, pay, summary, my-payslips |
| Leaves | 6 | apply, my-leaves, pending, all, approve, reject |
| Notifications | 3 | list, mark-read, unread-count |
| TTS | 1 | synthesize |
| Candidates | 3 | profile, resume, pipeline-status, applications |

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐
│  Next.js 14     │────>│  FastAPI Backend      │
│  25+ pages      │HTTP │  75+ endpoints        │
│  TF.js ML       │     │  16 DB tables         │
│  Tailwind CSS   │     │  AI agents            │
└─────────────────┘     └──────────┬───────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
               ┌────▼────┐  ┌─────▼─────┐  ┌────▼────┐
               │ OpenAI  │  │ ElevenLabs│  │ Gmail   │
               │ GPT-4o  │  │ TTS       │  │ SMTP    │
               │ Whisper  │  └───────────┘  └─────────┘
               └─────────┘
```

## License

MIT
