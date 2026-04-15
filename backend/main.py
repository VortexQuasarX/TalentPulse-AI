import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import auth, interviews, interview_session, tts, pipelines, candidates, agent_actions, notifications, behavior, jobs, employees, attendance, payroll, leaves

app = FastAPI(title="AI Interview Platform", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(pipelines.router)
app.include_router(interviews.router)
app.include_router(interview_session.router)
app.include_router(tts.router)
app.include_router(candidates.router)
app.include_router(agent_actions.router)
app.include_router(notifications.router)
app.include_router(behavior.router)
app.include_router(jobs.router)
app.include_router(employees.router)
app.include_router(attendance.router)
app.include_router(payroll.router)
app.include_router(leaves.router)


@app.on_event("startup")
def startup():
    init_db()
    os.makedirs("recordings", exist_ok=True)
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("uploads/resumes", exist_ok=True)

    # Seed default super_admin if none exists
    from app.database import SessionLocal
    from app.models import User
    db = SessionLocal()
    try:
        sa = db.query(User).filter(User.role == "super_admin").first()
        if not sa:
            db.add(User(
                email="admin@verticalai.com",
                name="System Admin",
                password_hash=User.hash_password("admin123"),
                role="super_admin",
            ))
            db.commit()
            print("[Startup] Default super_admin created: admin@verticalai.com / admin123")
        else:
            print(f"[Startup] Super admin exists: {sa.email}")
    except Exception as e:
        print(f"[Startup] Seed error: {e}")
    finally:
        db.close()


@app.get("/health")
async def health():
    return {"status": "ok"}
