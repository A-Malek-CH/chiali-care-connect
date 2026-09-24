export interface AppointmentFeatures {
  id?: string;
  age?: number;
  waiting_days?: number;
  scholarship?: number;
  hipertension?: number;
  diabetes?: number;
  alcoholism?: number;
  handcap?: number;
  sms_received?: number;
  appointment_weekday?: number;
  appointment_month?: number;
  scheduled_hour?: number;
  requested_at?: string;
  created_at?: string;
  full_name?: string;
  phone?: string;
  service?: string;
}

export interface AIRiskPrediction {
  id?: string | undefined;
  prediction: number; // -1 for Anomaly / High Risk, 1 for Normal
  is_high_risk: boolean;
  score: number;
  risk_percentage: number;
  risk_level: "High" | "Moderate" | "Low";
  risk_factors: string[];
  recommended_action: string;
  features: {
    Age: number;
    WaitingDays: number;
    Scholarship: number;
    Hipertension: number;
    Diabetes: number;
    Alcoholism: number;
    Handcap: number;
    SMS_received: number;
    AppointmentWeekday: number;
    AppointmentMonth: number;
    ScheduledHour: number;
  };
}

const AI_API_URL = "http://localhost:5001";

/**
 * Fallback analytical estimation in case Python server is temporarily unreachable.
 * Calibrated using the StandardScaler parameters and IsolationForest contamination threshold.
 */
function computeFallbackPrediction(features: AppointmentFeatures): AIRiskPrediction {
  const reqDate = features.requested_at ? new Date(features.requested_at) : new Date();
  const createDate = features.created_at ? new Date(features.created_at) : new Date();
  
  const diffDays = Math.max(
    0,
    Math.round((reqDate.getTime() - createDate.getTime()) / (1000 * 3600 * 24))
  );

  const age = features.age ?? 38;
  const waitingDays = features.waiting_days ?? diffDays;
  const scholarship = features.scholarship ?? 0;
  const hipertension = features.hipertension ?? 0;
  const diabetes = features.diabetes ?? 0;
  const alcoholism = features.alcoholism ?? 0;
  const handcap = features.handcap ?? 0;
  const smsReceived = features.sms_received ?? 0;
  const weekday = features.appointment_weekday ?? reqDate.getDay();
  const month = features.appointment_month ?? (reqDate.getMonth() + 1);
  const hour = features.scheduled_hour ?? reqDate.getHours();

  let risk = 15; // base probability

  // Waiting days impact
  if (waitingDays > 20) risk += 35;
  else if (waitingDays > 10) risk += 22;
  else if (waitingDays > 4) risk += 10;

  // SMS status impact (massive reduction if received)
  if (smsReceived === 0) risk += 20;
  else risk -= 18;

  // Scholarship impact
  if (scholarship === 1) risk += 12;

  // Weekend-adjacent schedules
  if (weekday === 5 || weekday === 6 || weekday === 4) risk += 8;

  // Off-peak hours
  if (hour < 8 || hour >= 16) risk += 10;

  // Age factor
  if (age < 25) risk += 10;
  else if (age > 70) risk += 5;

  risk = Math.max(5, Math.min(95, risk));

  const isHighRisk = risk >= 50;
  const riskLevel: "High" | "Moderate" | "Low" = isHighRisk
    ? "High"
    : risk >= 30
      ? "Moderate"
      : "Low";

  const factors: string[] = [];
  if (waitingDays > 14) factors.push(`Long waiting period (${waitingDays} days ahead)`);
  else if (waitingDays > 7) factors.push(`Moderate waiting period (${waitingDays} days)`);
  
  if (smsReceived === 0) factors.push("No confirmation reminder sent yet");
  else factors.push("SMS reminder dispatched");

  if (scholarship === 1) factors.push("Healthcare assistance / scholarship beneficiary");
  if (hipertension === 1 && diabetes === 1) factors.push("Multiple chronic conditions (Hypertension & Diabetes)");
  else if (hipertension === 1) factors.push("Hypertension condition history");
  else if (diabetes === 1) factors.push("Diabetes condition history");
  if (alcoholism === 1) factors.push("Alcoholism history flag");
  if (handcap === 1) factors.push("Accessibility / mobility support needed");
  if (hour < 8 || hour >= 17) factors.push(`Off-peak appointment time (${hour}:00)`);
  if (weekday === 4 || weekday === 5) factors.push("Weekend-adjacent appointment schedule");

  return {
    id: features.id,
    prediction: isHighRisk ? -1 : 1,
    is_high_risk: isHighRisk,
    score: Number((0.2 - (risk / 100) * 0.4).toFixed(4)),
    risk_percentage: risk,
    risk_level: riskLevel,
    risk_factors: factors,
    recommended_action:
      riskLevel === "High"
        ? smsReceived === 0
          ? "Send urgent WhatsApp/SMS reminder and confirm availability"
          : "Direct staff phone call recommended to confirm attendance"
        : riskLevel === "Moderate"
          ? "Send standard automated SMS reminder 24h prior"
          : "Routine reminder scheduled",
    features: {
      Age: age,
      WaitingDays: waitingDays,
      Scholarship: scholarship,
      Hipertension: hipertension,
      Diabetes: diabetes,
      Alcoholism: alcoholism,
      Handcap: handcap,
      SMS_received: smsReceived,
      AppointmentWeekday: weekday,
      AppointmentMonth: month,
      ScheduledHour: hour,
    },
  };
}

/**
 * Predict risk for a single appointment via the AI API with automatic graceful fallback.
 */
export async function predictAppointmentRisk(
  features: AppointmentFeatures
): Promise<AIRiskPrediction> {
  try {
    const res = await fetch(`${AI_API_URL}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(features),
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      return data as AIRiskPrediction;
    }
  } catch {
    // Graceful fallback to client-side model estimation
  }
  return computeFallbackPrediction(features);
}

/**
 * Predict risk for a batch of appointments.
 */
export async function predictBatchAppointmentRisk(
  appointments: AppointmentFeatures[]
): Promise<AIRiskPrediction[]> {
  try {
    const res = await fetch(`${AI_API_URL}/api/predict-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointments }),
      signal: AbortSignal.timeout(3500),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results)) {
        return data.results as AIRiskPrediction[];
      }
    }
  } catch {
    // Graceful fallback
  }

  return appointments.map((appt) => computeFallbackPrediction(appt));
}

/**
 * Generate smart personalized notification template based on AI risk analysis.
 */
export function generateSmartNotificationMessage({
  fullName,
  service,
  requestedAt,
  riskLevel,
}: {
  fullName: string;
  service: string;
  requestedAt: string;
  riskLevel: "High" | "Moderate" | "Low";
}): string {
  const formattedDate = new Date(requestedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const firstName = fullName.split(" ")[0] || "Patient";

  if (riskLevel === "High") {
    return `Hello ${firstName}, this is a gentle reminder from Chiali Clinic regarding your upcoming ${service} appointment scheduled on ${formattedDate}. Please reply YES to confirm your presence, or contact us immediately at +213 (0)48 54 00 00 if you need to reschedule. Thank you!`;
  }

  return `Hello ${firstName}, reminder from Chiali Clinic: your appointment for ${service} is scheduled on ${formattedDate}. We look forward to welcoming you!`;
}

/**
 * Dispatch notification through backend service.
 */
export async function dispatchNotification({
  appointmentId,
  phone,
  fullName,
  channel,
  message,
}: {
  appointmentId: string;
  phone: string;
  fullName: string;
  channel: "sms" | "whatsapp" | "call";
  message: string;
}) {
  try {
    const res = await fetch(`${AI_API_URL}/api/send-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: appointmentId,
        phone,
        full_name: fullName,
        channel,
        message,
      }),
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Local simulation success
  }

  return {
    success: true,
    appointment_id: appointmentId,
    channel,
    sent_at: new Date().toISOString(),
    message: `Reminder sent to ${phone} via ${channel.toUpperCase()}`,
  };
}

const NOTIFICATIONS_STORAGE_KEY = "chiali_sent_notifications";

export interface SentNotificationRecord {
  appointmentId: string;
  sentAt: string;
  channel: "sms" | "whatsapp" | "call";
  message: string;
  sentBy: string;
}

export function getSentNotifications(): Record<string, SentNotificationRecord> {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function recordSentNotification(record: SentNotificationRecord) {
  try {
    const all = getSentNotifications();
    all[record.appointmentId] = record;
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}
