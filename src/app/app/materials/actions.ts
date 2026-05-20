"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./_state";

// `ActionResult` and `ACTION_INITIAL` live in `./_state.ts` — Next 16
// forbids non-async exports from `"use server"` files at runtime.

function readField(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function readOptional(form: FormData, key: string): string | null {
  const v = readField(form, key);
  return v.length > 0 ? v : null;
}

function parsePrice(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export async function createMaterial(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = readField(formData, "name");
  const unit = readField(formData, "unit");
  const priceRaw = readField(formData, "default_unit_price");
  const price = parsePrice(priceRaw);

  if (!name) return { error: "Name is required." };
  if (!unit) return { error: "Unit is required." };
  if (price === null) return { error: "Default price must be a non-negative number." };

  const { error } = await supabase.from("materials").insert({
    user_id: user.id,
    name,
    unit,
    default_unit_price: price,
    supplier: readOptional(formData, "supplier"),
    supplier_url: readOptional(formData, "supplier_url"),
    notes: readOptional(formData, "notes"),
    is_ai_estimated: false,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You already have a material with that name." };
    }
    console.error("createMaterial failed", error);
    return { error: "Could not save material." };
  }

  revalidatePath("/app/materials");
  redirect("/app/materials");
}

export async function updateMaterial(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = readField(formData, "id");
  const name = readField(formData, "name");
  const unit = readField(formData, "unit");
  const priceRaw = readField(formData, "default_unit_price");
  const price = parsePrice(priceRaw);

  if (!id) return { error: "Missing material id." };
  if (!name) return { error: "Name is required." };
  if (!unit) return { error: "Unit is required." };
  if (price === null) return { error: "Default price must be a non-negative number." };

  const { error } = await supabase
    .from("materials")
    .update({
      name,
      unit,
      default_unit_price: price,
      supplier: readOptional(formData, "supplier"),
      supplier_url: readOptional(formData, "supplier_url"),
      notes: readOptional(formData, "notes"),
      is_ai_estimated: false,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "You already have a material with that name." };
    }
    console.error("updateMaterial failed", error);
    return { error: "Could not save changes." };
  }

  revalidatePath("/app/materials");
  redirect("/app/materials");
}

export async function deleteMaterial(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = readField(formData, "id");
  if (!id) return { error: "Missing material id." };

  const { error } = await supabase
    .from("materials")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    console.error("deleteMaterial failed", error);
    return { error: "Could not delete." };
  }

  revalidatePath("/app/materials");
  redirect("/app/materials");
}

type ImportRow = {
  name: string;
  unit: string;
  default_unit_price: number;
  supplier: string | null;
  supplier_url: string | null;
  notes: string | null;
};

export async function importMaterials(
  rows: ImportRow[],
): Promise<{ inserted: number; updated: number; failed: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!Array.isArray(rows) || rows.length === 0) {
    return { inserted: 0, updated: 0, failed: 0, error: "No rows to import." };
  }

  const { data: existing, error: selErr } = await supabase
    .from("materials")
    .select("id, name")
    .eq("user_id", user.id);

  if (selErr) {
    console.error("importMaterials select failed", selErr);
    return {
      inserted: 0,
      updated: 0,
      failed: rows.length,
      error: "Could not read existing library.",
    };
  }

  const byName = new Map<string, string>();
  for (const m of existing ?? []) {
    byName.set(m.name.trim().toLowerCase(), m.id);
  }

  const toInsert: Array<ImportRow & { user_id: string }> = [];
  const toUpdate: Array<{ id: string; row: ImportRow }> = [];
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    const matchId = byName.get(key);
    if (matchId) {
      toUpdate.push({ id: matchId, row: r });
    } else {
      toInsert.push({ ...r, user_id: user.id });
    }
  }

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from("materials")
      .insert(
        toInsert.map((r) => ({
          user_id: r.user_id,
          name: r.name,
          unit: r.unit,
          default_unit_price: r.default_unit_price,
          supplier: r.supplier,
          supplier_url: r.supplier_url,
          notes: r.notes,
          is_ai_estimated: false,
        })),
      )
      .select("id");
    if (error) {
      console.error("importMaterials insert failed", error);
      failed += toInsert.length;
    } else {
      inserted = data?.length ?? 0;
    }
  }

  for (const u of toUpdate) {
    const { error } = await supabase
      .from("materials")
      .update({
        unit: u.row.unit,
        default_unit_price: u.row.default_unit_price,
        supplier: u.row.supplier,
        supplier_url: u.row.supplier_url,
        notes: u.row.notes,
        is_ai_estimated: false,
      })
      .eq("id", u.id);
    if (error) {
      failed++;
    } else {
      updated++;
    }
  }

  revalidatePath("/app/materials");
  return { inserted, updated, failed };
}

// ───────────────────────────────────────────────────────────────────────
// Supplier-quote import (Wave 46).
//
// Sibling of importMaterials for rows the tradie reviewed off an AI-read
// supplier quote photo. Same dedupe-by-name + bulk-insert / serial-update
// shape, but the rows are marked is_ai_estimated + price_source so the
// library makes clear these prices came from a scanned quote and should
// be re-confirmed. The human has already reviewed every row in the UI.
// ───────────────────────────────────────────────────────────────────────

export type SupplierQuoteRow = {
  name: string;
  unit: string;
  default_unit_price: number;
  sku: string | null;
  notes: string | null;
};

export async function importSupplierQuoteItems(
  rows: SupplierQuoteRow[],
  supplier: string | null,
): Promise<{ inserted: number; updated: number; failed: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!Array.isArray(rows) || rows.length === 0) {
    return { inserted: 0, updated: 0, failed: 0, error: "No rows to import." };
  }
  // Defensive server-side validation — the UI already enforces this, but
  // never trust the client. Drop rows with no name or a bad price.
  const clean = rows
    .map((r) => ({
      name: typeof r.name === "string" ? r.name.trim() : "",
      unit: typeof r.unit === "string" && r.unit.trim() ? r.unit.trim() : "each",
      default_unit_price: Math.max(0, Number(r.default_unit_price) || 0),
      sku: typeof r.sku === "string" && r.sku.trim() ? r.sku.trim() : null,
      notes: typeof r.notes === "string" && r.notes.trim() ? r.notes.trim() : null,
    }))
    .filter((r) => r.name.length > 0);
  if (clean.length === 0) {
    return { inserted: 0, updated: 0, failed: 0, error: "No valid rows to import." };
  }

  const supplierName =
    typeof supplier === "string" && supplier.trim() ? supplier.trim() : null;

  const { data: existing, error: selErr } = await supabase
    .from("materials")
    .select("id, name")
    .eq("user_id", user.id);
  if (selErr) {
    console.error("importSupplierQuoteItems select failed", selErr);
    return {
      inserted: 0,
      updated: 0,
      failed: clean.length,
      error: "Could not read existing library.",
    };
  }

  const byName = new Map<string, string>();
  for (const m of existing ?? []) {
    byName.set(m.name.trim().toLowerCase(), m.id);
  }

  const toInsert: typeof clean = [];
  const toUpdate: Array<{ id: string; row: (typeof clean)[number] }> = [];
  for (const r of clean) {
    const matchId = byName.get(r.name.toLowerCase());
    if (matchId) toUpdate.push({ id: matchId, row: r });
    else toInsert.push(r);
  }

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from("materials")
      .insert(
        toInsert.map((r) => ({
          user_id: user.id,
          name: r.name,
          unit: r.unit,
          default_unit_price: r.default_unit_price,
          supplier: supplierName,
          sku: r.sku,
          notes: r.notes ?? "From scanned supplier quote — confirm price.",
          is_ai_estimated: true,
          price_source: "supplier_import",
          price_confidence: "medium",
          gst_included: false,
        })),
      )
      .select("id");
    if (error) {
      console.error("importSupplierQuoteItems insert failed", error);
      failed += toInsert.length;
    } else {
      inserted = data?.length ?? 0;
    }
  }

  for (const u of toUpdate) {
    const { error } = await supabase
      .from("materials")
      .update({
        unit: u.row.unit,
        default_unit_price: u.row.default_unit_price,
        supplier: supplierName,
        sku: u.row.sku,
        notes: u.row.notes ?? "From scanned supplier quote — confirm price.",
        is_ai_estimated: true,
        price_source: "supplier_import",
        price_confidence: "medium",
        gst_included: false,
      })
      .eq("id", u.id)
      .eq("user_id", user.id);
    if (error) failed++;
    else updated++;
  }

  console.log("[import-quote] saved", {
    userId: user.id,
    inserted,
    updated,
    failed,
  });
  revalidatePath("/app/materials");
  return { inserted, updated, failed };
}
