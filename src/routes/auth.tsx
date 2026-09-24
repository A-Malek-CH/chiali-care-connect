import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Patient sign in — Chiali Clinic" },
      {
        name: "description",
        content: "Create a patient account or sign in to book and follow your appointments at Chiali Clinic.",
      },
      { property: "og:title", content: "Patient sign in — Chiali Clinic" },
      {
        property: "og:description",
        content: "Access your Chiali Clinic patient account to manage appointments.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) void router.navigate({ to: "/appointments", replace: true });
  }, [loading, user, router]);

  const signIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    await router.navigate({ to: "/appointments" });
  };

  const signUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const fullName = String(form.get("full_name")).trim();
    const phone = String(form.get("phone")).trim();
    if (fullName.length < 3) {
      toast.error("Please enter your full name.");
      return;
    }
    if (phone.length < 6) {
      toast.error("Please enter a phone number we can call you on.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, phone },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success("Account created. Check your email to confirm it, then sign in.");
      return;
    }
    toast.success("Account created!");
    await router.navigate({ to: "/appointments" });
  };

  return (
    <div className="surface-soft min-h-[70vh] px-4 py-16">
      <Card className="mx-auto w-full max-w-md shadow-soft">
        <CardHeader>
          <CardTitle className="text-2xl">Patient account</CardTitle>
          <CardDescription>
            Sign in or create an account to request an appointment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form className="space-y-4 pt-4" onSubmit={signIn}>
                <div className="space-y-2">
                  <Label htmlFor="in-email">Email</Label>
                  <Input id="in-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="in-password">Password</Label>
                  <Input
                    id="in-password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form className="space-y-4 pt-4" onSubmit={signUp}>
                <div className="space-y-2">
                  <Label htmlFor="up-name">Full name</Label>
                  <Input id="up-name" name="full_name" required autoComplete="name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="up-phone">Phone number</Label>
                  <Input
                    id="up-phone"
                    name="phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="+213 ..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="up-email">Email</Label>
                  <Input id="up-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="up-password">Password</Label>
                  <Input
                    id="up-password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
