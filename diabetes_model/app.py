from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# -----------------------------
# Load trained model
# -----------------------------

MODEL_PATH = Path(__file__).parent / "chiali_diabetes_model.pkl"

package = joblib.load(MODEL_PATH)

model = package["model"]
threshold = package["threshold"]
features = package["features"]


# -----------------------------
# FastAPI
# -----------------------------

app = FastAPI(
    title="Chiali Diabetes Screening API",
    version="1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # development only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# Input structure
# -----------------------------

class PatientData(BaseModel):
    HighBP: int
    HighChol: int
    BMI: float
    Smoker: int
    HeartDiseaseorAttack: int
    PhysActivity: int
    Fruits: int
    Veggies: int
    GenHlth: int
    Age: int
    Sex: int


# -----------------------------
# Routes
# -----------------------------

@app.get("/")
def home():
    return {
        "status": "online",
        "message": "Chiali Diabetes Screening API"
    }


@app.post("/predict")
def predict(data: PatientData):

    patient = pd.DataFrame(
        [data.model_dump()],
        columns=features
    )

    score = float(
        model.predict_proba(patient)[0, 1]
    )

    screen_positive = score >= threshold

    return {
        "score": round(score, 4),
        "threshold": threshold,
        "screen_positive": bool(screen_positive),
        "message": (
            "Elevated model-indicated screening result"
            if screen_positive
            else "Lower model-indicated screening result"
        )
    }