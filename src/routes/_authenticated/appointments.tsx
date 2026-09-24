import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Bell, CheckCheck, Clock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SERVICE_NAMES, STATUS_LABELS } from "@/lib/clinic-data";
import {
  fetchNotifications,
  updateNotificationStatus,
  type NotificationItem,
} from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/appointments")({
  head: () => ({
    meta: [
      { title: "My appointments — Chiali Clinic" },
      {
        name: "description",
        content: "Request a new appointment at Chiali Clinic, confirm attendance, and view status.",
      },
      { property: "og:title", content: "My appointments — Chiali Clinic" },
      {
        property: "og:description",
        content: "Manage your Chiali Clinic appointment requests and AI reminders.",
      },
    ],
  }),
  component: AppointmentsPage,
});

function statusVariant(status: string) {
  if (status === "confirmed") return "default" as const;
  if (status === "cancelled") return "destructive" as const;
  return "secondary" as const;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AppointmentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [service, setService] = useState<string>(SERVICE_NAMES[0] ?? "");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState<string>("");

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile.data) {
      setFullName((v) => v || profile.data!.full_name);
      setPhone((v) => v || profile.data!.phone);
    }
  }, [profile.data]);

  const appointments = useQuery({
    queryKey: ["my-appointments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("requested_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch patient notifications
  const notificationsQuery = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: () => fetchNotifications(user!.id),
    refetchInterval: 10000,
  });

  const patientNotifs = notificationsQuery.data ?? [];

  // Group notifications by appointment ID
  const notifsByAppt = patientNotifs.reduce((acc, n) => {
    if (n.appointment_id) {
      if (!acc[n.appointment_id]) acc[n.appointment_id] = [];
      acc[n.appointment_id].push(n);
    }
    return acc;
  }, {} as Record<string, NotificationItem[]>);

  const create = useMutation({
    mutationFn: async (payload: {
      full_name: string;
      phone: string;
      service: string;
      requested_at: string;
      notes: string | null;
    }) => {
      const { error } = await supabase
        .from("appointments")
        .insert({ ...payload, patient_id: user!.id });
      if (error) throw error;
      await supabase
        .from("profiles")
        .update({ full_name: payload.full_name, phone: payload.phone })
        .eq("id", user!.id);
    },
    onSuccess: () => {
      toast.success("Request sent. The clinic will confirm your appointment.");
      void queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const respond = useMutation({
    mutationFn: async (vars: { id: string; accept: boolean; suggested?: string | null }) => {
      const patch = vars.accept
        ? { status: "confirmed" as const, requested_at: vars.suggested!, suggested_at: null }
        : { status: "cancelled" as const };
      const { error } = await supabase.from("appointments").update(patch).eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Confirm attendance via notification action
  const confirmAttendance = useMutation({
    mutationFn: async (vars: { notifId: string; apptId: string }) => {
      await updateNotificationStatus(vars.notifId, "confirmed");
      await supabase
        .from("appointments")
        .update({ status: "confirmed" })
        .eq("id", vars.apptId);
    },
    onSuccess: () => {
      toast.success("Thank you! Your clinic attendance has been confirmed.");
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const when = String(form.get("requested_at"));
    if (!when) {
      toast.error("Please choose a date and time.");
      return;
    }

    const rawNotes = String(form.get("notes") || "").trim();
    const ageText = age.trim() ? `Age: ${age.trim()} ans` : "";
    const combinedNotes = [ageText, rawNotes].filter(Boolean).join(" • ") || null;

    create.mutate({
      full_name: fullName.trim(),
      phone: phone.trim(),
      service,
      requested_at: new Date(when).toISOString(),
      notes: combinedNotes,
    });
  };

  return (
    <div className="surface-soft min-h-[70vh] px-4 py-12">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Booking Form Card */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CalendarCheck className="size-5 text-primary" />
              Book an appointment
            </CardTitle>
            <CardDescription>
              Pick a preferred time — reception reviews your request and sends confirmation notifications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age">Age (optional)</Label>
                  <Input
                    id="age"
                    type="number"
                    min="1"
                    max="120"
                    placeholder="e.g. 35"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={service} onValueChange={setService}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_NAMES.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="requested_at">Preferred date & time</Label>
                <Input id="requested_at" name="requested_at" type="datetime-local" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Reason or health conditions (optional)</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  placeholder="e.g., Routine checkup, tension follow-up, etc."
                />
              </div>

              <Button type="submit" className="w-full" disabled={create.isPending}>
                Send request
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* My Appointments List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">My appointments</h2>
            {patientNotifs.length > 0 && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Bell className="size-3 text-primary" />
                {patientNotifs.length} Clinic Alert(s)
              </Badge>
            )}
          </div>

          {appointments.isLoading && <p className="text-muted-foreground">Loading…</p>}
          {appointments.data?.length === 0 && (
            <p className="text-muted-foreground">No requests yet.</p>
          )}

          {appointments.data?.map((appt) => {
            const relatedNotifs = notifsByAppt[appt.id] ?? [];
            const latestNotif = relatedNotifs[0];

            return (
              <Card key={appt.id} className="shadow-card border-border/60">
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-base">{appt.service}</p>
                      <p className="text-sm font-medium text-foreground">
                        {formatDate(appt.requested_at)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Patient: {appt.full_name} • {appt.phone}
                      </p>
                    </div>
                    <Badge variant={statusVariant(appt.status)}>
                      {STATUS_LABELS[appt.status] ?? appt.status}
                    </Badge>
                  </div>

                  {appt.notes && (
                    <p className="text-xs text-muted-foreground bg-muted/40 p-2 rounded-md">
                      Note: {appt.notes}
                    </p>
                  )}

                  {appt.admin_note && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <ShieldCheck className="size-4 text-primary shrink-0" />
                      <span>Clinic note: {appt.admin_note}</span>
                    </p>
                  )}

                  {/* Proactive Clinic Reminder Banner */}
                  {latestNotif && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs flex items-center gap-1.5 text-primary">
                          <Bell className="size-3.5" />
                          {latestNotif.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(latestNotif.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {latestNotif.message}
                      </p>

                      {latestNotif.status !== "confirmed" ? (
                        <div className="pt-1 flex gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-primary gap-1"
                            disabled={confirmAttendance.isPending}
                            onClick={() =>
                              confirmAttendance.mutate({
                                notifId: latestNotif.id,
                                apptId: appt.id,
                              })
                            }
                          >
                            <CheckCheck className="size-3" />
                            Confirm I Will Attend
                          </Button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCheck className="size-3" /> Attendance Confirmed
                        </span>
                      )}
                    </div>
                  )}

                  {/* Reschedule Suggestion from Clinic */}
                  {appt.status === "rescheduled" && appt.suggested_at && (
                    <div className="rounded-lg border border-border bg-secondary/40 p-3">
                      <p className="text-sm">
                        The clinic suggests{" "}
                        <span className="font-semibold">{formatDate(appt.suggested_at)}</span>
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            respond.mutate({
                              id: appt.id,
                              accept: true,
                              suggested: appt.suggested_at,
                            })
                          }
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => respond.mutate({ id: appt.id, accept: false })}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  )}

                  {appt.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => respond.mutate({ id: appt.id, accept: false })}
                    >
                      Cancel request
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
