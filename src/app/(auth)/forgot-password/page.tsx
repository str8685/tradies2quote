import Link from "next/link";
import type { Metadata } from "next";
import { forgotPasswordAction } from "./actions";
import {
  AuthCard,
  FormError,
  FormField,
  FormNotice,
  SubmitButton,
} from "../_components/AuthCard";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
    >
      <form action={forgotPasswordAction} className="space-y-4">
        <FormNotice message={message} />
        <FormError message={error} />
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
        />
        <SubmitButton>Send reset link</SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="text-muted hover:text-ink">
          ← Back to login
        </Link>
      </p>
    </AuthCard>
  );
}
