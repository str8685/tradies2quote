"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { error: string };
export const ACTION_INITIAL: ActionResult = { ok: true };

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
    .eq("id", id);

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

  const { error } = await supabase.from("materials").delete().eq("id", id);
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
