import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Info,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/diabetes-risk")({
  component: DiabetesRiskPage,
});

type FormData = {
  HighBP: number;
  HighChol: number;
  BMI: number;
  Smoker: number;
  HeartDiseaseorAttack: number;
  PhysActivity: number;
  Fruits: number;
  Veggies: number;
  GenHlth: number;
  Age: number;
  Sex: number;
};

type ScreeningResult = {
  score: number;
  threshold: number;
  screen_positive: boolean;
  message: string;
};

function DiabetesRiskPage() {
  const [form, setForm] = useState<FormData>({
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

  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const updateField = (field: keyof FormData, value: number) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setResult(null);
    setErrorMessage("");
  };

  const submitScreening = async () => {
    setLoading(true);
    setResult(null);
    setErrorMessage("");

    try {
      if (form.BMI < 10 || form.BMI > 70) {
        setErrorMessage("Please enter a BMI between 10 and 70.");
        return;
      }

      const response = await fetch("http://127.0.0.1:8000/predict-diabetes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        throw new Error("Prediction request failed.");
      }

      const data: ScreeningResult = await response.json();

      setResult(data);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        "Could not connect to the screening model. Make sure the Python API is running.",
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
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

    setResult(null);
    setErrorMessage("");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="surface-soft border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
          <Button variant="ghost" size="sm" asChild className="-ml-3 mb-6">
            <Link to="/">
              <ArrowLeft className="size-4" />
              Back to clinic
            </Link>
          </Button>

          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
              <Activity className="size-6" />
            </span>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                AI Health Tool
              </p>

              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                Diabetes Risk Screening
              </h1>

              <p className="mt-3 max-w-2xl text-muted-foreground">
                Answer a short health questionnaire to receive a
                machine-learning-assisted diabetes and prediabetes screening
                result.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main */}
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Card className="shadow-card">
          <CardContent className="p-6 sm:p-8">
            <div>
              <h2 className="text-2xl font-semibold">
                Health questionnaire
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Provide the information below as accurately as possible.
              </p>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {/* Age */}
              <FormField
                label="Age"
                description="Select your age group."
              >
                <select
                  value={form.Age}
                  onChange={(event) =>
                    updateField("Age", Number(event.target.value))
                  }
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
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
              </FormField>

              {/* Sex */}
              <FormField label="Sex">
                <select
                  value={form.Sex}
                  onChange={(event) =>
                    updateField("Sex", Number(event.target.value))
                  }
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value={0}>Female</option>
                  <option value={1}>Male</option>
                </select>
              </FormField>

              {/* BMI */}
              <FormField
                label="BMI"
                description="Body mass index."
              >
                <input
                  type="number"
                  min={10}
                  max={70}
                  step={0.1}
                  value={form.BMI}
                  onChange={(event) =>
                    updateField("BMI", Number(event.target.value))
                  }
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </FormField>

              {/* General health */}
              <FormField
                label="General health"
                description="How would you describe your overall health?"
              >
                <select
                  value={form.GenHlth}
                  onChange={(event) =>
                    updateField("GenHlth", Number(event.target.value))
                  }
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value={1}>Excellent</option>
                  <option value={2}>Very good</option>
                  <option value={3}>Good</option>
                  <option value={4}>Fair</option>
                  <option value={5}>Poor</option>
                </select>
              </FormField>

              <YesNoField
                label="High blood pressure"
                value={form.HighBP}
                onChange={(value) => updateField("HighBP", value)}
              />

              <YesNoField
                label="High cholesterol"
                value={form.HighChol}
                onChange={(value) => updateField("HighChol", value)}
              />

              <YesNoField
                label="Smoking history"
                description="Have you smoked at least 100 cigarettes in your lifetime?"
                value={form.Smoker}
                onChange={(value) => updateField("Smoker", value)}
              />

              <YesNoField
                label="Heart disease or heart attack history"
                value={form.HeartDiseaseorAttack}
                onChange={(value) =>
                  updateField("HeartDiseaseorAttack", value)
                }
              />

              <YesNoField
                label="Physical activity"
                description="Any physical activity during the past 30 days, excluding work?"
                value={form.PhysActivity}
                onChange={(value) => updateField("PhysActivity", value)}
              />

              <YesNoField
                label="Fruit daily"
                description="Do you usually consume fruit at least once per day?"
                value={form.Fruits}
                onChange={(value) => updateField("Fruits", value)}
              />

              <YesNoField
                label="Vegetables daily"
                description="Do you usually consume vegetables at least once per day?"
                value={form.Veggies}
                onChange={(value) => updateField("Veggies", value)}
              />
            </div>

            {errorMessage && (
              <div className="mt-6 flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />

                <p className="text-sm">{errorMessage}</p>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={submitScreening}
                disabled={loading}
                className="sm:flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Activity className="size-4" />
                    Check screening result
                  </>
                )}
              </Button>

              <Button
                size="lg"
                variant="outline"
                onClick={resetForm}
                disabled={loading}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* RESULT */}
        {result && (
          <Card
            className={`mt-8 overflow-hidden border-2 shadow-card ${result.screen_positive
                ? "border-amber-200 bg-amber-50/40"
                : "border-emerald-200 bg-emerald-50/40"
              }`}
          >
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div
                  className={`flex size-12 shrink-0 items-center justify-center rounded-full ${result.screen_positive
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                    }`}
                >
                  {result.screen_positive ? (
                    <AlertTriangle className="size-6" />
                  ) : (
                    <CheckCircle2 className="size-6" />
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Screening result
                  </p>

                  <h2 className="mt-1 text-2xl font-semibold">
                    {result.screen_positive
                      ? "Elevated screening signal"
                      : "Lower screening signal"}
                  </h2>
                </div>
              </div>

              {result.screen_positive ? (
                <ElevatedResult />
              ) : (
                <LowerResult />
              )}

              {/* Technical details */}
              <details className="mt-6 rounded-xl border bg-background p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Technical details
                </summary>

                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <p>
                    Model score:{" "}
                    <span className="font-mono font-medium text-foreground">
                      {Number(result.score).toFixed(4)}
                    </span>
                  </p>

                  <p>
                    Screening threshold:{" "}
                    <span className="font-mono font-medium text-foreground">
                      {Number(result.threshold).toFixed(3)}
                    </span>
                  </p>

                  <p className="pt-2">
                    The model score is a technical model output. It should not
                    be interpreted as your percentage chance of having diabetes.
                  </p>
                </div>
              </details>

              {/* Disclaimer */}
              <div className="mt-6 flex gap-3 rounded-xl bg-muted/60 p-4">
                <Info className="mt-0.5 size-5 shrink-0 text-primary" />

                <p className="text-sm leading-relaxed text-muted-foreground">
                  This machine-learning tool is an educational screening
                  prototype. It cannot diagnose diabetes or prediabetes and does
                  not replace medical evaluation or laboratory testing.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="outline" onClick={resetForm}>
                  Start again
                </Button>

                <Button asChild>
                  <Link to="/appointments">
                    Book an appointment
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ABOUT */}
        <Card className="mt-8 shadow-card">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold">
              About this screening tool
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The model uses health-related information such as age, BMI, blood
              pressure, cholesterol, physical activity and general health. It
              was created as a machine-learning demonstration and is intended
              to support health awareness, not provide a medical diagnosis.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function ElevatedResult() {
  return (
    <div className="mt-6">
      <p className="leading-relaxed">
        Based on the information you provided, the model identified an
        elevated diabetes/prediabetes screening signal.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-background p-5">
          <h3 className="font-semibold">What does this mean?</h3>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your answers matched patterns associated with diabetes or
            prediabetes in the dataset used to train this model. This does not
            mean that you have diabetes.
          </p>
        </div>

        <div className="rounded-xl border bg-background p-5">
          <h3 className="font-semibold">Recommended next step</h3>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Consider discussing appropriate diabetes testing with a healthcare
            professional, especially if you have symptoms or other risk
            factors.
          </p>
        </div>
      </div>
    </div>
  );
}

function LowerResult() {
  return (
    <div className="mt-6">
      <p className="leading-relaxed">
        Based on the information you provided, the model did not identify an
        elevated diabetes/prediabetes screening signal.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-background p-5">
          <h3 className="font-semibold">What does this mean?</h3>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your answers produced a score below this model&apos;s screening
            threshold. A lower screening result does not rule out diabetes or
            prediabetes.
          </p>
        </div>

        <div className="rounded-xl border bg-background p-5">
          <h3 className="font-semibold">Recommended next step</h3>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Continue routine health checks. If you have symptoms, concerns, or
            have been advised to undergo diabetes testing, speak with a
            healthcare professional.
          </p>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className="text-sm font-medium">{label}</label>

        {description && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {children}
    </div>
  );
}

function YesNoField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <FormField label={label} description={description}>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        <option value={0}>No</option>
        <option value={1}>Yes</option>
      </select>
    </FormField>
  );
}