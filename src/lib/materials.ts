import type { LibraryMaterial, QuoteLineItem } from "./quote-types";

export const CSV_HEADERS = [
  "name",
  "unit",
  "default_unit_price",
  "supplier",
  "supplier_url",
  "notes",
] as const;

export const REQUIRED_CSV_HEADERS = [
  "name",
  "unit",
  "default_unit_price",
] as const;

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "per",
  "each",
  "of",
  "to",
  "from",
  "by",
]);

function normaliseTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !STOP_WORDS.has(t)),
  );
}

export function matchToLibrary(
  description: string,
  library: LibraryMaterial[],
): LibraryMaterial | null {
  if (!description || library.length === 0) return null;
  const descTokens = normaliseTokens(description);
  if (descTokens.size === 0) return null;

  let best: LibraryMaterial | null = null;
  let bestSpecificity = 0;

  for (const item of library) {
    const libTokens = normaliseTokens(item.name);
    if (libTokens.size === 0) continue;
    let allFound = true;
    for (const t of libTokens) {
      if (!descTokens.has(t)) {
        allFound = false;
        break;
      }
    }
    if (allFound && libTokens.size > bestSpecificity) {
      best = item;
      bestSpecificity = libTokens.size;
    }
  }

  return best;
}

export function formatLibraryForPrompt(
  library: LibraryMaterial[],
  currency: string,
): string {
  if (library.length === 0) {
    return "(The tradie has no saved materials yet — generate AI estimates for everything.)";
  }
  const lines = library
    .slice()
    .sort((a, b) => b.usage_count - a.usage_count || a.name.localeCompare(b.name))
    .map((m) => {
      const price =
        m.default_unit_price !== null
          ? `${currency} ${Number(m.default_unit_price).toFixed(2)}`
          : "no price set";
      const unit = m.unit ?? "each";
      const supplier = m.supplier ? ` (${m.supplier})` : "";
      return `- "${m.name}" — ${unit} @ ${price}${supplier}`;
    });
  return lines.join("\n");
}

export type CsvParseResult = {
  valid: Array<{
    name: string;
    unit: string;
    default_unit_price: number;
    supplier: string | null;
    supplier_url: string | null;
    notes: string | null;
  }>;
  invalid: Array<{ row: number; reason: string; raw: string }>;
};

export function parseMaterialsCsv(text: string): CsvParseResult {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  const valid: CsvParseResult["valid"] = [];
  const invalid: CsvParseResult["invalid"] = [];
  if (lines.length === 0) return { valid, invalid };

  const headerCells = splitCsvLine(lines[0]).map((c) => c.toLowerCase().trim());
  const idx = (h: string) => headerCells.indexOf(h);
  const iName = idx("name");
  const iUnit = idx("unit");
  const iPrice = idx("default_unit_price");
  const iSupplier = idx("supplier");
  const iUrl = idx("supplier_url");
  const iNotes = idx("notes");

  for (const required of REQUIRED_CSV_HEADERS) {
    if (idx(required) === -1) {
      invalid.push({
        row: 0,
        reason: `Missing required column "${required}"`,
        raw: lines[0],
      });
      return { valid, invalid };
    }
  }

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const name = (cells[iName] ?? "").trim();
    const unit = (cells[iUnit] ?? "").trim();
    const priceRaw = (cells[iPrice] ?? "").trim();
    const supplier = iSupplier >= 0 ? (cells[iSupplier] ?? "").trim() : "";
    const supplier_url = iUrl >= 0 ? (cells[iUrl] ?? "").trim() : "";
    const notes = iNotes >= 0 ? (cells[iNotes] ?? "").trim() : "";

    if (!name) {
      invalid.push({ row: i + 1, reason: "Missing name", raw: lines[i] });
      continue;
    }
    if (!unit) {
      invalid.push({ row: i + 1, reason: "Missing unit", raw: lines[i] });
      continue;
    }
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) {
      invalid.push({
        row: i + 1,
        reason: `Invalid price "${priceRaw}"`,
        raw: lines[i],
      });
      continue;
    }
    valid.push({
      name,
      unit,
      default_unit_price: Math.round(price * 100) / 100,
      supplier: supplier || null,
      supplier_url: supplier_url || null,
      notes: notes || null,
    });
  }

  return { valid, invalid };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"' && cur.length === 0) {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

export function buildLibrarySnapshot(
  items: QuoteLineItem[],
): Map<string, { unit_price: number; was_ai: boolean }> {
  const map = new Map<string, { unit_price: number; was_ai: boolean }>();
  for (const it of items) {
    if (it.type !== "material") continue;
    const key = it.description.trim().toLowerCase();
    if (!key) continue;
    map.set(key, {
      unit_price: Number(it.unit_price) || 0,
      was_ai: !!it.is_ai_estimated,
    });
  }
  return map;
}
