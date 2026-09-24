import { supabase } from "@/integrations/supabase/client";

export interface NotificationItem {
  id: string;
  patient_id: string;
  appointment_id?: string | null;
  title: string;
  message: string;
  type: "no_show_warning" | "appointment_reminder" | "reschedule_offer" | "confirmation_acknowledged";
  channel: "in_app" | "sms" | "whatsapp" | "email";
  status: "unread" | "read" | "confirmed" | "cancelled";
  risk_score?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
}

const LOCAL_STORAGE_NOTIFS_KEY = "chiali_care_notifications_cache";

function getLocalNotifications(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_NOTIFS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalNotifications(items: NotificationItem[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_NOTIFS_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("Could not write notifications to local storage:", e);
  }
}

/**
 * Sends a notification from admin to patient (with database and local fallback)
 */
export async function sendPatientNotification(payload: {
  patient_id: string;
  appointment_id?: string | null;
  title: string;
  message: string;
  type?: NotificationItem["type"];
  channel?: NotificationItem["channel"];
  risk_score?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<NotificationItem> {
  const newItem: NotificationItem = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `notif_${Date.now()}`,
    patient_id: payload.patient_id,
    appointment_id: payload.appointment_id ?? null,
    title: payload.title,
    message: payload.message,
    type: payload.type ?? "appointment_reminder",
    channel: payload.channel ?? "in_app",
    status: "unread",
    risk_score: payload.risk_score ?? null,
    metadata: payload.metadata ?? null,
    created_at: new Date().toISOString(),
  };

  // Try saving to Supabase
  try {
    const { data, error } = await supabase
      .from("notifications" as any)
      .insert(newItem)
      .select()
      .maybeSingle();

    if (!error && data) {
      const local = getLocalNotifications();
      saveLocalNotifications([data as unknown as NotificationItem, ...local.filter((n) => n.id !== (data as any).id)]);
      return data as unknown as NotificationItem;
    }
  } catch (e) {
    console.warn("Supabase notification insert failed, using fallback store:", e);
  }

  // Fallback to local storage
  const existing = getLocalNotifications();
  saveLocalNotifications([newItem, ...existing]);
  return newItem;
}

/**
 * Fetches notifications for a specific patient or all notifications if admin
 */
export async function fetchNotifications(patientId?: string): Promise<NotificationItem[]> {
  try {
    let query = supabase
      .from("notifications" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (patientId) {
      query = query.eq("patient_id", patientId);
    }

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      const serverNotifs = data as unknown as NotificationItem[];
      // Sync to local
      const local = getLocalNotifications();
      const mergedMap = new Map<string, NotificationItem>();
      for (const item of [...serverNotifs, ...local]) {
        if (!mergedMap.has(item.id)) {
          mergedMap.set(item.id, item);
        }
      }
      const merged = Array.from(mergedMap.values());
      saveLocalNotifications(merged);
      return patientId ? merged.filter((n) => n.patient_id === patientId) : merged;
    }
  } catch (e) {
    console.warn("Error fetching remote notifications, using cached items:", e);
  }

  const local = getLocalNotifications();
  if (patientId) {
    return local.filter((n) => n.patient_id === patientId);
  }
  return local;
}

/**
 * Updates notification status (e.g. read, confirmed)
 */
export async function updateNotificationStatus(
  notificationId: string,
  status: NotificationItem["status"],
): Promise<void> {
  try {
    await supabase
      .from("notifications" as any)
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", notificationId);
  } catch (e) {
    console.warn("Could not update remote notification status:", e);
  }

  const local = getLocalNotifications();
  const updated = local.map((n) => (n.id === notificationId ? { ...n, status } : n));
  saveLocalNotifications(updated);
}
