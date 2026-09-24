import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, Clock, MapPin, Phone, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CLINIC, REVIEWS, SERVICES } from "@/lib/clinic-data";
import heroImg from "@/assets/clinic-exterior.jpg";
import receptionImg from "@/assets/clinic-reception.jpg";
import consultationImg from "@/assets/clinic-consultation.jpg";
import labImg from "@/assets/clinic-lab.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chiali Clinic — Private medical clinic in Sidi Bel Abbes" },
      {
        name: "description",
        content:
          "Chiali Clinic offers general medicine, cardiology, pediatrics, laboratory and imaging. See our services, reviews and book an appointment online.",
      },
      { property: "og:title", content: "Chiali Clinic — Private medical clinic" },
      {
        property: "og:description",
        content:
          "Services, opening hours, patient reviews and online appointment booking at Chiali Clinic.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div>
      <section className="surface-hero">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] opacity-80">
              Private medical clinic
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">{CLINIC.name}</h1>
            <p className="mt-4 max-w-md text-lg opacity-90">
              {CLINIC.tagline} Request a slot online and our reception calls you back to confirm the
              exact time.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" variant="secondary" asChild>
                <Link to="/appointments">
                  <CalendarCheck className="size-4" />
                  Book an appointment
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                asChild
              >
                <a href={`tel:${CLINIC.phone.replace(/\s/g, "")}`}>
                  <Phone className="size-4" />
                  {CLINIC.phone}
                </a>
              </Button>
            </div>
          </div>
          <img
            src={heroImg}
            alt="Chiali Clinic building entrance"
            width={1600}
            height={1008}
            className="rounded-3xl shadow-soft"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-semibold">Our services</h2>
        <p className="mt-2 text-muted-foreground">
          Specialised care under one roof, with results delivered quickly.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <Card key={service.name} className="shadow-card">
              <CardContent className="pt-6">
                <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <service.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{service.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{service.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="surface-soft border-y border-border">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-semibold">Inside the clinic</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { src: receptionImg, alt: "Clinic reception and waiting area" },
              { src: consultationImg, alt: "Doctor consulting a patient" },
              { src: labImg, alt: "Medical imaging room" },
            ].map((img) => (
              <img
                key={img.alt}
                src={img.src}
                alt={img.alt}
                loading="lazy"
                width={1200}
                height={912}
                className="h-56 w-full rounded-2xl object-cover shadow-card"
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-semibold">What patients say</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {REVIEWS.map((review) => (
            <Card key={review.name} className="shadow-card">
              <CardContent className="pt-6">
                <div className="flex gap-0.5 text-accent-foreground">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} className="size-4 fill-current" />
                  ))}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">“{review.text}”</p>
                <p className="mt-4 text-sm font-semibold">{review.name}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="surface-soft border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold">Find us</h2>
            <p className="mt-4 flex items-start gap-3 text-muted-foreground">
              <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
              {CLINIC.address}
            </p>
            <p className="mt-3 flex items-start gap-3 text-muted-foreground">
              <Phone className="mt-0.5 size-5 shrink-0 text-primary" />
              {CLINIC.phone}
            </p>
            <Button className="mt-6" variant="outline" asChild>
              <a href={CLINIC.mapUrl} target="_blank" rel="noreferrer">
                Open in Maps
              </a>
            </Button>
          </div>
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Clock className="size-5 text-primary" />
                Opening hours
              </h3>
              <ul className="mt-4 space-y-2 text-sm">
                {CLINIC.hours.map((h) => (
                  <li key={h.day} className="flex justify-between gap-4">
                    <span>{h.day}</span>
                    <span className="text-muted-foreground">{h.time}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
