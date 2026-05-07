"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function forgotPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect("/forgot-password?error=Email%20required");
  }

  const headerStore = await headers();
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${headerStore.get("x-forwarded-proto") ?? "http"}://${headerStore.get("host")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect(
    "/forgot-password?message=If%20that%20email%20exists%2C%20a%20reset%20link%20is%20on%20its%20way.",
  );
}
