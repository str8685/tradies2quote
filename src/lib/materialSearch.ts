import "server-only";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Stage 4.2 — typed wrapper around the `search_materials` Postgres RPC.
 *
 * Security model (matches Phase 4.1 migration):
 *   - RPC is SECURITY INVOKER + restricted to the `authenticated` role.
 *   - Caller never passes a user ID. The RPC reads `auth.uid()` from the JWT
 *     and uses it for visibility + ranking.
 *   - Anonymous calls are rejected at the GRANT layer.
 *   - Result rows are RLS-filtered: own-rows + global rows only.
 *
 * The shape of `MaterialSearchHit` mirrors the RPC's return columns exactly.
 * If you change the SQL, update this file (and the matcher tests below).
 */

export type MaterialMatchSource =
  | "direct_user"
  | "alias_user"
  | "direct_global"
  | "alias_global";

export type MaterialSearchHit = {
  id: string;
  user_id: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string | null;
  price: number | null;
  attributes: Record<string, unknown>;
  match_source: MaterialMatchSource;
  match_score: number;
  tier_rank: number;
};

export type MaterialSearchOptions = {
  query: string;
  country?: string | null;
  category?: string | null;
  brand?: string | null;
  supplier?: string | null;
  /** Server-side cap is 100 (see search_materials migration). Default 25. */
  limit?: number;
  /**
   * Stage 4.9 — H-class hard filter. When set, ONLY rows whose
   * attributes->>'treatment_class' equals this value are returned.
   * Pass values like 'H1.2' / 'H3' / 'H3.2' / 'H4' / 'H5' (case-sensitive,
   * matches catalogue convention). The matcher fills this in from the
   * normalizer's `treatmentClass` field whenever the description names an
   * H-class — preventing the V9 collapse where trigram similarity could
   * pick H1.2 framing rows over an H3 framing query.
   */
  treatmentClass?: string | null;
  /**
   * When true, query as service role. This bypasses RLS — use ONLY for
   * trusted server jobs (catalogue seeding, scheduled rebuilds). Default
   * false: query runs under the calling user's session.
   */
  asAdmin?: boolean;
};

const RPC_NAME = "search_materials" as const;

export async function searchMaterials(
  opts: MaterialSearchOptions,
): Promise<MaterialSearchHit[]> {
  const trimmed = (opts.query ?? "").trim();
  if (trimmed.length === 0) return [];

  const supabase = opts.asAdmin ? adminClient() : await createClient();

  const { data, error } = await supabase.rpc(RPC_NAME as never, {
    p_query: trimmed,
    p_country: opts.country ?? "NZ",
    p_category: opts.category ?? null,
    p_brand: opts.brand ?? null,
    p_supplier: opts.supplier ?? null,
    p_limit: opts.limit ?? 25,
    p_treatment_class: opts.treatmentClass ?? null,
  } as never);

  if (error) {
    throw new Error(`searchMaterials RPC failed: ${error.message}`);
  }

  return (data ?? []) as MaterialSearchHit[];
}
