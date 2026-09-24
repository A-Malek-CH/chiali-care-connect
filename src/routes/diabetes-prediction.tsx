import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/diabetes-prediction")({
  head: () => ({
    meta: [
      { title: "Diabetes Prediction — Chiali Clinic" },
      {
        name: "description",
        content: "Predict your diabetes risk with our advanced machine learning model.",
      },
    ],
  }),
  component: DiabetesPredictionComponent,
});

function DiabetesPredictionComponent() {
  const [age, setAge] = useState<string>("");
  const [glucose, setGlucose] = useState<string>("");
  const [insulin, setInsulin] = useState<string>("");
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"healthy" | "at risk" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Age: parseFloat(age),
          Glucose: parseFloat(glucose),
          Insulin: parseFloat(insulin),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get prediction from server.");
      }

      const data = await response.json();
      setResult(data.result);
    } catch (err) {
      console.error(err);
      setError("An error occurred while connecting to the prediction server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="mb-8 max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Diabetes Risk Prediction
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Enter your metrics below to evaluate your risk using our advanced ML model.
        </p>
      </div>

      <Card className="w-full max-w-md shadow-lg">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Activity className="size-6 text-primary" />
              Patient Data
            </CardTitle>
            <CardDescription>
              Please provide accurate values for the best results.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                placeholder="e.g. 45"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
                min="0"
                max="120"
                step="0.1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="glucose">Glucose Level</Label>
              <Input
                id="glucose"
                type="number"
                placeholder="e.g. 110"
                value={glucose}
                onChange={(e) => setGlucose(e.target.value)}
                required
                min="0"
                step="0.1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insulin">Insulin Level</Label>
              <Input
                id="insulin"
                type="number"
                placeholder="e.g. 80"
                value={insulin}
                onChange={(e) => setInsulin(e.target.value)}
                required
                min="0"
                step="0.1"
              />
            </div>

            {error && (
              <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {result && (
              <div
                className={`mt-6 flex items-center gap-3 rounded-lg border p-4 ${
                  result === "at risk"
                    ? "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/50 dark:bg-orange-900/20 dark:text-orange-200"
                    : "border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-200"
                }`}
              >
                {result === "at risk" ? (
                  <AlertCircle className="size-6 shrink-0" />
                ) : (
                  <CheckCircle2 className="size-6 shrink-0" />
                )}
                <div>
                  <h3 className="font-semibold capitalize">{result}</h3>
                  <p className="text-sm opacity-90">
                    {result === "at risk"
                      ? "Your indicators suggest a risk of diabetes. We recommend consulting a specialist."
                      : "Your indicators look healthy. Keep up the good work!"}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full text-lg"
              size="lg"
              disabled={loading}
            >
              {loading ? "Analyzing..." : "Analyze Risk"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
