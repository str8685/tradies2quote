import Link from "next/link";
import type { Metadata } from "next";
import { loginAction } from "./actions";
import {
  AuthCard,
  FormError,
  FormField,
  FormNotice,
  SubmitButton,
} from "../_components/AuthCard";

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const { error, message, next } = await searchParams;

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to your tradies2Quote account."
    >
      <form action={loginAction} className="space-y-4">
        <input type="hidden" name="next" value={next ?? "/app"} />
        <FormNotice message={message} />
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
          autoComplete="current-password"
        />
        <SubmitButton>Log in</SubmitButton>
      </form>

      <div className="mt-6 flex justify-between text-sm">
        <Link href="/forgot-password" className="text-muted hover:text-ink">
          Forgot password?
        </Link>
        <Link href="/signup" className="font-medium text-accent hover:brightness-95">
          Create an account
        </Link>
      </div>
    </AuthCard>
  );
}
