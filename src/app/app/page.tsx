import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "./actions";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already redirects unauthenticated users away from /app, but
  // keep this as defense-in-depth for direct server-component access.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="font-semibold tracking-tight">tradies2Quote</span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm font-medium text-muted hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Welcome, {user.email}
        </h1>
        <p className="mt-2 text-muted">
          Your dashboard is ready. Quotes, clients, and the voice-to-quote flow
          land here in Phase 3.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PlaceholderCard
            label="Recent quotes"
            value="0"
            hint="Coming next phase"
          />
          <PlaceholderCard
            label="Clients"
            value="0"
            hint="Coming next phase"
          />
          <PlaceholderCard
            label="Materials"
            value="0"
            hint="Coming next phase"
          />
        </div>
      </main>
    </div>
  );
}

function PlaceholderCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}
