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
    <div className="relative min-h-screen flex flex-col bg-ink-900 text-white overflow-hidden">
      <div className="pointer-events-none absolute inset-0 t2q-grid-bg opacity-30" />
      <div className="pointer-events-none absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full bg-brand/20 blur-3xl animate-blob" />

      <header className="relative z-10 border-b border-ink-600">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-6">
          <Link href="/" aria-label="tradies2Quote home" className="inline-flex">
            {/* Wave 12.3 — new Tradies2Quote brand PNG on a small white
                pill. Replaces the old inline Site-Safe Badge. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-horizontal.png"
              alt="Tradies2Quote"
              width={380}
              height={100}
              className="block h-8 w-auto rounded-sm bg-white px-2 py-1"
            />
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
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

            <p className="mt-6 text-center text-sm">
              <Link
                href="/login"
                className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-300 hover:text-white"
              >
                ← Back to sign in
              </Link>
            </p>
          </AuthCard>
        </div>
      </main>
    </div>
  );
}
