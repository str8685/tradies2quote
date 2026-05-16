"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/signup?error=Email%20and%20password%20required");
  }

  if (password.length < 8) {
    redirect("/signup?error=Password%20must%20be%20at%20least%208%20characters");
  }

  const supabase = await createClient();

  // CRITICAL — pass `emailRedirectTo` explicitly so the confirmation
  // link in the signup email points at production. Without this,
  // Supabase falls back to the project's "Site URL" setting (default
  // `http://localhost:3000`), which produces the dreaded "Safari can't
  // open the page because it couldn't connect to the server" when a
  // real user taps the link on their phone. NEXT_PUBLIC_APP_URL is set
  // in Vercel → Environment Variables to https://tradies2quote.com.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${appUrl}/auth/callback` },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // Supabase does NOT return an error for an already-registered email
  // (deliberate, to prevent account enumeration). Instead it returns a
  // user with an empty `identities` array and no session. Detect that
  // and send them to log in, rather than a dead-end "check your inbox"
  // for a confirmation email that will never arrive.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    redirect(
      "/login?message=That%20email%20is%20already%20registered.%20Please%20log%20in.",
    );
  }

  // With email confirmation OFF, signUp returns a session and the user is
  // already logged in — go straight to the dashboard. With confirmation ON,
  // there is no session and we'd send them to /login with a "check your inbox"
  // message instead.
  if (!data.session) {
    redirect(
      "/login?message=Check%20your%20inbox%20to%20confirm%20your%20email%20before%20logging%20in.",
    );
  }

  redirect("/app");
}
