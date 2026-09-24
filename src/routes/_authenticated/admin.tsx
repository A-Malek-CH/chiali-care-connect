import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Brain,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Send,
  Sparkles,
  Phone,
  MessageSquare,
  RefreshCw,
  Sliders,
  Calendar,
  Clock,
  User,
  Activity,
  Layers,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { STATUS_LABELS } from "@/lib/clinic-data";
import {
  predictBatchAppointmentRisk,
  predictAppointmentRisk,
  generateSmartNotificationMessage,
  dispatchNotification,
  getSentNotifications,
  recordSentNotification,
  type AIRiskPrediction,
  type SentNotificationRecord,
} from "@/lib/ai-no-show";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin AI Attendance & Dashboard — Chiali Clinic" },
      {
        name: "description",
        content:
          "AI-driven appointment attendance predictor and clinic management dashboard to prevent no-shows.",
      },
      { property: "og:title", content: "Admin Dashboard — Chiali Clinic" },
    ],
  }),
  component: AdminPage,
});

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function calculateWaitingDays(requestedAt: string, createdAt?: string) {
  try {
    const req = new Date(requestedAt).getTime();
    const cre = createdAt ? new Date(createdAt).getTime() : Date.now();
    return Math.max(0, Math.round((req - cre) / (1000 * 3600 * 24)));
  } catch {
    return 0;
  }
}

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("ai-detector");
  const [drafts, setDrafts] = useState<Record<string, { when: string; note: string }>>({});
  
  // AI Prediction State
  const [predictions, setPredictions] = useState<Record<string, AIRiskPrediction>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | "high" | "moderate" | "low">("all");
  const [sentRecords, setSentRecords] = useState<Record<string, SentNotificationRecord>>({});

  // Notification Modal State
  const [selectedAppt, setSelectedAppt] = useState<any | null>(null);
  const [notifChannel, setNotifChannel] = useState<"sms" | "whatsapp" | "call">("sms");
  const [notifMessage, setNotifMessage] = useState("");
  const [isSendingNotif, setIsSendingNotif] = useState(false);

  // AI Simulator Sandbox State
  const [simAge, setSimAge] = useState<number>(35);
  const [simWaitingDays, setSimWaitingDays] = useState<number>(14);
  const [simScholarship, setSimScholarship] = useState<boolean>(false);
  const [simHypertension, setSimHypertension] = useState<boolean>(false);
  const [simDiabetes, setSimDiabetes] = useState<boolean>(false);
  const [simAlcoholism, setSimAlcoholism] = useState<boolean>(false);
  const [simHandicap, setSimHandicap] = useState<boolean>(false);
  const [simSmsReceived, setSimSmsReceived] = useState<boolean>(false);
  const [simWeekday, setSimWeekday] = useState<number>(2);
  const [simHour, setSimHour] = useState<number>(10);
  const [simResult, setSimResult] = useState<AIRiskPrediction | null>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  // Load sent notification records from storage on mount
  useEffect(() => {
    setSentRecords(getSentNotifications());
  }, []);

  const appointments = useQuery({
    queryKey: ["all-appointments"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("requested_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Run AI Model Batch Prediction whenever appointments list changes or notifications update
  useEffect(() => {
    if (!appointments.data || appointments.data.length === 0) return;

    let isMounted = true;
    const runBatchEvaluation = async () => {
      setIsAnalyzing(true);
      try {
        const payload = appointments.data.map((appt) => {
          const hasReceivedReminder = !!sentRecords[appt.id] || (appt.admin_note?.includes("[Reminder Sent]") ?? false);
          return {
            id: appt.id,
            requested_at: appt.requested_at,
            created_at: appt.created_at,
            full_name: appt.full_name,
            phone: appt.phone,
            service: appt.service,
            waiting_days: calculateWaitingDays(appt.requested_at, appt.created_at),
            sms_received: hasReceivedReminder ? 1 : 0,
            age: 38,
            scholarship: 0,
            hipertension: 0,
            diabetes: 0,
            alcoholism: 0,
            handcap: 0,
          };
        });

        const results = await predictBatchAppointmentRisk(payload);
        if (isMounted) {
          const map: Record<string, AIRiskPrediction> = {};
          results.forEach((r) => {
            if (r.id) map[r.id] = r;
          });
          setPredictions(map);
        }
      } catch (err) {
        console.error("AI Evaluation error:", err);
      } finally {
        if (isMounted) setIsAnalyzing(false);
      }
    };

    void runBatchEvaluation();

    return () => {
      isMounted = false;
    };
  }, [appointments.data, sentRecords]);

  // Run Live Simulator Evaluation
  useEffect(() => {
    let active = true;
    const runSim = async () => {
      setSimLoading(true);
      try {
        const res = await predictAppointmentRisk({
          age: simAge,
          waiting_days: simWaitingDays,
          scholarship: simScholarship ? 1 : 0,
          hipertension: simHypertension ? 1 : 0,
          diabetes: simDiabetes ? 1 : 0,
          alcoholism: simAlcoholism ? 1 : 0,
          handcap: simHandicap ? 1 : 0,
          sms_received: simSmsReceived ? 1 : 0,
          appointment_weekday: simWeekday,
          appointment_month: 6,
          scheduled_hour: simHour,
        });
        if (active) setSimResult(res);
      } catch (e) {
        console.error("Simulator error:", e);
      } finally {
        if (active) setSimLoading(false);
      }
    };

    const timer = setTimeout(runSim, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    simAge,
    simWaitingDays,
    simScholarship,
    simHypertension,
    simDiabetes,
    simAlcoholism,
    simHandicap,
    simSmsReceived,
    simWeekday,
    simHour,
  ]);

  const update = useMutation({
    mutationFn: async (vars: {
      id: string;
      status: "confirmed" | "rescheduled" | "cancelled";
      suggested_at?: string | null;
      admin_note?: string | null;
    }) => {
      const { id, ...patch } = vars;
      const { error } = await supabase.from("appointments").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Appointment updated successfully.");
      void queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Open notification modal with pre-generated message
  const handleOpenNotification = (appt: any) => {
    setSelectedAppt(appt);
    const pred = predictions[appt.id];
    const initialMsg = generateSmartNotificationMessage({
      fullName: appt.full_name,
      service: appt.service,
      requestedAt: appt.requested_at,
      riskLevel: pred?.risk_level ?? "Moderate",
    });
    setNotifMessage(initialMsg);
    setNotifChannel("sms");
  };

  // Dispatch individual notification
  const handleSendNotification = async () => {
    if (!selectedAppt) return;
    setIsSendingNotif(true);
    try {
      const result = await dispatchNotification({
        appointmentId: selectedAppt.id,
        phone: selectedAppt.phone,
        fullName: selectedAppt.full_name,
        channel: notifChannel,
        message: notifMessage,
      });

      const record: SentNotificationRecord = {
        appointmentId: selectedAppt.id,
        sentAt: new Date().toISOString(),
        channel: notifChannel,
        message: notifMessage,
        sentBy: "Clinic Admin",
      };

      recordSentNotification(record);
      setSentRecords((prev) => ({ ...prev, [selectedAppt.id]: record }));

      // Append note to supabase appointment
      const existingNote = selectedAppt.admin_note ? `${selectedAppt.admin_note} | ` : "";
      const updatedNote = `${existingNote}[Reminder Sent via ${notifChannel.toUpperCase()} on ${new Date().toLocaleDateString()}]`;
      
      await supabase
        .from("appointments")
        .update({ admin_note: updatedNote })
        .eq("id", selectedAppt.id);

      toast.success(`Reminder sent to ${selectedAppt.full_name} via ${notifChannel.toUpperCase()}!`);
      setSelectedAppt(null);
      void queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
    } catch (err: any) {
      toast.error(`Failed to send notification: ${err.message}`);
    } finally {
      setIsSendingNotif(false);
    }
  };

  // Send batch reminders to all high-risk patients
  const handleSendBatchHighRiskReminders = async () => {
    const highRiskAppts = (appointments.data ?? []).filter((appt) => {
      const pred = predictions[appt.id];
      const hasReminder = !!sentRecords[appt.id];
      return pred?.is_high_risk && !hasReminder && appt.status !== "cancelled";
    });

    if (highRiskAppts.length === 0) {
      toast.info("No un-notified high-risk appointments found.");
      return;
    }

    toast.loading(`Sending reminders to ${highRiskAppts.length} high-risk patients...`, {
      id: "batch-notifs",
    });

    let count = 0;
    for (const appt of highRiskAppts) {
      const pred = predictions[appt.id];
      const msg = generateSmartNotificationMessage({
        fullName: appt.full_name,
        service: appt.service,
        requestedAt: appt.requested_at,
        riskLevel: pred?.risk_level ?? "High",
      });

      await dispatchNotification({
        appointmentId: appt.id,
        phone: appt.phone,
        fullName: appt.full_name,
        channel: "sms",
        message: msg,
      });

      const record: SentNotificationRecord = {
        appointmentId: appt.id,
        sentAt: new Date().toISOString(),
        channel: "sms",
        message: msg,
        sentBy: "Clinic Admin AI Automation",
      };
      recordSentNotification(record);
      setSentRecords((prev) => ({ ...prev, [appt.id]: record }));
      count++;
    }

    toast.success(`Dispatched ${count} AI reminder notifications!`, { id: "batch-notifs" });
    void queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
  };

  // Filtered appointments computation
  const filteredAppointments = useMemo(() => {
    const list = appointments.data ?? [];
    return list.filter((appt) => {
      const pred = predictions[appt.id];
      const matchesSearch =
        appt.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        appt.phone.includes(searchQuery) ||
        appt.service.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (riskFilter === "high") return pred?.is_high_risk;
      if (riskFilter === "moderate") return pred?.risk_level === "Moderate";
      if (riskFilter === "low") return pred?.risk_level === "Low";
      return true;
    });
  }, [appointments.data, predictions, searchQuery, riskFilter]);

  // Statistics calculation
  const stats = useMemo(() => {
    const list = appointments.data ?? [];
    let highRiskCount = 0;
    let moderateRiskCount = 0;
    let remindersSentCount = 0;

    list.forEach((appt) => {
      const pred = predictions[appt.id];
      if (pred?.is_high_risk) highRiskCount++;
      else if (pred?.risk_level === "Moderate") moderateRiskCount++;

      if (sentRecords[appt.id] || appt.admin_note?.includes("[Reminder Sent]")) {
        remindersSentCount++;
      }
    });

    return {
      total: list.length,
      highRisk: highRiskCount,
      moderateRisk: moderateRiskCount,
      remindersSent: remindersSentCount,
    };
  }, [appointments.data, predictions, sentRecords]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="size-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading clinic administration...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="px-4 py-20 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldCheck className="size-8" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold">Staff Only Access</h1>
        <p className="mt-2 text-muted-foreground">
          This dashboard is reserved for authorized clinic medical and administrative personnel.
        </p>
      </div>
    );
  }

  return (
    <div className="surface-soft min-h-[85vh] px-4 py-8 md:py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header Title */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Brain className="size-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Attendance Intelligence & Operations
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground md:text-base">
              Predict patient no-shows with machine learning (<span className="font-mono text-xs font-semibold text-primary">IsolationForest</span>) and dispatch proactive retention alerts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
                toast.success("Synchronized clinic records.");
              }}
              className="gap-1.5"
            >
              <RefreshCw className={`size-4 ${isAnalyzing ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>
            <Button
              size="sm"
              onClick={handleSendBatchHighRiskReminders}
              className="gap-1.5 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white shadow-sm"
            >
              <Bell className="size-4" />
              Notify All High-Risk Patients ({stats.highRisk})
            </Button>
          </div>
        </div>

        {/* Metric KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/80 shadow-sm bg-card/60 backdrop-blur">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Total Bookings
                  </p>
                  <p className="mt-1 text-3xl font-bold">{stats.total}</p>
                </div>
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Calendar className="size-5" />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                All patient appointment requests
              </p>
            </CardContent>
          </Card>

          <Card className="border-rose-200/50 bg-rose-50/40 shadow-sm dark:border-rose-900/30 dark:bg-rose-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                    High No-Show Risk
                  </p>
                  <p className="mt-1 text-3xl font-bold text-rose-600 dark:text-rose-400">
                    {stats.highRisk}
                  </p>
                </div>
                <div className="flex size-11 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300">
                  <AlertTriangle className="size-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-rose-700/80 dark:text-rose-400/80">
                <span>Flagged by AI Anomaly Model</span>
                <span className="font-semibold">{stats.total > 0 ? Math.round((stats.highRisk / stats.total) * 100) : 0}%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200/50 bg-amber-50/30 shadow-sm dark:border-amber-900/30 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Moderate Risk
                  </p>
                  <p className="mt-1 text-3xl font-bold text-amber-600 dark:text-amber-400">
                    {stats.moderateRisk}
                  </p>
                </div>
                <div className="flex size-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300">
                  <Activity className="size-5" />
                </div>
              </div>
              <p className="mt-3 text-xs text-amber-700/80 dark:text-amber-400/80">
                Scheduled for standard reminder
              </p>
            </CardContent>
          </Card>

          <Card className="border-emerald-200/50 bg-emerald-50/30 shadow-sm dark:border-emerald-900/30 dark:bg-emerald-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Reminders Dispatched
                  </p>
                  <p className="mt-1 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {stats.remindersSent}
                  </p>
                </div>
                <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <CheckCircle2 className="size-5" />
                </div>
              </div>
              <p className="mt-3 text-xs text-emerald-700/80 dark:text-emerald-400/80">
                SMS / WhatsApp retention alerts sent
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-lg bg-muted/80 p-1">
            <TabsTrigger value="ai-detector" className="flex items-center gap-2">
              <Brain className="size-4 text-primary" />
              <span>AI Risk Hub</span>
            </TabsTrigger>
            <TabsTrigger value="all-requests" className="flex items-center gap-2">
              <Layers className="size-4" />
              <span>All Requests</span>
            </TabsTrigger>
            <TabsTrigger value="simulator" className="flex items-center gap-2">
              <Sliders className="size-4 text-amber-600" />
              <span>Model Sandbox</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: AI Risk Hub */}
          <TabsContent value="ai-detector" className="space-y-6">
            {/* Filter and Search Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search patient name, phone, or medical service..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Filter Risk:</span>
                <div className="flex gap-1">
                  <Button
                    variant={riskFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRiskFilter("all")}
                    className="h-8 text-xs"
                  >
                    All
                  </Button>
                  <Button
                    variant={riskFilter === "high" ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => setRiskFilter("high")}
                    className="h-8 text-xs"
                  >
                    High Risk ({stats.highRisk})
                  </Button>
                  <Button
                    variant={riskFilter === "moderate" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setRiskFilter("moderate")}
                    className="h-8 text-xs"
                  >
                    Moderate ({stats.moderateRisk})
                  </Button>
                </div>
              </div>
            </div>

            {/* Appointment Risk Cards List */}
            <div className="space-y-4">
              {appointments.isLoading && (
                <div className="p-12 text-center text-muted-foreground">
                  <RefreshCw className="mx-auto size-6 animate-spin text-primary" />
                  <p className="mt-2 text-sm">Evaluating appointment risks with AI model...</p>
                </div>
              )}

              {!appointments.isLoading && filteredAppointments.length === 0 && (
                <Card className="p-12 text-center border-dashed">
                  <CheckCircle2 className="mx-auto size-10 text-muted-foreground/60" />
                  <h3 className="mt-3 text-lg font-medium">No appointments match your filters</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try adjusting your search query or risk filters.
                  </p>
                </Card>
              )}

              {filteredAppointments.map((appt) => {
                const pred = predictions[appt.id];
                const notif = sentRecords[appt.id];
                const waitingDays = calculateWaitingDays(appt.requested_at, appt.created_at);
                const hasReminder = !!notif || appt.admin_note?.includes("[Reminder Sent]");

                return (
                  <Card
                    key={appt.id}
                    className={`transition-all border shadow-sm hover:shadow-md ${
                      pred?.is_high_risk && !hasReminder
                        ? "border-rose-300/80 bg-rose-50/20 dark:border-rose-900/50 dark:bg-rose-950/10"
                        : pred?.risk_level === "Moderate"
                          ? "border-amber-200/60 bg-amber-50/10 dark:border-amber-900/40"
                          : "border-border/80"
                    }`}
                  >
                    <CardContent className="p-5 md:p-6 space-y-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        {/* Patient info */}
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold">{appt.full_name}</h3>
                            <Badge variant="outline" className="text-xs font-normal">
                              {appt.phone}
                            </Badge>
                            <Badge
                              variant={
                                appt.status === "confirmed"
                                  ? "default"
                                  : appt.status === "cancelled"
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="text-xs"
                            >
                              {STATUS_LABELS[appt.status] ?? appt.status}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{appt.service}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3.5 text-primary" />
                              Requested: <strong className="text-foreground">{formatDate(appt.requested_at)}</strong>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="size-3.5" />
                              Lead time: {waitingDays} days
                            </span>
                          </div>

                          {appt.notes && (
                            <p className="text-xs italic text-muted-foreground bg-muted/40 rounded-md p-2 mt-1">
                              Patient note: “{appt.notes}”
                            </p>
                          )}
                        </div>

                        {/* AI Risk Score Badge */}
                        <div className="flex flex-col items-start md:items-end gap-1.5 shrink-0">
                          {pred ? (
                            <div className="flex flex-col items-start md:items-end">
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={`px-2.5 py-1 text-xs font-semibold ${
                                    pred.is_high_risk
                                      ? "bg-rose-600 hover:bg-rose-700 text-white"
                                      : pred.risk_level === "Moderate"
                                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                  }`}
                                >
                                  {pred.is_high_risk ? "🚨 High No-Show Risk" : `${pred.risk_level} Risk`} ({pred.risk_percentage}%)
                                </Badge>
                              </div>
                              <span className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                                IsolationForest Score: {pred.score}
                              </span>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Evaluating...
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* AI Risk Analysis & Action Bar */}
                      <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                            <Sparkles className="size-3.5 text-primary" />
                            <span>AI Contributing Risk Factors:</span>
                          </div>
                          {hasReminder ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="size-3" />
                              Reminder Dispatched
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 text-[11px] flex items-center gap-1">
                              <Bell className="size-3" />
                              Action Required
                            </Badge>
                          )}
                        </div>

                        {pred?.risk_factors && pred.risk_factors.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {pred.risk_factors.map((f, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center rounded-md bg-background px-2 py-0.5 text-xs text-muted-foreground border border-border/70"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Standard demographic & booking parameters. Low probability of no-show.
                          </p>
                        )}

                        {pred?.recommended_action && (
                          <p className="text-xs font-medium text-foreground pt-1">
                            <span className="text-primary font-semibold">Recommended Intervention:</span>{" "}
                            {pred.recommended_action}
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
                        <div className="text-xs text-muted-foreground">
                          {appt.admin_note && <span>Admin note: {appt.admin_note}</span>}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant={pred?.is_high_risk && !hasReminder ? "default" : "outline"}
                            className="gap-1.5 text-xs h-8"
                            onClick={() => handleOpenNotification(appt)}
                          >
                            <Send className="size-3.5" />
                            {hasReminder ? "Send Follow-up Alert" : "Send AI Reminder"}
                          </Button>

                          <Button
                            size="sm"
                            variant="secondary"
                            className="text-xs h-8"
                            disabled={update.isPending}
                            onClick={() =>
                              update.mutate({
                                id: appt.id,
                                status: "confirmed",
                                suggested_at: null,
                              })
                            }
                          >
                            Confirm
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* TAB 2: Classic All Requests */}
          <TabsContent value="all-requests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Appointment Requests & Rescheduling</CardTitle>
                <CardDescription>
                  Confirm patient requests or suggest an alternate time slot.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {appointments.data?.map((appt) => {
                  const draft = drafts[appt.id] ?? { when: "", note: "" };
                  return (
                    <Card key={appt.id} className="shadow-sm border-border/70">
                      <CardContent className="space-y-4 pt-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold">{appt.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {appt.phone} · {appt.service}
                            </p>
                            <p className="mt-1 text-sm">
                              Requested for{" "}
                              <span className="font-medium">{formatDate(appt.requested_at)}</span>
                            </p>
                            {appt.notes && (
                              <p className="mt-1 text-sm text-muted-foreground">“{appt.notes}”</p>
                            )}
                            {appt.suggested_at && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                Suggested: {formatDate(appt.suggested_at)}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant={
                              appt.status === "confirmed"
                                ? "default"
                                : appt.status === "cancelled"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {STATUS_LABELS[appt.status] ?? appt.status}
                          </Badge>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`when-${appt.id}`}>Suggest another time</Label>
                            <Input
                              id={`when-${appt.id}`}
                              type="datetime-local"
                              value={draft.when}
                              onChange={(e) =>
                                setDrafts((d) => ({
                                  ...d,
                                  [appt.id]: { ...draft, when: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`note-${appt.id}`}>Message to patient</Label>
                            <Input
                              id={`note-${appt.id}`}
                              value={draft.note}
                              placeholder="Optional"
                              onChange={(e) =>
                                setDrafts((d) => ({
                                  ...d,
                                  [appt.id]: { ...draft, note: e.target.value },
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={update.isPending}
                            onClick={() =>
                              update.mutate({
                                id: appt.id,
                                status: "confirmed",
                                suggested_at: null,
                                admin_note: draft.note.trim() || null,
                              })
                            }
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={update.isPending}
                            onClick={() => {
                              if (!draft.when) {
                                toast.error("Choose the time you want to suggest.");
                                return;
                              }
                              update.mutate({
                                id: appt.id,
                                status: "rescheduled",
                                suggested_at: new Date(draft.when).toISOString(),
                                admin_note: draft.note.trim() || null,
                              });
                            }}
                          >
                            Suggest this time
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={update.isPending}
                            onClick={() =>
                              update.mutate({
                                id: appt.id,
                                status: "cancelled",
                                admin_note: draft.note.trim() || null,
                              })
                            }
                          >
                            Cancel
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: Interactive Model Simulator */}
          <TabsContent value="simulator" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Controls */}
              <div className="lg:col-span-7 space-y-5">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Sliders className="size-5 text-primary" />
                      AI Model Parameter Tester
                    </CardTitle>
                    <CardDescription>
                      Simulate patient and booking parameters to observe how the <strong className="text-foreground">IsolationForest</strong> anomaly model computes attendance likelihood in real time.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Age */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <Label>Patient Age</Label>
                        <span className="font-semibold">{simAge} years</span>
                      </div>
                      <Slider
                        value={[simAge]}
                        min={1}
                        max={100}
                        step={1}
                        onValueChange={(val) => {
                          const v = val[0];
                          if (typeof v === "number") setSimAge(v);
                        }}
                      />
                    </div>

                    {/* Waiting Days */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <Label>Waiting Period (Lead Time)</Label>
                        <span className="font-semibold">{simWaitingDays} days ahead</span>
                      </div>
                      <Slider
                        value={[simWaitingDays]}
                        min={0}
                        max={90}
                        step={1}
                        onValueChange={(val) => {
                          const v = val[0];
                          if (typeof v === "number") setSimWaitingDays(v);
                        }}
                      />
                    </div>

                    {/* Weekday & Hour */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Appointment Day</Label>
                        <Select
                          value={String(simWeekday)}
                          onValueChange={(v) => setSimWeekday(Number(v))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Monday</SelectItem>
                            <SelectItem value="1">Tuesday</SelectItem>
                            <SelectItem value="2">Wednesday</SelectItem>
                            <SelectItem value="3">Thursday</SelectItem>
                            <SelectItem value="4">Friday</SelectItem>
                            <SelectItem value="5">Saturday</SelectItem>
                            <SelectItem value="6">Sunday</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <Label>Scheduled Hour</Label>
                          <span className="font-semibold">{simHour}:00</span>
                        </div>
                        <Slider
                          value={[simHour]}
                          min={7}
                          max={19}
                          step={1}
                          onValueChange={(val) => {
                            const v = val[0];
                            if (typeof v === "number") setSimHour(v);
                          }}
                        />
                      </div>
                    </div>

                    {/* Medical & Social Toggles */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <Label htmlFor="sim-sms" className="cursor-pointer text-xs font-medium">
                          SMS Reminder Sent
                        </Label>
                        <Switch
                          id="sim-sms"
                          checked={simSmsReceived}
                          onCheckedChange={setSimSmsReceived}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <Label htmlFor="sim-scholarship" className="cursor-pointer text-xs font-medium">
                          Health Welfare / Assistance
                        </Label>
                        <Switch
                          id="sim-scholarship"
                          checked={simScholarship}
                          onCheckedChange={setSimScholarship}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <Label htmlFor="sim-hyp" className="cursor-pointer text-xs font-medium">
                          Hypertension History
                        </Label>
                        <Switch
                          id="sim-hyp"
                          checked={simHypertension}
                          onCheckedChange={setSimHypertension}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <Label htmlFor="sim-diab" className="cursor-pointer text-xs font-medium">
                          Diabetes History
                        </Label>
                        <Switch
                          id="sim-diab"
                          checked={simDiabetes}
                          onCheckedChange={setSimDiabetes}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <Label htmlFor="sim-alc" className="cursor-pointer text-xs font-medium">
                          Alcoholism Flag
                        </Label>
                        <Switch
                          id="sim-alc"
                          checked={simAlcoholism}
                          onCheckedChange={setSimAlcoholism}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <Label htmlFor="sim-hand" className="cursor-pointer text-xs font-medium">
                          Physical Handicap / Mobility
                        </Label>
                        <Switch
                          id="sim-hand"
                          checked={simHandicap}
                          onCheckedChange={setSimHandicap}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Output Preview */}
              <div className="lg:col-span-5 space-y-5">
                <Card className="border-primary/40 shadow-md">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center justify-between">
                      <span>Model Inference Output</span>
                      {simLoading && <RefreshCw className="size-4 animate-spin text-primary" />}
                    </CardTitle>
                    <CardDescription>
                      Calculated from preprocessor pipeline & IsolationForest estimator
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {simResult ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-border p-4 bg-muted/40 text-center space-y-2">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                            Predicted Abandonment Risk
                          </p>
                          <p className={`text-4xl font-extrabold ${
                            simResult.is_high_risk
                              ? "text-rose-600 dark:text-rose-400"
                              : simResult.risk_level === "Moderate"
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-emerald-600 dark:text-emerald-400"
                          }`}>
                            {simResult.risk_percentage}%
                          </p>
                          <Badge
                            className={`mt-1 ${
                              simResult.is_high_risk
                                ? "bg-rose-600 text-white"
                                : simResult.risk_level === "Moderate"
                                  ? "bg-amber-600 text-white"
                                  : "bg-emerald-600 text-white"
                            }`}
                          >
                            {simResult.is_high_risk ? "🚨 High No-Show Risk" : `${simResult.risk_level} Risk Category`}
                          </Badge>

                          <div className="pt-2">
                            <Progress value={simResult.risk_percentage} className="h-2" />
                          </div>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-border/50">
                            <span className="text-muted-foreground">Model Decision Score:</span>
                            <span className="font-mono font-semibold">{simResult.score}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-border/50">
                            <span className="text-muted-foreground">Anomaly Output (IsolationForest):</span>
                            <span className="font-mono font-semibold">
                              {simResult.prediction === -1 ? "-1 (Outlier / Abandonment Risk)" : "+1 (Normal Attendance)"}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-border/50">
                            <span className="text-muted-foreground">Recommended Action:</span>
                            <span className="font-semibold text-right max-w-[200px]">{simResult.recommended_action}</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold">Contributing Factors:</p>
                          <div className="flex flex-wrap gap-1">
                            {simResult.risk_factors.map((f, i) => (
                              <Badge key={i} variant="outline" className="text-[11px] font-normal">
                                {f}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Adjust parameters to see inference...</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Notification Dispatch Modal */}
      <Dialog open={!!selectedAppt} onOpenChange={(open) => !open && setSelectedAppt(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="size-5 text-primary" />
              Dispatch Patient Retention Alert
            </DialogTitle>
            <DialogDescription>
              Send an immediate reminder to confirm attendance and minimize no-show risk.
            </DialogDescription>
          </DialogHeader>

          {selectedAppt && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient:</span>
                  <span className="font-semibold">{selectedAppt.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-semibold">{selectedAppt.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Appointment:</span>
                  <span className="font-semibold">{formatDate(selectedAppt.requested_at)}</span>
                </div>
              </div>

              {/* Channel selector */}
              <div className="space-y-2">
                <Label>Communication Channel</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={notifChannel === "sms" ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setNotifChannel("sms")}
                  >
                    <MessageSquare className="size-4" />
                    SMS
                  </Button>
                  <Button
                    type="button"
                    variant={notifChannel === "whatsapp" ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setNotifChannel("whatsapp")}
                  >
                    <Phone className="size-4" />
                    WhatsApp
                  </Button>
                  <Button
                    type="button"
                    variant={notifChannel === "call" ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setNotifChannel("call")}
                  >
                    <User className="size-4" />
                    Call Log
                  </Button>
                </div>
              </div>

              {/* Message template */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notif-text">Customized Message</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-primary"
                    onClick={() => {
                      const pred = predictions[selectedAppt.id];
                      setNotifMessage(
                        generateSmartNotificationMessage({
                          fullName: selectedAppt.full_name,
                          service: selectedAppt.service,
                          requestedAt: selectedAppt.requested_at,
                          riskLevel: pred?.risk_level ?? "High",
                        })
                      );
                    }}
                  >
                    Reset AI Template
                  </Button>
                </div>
                <Textarea
                  id="notif-text"
                  rows={4}
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  placeholder="Enter message to patient..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAppt(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendNotification}
              disabled={isSendingNotif}
              className="gap-1.5"
            >
              {isSendingNotif ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Send Notification
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
