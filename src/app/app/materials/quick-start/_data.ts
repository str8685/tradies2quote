/**
 * Wave 41 Stage 4 — curated NZ starter materials.
 *
 * The 12 items below are the materials a typical NZ tradie touches
 * on most jobs across decks, fences, framing, GIB lining, concrete
 * and roofing. They were picked specifically so a tradie can fill
 * in five or six prices in 60 seconds and immediately have most
 * future AI-generated quotes resolve against their library instead
 * of asking Claude for an estimate.
 *
 * Suggested prices are deliberately omitted — we don't want to
 * anchor the tradie to a possibly-stale national average. They
 * skip the rows they don't use; the rows they DO fill in become
 * the source of truth for every subsequent quote.
 *
 * `category` mirrors the values used by the rest of the materials
 * module so the items list in the table groups them sensibly after
 * the bulk insert.
 */

export interface StarterMaterial {
  slug: string;
  name: string;
  unit: string;
  category: string;
  trade_hint: string;
}

export const STARTER_MATERIALS: StarterMaterial[] = [
  {
    slug: "framing-90x45-h12-48",
    name: "Framing 90x45 H1.2 4.8m",
    unit: "each",
    category: "Timber",
    trade_hint: "Framing studs and plates",
  },
  {
    slug: "joist-140x45-h32-54",
    name: "Joist 140x45 H3.2 5.4m",
    unit: "each",
    category: "Timber",
    trade_hint: "Deck and subfloor joists",
  },
  {
    slug: "decking-140x19-h32-54",
    name: "Decking 140x19 H3.2 5.4m",
    unit: "each",
    category: "Timber",
    trade_hint: "Deck boards",
  },
  {
    slug: "post-100x100-h5-24",
    name: "Post 100x100 H5 2.4m",
    unit: "each",
    category: "Timber",
    trade_hint: "Deck posts and fence posts",
  },
  {
    slug: "gib-standard-10mm",
    name: "GIB Standard 10mm 1200x2400",
    unit: "sheet",
    category: "Plasterboard",
    trade_hint: "Wall lining",
  },
  {
    slug: "gib-standard-13mm",
    name: "GIB Standard 13mm 1200x2400",
    unit: "sheet",
    category: "Plasterboard",
    trade_hint: "Ceiling lining (anti-sag)",
  },
  {
    slug: "gib-aqualine-10mm",
    name: "GIB Aqualine 10mm 1200x2400",
    unit: "sheet",
    category: "Plasterboard",
    trade_hint: "Wet area lining (bathrooms, laundries)",
  },
  {
    slug: "pink-batts-r32-wall",
    name: "Pink Batts R3.2 wall insulation",
    unit: "pack",
    category: "Insulation",
    trade_hint: "Wall insulation per pack",
  },
  {
    slug: "stainless-decking-screws-box",
    name: "Stainless decking screws 75mm (box 500)",
    unit: "box",
    category: "Fixings",
    trade_hint: "Deck fixings",
  },
  {
    slug: "joist-hanger-90x45",
    name: "Joist hanger 90x45",
    unit: "each",
    category: "Fixings",
    trade_hint: "Ledger fixings",
  },
  {
    slug: "concrete-mix-20kg",
    name: "Concrete mix 20kg",
    unit: "bag",
    category: "Concrete",
    trade_hint: "Post footings",
  },
  {
    slug: "reo-mesh-se62-sheet",
    name: "Reinforcing mesh SE62 (3.0m x 1.5m sheet)",
    unit: "sheet",
    category: "Concrete",
    trade_hint: "Slab reinforcing",
  },
  {
    slug: "coloursteel-04mm-24m",
    name: "Coloursteel 0.4mm corrugate 2.4m sheet",
    unit: "sheet",
    category: "Roofing",
    trade_hint: "Long-run iron roofing",
  },
];
