import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { STATUS_LABELS } from "@/lib/clinic-data";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — Chiali Clinic" },
      {
        name: "description",
        content: "Clinic staff dashboard to confirm appointments or suggest another time.",
      },
      { property: "og:title", content: "Admin dashboard — Chiali Clinic" },
      {
        property: "og:description",
        content: "Confirm or reschedule patient appointment requests.",
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

  const appointments = useQuery({
    queryKey: ["all-appointments"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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
    <div className="surface-soft min-h-[70vh] px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <ShieldCheck className="size-6 text-primary" />
          Appointment requests
        </h1>
        <p className="mt-2 text-muted-foreground">
          Confirm a request or suggest another time — the patient sees your answer and their phone
          number is listed for the call-back.
        </p>

        <div className="mt-8 space-y-4">
          {appointments.isLoading && <p className="text-muted-foreground">Loading…</p>}
          {appointments.data?.length === 0 && (
            <p className="text-muted-foreground">No requests yet.</p>
          )}
          {appointments.data?.map((appt) => {
            const draft = drafts[appt.id] ?? { when: "", note: "" };
            return (
              <Card key={appt.id} className="shadow-card">
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
        </div>
      </div>
    </div>
  );
}
