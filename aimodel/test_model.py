import os
import sys
import json
import joblib
import pandas as pd
import numpy as np

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
PREPROCESSOR_PATH = os.path.join(MODEL_DIR, "clinic_preprocessor.pkl")
MODEL_PATH = os.path.join(MODEL_DIR, "isolation_forest_clinic.pkl")

preprocessor = joblib.load(PREPROCESSOR_PATH)
model = joblib.load(MODEL_PATH)

def analyze_appointment(appt):
    # Prepare features
    features = {
        'Age': float(appt.get('age', 35)),
        'WaitingDays': float(appt.get('waiting_days', 0)),
        'Scholarship': float(appt.get('scholarship', 0)),
        'Hipertension': float(appt.get('hipertension', 0)),
        'Diabetes': float(appt.get('diabetes', 0)),
        'Alcoholism': float(appt.get('alcoholism', 0)),
        'Handcap': float(appt.get('handcap', 0)),
        'SMS_received': float(appt.get('sms_received', 0)),
        'AppointmentWeekday': float(appt.get('appointment_weekday', 2)),
        'AppointmentMonth': float(appt.get('appointment_month', 5)),
        'ScheduledHour': float(appt.get('scheduled_hour', 10)),
    }
    
    df = pd.DataFrame([features])
    X = preprocessor.transform(df)
    pred = int(model.predict(X)[0])
    score = float(model.decision_function(X)[0])
    
    # IsolationForest: score < 0 indicates anomaly (likely to abandon / no-show)
    # Score usually ranges from ~ -0.25 (extreme anomaly) to +0.25 (typical patient)
    # Map score to risk percentage: 0 to 100%
    # If score <= 0 -> High/Elevated Risk
    risk_percentage = round(float(np.clip((0.20 - score) / 0.35 * 100, 5, 98)), 1)
    
    is_high_risk = pred == -1 or risk_percentage >= 50.0
    
    factors = []
    if features['WaitingDays'] > 14:
        factors.append(f"Long waiting period ({int(features['WaitingDays'])} days)")
    elif features['WaitingDays'] > 7:
        factors.append(f"Moderate waiting period ({int(features['WaitingDays'])} days)")
        
    if features['SMS_received'] == 0:
        factors.append("No SMS reminder received")
    else:
        factors.append("SMS reminder already sent")
        
    if features['Scholarship'] == 1:
        factors.append("Scholarship/Assistance beneficiary")
    if features['Hipertension'] == 1 or features['Diabetes'] == 1:
        factors.append("Chronic condition history")
    if features['ScheduledHour'] < 8 or features['ScheduledHour'] > 16:
        factors.append(f"Off-peak schedule hour ({int(features['ScheduledHour'])}:00)")
        
    risk_level = "High" if is_high_risk else ("Moderate" if risk_percentage >= 30 else "Low")
    
    return {
        "prediction": pred,
        "is_high_risk": is_high_risk,
        "score": round(score, 4),
        "risk_percentage": risk_percentage,
        "risk_level": risk_level,
        "risk_factors": factors,
    }

if __name__ == "__main__":
    sample = {
        'age': 25,
        'waiting_days': 21,
        'scholarship': 1,
        'hipertension': 0,
        'diabetes': 0,
        'alcoholism': 0,
        'handcap': 0,
        'sms_received': 0,
        'appointment_weekday': 4,
        'appointment_month': 10,
        'scheduled_hour': 17,
    }
    result = analyze_appointment(sample)
    print("Test Sample Analysis:")
    print(json.dumps(result, indent=2))
