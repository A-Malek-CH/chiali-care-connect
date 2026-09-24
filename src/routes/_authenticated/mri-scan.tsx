import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  Upload,
  FileImage,
  AlertCircle,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mri-scan")({
  component: MriScanPage,
});

function MriScanPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    status: "success" | "warning" | "error";
    message: string;
    confidence: number;
    details: string[];
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setResults(null);
      setProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
      setResults(null);
      setProgress(0);
    }
  };

  const analyzeScan = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setProgress(20);
    setResults(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      // Animate progress bar while waiting for the real API
      const interval = setInterval(() => {
        setProgress((prev) => (prev < 90 ? prev + 10 : prev));
      }, 500);

      const response = await fetch("http://localhost:8000/predict", {
        method: "POST",
        body: formData,
      });

      clearInterval(interval);
      setProgress(100);

      if (!response.ok) {
        throw new Error("API request failed. Is the Python server running?");
      }

      const data = await response.json();

      setResults({
        status: data.status,
        message: data.message,
        confidence: data.confidence,
        details: data.details,
      });

      toast.success("Scan analysis complete");
    } catch (error: unknown) {
      console.error(error);
      toast.error("Failed to analyze scan", {
        description:
          "Please ensure the local Python API is running on port 8000.",
      });
      setProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container max-w-4xl py-10 px-4 md:px-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary/10 rounded-2xl text-primary">
          <Brain className="size-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            MRI Analysis
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Upload your MRI scan for immediate, AI-powered preliminary analysis.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card className="border-border/60 shadow-sm transition-all hover:shadow-md">
          <CardHeader>
            <CardTitle>Upload Scan</CardTitle>
            <CardDescription>
              We accept standard image formats (JPEG, PNG) for this
              demonstration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`
                border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300
                ${isUploading ? "border-primary/20 bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer"}
              `}
              onDragOver={!isUploading ? handleDragOver : undefined}
              onDrop={!isUploading ? handleDrop : undefined}
              onClick={() =>
                !isUploading && document.getElementById("file-upload")?.click()
              }
            >
              <input
                id="file-upload"
                type="file"
                className="hidden"
                accept="image/jpeg, image/png, image/jpg"
                onChange={handleFileChange}
                disabled={isUploading}
              />

              {!selectedFile ? (
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="bg-primary/10 p-4 rounded-full text-primary">
                    <Upload className="size-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG or JPG (max. 10MB)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="bg-emerald-500/10 p-4 rounded-full text-emerald-500">
                    <FileImage className="size-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-sm truncate max-w-[200px]">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  {!isUploading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setResults(null);
                      }}
                      className="mt-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              )}
            </div>

            {isUploading && (
              <div className="mt-6 space-y-2 animate-in fade-in">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground animate-pulse">
                    Analyzing scan with AI models...
                  </span>
                  <span className="text-primary">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-2">
            <Button
              className="w-full gap-2 transition-all"
              size="lg"
              disabled={!selectedFile || isUploading}
              onClick={analyzeScan}
            >
              {isUploading ? (
                <>
                  <Activity className="size-4 animate-pulse" />
                  Processing...
                </>
              ) : (
                <>
                  <Brain className="size-4" />
                  Analyze Scan
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <div className="space-y-6">
          <Card
            className={`border-border/60 shadow-sm transition-all duration-500 ${
              results
                ? "opacity-100 translate-y-0"
                : "opacity-50 translate-y-2 grayscale"
            }`}
          >
            <CardHeader>
              <CardTitle>Analysis Results</CardTitle>
              <CardDescription>
                AI-generated preliminary findings. Always consult with a doctor.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {results ? (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
                  <div
                    className={`flex items-start gap-4 p-4 rounded-xl border ${
                      results.status === "success"
                        ? "bg-emerald-500/10 border-emerald-500/20"
                        : "bg-amber-500/10 border-amber-500/20"
                    }`}
                  >
                    <CheckCircle2
                      className={`size-6 shrink-0 mt-0.5 ${
                        results.status === "success"
                          ? "text-emerald-500"
                          : "text-amber-500"
                      }`}
                    />
                    <div>
                      <h4
                        className={`font-semibold ${
                          results.status === "success"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {results.message}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        AI Confidence Score:{" "}
                        <span className="font-bold">{results.confidence}%</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h5 className="text-sm font-semibold text-foreground">
                      Detailed Findings
                    </h5>
                    <ul className="space-y-2">
                      {results.details.map((detail, idx) => (
                        <li
                          key={idx}
                          className="flex gap-2 text-sm text-muted-foreground"
                        >
                          <span className="text-primary/60 mt-0.5">•</span>
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 bg-amber-500/10 rounded-lg flex gap-3 text-sm text-amber-700 dark:text-amber-400/90 border border-amber-500/20">
                    <AlertCircle className="size-5 shrink-0" />
                    <p>
                      This is a preliminary analysis and does not replace a
                      professional medical diagnosis.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 text-muted-foreground">
                  <Activity className="size-10 opacity-20" />
                  <p className="text-sm max-w-[200px]">
                    Upload and analyze a scan to view results here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
