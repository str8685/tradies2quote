// ── Job address resolution (Weather Location Agent, pure layer) ────────────
// Decides WHICH stored address is the job's weather location. The hard rule:
// weather resolves from the client/customer JOB location on record — never
// implicitly from the tradie's device. Resolution order:
//
//   1. clients.address        (first-class client record, when linked)
//   2. quote_data.client.address  (the per-quote client snapshot — today the
//      only populated source, since nothing writes the clients table yet)
//   3. null → the caller BLOCKS ("no_address") and asks; it never defaults.
//
// Pure + unit-tested. No IO; callers supply both candidate values.

export type JobAddressSource = "clients_table" | "quote_client_address";

export interface JobAddress {
  address: string;
  source: JobAddressSource;
}

/** Read quote_data.client.address defensively from an unknown JSONB shape. */
export function addressFromQuoteData(quoteData: unknown): string | null {
  if (!quoteData || typeof quoteData !== "object") return null;
  const client = (quoteData as Record<string, unknown>).client;
  if (!client || typeof client !== "object") return null;
  const address = (client as Record<string, unknown>).address;
  if (typeof address !== "string") return null;
  const trimmed = address.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Pick the job's address in priority order. Returns null when neither
 * source has a usable address — the caller must block, not guess.
 */
export function pickJobAddress(args: {
  clientsAddress: string | null | undefined;
  quoteData: unknown;
}): JobAddress | null {
  const fromClients =
    typeof args.clientsAddress === "string" ? args.clientsAddress.trim() : "";
  if (fromClients.length > 0) {
    return { address: fromClients, source: "clients_table" };
  }
  const fromQuote = addressFromQuoteData(args.quoteData);
  if (fromQuote) {
    return { address: fromQuote, source: "quote_client_address" };
  }
  return null;
}
