import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resetPasswordAction } from "./actions";
import {
  AuthCard,
  FormError,
  FormField,
  SubmitButton,
} from "../_components/AuthCard";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Set a new password",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // The user must arrive here with an active session (set by the auth callback
  // after they click the email link). If not, send them to /forgot-password.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/forgot-password?error=Reset%20link%20expired%20or%20invalid.%20Request%20a%20new%20one.",
    );
  }

  return (
    <AuthCard
      title="Set a new password"
      subtitle="Choose a strong password you don't use elsewhere."
    >
      <form action={resetPasswordAction} className="space-y-4">
        <FormError message={error} />
        <FormField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
        />
        <FormField
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
        />
        <p className="text-xs text-muted">At least 8 characters.</p>
        <SubmitButton>Update password</SubmitButton>
      </form>
    </AuthCard>
  );
}
