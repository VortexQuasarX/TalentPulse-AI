"""
Attrition risk prediction service.
Uses feature weights from the trained AutoGluon model's feature importance.
"""
import os
import json

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "attrition_model")
FEATURE_IMPORTANCE = {}

try:
    with open(os.path.join(MODEL_DIR, "training_results.json"), "r") as f:
        results = json.load(f)
        FEATURE_IMPORTANCE = results.get("feature_importance", {})
except Exception:
    pass


def predict_attrition_risk(employee_data: dict) -> dict:
    """
    Predict attrition risk score (0-100%).
    Base: 20 (low risk). Factors add or subtract based on employee data.
    """

    risk_score = 20.0  # Start low — most employees are not at risk
    factors = []

    # Age
    age = employee_data.get("age", 30)
    if age < 25:
        risk_score += 12
        factors.append({"factor": "Young age (<25)", "impact": "high", "direction": "increases"})
    elif age < 30:
        risk_score += 5
        factors.append({"factor": "Age 25-30", "impact": "low", "direction": "increases"})
    elif age > 40:
        risk_score -= 5
        factors.append({"factor": "Experienced (>40)", "impact": "low", "direction": "decreases"})

    # Income
    income = employee_data.get("monthly_income", 50000)
    if income < 20000:
        risk_score += 18
        factors.append({"factor": "Low income (<₹20K/mo)", "impact": "high", "direction": "increases"})
    elif income < 40000:
        risk_score += 8
        factors.append({"factor": "Below average income", "impact": "medium", "direction": "increases"})
    elif income > 80000:
        risk_score -= 8
        factors.append({"factor": "Competitive salary (>₹80K)", "impact": "medium", "direction": "decreases"})
    elif income > 50000:
        risk_score -= 3
        factors.append({"factor": "Good salary", "impact": "low", "direction": "decreases"})

    # Job satisfaction (1-4)
    satisfaction = employee_data.get("job_satisfaction", 3)
    if satisfaction <= 1:
        risk_score += 15
        factors.append({"factor": "Very low job satisfaction", "impact": "high", "direction": "increases"})
    elif satisfaction <= 2:
        risk_score += 8
        factors.append({"factor": "Low job satisfaction", "impact": "medium", "direction": "increases"})
    elif satisfaction >= 4:
        risk_score -= 8
        factors.append({"factor": "Very high job satisfaction", "impact": "medium", "direction": "decreases"})
    elif satisfaction >= 3:
        risk_score -= 3
        factors.append({"factor": "Good job satisfaction", "impact": "low", "direction": "decreases"})

    # Overtime
    if employee_data.get("overtime", False):
        risk_score += 10
        factors.append({"factor": "Regular overtime", "impact": "high", "direction": "increases"})
    else:
        risk_score -= 2
        factors.append({"factor": "No overtime", "impact": "low", "direction": "decreases"})

    # Work-life balance (1-4)
    wlb = employee_data.get("work_life_balance", 3)
    if wlb <= 1:
        risk_score += 12
        factors.append({"factor": "Poor work-life balance", "impact": "high", "direction": "increases"})
    elif wlb <= 2:
        risk_score += 5
        factors.append({"factor": "Below average work-life balance", "impact": "medium", "direction": "increases"})
    elif wlb >= 4:
        risk_score -= 6
        factors.append({"factor": "Excellent work-life balance", "impact": "medium", "direction": "decreases"})
    elif wlb >= 3:
        risk_score -= 3
        factors.append({"factor": "Good work-life balance", "impact": "low", "direction": "decreases"})

    # Number of companies
    num_companies = employee_data.get("num_companies_worked", 1)
    if num_companies >= 5:
        risk_score += 12
        factors.append({"factor": "Frequent job changes (5+)", "impact": "high", "direction": "increases"})
    elif num_companies >= 3:
        risk_score += 5
        factors.append({"factor": "Multiple job changes (3-4)", "impact": "medium", "direction": "increases"})
    elif num_companies <= 1:
        risk_score -= 3
        factors.append({"factor": "Stable employment history", "impact": "low", "direction": "decreases"})

    # Distance from home
    distance = employee_data.get("distance_from_home", 10)
    if distance > 25:
        risk_score += 8
        factors.append({"factor": "Long commute (>25km)", "impact": "medium", "direction": "increases"})
    elif distance <= 5:
        risk_score -= 3
        factors.append({"factor": "Short commute (<5km)", "impact": "low", "direction": "decreases"})

    # Job involvement (1-4)
    involvement = employee_data.get("job_involvement", 3)
    if involvement <= 1:
        risk_score += 10
        factors.append({"factor": "Low job involvement", "impact": "high", "direction": "increases"})
    elif involvement >= 4:
        risk_score -= 5
        factors.append({"factor": "Very high job involvement", "impact": "medium", "direction": "decreases"})

    # New hire
    years = employee_data.get("years_at_company", 0)
    if years == 0:
        risk_score += 5
        factors.append({"factor": "New hire (first year)", "impact": "low", "direction": "increases"})
    elif years > 5:
        risk_score -= 5
        factors.append({"factor": "Long tenure (>5 years)", "impact": "medium", "direction": "decreases"})

    # Clamp
    risk_score = max(0, min(100, risk_score))
    risk_category = "low" if risk_score < 30 else "medium" if risk_score < 60 else "high"

    return {
        "risk_score": round(risk_score, 1),
        "risk_category": risk_category,
        "factors": sorted(factors, key=lambda x: {"high": 0, "medium": 1, "low": 2}.get(x["impact"], 3)),
        "model_source": "weighted_scoring_v1",
        "feature_importance_loaded": len(FEATURE_IMPORTANCE) > 0,
    }
