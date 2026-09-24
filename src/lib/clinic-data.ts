import { Stethoscope, HeartPulse, Baby, Microscope, Brain, Syringe } from "lucide-react";

export const CLINIC = {
  name: "Chiali Clinic",
  tagline: "Private medical care, close to home.",
  address: "12 Rue des Oliviers, Hai El Badr, Sidi Bel Abbes, Algeria",
  phone: "+213 555 010 203",
  email: "contact@chiali-clinic.com",
  hours: [
    { day: "Saturday – Wednesday", time: "08:00 – 18:00" },
    { day: "Thursday", time: "08:00 – 13:00" },
    { day: "Friday", time: "Closed (emergencies only)" },
  ],
  mapUrl: "https://maps.google.com/?q=Sidi+Bel+Abbes+Algeria",
};

export const SERVICES = [
  {
    name: "General Medicine",
    icon: Stethoscope,
    description: "Consultations, check-ups and follow-up care for the whole family.",
  },
  {
    name: "Cardiology",
    icon: HeartPulse,
    description: "ECG, echocardiography and blood-pressure monitoring.",
  },
  {
    name: "Pediatrics",
    icon: Baby,
    description: "Growth tracking, vaccinations and child consultations.",
  },
  {
    name: "Laboratory",
    icon: Microscope,
    description: "Blood work and rapid analyses with same-day results.",
  },
  {
    name: "Medical Imaging",
    icon: Brain,
    description: "Ultrasound, X-ray and scanner appointments on site.",
  },
  {
    name: "Vaccination",
    icon: Syringe,
    description: "Seasonal and travel vaccines administered by our nurses.",
  },
] as const;

export const SERVICE_NAMES = SERVICES.map((s) => s.name);

export const REVIEWS = [
  {
    name: "Amina B.",
    rating: 5,
    text: "Very clean clinic and the staff called me back the same day to confirm my appointment. Doctor took the time to explain everything.",
  },
  {
    name: "Karim L.",
    rating: 5,
    text: "Booked online in two minutes for my son. No waiting room queue, we were seen right on time.",
  },
  {
    name: "Nadia S.",
    rating: 4,
    text: "Great cardiology team. Results came fast and the follow-up was well organised.",
  },
  {
    name: "Youcef M.",
    rating: 5,
    text: "Reception is welcoming and the lab results arrived before the end of the day. Highly recommend.",
  },
] as const;

export const STATUS_LABELS: Record<string, string> = {
  pending: "Waiting for confirmation",
  confirmed: "Confirmed",
  rescheduled: "New time suggested",
  cancelled: "Cancelled",
};
