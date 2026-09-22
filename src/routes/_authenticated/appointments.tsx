import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck } from "lucide-react";

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

export const Route = createFileRoute("/_authenticated/appointments")({
  head: () => ({
    meta: [
      { title: "My appointments — Chiali Clinic" },
      {
        name: "description",
        content: "Request a new appointment at Chiali Clinic and follow its confirmation status.",
      },
      { property: "og:title", content: "My appointments — Chiali Clinic" },
      {
        property: "og:description",
        content: "Manage your Chiali Clinic appointment requests.",
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
      return data;
    },
  });

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
      toast.success("Request sent. The clinic will confirm by phone.");
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

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const when = String(form.get("requested_at"));
    if (!when) {
      toast.error("Please choose a date and time.");
      return;
    }
    create.mutate({
      full_name: fullName.trim(),
      phone: phone.trim(),
      service,
      requested_at: new Date(when).toISOString(),
      notes: (String(form.get("notes")).trim() || null) as string | null,
    });
  };

  return (
    <div className="surface-soft min-h-[70vh] px-4 py-12">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CalendarCheck className="size-5 text-primary" />
              Book an appointment
            </CardTitle>
            <CardDescription>
              Pick a preferred time — reception calls you on the number below to confirm.
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
                <Label htmlFor="notes">Reason (optional)</Label>
                <Textarea id="notes" name="notes" rows={3} />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                Send request
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">My appointments</h2>
          {appointments.isLoading && <p className="text-muted-foreground">Loading…</p>}
          {appointments.data?.length === 0 && (
            <p className="text-muted-foreground">No requests yet.</p>
          )}
          {appointments.data?.map((appt) => (
            <Card key={appt.id} className="shadow-card">
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{appt.service}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(appt.requested_at)}
                    </p>
                  </div>
                  <Badge variant={statusVariant(appt.status)}>
                    {STATUS_LABELS[appt.status] ?? appt.status}
                  </Badge>
                </div>
                {appt.admin_note && (
                  <p className="text-sm text-muted-foreground">Clinic: {appt.admin_note}</p>
                )}
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
          ))}
        </div>
      </div>
    </div>
  );
}
