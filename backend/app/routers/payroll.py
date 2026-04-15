from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Employee, Payroll, User
from app.schemas import PayrollResponse
from app.security import get_current_user, require_accounts, require_employee_or_admin
from app.services.payroll_service import compute_payroll, generate_monthly_payroll

router = APIRouter(prefix="/payroll", tags=["payroll"])


@router.post("/generate")
async def generate_payroll(
    month: int = Query(...), year: int = Query(...),
    db: Session = Depends(get_db), current_user: User = Depends(require_accounts),
):
    payrolls = generate_monthly_payroll(month, year, db)
    return {
        "message": f"Payroll generated for {len(payrolls)} employees",
        "month": month, "year": year, "count": len(payrolls),
    }


@router.get("/")
async def list_payrolls(
    month: int = Query(default=None), year: int = Query(default=None),
    status: str = Query(default=None),
    db: Session = Depends(get_db), current_user: User = Depends(require_accounts),
):
    now = datetime.utcnow()
    m = month or now.month
    y = year or now.year

    q = db.query(Payroll).filter(Payroll.month == m, Payroll.year == y)
    if status:
        q = q.filter(Payroll.status == status)
    payrolls = q.order_by(Payroll.employee_id).all()

    result = []
    for p in payrolls:
        emp = db.query(Employee).filter(Employee.id == p.employee_id).first()
        user = db.query(User).filter(User.id == emp.user_id).first() if emp else None
        result.append({
            "id": p.id, "employee_id": p.employee_id,
            "employee_code": emp.employee_id if emp else None,
            "employee_name": user.name if user else None,
            "month": p.month, "year": p.year,
            "days_present": p.days_present, "days_absent": p.days_absent,
            "total_hours": p.total_hours, "total_working_days": p.total_working_days,
            "base_salary": p.base_salary, "overtime_pay": p.overtime_pay,
            "deductions": p.deductions, "net_salary": p.net_salary,
            "breakdown": p.breakdown, "status": p.status,
            "created_at": p.created_at.isoformat(),
        })
    return result


@router.get("/summary")
async def payroll_summary(
    month: int = Query(default=None), year: int = Query(default=None),
    db: Session = Depends(get_db), current_user: User = Depends(require_accounts),
):
    now = datetime.utcnow()
    m = month or now.month
    y = year or now.year

    payrolls = db.query(Payroll).filter(Payroll.month == m, Payroll.year == y).all()
    total = sum(p.net_salary for p in payrolls)
    pending = sum(1 for p in payrolls if p.status == "pending")
    processed = sum(1 for p in payrolls if p.status == "processed")
    paid = sum(1 for p in payrolls if p.status == "paid")

    return {
        "month": m, "year": y, "total_employees": len(payrolls),
        "total_payout": round(total, 2), "pending": pending,
        "processed": processed, "paid": paid,
    }


@router.get("/{payroll_id}")
async def get_payroll(payroll_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_accounts)):
    p = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payroll not found")
    emp = db.query(Employee).filter(Employee.id == p.employee_id).first()
    user = db.query(User).filter(User.id == emp.user_id).first() if emp else None
    return {
        "id": p.id, "employee_id": p.employee_id,
        "employee_code": emp.employee_id if emp else None,
        "employee_name": user.name if user else None,
        "month": p.month, "year": p.year,
        "days_present": p.days_present, "days_absent": p.days_absent,
        "total_hours": p.total_hours, "total_working_days": p.total_working_days,
        "base_salary": p.base_salary, "overtime_pay": p.overtime_pay,
        "deductions": p.deductions, "net_salary": p.net_salary,
        "breakdown": p.breakdown, "status": p.status,
        "created_at": p.created_at.isoformat(),
    }


@router.put("/{payroll_id}")
async def edit_payroll(
    payroll_id: int,
    overtime_pay: float = Query(default=None), deductions: float = Query(default=None),
    total_working_days: int = Query(default=None),
    db: Session = Depends(get_db), current_user: User = Depends(require_accounts),
):
    p = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payroll not found")
    if overtime_pay is not None: p.overtime_pay = overtime_pay
    if deductions is not None: p.deductions = deductions
    if total_working_days is not None: p.total_working_days = total_working_days
    p.net_salary = round(p.base_salary + p.overtime_pay - p.deductions, 2)
    db.commit()
    return {"message": "Payroll updated", "net_salary": p.net_salary}


@router.post("/{payroll_id}/approve")
async def approve_payroll(payroll_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_accounts)):
    p = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payroll not found")
    p.status = "processed"
    p.processed_by = current_user.id
    p.processed_at = datetime.utcnow()
    db.commit()
    return {"message": "Payroll approved"}


@router.post("/{payroll_id}/pay")
async def mark_paid(payroll_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_accounts)):
    p = db.query(Payroll).filter(Payroll.id == payroll_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payroll not found")
    p.status = "paid"
    db.commit()
    return {"message": "Payroll marked as paid"}


@router.get("/employee/me")
async def my_payslips(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee record")
    payrolls = db.query(Payroll).filter(Payroll.employee_id == emp.id).order_by(Payroll.year.desc(), Payroll.month.desc()).all()
    return [{
        "id": p.id, "month": p.month, "year": p.year,
        "base_salary": p.base_salary, "overtime_pay": p.overtime_pay,
        "deductions": p.deductions, "net_salary": p.net_salary,
        "days_present": p.days_present, "days_absent": p.days_absent,
        "status": p.status,
    } for p in payrolls]
