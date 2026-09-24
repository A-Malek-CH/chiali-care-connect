import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Sparkles,
  Send,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PhoneCall,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { STATUS_LABELS } from "@/lib/clinic-data";
import { assessAppointmentsBatch, type AiRiskResult } from "@/lib/ai-risk-service";
import { fetchNotifications, sendPatientNotification, type NotificationItem } from "@/lib/notifications";
import { AiStatsOverview } from "@/components/admin/AiStatsOverview";
import { AiRiskBadge } from "@/components/admin/AiRiskBadge";
import { SendAiNotificationModal } from "@/components/admin/SendAiNotificationModal";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin AI Dashboard — Chiali Clinic" },
      {
        name: "description",
        content: "Clinic staff dashboard to confirm appointments, assess AI no-show risk, and send patient reminders.",
      },
      { property: "og:title", content: "Admin AI Dashboard — Chiali Clinic" },
      {
        property: "og:description",
        content: "Predict potential appointment abandonment and dispatch proactive notifications.",
      },
    ],
  }),
  component: AdminPage,
});

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, { when: string; note: string }>>({});
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [selectedApptForNotif, setSelectedApptForNotif] = useState<{
    id: string;
    patient_id: string;
    full_name: string;
    phone: string;
    service: string;
    requested_at: string;
  } | null>(null);
  const [isNotifyingAll, setIsNotifyingAll] = useState(false);

  // Fetch all appointments
  const appointments = useQuery({
    queryKey: ["all-appointments"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch all notifications to track dispatched reminders
  const notificationsQuery = useQuery({
    queryKey: ["notifications", "admin-all"],
    enabled: isAdmin,
    queryFn: () => fetchNotifications(),
    refetchInterval: 15000,
  });

  const notificationsList = notificationsQuery.data ?? [];

  // Map which appointments have had notifications sent
  const notifMapByApptId = useMemo(() => {
    const map: Record<string, NotificationItem> = {};
    for (const notif of notificationsList) {
      if (notif.appointment_id) {
        map[notif.appointment_id] = notif;
      }
    }
    return map;
  }, [notificationsList]);

  // AI evaluations for all appointments
  const aiRiskMap = useMemo(() => {
    if (!appointments.data) return {};
    const sentMap = Object.fromEntries(
      Object.keys(notifMapByApptId).map((id) => [id, true]),
    );
    return assessAppointmentsBatch(appointments.data, sentMap);
  }, [appointments.data, notifMapByApptId]);

  // Filter appointments based on active tab
  const filteredAppointments = useMemo(() => {
    const list = appointments.data ?? [];
    if (activeFilter === "all") return list;
    if (activeFilter === "high-risk") {
      return list.filter((a) => aiRiskMap[a.id]?.risk_level === "High");
    }
    if (activeFilter === "moderate-risk") {
      return list.filter((a) => aiRiskMap[a.id]?.risk_level === "Moderate");
    }
    if (activeFilter === "pending") {
      return list.filter((a) => a.status === "pending");
    }
    if (activeFilter === "confirmed") {
      return list.filter((a) => a.status === "confirmed");
    }
    return list;
  }, [appointments.data, activeFilter, aiRiskMap]);

  // Update appointment status mutation
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
      toast.success("Appointment updated.");
      void queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Batch Notify All High-Risk Patients
  const handleNotifyAllHighRisk = async () => {
    const highRiskAppointments = (appointments.data ?? []).filter(
      (a) => aiRiskMap[a.id]?.risk_level === "High" && a.status !== "cancelled",
    );

    if (highRiskAppointments.length === 0) {
      toast.info("No high-risk appointments pending notification.");
      return;
    }

    try {
      setIsNotifyingAll(true);
      let count = 0;
      for (const appt of highRiskAppointments) {
        const apptDateStr = new Date(appt.requested_at).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
        await sendPatientNotification({
          patient_id: appt.patient_id,
          appointment_id: appt.id,
          title: "Urgent: Please confirm your appointment at Chiali Clinic",
          message: `Dear ${appt.full_name}, your ${appt.service} appointment is booked for ${apptDateStr}. Please confirm your attendance to hold your reserved slot.`,
          type: "no_show_warning",
          channel: "in_app",
          risk_score: aiRiskMap[appt.id]?.risk_percentage,
        });
        count++;
      }
      toast.success(`Dispatched AI attendance reminders to ${count} high-risk patients.`);
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to complete batch notification.");
    } finally {
      setIsNotifyingAll(false);
    }
  };

  if (loading) return <p className="p-12 text-center text-muted-foreground">Loading…</p>;

  if (!isAdmin) {
    return (
      <div className="px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Staff only</h1>
        <p className="mt-2 text-muted-foreground">
          This dashboard is reserved for clinic administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="surface-soft min-h-[70vh] px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header Title */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <ShieldCheck className="size-7 text-primary" />
              Clinic Operations & AI Retention Hub
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor bookings, detect potential client no-shows with AI, and dispatch proactive retention alerts.
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs font-semibold bg-primary/5 text-primary border-primary/20">
            <Sparkles className="size-3.5" />
            AI Isolation Forest Active
          </Badge>
        </div>

        {/* AI Stats Overview Cards */}
        <AiStatsOverview
          totalAppointments={appointments.data?.length ?? 0}
          riskMap={aiRiskMap}
          sentNotificationsCount={notificationsList.length}
          onNotifyAllHighRisk={handleNotifyAllHighRisk}
          isNotifyingAll={isNotifyingAll}
        />

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <Tabs value={activeFilter} onValueChange={setActiveFilter} className="w-full sm:w-auto">
            <TabsList className="grid grid-cols-3 sm:flex sm:h-9">
              <TabsTrigger value="all" className="text-xs">
                All ({appointments.data?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="high-risk" className="text-xs text-rose-600 dark:text-rose-400">
                High Risk ({Object.values(aiRiskMap).filter((r) => r.risk_level === "High").length})
              </TabsTrigger>
              <TabsTrigger value="moderate-risk" className="text-xs text-amber-600 dark:text-amber-400">
                Moderate Risk ({Object.values(aiRiskMap).filter((r) => r.risk_level === "Moderate").length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-xs">
                Pending
              </TabsTrigger>
              <TabsTrigger value="confirmed" className="text-xs">
                Confirmed
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Filter className="size-3.5" />
            Showing {filteredAppointments.length} requests
          </span>
        </div>

        {/* Appointment Cards List */}
        <div className="space-y-4">
          {appointments.isLoading && <p className="text-muted-foreground p-8 text-center">Loading requests and AI scores…</p>}
          
          {filteredAppointments.length === 0 && !appointments.isLoading && (
            <Card className="border-dashed p-10 text-center">
              <Sparkles className="size-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="font-semibold text-foreground">No appointments in this view</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try switching filter tabs or check back when new patient requests arrive.
              </p>
            </Card>
          )}

          {filteredAppointments.map((appt) => {
            const draft = drafts[appt.id] ?? { when: "", note: "" };
            const risk = aiRiskMap[appt.id];
            const existingNotif = notifMapByApptId[appt.id];

            return (
              <Card
                key={appt.id}
                className={`shadow-card transition-all border ${
                  risk?.risk_level === "High"
                    ? "border-rose-500/30 bg-rose-500/[0.015]"
                    : "border-border/60"
                }`}
              >
                <CardContent className="space-y-4 pt-6">
                  {/* Card Header with Patient Info, AI Badge, and Status */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-bold text-foreground">{appt.full_name}</p>
                        {risk && (
                          <AiRiskBadge
                            risk={risk}
                            onClickSendReminder={() => setSelectedApptForNotif(appt)}
                          />
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{appt.phone}</span>
                        <span>•</span>
                        <span className="font-medium text-primary">{appt.service}</span>
                        <span>•</span>
                        <span>Booked {new Date(appt.created_at).toLocaleDateString()}</span>
                      </p>

                      <p className="text-sm font-medium pt-0.5">
                        Requested for{" "}
                        <span className="font-semibold text-primary">{formatDate(appt.requested_at)}</span>
                      </p>

                      {appt.notes && (
                        <p className="text-xs text-muted-foreground bg-muted/40 p-2 rounded-md italic">
                          “{appt.notes}”
                        </p>
                      )}

                      {appt.suggested_at && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                          <Clock className="size-3" />
                          Suggested alternative: {formatDate(appt.suggested_at)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
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

                      {existingNotif ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
                        >
                          <CheckCircle2 className="size-3" />
                          Reminder Sent ({existingNotif.status})
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                          onClick={() => setSelectedApptForNotif(appt)}
                        >
                          <Send className="size-3" />
                          Send AI Reminder
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* AI Factor Highlights if high/moderate risk */}
                  {risk && (risk.risk_level === "High" || risk.risk_level === "Moderate") && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold flex items-center gap-1 text-foreground">
                          <Sparkles className="size-3 text-primary" />
                          AI Risk Explanation & Action Recommendation:
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {risk.features.WaitingDays} days wait • SMS {risk.features.SMS_received ? "Sent" : "Pending"}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        {risk.factors.join(" • ")}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-primary font-medium text-[11px]">
                          💡 Suggestion: {risk.recommended_action}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs text-primary font-semibold hover:underline p-0"
                          onClick={() => setSelectedApptForNotif(appt)}
                        >
                          Open Notification Composer →
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Suggest New Time & Message inputs */}
                  <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t">
                    <div className="space-y-1.5">
                      <Label htmlFor={`when-${appt.id}`} className="text-xs font-semibold">
                        Suggest another time
                      </Label>
                      <Input
                        id={`when-${appt.id}`}
                        type="datetime-local"
                        className="h-8 text-xs"
                        value={draft.when}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [appt.id]: { ...draft, when: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`note-${appt.id}`} className="text-xs font-semibold">
                        Staff note / answer
                      </Label>
                      <Input
                        id={`note-${appt.id}`}
                        className="h-8 text-xs"
                        value={draft.note}
                        placeholder="Optional note visible to patient"
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [appt.id]: { ...draft, note: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
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
                        Confirm Booking
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
                        Suggest New Time
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

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs"
                        onClick={() => {
                          window.open(`tel:${appt.phone}`);
                        }}
                      >
                        <PhoneCall className="size-3.5 text-muted-foreground" />
                        Call Patient
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* AI Notification Dispatch Modal */}
      {selectedApptForNotif && (
        <SendAiNotificationModal
          isOpen={Boolean(selectedApptForNotif)}
          onClose={() => setSelectedApptForNotif(null)}
          appointment={selectedApptForNotif}
          riskResult={aiRiskMap[selectedApptForNotif.id]}
          onSent={() => {
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }}
        />
      )}
    </div>
  );
}
