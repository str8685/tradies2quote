import type { Metadata } from "next";
import { adminClient } from "@/lib/supabase/admin";
import type { PublicQuotePayload } from "@/lib/quote-types";
import { PublicQuoteSummary } from "./_components/PublicQuoteSummary";
import { AcceptForm } from "./_components/AcceptForm";
import { AcceptedView } from "./_components/AcceptedView";
import { ExpiredView } from "./_components/ExpiredView";

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

  // Mark viewed (idempotent — RPC no-ops unless first sent → viewed transition)
  await admin.rpc("mark_quote_viewed", { p_token: token } as never);

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

  if (isExpired && quote.status !== "accepted") {
    return (
      <PageShell>
        <ExpiredView reason="expired" />
      </PageShell>
    );
  }

  if (quote.status === "accepted") {
    return (
      <PageShell>
        <AcceptedView token={token} quote={quote} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PublicQuoteSummary token={token} quote={quote} />
      <AcceptForm token={token} quote={quote} />
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
