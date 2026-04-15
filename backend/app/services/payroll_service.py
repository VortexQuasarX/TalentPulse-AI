from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Employee, WorkLog, Payroll, LeaveRequest


def compute_payroll(employee: Employee, month: int, year: int, db: Session) -> Payroll:
    """Compute salary with leave deductions. Accounts Agent auto-calculates."""
    date_prefix = f"{year}-{month:02d}"

    logs = db.query(WorkLog).filter(
        WorkLog.employee_id == employee.id,
        WorkLog.date.like(f"{date_prefix}%"),
    ).all()

    days_present = sum(1 for l in logs if l.status == "present")
    half_days = sum(1 for l in logs if l.status == "half_day")
    approved_leaves = sum(1 for l in logs if l.status == "leave")
    days_present_effective = days_present + (half_days * 0.5)
    total_hours = sum(l.total_hours or 0 for l in logs)
    total_overtime = sum(l.overtime or 0 for l in logs)

    monthly_salary = employee.salary or 0
    total_working_days = 22

    # Count unapproved absences (absent days without approved leave)
    # These are days with no punch-in and no approved leave request
    total_logged_days = days_present + half_days + approved_leaves
    absent_days = max(0, total_working_days - total_logged_days)

    # Check for rejected/no-request absences — these get salary deducted
    leave_requests = db.query(LeaveRequest).filter(
        LeaveRequest.employee_id == employee.id,
        LeaveRequest.leave_date.like(f"{date_prefix}%"),
    ).all()
    unapproved_absences = 0
    for l in leave_requests:
        if l.status == "rejected":
            unapproved_absences += 1 if l.leave_type == "full_day" else 0.5

    # Salary computation
    per_day = monthly_salary / total_working_days if total_working_days > 0 else 0
    base_pay = per_day * days_present_effective
    approved_leave_pay = per_day * approved_leaves  # Paid leaves
    overtime_rate = (per_day / 8) * 1.5
    overtime_pay = total_overtime * overtime_rate

    # Deductions: unapproved absences + absent without request
    absence_deduction = per_day * unapproved_absences
    unlogged_deduction = per_day * absent_days  # Days not logged at all
    total_deductions = absence_deduction + unlogged_deduction

    net_salary = base_pay + approved_leave_pay + overtime_pay - total_deductions

    breakdown = {
        "monthly_salary": monthly_salary,
        "per_day_rate": round(per_day, 2),
        "total_working_days": total_working_days,
        "days_present": days_present,
        "half_days": half_days,
        "days_present_effective": days_present_effective,
        "approved_leaves": approved_leaves,
        "approved_leave_pay": round(approved_leave_pay, 2),
        "unapproved_absences": unapproved_absences,
        "unlogged_days": absent_days,
        "total_hours_worked": round(total_hours, 2),
        "overtime_hours": round(total_overtime, 2),
        "overtime_rate_per_hour": round(overtime_rate, 2),
        "base_pay": round(base_pay, 2),
        "overtime_pay": round(overtime_pay, 2),
        "absence_deduction": round(absence_deduction, 2),
        "unlogged_deduction": round(unlogged_deduction, 2),
        "total_deductions": round(total_deductions, 2),
        "net_salary": round(net_salary, 2),
    }

    existing = db.query(Payroll).filter(
        Payroll.employee_id == employee.id,
        Payroll.month == month, Payroll.year == year,
    ).first()

    if existing:
        existing.days_present = days_present
        existing.days_absent = int(absent_days + unapproved_absences)
        existing.total_hours = round(total_hours, 2)
        existing.base_salary = round(base_pay + approved_leave_pay, 2)
        existing.overtime_pay = round(overtime_pay, 2)
        existing.deductions = round(total_deductions, 2)
        existing.net_salary = round(max(0, net_salary), 2)
        existing.breakdown = breakdown
        payroll = existing
    else:
        payroll = Payroll(
            employee_id=employee.id,
            month=month, year=year,
            days_present=days_present,
            days_absent=int(absent_days + unapproved_absences),
            total_hours=round(total_hours, 2),
            total_working_days=total_working_days,
            base_salary=round(base_pay + approved_leave_pay, 2),
            overtime_pay=round(overtime_pay, 2),
            deductions=round(total_deductions, 2),
            net_salary=round(max(0, net_salary), 2),
            breakdown=breakdown, status="pending",
        )
        db.add(payroll)

    db.flush()
    return payroll


def generate_monthly_payroll(month: int, year: int, db: Session) -> list[Payroll]:
    employees = db.query(Employee).filter(Employee.onboarding_status == "completed").all()
    payrolls = []
    for emp in employees:
        p = compute_payroll(emp, month, year, db)
        payrolls.append(p)
    db.commit()
    print(f"[Payroll] Generated for {len(payrolls)} employees, {month}/{year}")
    return payrolls
