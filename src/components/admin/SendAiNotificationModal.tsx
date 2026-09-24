import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Bell, Send, Sparkles, Smartphone, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { sendPatientNotification, type NotificationItem } from "@/lib/notifications";
import type { AiRiskResult } from "@/lib/ai-risk-service";

interface SendAiNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: {
    id: string;
    patient_id: string;
    full_name: string;
    phone: string;
    service: string;
    requested_at: string;
  } | null;
  riskResult?: AiRiskResult | null;
  onSent?: (notification: NotificationItem) => void;
}

export const SendAiNotificationModal: React.FC<SendAiNotificationModalProps> = ({
  isOpen,
  onClose,
  appointment,
  riskResult,
  onSent,
}) => {
  if (!appointment) return null;

  const apptDateStr = new Date(appointment.requested_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const templates: Record<string, { title: string; message: string; type: NotificationItem["type"] }> = {
    urgent_confirmation: {
      title: "Urgent: Please confirm your appointment at Chiali Clinic",
      message: `Dear ${appointment.full_name}, your ${appointment.service} consultation is booked for ${apptDateStr}. To secure your slot and help our medical staff prepare, please tap to confirm your attendance or choose a new time.`,
      type: "no_show_warning",
    },
    friendly_reminder: {
      title: "Appointment Reminder — Chiali Clinic",
      message: `Hello ${appointment.full_name}, we look forward to welcoming you for your ${appointment.service} visit on ${apptDateStr}. If you have any questions or need directions, we are here to help!`,
      type: "appointment_reminder",
    },
    reschedule_offer: {
      title: "Flexible Rescheduling Available — Chiali Clinic",
      message: `Dear ${appointment.full_name}, if ${apptDateStr} is no longer convenient for your ${appointment.service} consultation, you can easily select a new date with no delay.`,
      type: "reschedule_offer",
    },
  };

  const defaultTemplateKey =
    riskResult?.risk_level === "High"
      ? "urgent_confirmation"
      : riskResult?.risk_level === "Moderate"
        ? "reschedule_offer"
        : "friendly_reminder";

  const [selectedTemplate, setSelectedTemplate] = useState<string>(defaultTemplateKey);
  const [title, setTitle] = useState(templates[defaultTemplateKey].title);
  const [message, setMessage] = useState(templates[defaultTemplateKey].message);
  const [channel, setChannel] = useState<NotificationItem["channel"]>("in_app");
  const [isSending, setIsSending] = useState(false);

  const handleTemplateChange = (key: string) => {
    setSelectedTemplate(key);
    if (templates[key]) {
      setTitle(templates[key].title);
      setMessage(templates[key].message);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Please enter a title and message.");
      return;
    }

    try {
      setIsSending(true);
      const notif = await sendPatientNotification({
        patient_id: appointment.patient_id,
        appointment_id: appointment.id,
        title: title.trim(),
        message: message.trim(),
        type: templates[selectedTemplate]?.type ?? "appointment_reminder",
        channel,
        risk_score: riskResult?.risk_percentage,
        metadata: {
          service: appointment.service,
          requested_at: appointment.requested_at,
          phone: appointment.phone,
          risk_level: riskResult?.risk_level,
          factors: riskResult?.factors,
        },
      });

      toast.success(
        channel === "sms"
          ? `SMS dispatched to ${appointment.phone} & recorded in patient portal.`
          : `Notification sent directly to ${appointment.full_name}'s portal.`,
      );
      onSent?.(notif);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send notification.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Send AI-Assisted Patient Notification</DialogTitle>
              <DialogDescription>
                Proactively engage {appointment.full_name} to confirm their upcoming appointment and reduce no-shows.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {riskResult && (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                AI Model Assessment:
              </span>
              <Badge
                variant={
                  riskResult.risk_level === "High"
                    ? "destructive"
                    : riskResult.risk_level === "Moderate"
                      ? "secondary"
                      : "outline"
                }
              >
                {riskResult.risk_level} Risk ({riskResult.risk_percentage}%)
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Detected Factors: {riskResult.factors.join(" • ")}
            </p>
          </div>
        )}

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Recommended Template</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent_confirmation">
                  ⚠️ Urgent Attendance Confirmation (High-Risk)
                </SelectItem>
                <SelectItem value="reschedule_offer">
                  🔄 Easy Reschedule & Slot Protection (Moderate-Risk)
                </SelectItem>
                <SelectItem value="friendly_reminder">
                  👋 Friendly Clinic Visit Reminder (Routine)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Delivery Channel</Label>
              <Select value={channel} onValueChange={(val) => setChannel(val as NotificationItem["channel"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_app">📲 In-App Portal Alert</SelectItem>
                  <SelectItem value="sms">💬 SMS to {appointment.phone}</SelectItem>
                  <SelectItem value="whatsapp">🟢 WhatsApp Notification</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Patient Phone</Label>
              <Input value={appointment.phone} readOnly className="bg-muted/50 text-xs" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Notification Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification title..."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Message Body</Label>
            <Textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the message text..."
            />
          </div>

          {/* Patient preview mockup */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Smartphone className="size-4" />
              <span>Patient Preview</span>
            </div>
            <div className="bg-card rounded-lg p-3 shadow-xs border text-xs space-y-1.5">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <Bell className="size-3.5 text-primary" />
                {title || "Notification Title"}
              </p>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{message}</p>
              <div className="pt-2 flex gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                  <CheckCheck className="size-3" /> Quick "Confirm Attendance" Action Button Attached
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending} className="gap-2">
            <Send className="size-4" />
            <span>{isSending ? "Sending…" : "Send Notification"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
