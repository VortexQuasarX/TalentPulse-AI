from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Employee, LeaveRequest, WorkLog, User, Notification
from app.security import get_current_user, require_employee, require_admin

router = APIRouter(prefix="/leaves", tags=["leaves"])


@router.post("/apply")
async def apply_leave(
    leave_date: str = Query(...), leave_type: str = Query("full_day"),
    reason: str = Query(""),
    db: Session = Depends(get_db), current_user: User = Depends(require_employee),
):
    """Employee requests a leave."""
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee record")
    if emp.onboarding_status != "completed":
        raise HTTPException(status_code=400, detail="Complete onboarding first")

    # Check not already requested
    existing = db.query(LeaveRequest).filter(
        LeaveRequest.employee_id == emp.id, LeaveRequest.leave_date == leave_date
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Leave already requested for {leave_date}")

    # Check leave balance
    deduction = 1 if leave_type == "full_day" else 0.5
    if emp.leaves_remaining < deduction:
        raise HTTPException(status_code=400, detail=f"Insufficient leave balance ({emp.leaves_remaining} remaining)")

    leave = LeaveRequest(
        employee_id=emp.id, leave_date=leave_date,
        leave_type=leave_type, reason=reason,
    )
    db.add(leave)

    # Notify HR
    admins = db.query(User).filter(User.role.in_(["admin", "super_admin"])).all()
    for admin in admins:
        db.add(Notification(
            user_id=admin.id, type="approval_needed",
            title=f"Leave Request: {current_user.name}",
            message=f"{current_user.name} ({emp.employee_id}) requests {leave_type.replace('_', ' ')} leave on {leave_date}. Reason: {reason or 'Not specified'}",
            link="/hr/leaves",
        ))

    db.commit()
    return {"message": f"Leave requested for {leave_date}", "status": "pending"}


@router.get("/my-leaves")
async def my_leaves(db: Session = Depends(get_db), current_user: User = Depends(require_employee)):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee record")

    leaves = db.query(LeaveRequest).filter(LeaveRequest.employee_id == emp.id).order_by(LeaveRequest.leave_date.desc()).all()
    return {
        "balance": {"total": emp.total_leaves, "used": emp.leaves_used, "remaining": emp.leaves_remaining},
        "requests": [{
            "id": l.id, "date": l.leave_date, "type": l.leave_type,
            "reason": l.reason, "status": l.status,
        } for l in leaves],
    }


@router.get("/pending")
async def pending_leaves(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """HR sees all pending leave requests."""
    leaves = db.query(LeaveRequest).filter(LeaveRequest.status == "pending").order_by(LeaveRequest.created_at.desc()).all()
    result = []
    for l in leaves:
        emp = db.query(Employee).filter(Employee.id == l.employee_id).first()
        user = db.query(User).filter(User.id == emp.user_id).first() if emp else None
        result.append({
            "id": l.id, "employee_id": emp.employee_id if emp else None,
            "employee_name": user.name if user else None,
            "date": l.leave_date, "type": l.leave_type,
            "reason": l.reason, "status": l.status,
            "leaves_remaining": emp.leaves_remaining if emp else 0,
        })
    return result


@router.get("/all")
async def all_leaves(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """HR sees all leave requests."""
    leaves = db.query(LeaveRequest).order_by(LeaveRequest.leave_date.desc()).all()
    result = []
    for l in leaves:
        emp = db.query(Employee).filter(Employee.id == l.employee_id).first()
        user = db.query(User).filter(User.id == emp.user_id).first() if emp else None
        result.append({
            "id": l.id, "employee_id": emp.employee_id if emp else None,
            "employee_name": user.name if user else None,
            "date": l.leave_date, "type": l.leave_type,
            "reason": l.reason, "status": l.status,
        })
    return result


@router.post("/{leave_id}/approve")
async def approve_leave(leave_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave.status != "pending":
        raise HTTPException(status_code=400, detail="Already processed")

    leave.status = "approved"
    leave.approved_by = current_user.id
    leave.approved_at = datetime.utcnow()

    # Deduct from balance
    emp = db.query(Employee).filter(Employee.id == leave.employee_id).first()
    if emp:
        deduction = 1 if leave.leave_type == "full_day" else 0.5
        emp.leaves_used = (emp.leaves_used or 0) + deduction
        emp.leaves_remaining = max(0, (emp.total_leaves or 15) - emp.leaves_used)

        # Create a work log entry for the leave day
        existing_log = db.query(WorkLog).filter(
            WorkLog.employee_id == emp.id, WorkLog.date == leave.leave_date
        ).first()
        if not existing_log:
            db.add(WorkLog(
                employee_id=emp.id, date=leave.leave_date,
                total_hours=0, status="leave",
            ))

    # Notify employee
    user = db.query(User).filter(User.id == emp.user_id).first() if emp else None
    if user:
        db.add(Notification(
            user_id=user.id, type="shortlisted",
            title="Leave Approved",
            message=f"Your {leave.leave_type.replace('_', ' ')} leave on {leave.leave_date} has been approved.",
            link="/employee/attendance",
        ))

    db.commit()
    return {"message": "Leave approved"}


@router.post("/{leave_id}/reject")
async def reject_leave(leave_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave.status != "pending":
        raise HTTPException(status_code=400, detail="Already processed")

    leave.status = "rejected"
    leave.approved_by = current_user.id
    leave.approved_at = datetime.utcnow()

    emp = db.query(Employee).filter(Employee.id == leave.employee_id).first()
    user = db.query(User).filter(User.id == emp.user_id).first() if emp else None
    if user:
        db.add(Notification(
            user_id=user.id, type="rejected",
            title="Leave Rejected",
            message=f"Your leave on {leave.leave_date} was rejected. Absence will be marked as unpaid.",
            link="/employee/attendance",
        ))

    db.commit()
    return {"message": "Leave rejected"}
