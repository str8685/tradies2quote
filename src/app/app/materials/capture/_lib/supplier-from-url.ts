/**
 * Pure URL → supplier-name helper for the supplier-product capture flow.
 *
 * No fetch, no DOM, no I/O. Given a product URL the tradie pasted or shared,
 * we look at the hostname and match it against the four NZ trade-supplier
 * domains the app supports. Anything else returns null and the user fills
 * the supplier name in by hand.
 *
 * Also exports `cleanSharedTitle` which strips the noisy " - Mitre 10" /
 * " | Bunnings NZ" suffixes the OS share sheet sometimes hands us as
 * `?title=` so the product-name field doesn't end up with a supplier suffix
 * baked in.
 *
 * Used by:
 *   - src/app/app/materials/capture/page.tsx (server)
 *   - src/app/app/materials/capture/_components/CaptureForm.tsx (client)
 */

const KNOWN_SUPPLIERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(^|\.)mitre10\.co\.nz$/i, "Mitre 10"],
  [/(^|\.)bunnings\.co\.nz$/i, "Bunnings"],
  [/(^|\.)itm\.co\.nz$/i, "ITM"],
  [/(^|\.)placemakers\.co\.nz$/i, "PlaceMakers"],
] as const;

/**
 * Returns the canonical supplier name if `url`'s hostname is one of the
 * four known NZ suppliers, else null. Robust to malformed input.
 */
export function supplierFromUrl(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  for (const [pattern, name] of KNOWN_SUPPLIERS) {
    if (pattern.test(host)) return name;
  }
  return null;
}

/**
 * Strip common "<product> - Mitre 10", "<product> | Bunnings NZ", etc.
 * suffixes that the OS share sheet copies into `?title=`. Best-effort:
 * leaves the title as-is if no known suffix matches.
 */
export function cleanSharedTitle(title: string): string {
  if (!title) return "";
  let cleaned = title.trim();
  const suffixPatterns: ReadonlyArray<RegExp> = [
    /\s*[-–|]\s*Mitre\s*10(\s+NZ)?\s*$/i,
    /\s*[-–|]\s*Bunnings(\s+NZ)?\s*$/i,
    /\s*[-–|]\s*ITM(\s+NZ)?\s*$/i,
    /\s*[-–|]\s*PlaceMakers(\s+NZ)?\s*$/i,
    // Generic "Buy X online | Site Name" → keep the part before " | "
    /\s+\|\s+[^|]+$/,
  ];
  for (const re of suffixPatterns) {
    cleaned = cleaned.replace(re, "");
  }
  return cleaned.trim();
}
