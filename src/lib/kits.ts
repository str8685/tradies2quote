import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Kits ("assemblies" / "recipes") — a saved set of line items for a common
 * job (e.g. "Standard hot-water cylinder swap"). The tradie builds them once,
 * then drops a whole job's worth of lines into a quote in one tap.
 *
 * Feature-flagged: until `KITS_ENABLED=true`, the nav entry + page are hidden,
 * so the rest of the app is byte-for-byte unchanged. All reads are RLS-scoped
 * (the user client only ever sees the signed-in tradie's own kits).
 */
export function kitsEnabled(): boolean {
  return process.env.KITS_ENABLED === "true";
}

export type KitItemType = "material" | "labour" | "other";

export type KitItemInput = {
  type: KitItemType;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
};

export type KitItem = KitItemInput & { id: string; position: number };

export type KitWithItems = {
  id: string;
  name: string;
  trade: string | null;
  notes: string | null;
  items: KitItem[];
};

function coerceType(value: string): KitItemType {
  return value === "labour" || value === "other" ? value : "material";
}

/** All of the signed-in tradie's kits with their line items (RLS-scoped). */
export async function getKitsWithItems(): Promise<KitWithItems[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: kits, error } = await supabase
    .from("kits")
    .select("id, name, trade, notes")
    .order("created_at", { ascending: true });
  if (error || !kits || kits.length === 0) return [];

  const kitIds = kits.map((k) => k.id);
  const { data: rows } = await supabase
    .from("kit_items")
    .select("id, kit_id, type, description, quantity, unit, unit_price, position")
    .in("kit_id", kitIds)
    .order("position", { ascending: true });

  const items = rows ?? [];
  return kits.map((k) => ({
    id: k.id,
    name: k.name,
    trade: k.trade,
    notes: k.notes,
    items: items
      .filter((i) => i.kit_id === k.id)
      .map((i) => ({
        id: i.id,
        type: coerceType(i.type),
        description: i.description,
        quantity: Number(i.quantity ?? 0),
        unit: i.unit,
        unit_price: Number(i.unit_price ?? 0),
        position: i.position,
      })),
  }));
}

/** Total ex-tax value of a kit, for display. */
export function kitTotal(items: ReadonlyArray<Pick<KitItem, "quantity" | "unit_price">>): number {
  return items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
}
