from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Employee, User
from app.schemas import EmployeeResponse, OnboardingFormData
from app.security import get_current_user, require_admin, require_employee

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("/me", response_model=EmployeeResponse)
async def get_my_employee_record(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee record found")
    return EmployeeResponse(
        id=emp.id, employee_id=emp.employee_id, user_id=emp.user_id,
        user_name=current_user.name, user_email=current_user.email,
        department=emp.department, designation=emp.designation,
        joining_date=emp.joining_date, salary=emp.salary,
        onboarding_status=emp.onboarding_status, onboarding_checklist=emp.onboarding_checklist,
        attrition_risk_score=emp.attrition_risk_score,
        attrition_risk_category=emp.attrition_risk_category,
        attrition_factors=emp.attrition_factors,
        created_at=emp.created_at,
    )


@router.post("/onboarding")
async def submit_onboarding(
    data: OnboardingFormData,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee record")

    # Build new checklist (must reassign entire dict for SQLAlchemy JSON detection)
    checklist = dict(emp.onboarding_checklist or {})

    if data.department:
        emp.department = data.department
        checklist["personal_details"] = True
    if data.designation:
        emp.designation = data.designation
        checklist["personal_details"] = True
    if data.joining_date:
        emp.joining_date = datetime.fromisoformat(data.joining_date)
    if data.salary is not None:
        emp.salary = data.salary
    if data.bank_details:
        emp.bank_details = data.bank_details
        checklist["bank_info"] = True
    if data.emergency_contact:
        emp.emergency_contact = data.emergency_contact
        checklist["emergency_contact"] = True

    # Attrition survey: recompute risk with real data
    if data.attrition_survey:
        from app.services.attrition_service import predict_attrition_risk
        survey = data.attrition_survey
        risk = predict_attrition_risk({
            "age": survey.get("age", 28),
            "monthly_income": emp.salary or 50000,
            "job_satisfaction": survey.get("job_satisfaction", 3),
            "years_at_company": 0,
            "num_companies_worked": survey.get("num_companies_worked", 1),
            "distance_from_home": survey.get("distance_from_home", 10),
            "work_life_balance": survey.get("work_life_balance", 3),
            "overtime": survey.get("overtime", False),
            "total_working_years": survey.get("total_working_years", 0),
            "job_involvement": survey.get("job_involvement", 3),
        })
        emp.attrition_risk_score = risk["risk_score"]
        emp.attrition_risk_category = risk["risk_category"]
        emp.attrition_factors = risk["factors"]

    # MUST reassign the whole dict for SQLAlchemy to detect JSON change
    emp.onboarding_checklist = dict(checklist)

    # Check if all required fields are done
    if checklist.get("personal_details") and checklist.get("bank_info") and checklist.get("emergency_contact"):
        emp.onboarding_status = "completed"
    else:
        emp.onboarding_status = "documents_pending"

    db.commit()
    return {"message": "Onboarding updated", "status": emp.onboarding_status}


@router.get("/", response_model=List[EmployeeResponse])
async def list_employees(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    employees = db.query(Employee).order_by(Employee.created_at.desc()).all()
    result = []
    for emp in employees:
        user = db.query(User).filter(User.id == emp.user_id).first()
        result.append(EmployeeResponse(
            id=emp.id, employee_id=emp.employee_id, user_id=emp.user_id,
            user_name=user.name if user else None, user_email=user.email if user else None,
            department=emp.department, designation=emp.designation,
            joining_date=emp.joining_date, salary=emp.salary,
            onboarding_status=emp.onboarding_status, onboarding_checklist=emp.onboarding_checklist,
            attrition_risk_score=emp.attrition_risk_score,
            attrition_risk_category=emp.attrition_risk_category,
            attrition_factors=emp.attrition_factors,
            created_at=emp.created_at,
        ))
    return result


@router.get("/{employee_id}")
async def get_employee(employee_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    user = db.query(User).filter(User.id == emp.user_id).first()
    return {
        "id": emp.id, "employee_id": emp.employee_id, "user_id": emp.user_id,
        "user_name": user.name if user else None, "user_email": user.email if user else None,
        "department": emp.department, "designation": emp.designation,
        "joining_date": emp.joining_date.isoformat() if emp.joining_date else None,
        "salary": emp.salary, "bank_details": emp.bank_details,
        "emergency_contact": emp.emergency_contact,
        "onboarding_status": emp.onboarding_status, "onboarding_checklist": emp.onboarding_checklist,
        "created_at": emp.created_at.isoformat(),
    }


@router.put("/{employee_id}")
async def update_employee(
    employee_id: int, data: OnboardingFormData,
    db: Session = Depends(get_db), current_user: User = Depends(require_admin),
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if data.department: emp.department = data.department
    if data.designation: emp.designation = data.designation
    if data.salary: emp.salary = data.salary
    if data.joining_date: emp.joining_date = datetime.fromisoformat(data.joining_date)
    if data.bank_details: emp.bank_details = data.bank_details
    if data.emergency_contact: emp.emergency_contact = data.emergency_contact
    db.commit()
    return {"message": "Employee updated"}
