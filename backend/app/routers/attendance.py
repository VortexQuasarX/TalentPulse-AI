from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Employee, WorkLog, User
from app.schemas import WorkLogResponse, WorkSummaryResponse
from app.security import get_current_user, require_employee, require_admin, require_employee_or_admin

router = APIRouter(prefix="/attendance", tags=["attendance"])


def _get_employee(user_id: int, db: Session) -> Employee:
    emp = db.query(Employee).filter(Employee.user_id == user_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee record")
    if emp.onboarding_status != "completed":
        raise HTTPException(status_code=400, detail="Complete onboarding first")
    return emp


@router.post("/punch-in")
async def punch_in(db: Session = Depends(get_db), current_user: User = Depends(require_employee)):
    emp = _get_employee(current_user.id, db)
    today = datetime.utcnow().strftime("%Y-%m-%d")

    log = db.query(WorkLog).filter(WorkLog.employee_id == emp.id, WorkLog.date == today).first()
    if log and log.punch_in:
        raise HTTPException(status_code=400, detail="Already punched in today")

    if not log:
        log = WorkLog(employee_id=emp.id, date=today)
        db.add(log)

    log.punch_in = datetime.utcnow()
    log.status = "present"
    db.commit()
    return {"message": "Punched in", "punch_in": log.punch_in.isoformat(), "date": today}


@router.post("/punch-out")
async def punch_out(db: Session = Depends(get_db), current_user: User = Depends(require_employee)):
    emp = _get_employee(current_user.id, db)
    today = datetime.utcnow().strftime("%Y-%m-%d")

    log = db.query(WorkLog).filter(WorkLog.employee_id == emp.id, WorkLog.date == today).first()
    if not log or not log.punch_in:
        raise HTTPException(status_code=400, detail="Must punch in first")
    if log.punch_out:
        raise HTTPException(status_code=400, detail="Already punched out today")

    log.punch_out = datetime.utcnow()
    log.total_hours = round((log.punch_out - log.punch_in).total_seconds() / 3600, 2)
    log.overtime = max(0, round(log.total_hours - 8, 2))
    if log.total_hours < 4:
        log.status = "half_day"

    db.commit()
    return {
        "message": "Punched out",
        "punch_in": log.punch_in.isoformat(),
        "punch_out": log.punch_out.isoformat(),
        "total_hours": log.total_hours,
        "overtime": log.overtime,
    }


@router.get("/today")
async def get_today(db: Session = Depends(get_db), current_user: User = Depends(require_employee)):
    emp = _get_employee(current_user.id, db)
    today = datetime.utcnow().strftime("%Y-%m-%d")
    log = db.query(WorkLog).filter(WorkLog.employee_id == emp.id, WorkLog.date == today).first()
    if not log:
        return {"date": today, "status": "not_punched_in"}
    return {
        "date": today, "punch_in": log.punch_in.isoformat() if log.punch_in else None,
        "punch_out": log.punch_out.isoformat() if log.punch_out else None,
        "total_hours": log.total_hours, "overtime": log.overtime, "status": log.status,
    }


@router.get("/summary", response_model=WorkSummaryResponse)
async def get_summary(db: Session = Depends(get_db), current_user: User = Depends(require_employee)):
    emp = _get_employee(current_user.id, db)
    now = datetime.utcnow()
    today = now.strftime("%Y-%m-%d")
    month_prefix = now.strftime("%Y-%m")

    # Today
    today_log = db.query(WorkLog).filter(WorkLog.employee_id == emp.id, WorkLog.date == today).first()

    # Weekly (last 7 days)
    week_start = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")
    weekly_logs = db.query(WorkLog).filter(
        WorkLog.employee_id == emp.id, WorkLog.date >= week_start, WorkLog.date <= today
    ).all()

    # Monthly
    monthly_logs = db.query(WorkLog).filter(
        WorkLog.employee_id == emp.id, WorkLog.date.like(f"{month_prefix}%")
    ).all()

    return WorkSummaryResponse(
        today={
            "date": today, "punch_in": today_log.punch_in.isoformat() if today_log and today_log.punch_in else None,
            "punch_out": today_log.punch_out.isoformat() if today_log and today_log.punch_out else None,
            "total_hours": today_log.total_hours if today_log else 0,
            "status": today_log.status if today_log else "not_punched_in",
        } if today_log else None,
        weekly_hours=round(sum(l.total_hours or 0 for l in weekly_logs), 2),
        weekly_days_present=sum(1 for l in weekly_logs if l.status in ("present", "half_day")),
        monthly_hours=round(sum(l.total_hours or 0 for l in monthly_logs), 2),
        monthly_days_present=sum(1 for l in monthly_logs if l.status == "present"),
        monthly_days_absent=max(0, 22 - sum(1 for l in monthly_logs if l.status in ("present", "half_day"))),
    )


@router.get("/history")
async def get_history(
    month: int = Query(default=None), year: int = Query(default=None),
    db: Session = Depends(get_db), current_user: User = Depends(require_employee),
):
    emp = _get_employee(current_user.id, db)
    now = datetime.utcnow()
    m = month or now.month
    y = year or now.year
    prefix = f"{y}-{m:02d}"

    logs = db.query(WorkLog).filter(
        WorkLog.employee_id == emp.id, WorkLog.date.like(f"{prefix}%")
    ).order_by(WorkLog.date.desc()).all()

    return [{
        "date": l.date, "punch_in": l.punch_in.isoformat() if l.punch_in else None,
        "punch_out": l.punch_out.isoformat() if l.punch_out else None,
        "total_hours": l.total_hours, "overtime": l.overtime, "status": l.status,
    } for l in logs]


@router.get("/all")
async def get_all_attendance(
    start_date: str = Query(default=None), end_date: str = Query(default=None),
    db: Session = Depends(get_db), current_user: User = Depends(require_admin),
):
    now = datetime.utcnow()
    start = start_date or now.strftime("%Y-%m-01")
    end = end_date or now.strftime("%Y-%m-%d")

    logs = db.query(WorkLog).filter(WorkLog.date >= start, WorkLog.date <= end).order_by(WorkLog.date.desc()).all()

    result = []
    for l in logs:
        emp = db.query(Employee).filter(Employee.id == l.employee_id).first()
        user = db.query(User).filter(User.id == emp.user_id).first() if emp else None
        result.append({
            "employee_id": emp.employee_id if emp else None,
            "employee_name": user.name if user else None,
            "date": l.date, "punch_in": l.punch_in.isoformat() if l.punch_in else None,
            "punch_out": l.punch_out.isoformat() if l.punch_out else None,
            "total_hours": l.total_hours, "overtime": l.overtime, "status": l.status,
        })
    return result
