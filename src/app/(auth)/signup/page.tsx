import Link from "next/link";
import type { Metadata } from "next";
import { signupAction } from "./actions";
import {
  AuthCard,
  FormError,
  FormField,
  SubmitButton,
} from "../_components/AuthCard";

export const metadata: Metadata = {
  title: "Start your free trial",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthCard
      title="Start your free trial"
      subtitle="7 days free. No credit card. Cancel anytime."
    >
      <form action={signupAction} className="space-y-4">
        <FormError message={error} />
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
        />
        <p className="text-xs text-muted">At least 8 characters.</p>
        <SubmitButton>Create account</SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:brightness-95">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
