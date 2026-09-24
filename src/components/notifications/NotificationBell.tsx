import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  Clock,
  Sparkles,
  AlertTriangle,
  CalendarCheck,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  fetchNotifications,
  updateNotificationStatus,
  type NotificationItem,
} from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";

interface NotificationBellProps {
  patientId?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ patientId }) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const notifsQuery = useQuery({
    queryKey: ["notifications", patientId],
    queryFn: () => fetchNotifications(patientId),
    refetchInterval: 10000,
  });

  const notifications = notifsQuery.data ?? [];
  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => updateNotificationStatus(id, "read"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const confirmAttendanceMutation = useMutation({
    mutationFn: async (notif: NotificationItem) => {
      await updateNotificationStatus(notif.id, "confirmed");
      if (notif.appointment_id) {
        await supabase
          .from("appointments")
          .update({ status: "confirmed", notes: "Patient confirmed attendance via AI reminder." })
          .eq("id", notif.appointment_id);
      }
    },
    onSuccess: () => {
      toast.success("Thank you! Your clinic attendance is confirmed.");
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not confirm appointment."),
  });

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 rounded-full transition-colors hover:bg-secondary"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-84 sm:w-96 p-0 shadow-2xl border" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/40">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => {
                notifications
                  .filter((n) => n.status === "unread")
                  .forEach((n) => markReadMutation.mutate(n.id));
              }}
              className="text-xs text-primary hover:underline font-medium"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[380px] overflow-y-auto divide-y divide-border/60">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground space-y-1">
              <Sparkles className="size-6 mx-auto text-muted-foreground/60 mb-2" />
              <p className="text-xs font-medium">No notifications yet</p>
              <p className="text-[11px]">Appointment reminders & updates will appear here.</p>
            </div>
          ) : (
            notifications.map((n) => {
              const isUnread = n.status === "unread";
              const isWarning = n.type === "no_show_warning";
              const isConfirmed = n.status === "confirmed";

              return (
                <div
                  key={n.id}
                  className={`p-3.5 space-y-2 transition-colors ${
                    isUnread ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-muted/30"
                  }`}
                  onClick={() => {
                    if (isUnread) markReadMutation.mutate(n.id);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {isWarning ? (
                        <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <CalendarCheck className="size-3.5 text-primary shrink-0" />
                      )}
                      <p className={`text-xs font-medium leading-tight ${isUnread ? "font-bold text-foreground" : "text-foreground/90"}`}>
                        {n.title}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                      <Clock className="size-2.5" />
                      {formatDate(n.created_at)}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed pl-5">
                    {n.message}
                  </p>

                  {/* Interactive actions for patient confirmation */}
                  <div className="flex items-center justify-between pl-5 pt-1">
                    {isConfirmed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                        <CheckCheck className="size-3" /> Attendance Confirmed
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-7 px-2.5 text-xs bg-primary text-primary-foreground hover:opacity-90"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmAttendanceMutation.mutate(n);
                          }}
                          disabled={confirmAttendanceMutation.isPending}
                        >
                          <CheckCheck className="size-3 mr-1" />
                          I will attend
                        </Button>
                      </div>
                    )}

                    {n.channel === "sms" && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        via SMS
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
