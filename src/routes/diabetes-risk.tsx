import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/diabetes-risk")({
  component: DiabetesRiskPage,
});

function DiabetesRiskPage() {
  const [form, setForm] = useState({
    HighBP: 0,
    HighChol: 0,
    BMI: 25,
    Smoker: 0,
    HeartDiseaseorAttack: 0,
    PhysActivity: 1,
    Fruits: 1,
    Veggies: 1,
    GenHlth: 2,
    Age: 5,
    Sex: 0,
  });

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const updateField = (name: string, value: number) => {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const submitScreening = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        throw new Error("Prediction request failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      alert("Could not connect to the screening model.");
    } finally {
      setLoading(false);
    }
  };

  const yesNo = (
    label: string,
    field: keyof typeof form,
    description?: string
  ) => (
    <div style={fieldStyle}>
      <label>
        <strong>{label}</strong>
      </label>

      {description && (
        <small style={{ color: "#666" }}>{description}</small>
      )}

      <select
        value={form[field]}
        onChange={(e) => updateField(field, Number(e.target.value))}
        style={inputStyle}
      >
        <option value={0}>No</option>
        <option value={1}>Yes</option>
      </select>
    </div>
  );

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1>Diabetes Risk Screening</h1>

        <p style={{ color: "#666" }}>
          Complete the health questionnaire to receive an ML-based screening
          result.
        </p>

        <div style={gridStyle}>
          {/* Age */}
          <div style={fieldStyle}>
            <label>
              <strong>Age</strong>
            </label>

            <select
              value={form.Age}
              onChange={(e) => updateField("Age", Number(e.target.value))}
              style={inputStyle}
            >
              <option value={1}>18–24</option>
              <option value={2}>25–29</option>
              <option value={3}>30–34</option>
              <option value={4}>35–39</option>
              <option value={5}>40–44</option>
              <option value={6}>45–49</option>
              <option value={7}>50–54</option>
              <option value={8}>55–59</option>
              <option value={9}>60–64</option>
              <option value={10}>65–69</option>
              <option value={11}>70–74</option>
              <option value={12}>75–79</option>
              <option value={13}>80+</option>
            </select>
          </div>

          {/* Sex */}
          <div style={fieldStyle}>
            <label>
              <strong>Sex</strong>
            </label>

            <select
              value={form.Sex}
              onChange={(e) => updateField("Sex", Number(e.target.value))}
              style={inputStyle}
            >
              <option value={0}>Female</option>
              <option value={1}>Male</option>
            </select>
          </div>

          {/* BMI */}
          <div style={fieldStyle}>
            <label>
              <strong>BMI</strong>
            </label>

            <input
              type="number"
              min="10"
              max="70"
              step="0.1"
              value={form.BMI}
              onChange={(e) => updateField("BMI", Number(e.target.value))}
              style={inputStyle}
            />
          </div>

          {/* General health */}
          <div style={fieldStyle}>
            <label>
              <strong>General health</strong>
            </label>

            <select
              value={form.GenHlth}
              onChange={(e) => updateField("GenHlth", Number(e.target.value))}
              style={inputStyle}
            >
              <option value={1}>Excellent</option>
              <option value={2}>Very good</option>
              <option value={3}>Good</option>
              <option value={4}>Fair</option>
              <option value={5}>Poor</option>
            </select>
          </div>

          {yesNo("High blood pressure", "HighBP")}
          {yesNo("High cholesterol", "HighChol")}

          {yesNo(
            "Smoking history",
            "Smoker",
            "Have you smoked at least 100 cigarettes in your lifetime?"
          )}

          {yesNo(
            "Heart disease or heart attack history",
            "HeartDiseaseorAttack"
          )}

          {yesNo(
            "Physical activity",
            "PhysActivity",
            "Physical activity during the past 30 days, excluding work?"
          )}

          {yesNo(
            "Fruit daily",
            "Fruits",
            "Do you consume fruit at least once per day?"
          )}

          {yesNo(
            "Vegetables daily",
            "Veggies",
            "Do you consume vegetables at least once per day?"
          )}
        </div>

        <button
          onClick={submitScreening}
          disabled={loading}
          style={buttonStyle}
        >
          {loading ? "Analyzing..." : "Check Screening Result"}
        </button>

        {result && (
          <div style={resultStyle}>
            <h2>
              {result.screen_positive
                ? "Elevated Screening Result"
                : "Lower Screening Result"}
            </h2>

            <p>{result.message}</p>

            <p>
              <strong>Model score:</strong> {result.score}
            </p>

            <hr />

            <small>
              This machine-learning tool is an educational screening prototype.
              It does not diagnose diabetes or prediabetes. Medical testing and
              evaluation by a healthcare professional are required for
              diagnosis.
            </small>
          </div>
        )}
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#f5f7fa",
  padding: "50px 20px",
};

const cardStyle = {
  maxWidth: "900px",
  margin: "0 auto",
  background: "white",
  padding: "35px",
  borderRadius: "16px",
  boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "20px",
  marginTop: "30px",
};

const fieldStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "7px",
};

const inputStyle = {
  padding: "11px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  fontSize: "15px",
};

const buttonStyle = {
  marginTop: "30px",
  width: "100%",
  padding: "14px",
  border: "none",
  borderRadius: "8px",
  background: "#2563eb",
  color: "white",
  fontSize: "16px",
  cursor: "pointer",
};

const resultStyle = {
  marginTop: "30px",
  padding: "25px",
  background: "#f8fafc",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
};