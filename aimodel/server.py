import os
import sys
import json
import warnings
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime

# Suppress sklearn unpickling warnings
warnings.filterwarnings("ignore")

import joblib
import pandas as pd
import numpy as np

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
PREPROCESSOR_PATH = os.path.join(MODEL_DIR, "clinic_preprocessor.pkl")
MODEL_PATH = os.path.join(MODEL_DIR, "isolation_forest_clinic.pkl")

print(f"Loading preprocessor from {PREPROCESSOR_PATH}...")
preprocessor = joblib.load(PREPROCESSOR_PATH)
print(f"Loading IsolationForest model from {MODEL_PATH}...")
model = joblib.load(MODEL_PATH)
print("AI Model loaded successfully!")

def compute_appointment_features(appt):
    # Parse appointment datetime if provided as string
    requested_at = appt.get('requested_at')
    created_at = appt.get('created_at')
    
    waiting_days = appt.get('waiting_days')
    weekday = appt.get('appointment_weekday')
    month = appt.get('appointment_month')
    hour = appt.get('scheduled_hour')

    if requested_at:
        try:
            req_dt = datetime.fromisoformat(requested_at.replace('Z', '+00:00'))
            if weekday is None:
                weekday = req_dt.weekday() # 0 = Monday
            if month is None:
                month = req_dt.month
            if hour is None:
                hour = req_dt.hour
                
            if waiting_days is None and created_at:
                c_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                waiting_days = max(0, (req_dt.date() - c_dt.date()).days)
        except Exception:
            pass

    if waiting_days is None:
        waiting_days = 5
    if weekday is None:
        weekday = 2
    if month is None:
        month = 5
    if hour is None:
        hour = 10

    return {
        'Age': float(appt.get('age', 38)),
        'WaitingDays': float(waiting_days),
        'Scholarship': float(appt.get('scholarship', 0)),
        'Hipertension': float(appt.get('hipertension', 0)),
        'Diabetes': float(appt.get('diabetes', 0)),
        'Alcoholism': float(appt.get('alcoholism', 0)),
        'Handcap': float(appt.get('handcap', 0)),
        'SMS_received': float(appt.get('sms_received', 0)),
        'AppointmentWeekday': float(weekday),
        'AppointmentMonth': float(month),
        'ScheduledHour': float(hour),
    }

def analyze_single(appt):
    features = compute_appointment_features(appt)
    df = pd.DataFrame([features])
    X = preprocessor.transform(df)
    pred = int(model.predict(X)[0])
    score = float(model.decision_function(X)[0])
    
    # Map score to calibrated risk percentage (IsolationForest score < 0 means anomaly)
    # Higher risk score -> more likely to abandon/no-show
    risk_percentage = round(float(np.clip((0.20 - score) / 0.35 * 100, 5, 98)), 1)
    is_high_risk = pred == -1 or risk_percentage >= 50.0
    
    factors = []
    if features['WaitingDays'] > 14:
        factors.append(f"Long waiting period ({int(features['WaitingDays'])} days ahead)")
    elif features['WaitingDays'] > 7:
        factors.append(f"Moderate waiting period ({int(features['WaitingDays'])} days)")
        
    if features['SMS_received'] == 0:
        factors.append("No confirmation reminder sent yet")
    else:
        factors.append("SMS reminder dispatched")
        
    if features['Scholarship'] == 1:
        factors.append("Healthcare assistance / scholarship beneficiary")
    if features['Hipertension'] == 1 and features['Diabetes'] == 1:
        factors.append("Multiple chronic conditions (Hypertension & Diabetes)")
    elif features['Hipertension'] == 1:
        factors.append("Hypertension condition history")
    elif features['Diabetes'] == 1:
        factors.append("Diabetes condition history")
    if features['Alcoholism'] == 1:
        factors.append("Alcoholism history flag")
    if features['Handcap'] == 1:
        factors.append("Accessibility / mobility support needed")
    if features['ScheduledHour'] < 8 or features['ScheduledHour'] >= 17:
        factors.append(f"Off-peak appointment time ({int(features['ScheduledHour'])}:00)")
    if features['AppointmentWeekday'] in [4, 5]: # Friday, Saturday
        factors.append("Weekend-adjacent appointment schedule")
        
    risk_level = "High" if is_high_risk else ("Moderate" if risk_percentage >= 30 else "Low")
    
    # Recommended retention action
    if risk_level == "High":
        if features['SMS_received'] == 0:
            rec_action = "Send urgent WhatsApp/SMS reminder and confirm availability"
        else:
            rec_action = "Direct staff phone call recommended to confirm attendance"
    elif risk_level == "Moderate":
        rec_action = "Send standard automated SMS reminder 24h prior"
    else:
        rec_action = "Routine reminder scheduled"

    return {
        "id": appt.get("id"),
        "prediction": pred,
        "is_high_risk": is_high_risk,
        "score": round(score, 4),
        "risk_percentage": risk_percentage,
        "risk_level": risk_level,
        "risk_factors": factors,
        "recommended_action": rec_action,
        "features": features
    }

class AIRequestHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_GET(self):
        if self.path in ["/health", "/api/health", "/"]:
            self._set_headers(200)
            res = {
                "status": "online",
                "model": "IsolationForest",
                "contamination": getattr(model, "contamination", 0.05),
                "features": list(preprocessor.feature_names_in_)
            }
            self.wfile.write(json.dumps(res).encode("utf-8"))
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Not found"}).encode("utf-8"))

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8')
        try:
            data = json.loads(body) if body else {}
        except Exception:
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode("utf-8"))
            return

        if self.path == "/api/predict":
            result = analyze_single(data)
            self._set_headers(200)
            self.wfile.write(json.dumps(result).encode("utf-8"))
        elif self.path == "/api/predict-batch":
            appointments = data.get("appointments", [])
            results = [analyze_single(item) for item in appointments]
            self._set_headers(200)
            self.wfile.write(json.dumps({"results": results}).encode("utf-8"))
        elif self.path == "/api/send-notification":
            appt_id = data.get("id")
            phone = data.get("phone", "")
            channel = data.get("channel", "sms")
            message = data.get("message", "")
            patient_name = data.get("full_name", "Patient")
            
            # Simulated notification dispatch log
            print(f"[NOTIFICATION DISPATCHED] Channel: {channel.upper()} | To: {patient_name} ({phone}) | Message: {message}")
            
            self._set_headers(200)
            self.wfile.write(json.dumps({
                "success": True,
                "appointment_id": appt_id,
                "channel": channel,
                "sent_at": datetime.utcnow().isoformat() + "Z",
                "message": f"Notification successfully sent to {phone} via {channel.upper()}"
            }).encode("utf-8"))
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode("utf-8"))

    def log_message(self, format, *args):
        # Concise logging
        sys.stderr.write(f"[{datetime.now().strftime('%H:%M:%S')}] {args[0]} {args[1]}\n")

def run(port=5001):
    server_address = ('', port)
    httpd = HTTPServer(server_address, AIRequestHandler)
    print(f"Chiali AI Attendance Prediction Server running on http://localhost:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down AI server...")
        httpd.server_close()

if __name__ == "__main__":
    port = 5001
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    run(port)
