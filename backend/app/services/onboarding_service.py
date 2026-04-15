import re
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import Employee, User, Notification, JobPosting, InterviewPipeline
from app.services.email_service import send_email


def _parse_salary(salary_range: str) -> float | None:
    """Extract a numeric salary from strings like '₹12-18 LPA', '50000/mo', '12 LPA'."""
    if not salary_range:
        return None
    # Remove currency symbols and whitespace
    clean = salary_range.replace("₹", "").replace(",", "").strip()
    # Try to find numbers
    numbers = re.findall(r"[\d.]+", clean)
    if not numbers:
        return None
    # If range like "12-18", take average
    if len(numbers) >= 2:
        avg = (float(numbers[0]) + float(numbers[1])) / 2
    else:
        avg = float(numbers[0])
    # Convert LPA to monthly
    lower = clean.lower()
    if "lpa" in lower or "lakhs" in lower or "lakh" in lower:
        return round(avg * 100000 / 12, 2)  # LPA to monthly
    elif "month" in lower or "/mo" in lower:
        return round(avg, 2)
    elif avg > 1000:
        return round(avg, 2)  # Assume already monthly
    else:
        return round(avg * 100000 / 12, 2)  # Assume LPA


def create_employee_from_hire(user_id: int, pipeline_id: int, db: Session) -> Employee | None:
    """Auto-create Employee record when candidate is hired. Fetches salary from job posting."""
    existing = db.query(Employee).filter(Employee.user_id == user_id).first()
    if existing:
        return existing

    count = db.query(Employee).count()
    emp_id = f"EMP{count + 1:03d}"

    # Fetch job posting details via pipeline
    salary = None
    designation = None
    department = None
    if pipeline_id:
        job = db.query(JobPosting).filter(JobPosting.pipeline_id == pipeline_id).first()
        if job:
            salary = _parse_salary(job.salary_range)
            designation = job.title  # Job title becomes designation
            department = job.department

    # Compute attrition risk at hire time
    from app.services.attrition_service import predict_attrition_risk
    user = db.query(User).filter(User.id == user_id).first()

    attrition_data = {
        "age": 28,  # Default; can be improved with profile_data
        "monthly_income": salary or 50000,
        "job_satisfaction": 3,
        "years_at_company": 0,
        "num_companies_worked": 1,
        "distance_from_home": 10,
        "work_life_balance": 3,
        "overtime": False,
    }
    # Try to extract age/details from user profile
    if user and user.profile_data:
        pd = user.profile_data
        if pd.get("age"): attrition_data["age"] = int(pd["age"])
        if pd.get("experience"):
            try: attrition_data["num_companies_worked"] = max(1, int(pd["experience"].split()[0]) // 3)
            except: pass

    risk = predict_attrition_risk(attrition_data)

    employee = Employee(
        employee_id=emp_id,
        user_id=user_id,
        pipeline_id=pipeline_id,
        department=department,
        designation=designation,
        salary=salary,
        joining_date=datetime.utcnow(),
        onboarding_status="pending",
        onboarding_checklist={"personal_details": bool(department and designation), "bank_info": False, "emergency_contact": False},
        attrition_risk_score=risk["risk_score"],
        attrition_risk_category=risk["risk_category"],
        attrition_factors=risk["factors"],
    )
    db.add(employee)

    if user:
        user.role = "employee"

    db.flush()
    print(f"[Onboarding] Employee created: {emp_id} for user {user_id} | dept={department} desig={designation} salary={salary}")
    return employee


def send_onboarding_email(to_email: str, candidate_name: str, employee_id: str, **kwargs):
    """Send onboarding welcome email."""
    subject = f"Welcome to Vertical AI! Complete your onboarding - {employee_id}"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to the Team! 🎉</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1a1a2e; margin-top: 0;">Hello, {candidate_name}!</h2>
            <p style="color: #555; line-height: 1.6;">
                Congratulations on being selected! Your employee ID is <strong>{employee_id}</strong>.
            </p>
            <p style="color: #555; line-height: 1.6;">
                Please complete your onboarding by logging into your account and filling in your details:
            </p>
            <ul style="color: #555; line-height: 1.8;">
                <li>Personal details (department, designation)</li>
                <li>Bank account information</li>
                <li>Emergency contact</li>
            </ul>
            <div style="text-align: center; margin: 25px 0;">
                <a href="http://localhost:3001/login" style="background: #059669; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                    Complete Onboarding
                </a>
            </div>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">
                Log in with your existing credentials. Your account has been upgraded to Employee access.
            </p>
        </div>
    </div>
    """
    return send_email(to_email, subject, html)
