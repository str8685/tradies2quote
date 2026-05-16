import type { Metadata } from "next";
import { adminClient } from "@/lib/supabase/admin";
import type { PublicQuotePayload } from "@/lib/quote-types";
import { PublicQuoteSummary } from "./_components/PublicQuoteSummary";
import { AcceptForm } from "./_components/AcceptForm";
import { AcceptedView } from "./_components/AcceptedView";
import { ExpiredView } from "./_components/ExpiredView";
import { CustomerChat } from "./_components/CustomerChat";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Quote",
  robots: { index: false, follow: false },
};

type Params = { token: string };

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { token } = await params;
  const admin = adminClient();

  // Mark viewed (idempotent — RPC no-ops unless first sent → viewed
  // transition). Best-effort telemetry: a failure here must never take
  // down the customer's quote view.
  try {
    await admin.rpc("mark_quote_viewed", { p_token: token } as never);
  } catch (e) {
    console.error("mark_quote_viewed failed", e);
  }

  // Fetch sanitised payload
  const { data, error } = await admin.rpc(
    "get_quote_by_token",
    { p_token: token } as never,
  );
  if (error || !data) {
    return (
      <PageShell>
        <ExpiredView reason="not_found" />
      </PageShell>
    );
  }

  const quote = data as PublicQuotePayload;
  const isExpired =
    quote.expires_at !== null && new Date(quote.expires_at) < new Date();

  // A quote that reached or passed acceptance — accepted itself, or any
  // post-acceptance lifecycle stage — shows the accepted view.
  const acceptedLike =
    quote.status === "accepted" ||
    quote.status === "scheduled" ||
    quote.status === "in_progress" ||
    quote.status === "completed";

  if (acceptedLike) {
    return (
      <PageShell>
        <AcceptedView token={token} quote={quote} />
      </PageShell>
    );
  }

  // Terminal, un-acceptable states: past its valid-until date, or the
  // tradie marked it declined / expired. Without this branch a declined
  // or expired-status quote would still render a live accept form.
  if (isExpired || quote.status === "declined" || quote.status === "expired") {
    return (
      <PageShell>
        <ExpiredView
          reason={quote.status === "declined" ? "unavailable" : "expired"}
        />
      </PageShell>
    );
  }

  // Only `sent` / `viewed` quotes reach the live accept form. Anything
  // else (e.g. a stray `draft` with a token) is treated as not found.
  if (quote.status !== "sent" && quote.status !== "viewed") {
    return (
      <PageShell>
        <ExpiredView reason="not_found" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PublicQuoteSummary token={token} quote={quote} />
      <AcceptForm token={token} quote={quote} />
      {/* Wave 36 — "The Quote That Sells Itself" chat bubble. Only on
          live (sent/viewed) quotes — the API gates this server-side
          too, but rendering nothing on terminal states keeps the
          accepted/expired views uncluttered. */}
      <CustomerChat
        token={token}
        businessName={quote.business_name}
        clientName={quote.client.name}
      />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-900 text-white">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6 flex items-center gap-2">
          <span className="font-display text-xl uppercase tracking-tight">
            tradies<span className="text-brand">2</span>Quote
          </span>
        </div>
        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}
