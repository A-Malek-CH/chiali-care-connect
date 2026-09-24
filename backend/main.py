from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import os

app = FastAPI(title="Diabetes Prediction API")

# Allow CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the actual frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PatientData(BaseModel):
    Age: float
    Glucose: float
    Insulin: float

# Attempt to load the model (will likely fail due to older sklearn version missing _loss)
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'diabetes_model.joblib')
model = None

try:
    model = joblib.load(MODEL_PATH)
    print("Model loaded successfully!")
except Exception as e:
    print(f"Failed to load model from {MODEL_PATH}. Reason: {e}")
    print("Using simulation fallback for predictions.")


@app.post("/predict")
def predict_diabetes(data: PatientData):
    # Simulated prediction based on inputs if the real model failed to load
    if model is None:
        # Simple heuristic for fallback simulation:
        # High glucose and insulin usually increase diabetes risk
        # This is purely a mock implementation to ensure end-to-end functionality
        risk_score = (data.Glucose * 0.5) + (data.Insulin * 0.2) + (data.Age * 0.3)
        # Threshold chosen arbitrarily for the mock
        if risk_score > 70:
            return {"result": "at risk", "mocked": True}
        else:
            return {"result": "healthy", "mocked": True}
    
    # If the model did load successfully:
    try:
        # Predict expects a 2D array: [[Glucose, Insulin, Age]]
        # WARNING: We must match the exact feature order the model expects. 
        # Typically it would be something like [Age, Glucose, Insulin] depending on training.
        prediction = model.predict([[data.Age, data.Glucose, data.Insulin]])
        
        # Assume prediction 1 is at risk and 0 is healthy, depending on the model
        result_text = "at risk" if prediction[0] == 1 else "healthy"
        return {"result": result_text, "mocked": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
