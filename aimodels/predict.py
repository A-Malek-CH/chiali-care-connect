#!/usr/bin/env python3
"""
predict.py - AI Inference Service for Patient No-Show & Abandonment Detection
Uses Isolation Forest anomaly detection model and clinic preprocessor.
"""

import sys
import json
import os
import warnings
from typing import Dict, Any, List

warnings.filterwarnings("ignore")

try:
    import joblib
    import pandas as pd
    import numpy as np
except ImportError as e:
    print(json.dumps({"error": f"Missing required dependency: {str(e)}"}))
    sys.exit(1)

# Paths to models
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PREPROCESSOR_PATH = os.path.join(BASE_DIR, "clinic_preprocessor.pkl")
MODEL_PATH = os.path.join(BASE_DIR, "isolation_forest_clinic.pkl")

_preprocessor = None
_model = None

def get_models():
    global _preprocessor, _model
    if _preprocessor is None or _model is None:
        if not os.path.exists(PREPROCESSOR_PATH) or not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model files not found in {BASE_DIR}")
        
        _preprocessor = joblib.load(PREPROCESSOR_PATH)
        _model = joblib.load(MODEL_PATH)
        
        # Backward compatibility for scikit-learn SimpleImputer
        for name, step in getattr(_preprocessor, "named_steps", {}).items():
            if hasattr(step, "_fit_dtype") and not hasattr(step, "_fill_dtype"):
                step._fill_dtype = step._fit_dtype

    return _preprocessor, _model

FEATURE_COLUMNS = [
    "Age",
    "WaitingDays",
    "Scholarship",
    "Hipertension",
    "Diabetes",
    "Alcoholism",
    "Handcap",
    "SMS_received",
    "AppointmentWeekday",
    "AppointmentMonth",
    "ScheduledHour",
]

def explain_factors(data: Dict[str, Any], anomaly_score: float) -> List[str]:
    """Generates human-readable explanations of why the AI considers the appointment risky."""
    factors = []
    waiting_days = float(data.get("WaitingDays", 0))
    sms_received = int(data.get("SMS_received", 0))
    age = float(data.get("Age", 35))
    weekday = int(data.get("AppointmentWeekday", 0))
    scheduled_hour = int(data.get("ScheduledHour", 12))
    
    if waiting_days >= 30:
        factors.append(f"Extended waiting period ({int(waiting_days)} days between booking and appointment)")
    elif waiting_days >= 14:
        factors.append(f"Moderate waiting delay ({int(waiting_days)} days since booking)")
    elif waiting_days == 0:
        factors.append("Same-day booking (higher tendency of schedule conflict or urgent no-show)")

    if sms_received == 0:
        factors.append("No SMS confirmation reminder dispatched yet")

    if age < 25:
        factors.append("Younger age demographic with historically higher appointment rescheduling rate")
    elif age >= 75:
        factors.append("Elderly patient needing mobility or transportation support")

    if weekday in [0, 4, 6]:  # Monday, Friday, Sunday
        weekday_names = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday", 5: "Saturday", 6: "Sunday"}
        factors.append(f"Appointment scheduled on {weekday_names.get(weekday, 'weekend/boundary day')} with higher historical absence")

    if scheduled_hour >= 17 or scheduled_hour <= 7:
        factors.append("Appointment booked during late evening or off-peak hours")

    if int(data.get("Scholarship", 0)) == 1:
        factors.append("Social welfare assistance recipient (often faces travel/logistic barriers)")

    if not factors:
        if anomaly_score < 0:
            factors.append("Multivariate anomaly pattern detected across timing and patient attributes")
        else:
            factors.append("Standard appointment profile with consistent attendance markers")

    return factors

def calculate_risk_metrics(score: float, pred: int, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    In Isolation Forest:
    - score < 0 means anomaly (outlier / high risk of no-show)
    - score > 0 means normal instance
    We map decision_function score (typically between -0.3 and +0.25) to a 0-100% risk index.
    """
    risk_percentage = max(5.0, min(95.0, round((0.15 - score) / 0.35 * 100, 1)))
    
    if int(data.get("SMS_received", 0)) == 0 and float(data.get("WaitingDays", 0)) > 7:
        risk_percentage = min(98.0, risk_percentage + 10.0)

    is_at_risk = pred == -1 or risk_percentage >= 50.0

    if risk_percentage >= 70.0:
        risk_level = "High"
        recommended_action = "Send urgent confirmation notification & priority call-back"
    elif risk_percentage >= 40.0:
        risk_level = "Moderate"
        recommended_action = "Send standard appointment reminder with easy reschedule option"
    else:
        risk_level = "Low"
        recommended_action = "Standard routine follow-up"

    return {
        "is_at_risk": is_at_risk,
        "risk_percentage": risk_percentage,
        "risk_level": risk_level,
        "anomaly_score": round(float(score), 4),
        "recommended_action": recommended_action,
    }

def predict_single(data: Dict[str, Any]) -> Dict[str, Any]:
    preprocessor, model = get_models()
    
    row = {col: data.get(col, 0) for col in FEATURE_COLUMNS}
    df = pd.DataFrame([row])
    
    transformed = preprocessor.transform(df)
    pred = int(model.predict(transformed)[0])
    score = float(model.decision_function(transformed)[0])
    
    metrics = calculate_risk_metrics(score, pred, data)
    factors = explain_factors(data, score)
    
    return {
        **metrics,
        "factors": factors,
        "features": row,
    }

def predict_batch(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    preprocessor, model = get_models()
    
    rows = [{col: item.get(col, 0) for col in FEATURE_COLUMNS} for item in items]
    df = pd.DataFrame(rows)
    
    transformed = preprocessor.transform(df)
    preds = model.predict(transformed)
    scores = model.decision_function(transformed)
    
    results = []
    for item, pred, score in zip(items, preds, scores):
        metrics = calculate_risk_metrics(float(score), int(pred), item)
        factors = explain_factors(item, float(score))
        results.append({
            "id": item.get("id"),
            **metrics,
            "factors": factors,
            "features": item,
        })
        
    return results

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        test_data = [
            {"id": "1", "Age": 24, "WaitingDays": 35, "Scholarship": 1, "Hipertension": 0, "Diabetes": 0, "Alcoholism": 0, "Handcap": 0, "SMS_received": 0, "AppointmentWeekday": 0, "AppointmentMonth": 10, "ScheduledHour": 20},
            {"id": "2", "Age": 68, "WaitingDays": 2, "Scholarship": 0, "Hipertension": 1, "Diabetes": 1, "Alcoholism": 0, "Handcap": 0, "SMS_received": 1, "AppointmentWeekday": 2, "AppointmentMonth": 5, "ScheduledHour": 10},
        ]
        print(json.dumps(predict_batch(test_data), indent=2))
        return

    try:
        input_data = sys.stdin.read()
        if not input_data.strip():
            print(json.dumps({"error": "No input provided"}))
            sys.exit(1)
            
        payload = json.loads(input_data)
        if isinstance(payload, list):
            output = predict_batch(payload)
        elif isinstance(payload, dict):
            if "items" in payload:
                output = predict_batch(payload["items"])
            else:
                output = predict_single(payload)
        else:
            output = {"error": "Invalid payload format"}
            
        print(json.dumps(output))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
