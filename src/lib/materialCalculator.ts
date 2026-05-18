export type MaterialTakeoffInput = {
  wallLengthM: number;
  wallHeightM?: number;
  studSpacingMm?: number;
  numberOfDoors?: number;
  numberOfWindows?: number;
  gibSides?: 1 | 2;
  includeInsulation?: boolean;
  includeSkirting?: boolean;
  includeArchitraves?: boolean;
  wastePercent?: number;
  timberStockLengthM?: number;
  gibSheetWidthM?: number;
  gibSheetHeightM?: number;
  insulationPackCoverageM2?: number;
  doorWidthM?: number;
  doorHeightM?: number;
  windowWidthM?: number;
  windowHeightM?: number;
};

export type MaterialTakeoffLine = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  formula: string;
  notes?: string;
  priceMatchKey?: string;
};

export type MaterialTakeoffResult = {
  summary: {
    wallAreaM2: number;
    openingAreaM2: number;
    netWallAreaM2: number;
    wastePercent: number;
  };
  materials: MaterialTakeoffLine[];
  warnings: string[];
};

export const DEFAULTS = {
  wallHeightM: 2.4,
  studSpacingMm: 600,
  numberOfDoors: 0,
  numberOfWindows: 0,
  gibSides: 2 as 1 | 2,
  includeInsulation: true,
  includeSkirting: false,
  includeArchitraves: false,
  wastePercent: 10,
  timberStockLengthM: 4.8,
  gibSheetWidthM: 1.2,
  gibSheetHeightM: 2.4,
  insulationPackCoverageM2: 8.8,
  doorWidthM: 0.82,
  doorHeightM: 2.04,
  windowWidthM: 1.2,
  windowHeightM: 1.2,
};

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

/**
 * Math.ceil with a 6-decimal-place precision guard. Plain Math.ceil on a
 * floating-point computation can push a value like 22.0000000004 (which
 * is mathematically 22 but suffers from IEEE-754 noise) over the integer
 * boundary to 23. safeCeil rounds to 6dp first so only meaningful
 * fractions trigger the ceiling. Used by every formula in the deck,
 * cladding and subfloor calculators that mixes multiplication and
 * division of decimal metres.
 */
function safeCeil(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.ceil(Math.round(n * 1e6) / 1e6);
}

export function calculateMaterialTakeoff(
  input: MaterialTakeoffInput,
): MaterialTakeoffResult {
  const wallLengthM = Number(input.wallLengthM);
  const wallHeightM = input.wallHeightM ?? DEFAULTS.wallHeightM;
  const studSpacingMm = input.studSpacingMm ?? DEFAULTS.studSpacingMm;
  const numberOfDoors = input.numberOfDoors ?? DEFAULTS.numberOfDoors;
  const numberOfWindows = input.numberOfWindows ?? DEFAULTS.numberOfWindows;
  const gibSides = (input.gibSides ?? DEFAULTS.gibSides) as 1 | 2;
  const includeInsulation =
    input.includeInsulation ?? DEFAULTS.includeInsulation;
  const includeSkirting = input.includeSkirting ?? DEFAULTS.includeSkirting;
  const includeArchitraves =
    input.includeArchitraves ?? DEFAULTS.includeArchitraves;
  const wastePercent = input.wastePercent ?? DEFAULTS.wastePercent;
  const timberStockLengthM =
    input.timberStockLengthM ?? DEFAULTS.timberStockLengthM;
  const gibSheetWidthM = input.gibSheetWidthM ?? DEFAULTS.gibSheetWidthM;
  const gibSheetHeightM = input.gibSheetHeightM ?? DEFAULTS.gibSheetHeightM;
  const insulationPackCoverageM2 =
    input.insulationPackCoverageM2 ?? DEFAULTS.insulationPackCoverageM2;
  const doorWidthM = input.doorWidthM ?? DEFAULTS.doorWidthM;
  const doorHeightM = input.doorHeightM ?? DEFAULTS.doorHeightM;
  const windowWidthM = input.windowWidthM ?? DEFAULTS.windowWidthM;
  const windowHeightM = input.windowHeightM ?? DEFAULTS.windowHeightM;

  const warnings: string[] = [];
  if (!Number.isFinite(wallLengthM) || wallLengthM <= 0) {
    warnings.push("wallLengthM must be greater than 0.");
  }
  if (!Number.isFinite(wallHeightM) || wallHeightM <= 0) {
    warnings.push("wallHeightM must be greater than 0.");
  }
  if (gibSides !== 1 && gibSides !== 2) {
    warnings.push("gibSides must be 1 or 2.");
  }
  if (studSpacingMm !== 400 && studSpacingMm !== 600) {
    warnings.push("studSpacingMm must be 400 or 600.");
  }
  if (wastePercent < 0) {
    warnings.push("wastePercent cannot be negative.");
  }

  const safeWallLength = Math.max(wallLengthM, 0);
  const safeWallHeight = Math.max(wallHeightM, 0);

  const wallAreaM2 = round2(safeWallLength * safeWallHeight);
  const doorAreaM2 = numberOfDoors * doorWidthM * doorHeightM;
  const windowAreaM2 = numberOfWindows * windowWidthM * windowHeightM;
  const openingAreaM2 = round2(doorAreaM2 + windowAreaM2);
  const netWallAreaM2 = round2(Math.max(wallAreaM2 - openingAreaM2, 0));

  if (netWallAreaM2 === 0) {
    warnings.push("netWallAreaM2 is 0 — check wall dimensions or openings.");
  }

  const wasteMultiplier = 1 + Math.max(wastePercent, 0) / 100;
  const sheetAreaM2 = gibSheetWidthM * gibSheetHeightM;

  const baseStuds =
    studSpacingMm > 0
      ? Math.ceil((safeWallLength * 1000) / studSpacingMm) + 1
      : 0;
  const openingStuds = numberOfDoors * 4 + numberOfWindows * 4;
  const studCount = baseStuds + openingStuds;

  const plateLengths =
    timberStockLengthM > 0
      ? Math.ceil((safeWallLength * 3) / timberStockLengthM)
      : 0;
  const nogLengths =
    timberStockLengthM > 0
      ? Math.ceil(safeWallLength / timberStockLengthM)
      : 0;

  const gibAreaM2 = netWallAreaM2 * gibSides;
  const gibAreaWithWaste = gibAreaM2 * wasteMultiplier;
  const gibSheets =
    sheetAreaM2 > 0 ? Math.ceil(gibAreaWithWaste / sheetAreaM2) : 0;
  const gibScrews = Math.ceil(gibSheets * 40 * 1.1);
  const adhesiveTubes = Math.ceil(gibSheets / 4);

  const materials: MaterialTakeoffLine[] = [
    {
      id: "studs-90x45",
      name: "90x45 SG8 Studs",
      category: "Framing",
      quantity: studCount,
      unit: "lengths",
      formula:
        "ceil((wallLengthM * 1000) / studSpacingMm) + 1 + opening studs",
      priceMatchKey: "90x45-sg8-studs",
    },
    {
      id: "plates-90x45",
      name: "90x45 SG8 Plates",
      category: "Framing",
      quantity: plateLengths,
      unit: "lengths",
      formula: "ceil((wallLengthM * 3) / timberStockLengthM)",
      priceMatchKey: "90x45-sg8-plates",
    },
    {
      id: "nogs-90x45",
      name: "90x45 SG8 Nogs",
      category: "Framing",
      quantity: nogLengths,
      unit: "lengths",
      formula: "ceil(wallLengthM / timberStockLengthM)",
      priceMatchKey: "90x45-sg8-nogs",
    },
    {
      id: "gib-10mm",
      name: "10mm GIB Board",
      category: "Lining",
      quantity: gibSheets,
      unit: "sheets",
      formula:
        "ceil((netWallAreaM2 * gibSides * wasteMultiplier) / sheetAreaM2)",
      priceMatchKey: "10mm-gib-board",
    },
    {
      id: "gib-screws",
      name: "GIB Screws",
      category: "Fixings",
      quantity: gibScrews,
      unit: "screws",
      formula: "ceil(gibSheets * 40 * 1.1)",
      notes: "Estimate only. Round to nearest box in pricing.",
      priceMatchKey: "gib-screws",
    },
    {
      id: "gib-adhesive",
      name: "GIB Adhesive",
      category: "Fixings",
      quantity: adhesiveTubes,
      unit: "tubes",
      formula: "ceil(gibSheets / 4)",
      priceMatchKey: "gib-adhesive",
    },
  ];

  if (includeInsulation) {
    const insulationAreaWithWaste = netWallAreaM2 * wasteMultiplier;
    const insulationPacks =
      insulationPackCoverageM2 > 0
        ? Math.ceil(insulationAreaWithWaste / insulationPackCoverageM2)
        : 0;
    materials.push({
      id: "pink-batts",
      name: "Pink Batts Insulation",
      category: "Insulation",
      quantity: insulationPacks,
      unit: "packs",
      formula:
        "ceil((netWallAreaM2 * wasteMultiplier) / insulationPackCoverageM2)",
      priceMatchKey: "pink-batts",
    });
  }

  if (includeSkirting) {
    const skirtingLinearM = safeWallLength * gibSides;
    const skirtingWithWaste = skirtingLinearM * wasteMultiplier;
    const skirtingLengths =
      timberStockLengthM > 0
        ? Math.ceil(skirtingWithWaste / timberStockLengthM)
        : 0;
    materials.push({
      id: "skirting",
      name: "Skirting",
      category: "Finishing",
      quantity: skirtingLengths,
      unit: "lengths",
      formula:
        "ceil((wallLengthM * gibSides * wasteMultiplier) / timberStockLengthM)",
      priceMatchKey: "skirting",
    });
  }

  if (includeArchitraves) {
    const architraveLinearM =
      numberOfDoors * (doorHeightM * 2 + doorWidthM);
    const architraveWithWaste = architraveLinearM * wasteMultiplier;
    const architraveLengths =
      timberStockLengthM > 0
        ? Math.ceil(architraveWithWaste / timberStockLengthM)
        : 0;
    materials.push({
      id: "architraves",
      name: "Architraves",
      category: "Finishing",
      quantity: architraveLengths,
      unit: "lengths",
      formula:
        "ceil((doors * ((doorHeightM * 2) + doorWidthM) * wasteMultiplier) / timberStockLengthM)",
      priceMatchKey: "architraves",
    });
  }

  materials.push({
    id: "framing-nails",
    name: "Framing Nails",
    category: "Fixings",
    quantity: 1,
    unit: "box",
    formula: "1 box allowance per small wall",
    priceMatchKey: "framing-nails",
  });

  return {
    summary: {
      wallAreaM2,
      openingAreaM2,
      netWallAreaM2,
      wastePercent,
    },
    materials,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Chunk 1 — Deck takeoff
//
// NZS 3604 framing rules + standard NZ residential deck practice. Joists
// run perpendicular to decking direction; bearers run parallel to it.
// Default profile is 90×19 H3.2 decking on 200×50 H3.2 SG8 joists at
// 450mm centres, sitting on 200×100 H4 SG8 bearers at 1.8m spans, on
// concrete piles at 1.8m centres. Boards have a 5mm gap so coverage =
// boardWidth + 5mm.
//
// Validation: numbers should match blocklayer.com's deck calculator for
// the same dimensions. The operator (qualified builder) is the final
// arbiter — formulas are pure geometry, no AI, so the numbers are
// reproducible and easy to compare.
// ─────────────────────────────────────────────────────────────────────────

export type DeckTakeoffInput = {
  deckLengthM: number;
  deckWidthM: number;
  joistSpacingMm?: number;
  bearerSpacingM?: number;
  pileSpacingM?: number;
  boardWidthMm?: number;
  boardGapMm?: number;
  wastePercent?: number;
  timberStockLengthM?: number;
  includePiles?: boolean;
};

export const DECK_DEFAULTS = {
  joistSpacingMm: 450,
  bearerSpacingM: 1.8,
  pileSpacingM: 1.8,
  boardWidthMm: 90,
  boardGapMm: 5,
  wastePercent: 10,
  timberStockLengthM: 4.8,
  includePiles: true,
};

export function calculateDeckTakeoff(
  input: DeckTakeoffInput,
): MaterialTakeoffResult {
  const deckLengthM = Number(input.deckLengthM);
  const deckWidthM = Number(input.deckWidthM);
  const joistSpacingMm =
    input.joistSpacingMm ?? DECK_DEFAULTS.joistSpacingMm;
  const bearerSpacingM =
    input.bearerSpacingM ?? DECK_DEFAULTS.bearerSpacingM;
  const pileSpacingM = input.pileSpacingM ?? DECK_DEFAULTS.pileSpacingM;
  const boardWidthMm = input.boardWidthMm ?? DECK_DEFAULTS.boardWidthMm;
  const boardGapMm = input.boardGapMm ?? DECK_DEFAULTS.boardGapMm;
  const wastePercent = input.wastePercent ?? DECK_DEFAULTS.wastePercent;
  const timberStockLengthM =
    input.timberStockLengthM ?? DECK_DEFAULTS.timberStockLengthM;
  const includePiles = input.includePiles ?? DECK_DEFAULTS.includePiles;

  const warnings: string[] = [];
  if (!Number.isFinite(deckLengthM) || deckLengthM <= 0) {
    warnings.push("Deck length is missing or invalid.");
  }
  if (!Number.isFinite(deckWidthM) || deckWidthM <= 0) {
    warnings.push("Deck width is missing or invalid.");
  }
  if (![300, 400, 450, 600].includes(joistSpacingMm)) {
    warnings.push(
      `Unusual joist spacing ${joistSpacingMm}mm; NZ residential decks normally use 450mm.`,
    );
  }
  if (wastePercent < 0) warnings.push("Waste percent cannot be negative.");

  const deckAreaM2 = round2(deckLengthM * deckWidthM);
  const wasteMultiplier = 1 + wastePercent / 100;
  const materials: MaterialTakeoffLine[] = [];

  // Joists — run across the deck width, spaced along the deck length.
  const joistCount = safeCeil((deckLengthM * 1000) / joistSpacingMm) + 1;
  const joistLinearM = round2(joistCount * deckWidthM);
  const joistLengths = safeCeil(
    (joistLinearM * wasteMultiplier) / timberStockLengthM,
  );
  materials.push({
    id: "deck-joists",
    name: `Deck joists (${joistLengths} × ${timberStockLengthM}m stock)`,
    category: "Joists",
    quantity: joistLengths,
    unit: "lengths",
    formula: `ceil(joistCount=${joistCount} × widthM=${deckWidthM} × (1+${wastePercent}/100) / ${timberStockLengthM}m) = ${joistLengths}`,
    priceMatchKey: "deck-joists",
    notes: `200×50 H3.2 SG8, ${joistSpacingMm}mm centres`,
  });

  // Bearers — run along the deck length, spaced across the deck width.
  const bearerRows = safeCeil(deckWidthM / bearerSpacingM) + 1;
  const bearerLinearM = round2(bearerRows * deckLengthM);
  const bearerLengths = safeCeil(
    (bearerLinearM * wasteMultiplier) / timberStockLengthM,
  );
  materials.push({
    id: "deck-bearers",
    name: `Deck bearers (${bearerLengths} × ${timberStockLengthM}m stock)`,
    category: "Bearers",
    quantity: bearerLengths,
    unit: "lengths",
    formula: `ceil(bearerRows=${bearerRows} × lengthM=${deckLengthM} × (1+${wastePercent}/100) / ${timberStockLengthM}m) = ${bearerLengths}`,
    priceMatchKey: "deck-bearers",
    notes: `200×100 H4 SG8, ${bearerSpacingM}m spans`,
  });

  // Decking boards — coverage = boardWidth + gap.
  const coverageMm = boardWidthMm + boardGapMm;
  const boardRows = safeCeil((deckWidthM * 1000) / coverageMm);
  const boardLinearM = round2(boardRows * deckLengthM * wasteMultiplier);
  materials.push({
    id: "decking-boards",
    name: `Decking boards (${boardWidthMm}mm)`,
    category: "Decking",
    quantity: boardLinearM,
    unit: "m",
    formula: `boardRows=ceil(widthMm=${deckWidthM * 1000} / coverage=${coverageMm}) × lengthM=${deckLengthM} × (1+${wastePercent}/100) = ${boardLinearM}m`,
    priceMatchKey: "decking-boards",
    notes: `${boardWidthMm}×19 H3.2 decking, ${boardGapMm}mm gap`,
  });

  // Joist hangers — one per joist at the ledger end (the other end sits
  // on top of the outer bearer with skew nails, not a hanger).
  materials.push({
    id: "joist-hangers",
    name: "Joist hangers",
    category: "Hardware",
    quantity: joistCount,
    unit: "each",
    formula: `joistCount=${joistCount} (one per joist at ledger end)`,
    priceMatchKey: "joist-hangers",
  });

  // Piles — bearer rows × pile points along each bearer.
  if (includePiles) {
    const pilesPerRow = Math.floor(deckLengthM / pileSpacingM) + 1;
    const piles = bearerRows * pilesPerRow;
    materials.push({
      id: "deck-piles",
      name: "Concrete piles",
      category: "Piles",
      quantity: piles,
      unit: "each",
      formula: `bearerRows=${bearerRows} × pilesPerRow=${pilesPerRow} = ${piles}`,
      priceMatchKey: "concrete-piles",
    });
  }

  // Decking screws — ~30 per m² industry standard for 90mm boards on
  // 450mm joist centres (2 screws per board per joist).
  const screws = safeCeil(deckAreaM2 * 30 * wasteMultiplier);
  materials.push({
    id: "deck-screws",
    name: "Decking screws (stainless)",
    category: "Fixings",
    quantity: screws,
    unit: "each",
    formula: `ceil(deckAreaM2=${deckAreaM2} × 30 × (1+${wastePercent}/100)) = ${screws}`,
    priceMatchKey: "decking-screws",
  });

  // Joist hanger nails — fixed box allowance.
  materials.push({
    id: "joist-hanger-nails",
    name: "Joist hanger nails",
    category: "Fixings",
    quantity: 1,
    unit: "box",
    formula: "1 box allowance",
    priceMatchKey: "joist-hanger-nails",
  });

  return {
    summary: {
      wallAreaM2: deckAreaM2,
      openingAreaM2: 0,
      netWallAreaM2: deckAreaM2,
      wastePercent,
    },
    materials,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Chunk 1 — Cladding takeoff
//
// Default profile is 180mm bevel-back weatherboard with 150mm visible
// coverage (30mm lap), on a cavity-batten system per E2/AS1. Includes
// building wrap, cavity battens, cladding fixings. Flashings are
// estimated per opening; complex flashings (parapet, raked head, etc.)
// fall to the operator to adjust manually.
// ─────────────────────────────────────────────────────────────────────────

export type CladdingTakeoffInput = {
  wallLengthM: number;
  wallHeightM?: number;
  openingAreaM2?: number;
  claddingCoverageMm?: number;
  battenSpacingMm?: number;
  wastePercent?: number;
  timberStockLengthM?: number;
  numberOfOpenings?: number;
  buildingPerimeterM?: number;
  includeCavityBattens?: boolean;
  includeBuildingWrap?: boolean;
  includeFlashings?: boolean;
};

export const CLADDING_DEFAULTS = {
  wallHeightM: 2.4,
  openingAreaM2: 0,
  claddingCoverageMm: 150,
  battenSpacingMm: 600,
  wastePercent: 10,
  timberStockLengthM: 4.8,
  numberOfOpenings: 0,
  buildingPerimeterM: 0,
  includeCavityBattens: true,
  includeBuildingWrap: true,
  includeFlashings: true,
  buildingWrapCoverageM2: 27.5, // Standard 1.4m × 20m roll
};

export function calculateCladdingTakeoff(
  input: CladdingTakeoffInput,
): MaterialTakeoffResult {
  const wallLengthM = Number(input.wallLengthM);
  const wallHeightM = input.wallHeightM ?? CLADDING_DEFAULTS.wallHeightM;
  const openingAreaM2 =
    input.openingAreaM2 ?? CLADDING_DEFAULTS.openingAreaM2;
  const claddingCoverageMm =
    input.claddingCoverageMm ?? CLADDING_DEFAULTS.claddingCoverageMm;
  const battenSpacingMm =
    input.battenSpacingMm ?? CLADDING_DEFAULTS.battenSpacingMm;
  const wastePercent = input.wastePercent ?? CLADDING_DEFAULTS.wastePercent;
  const timberStockLengthM =
    input.timberStockLengthM ?? CLADDING_DEFAULTS.timberStockLengthM;
  const numberOfOpenings =
    input.numberOfOpenings ?? CLADDING_DEFAULTS.numberOfOpenings;
  const buildingPerimeterM =
    input.buildingPerimeterM ?? CLADDING_DEFAULTS.buildingPerimeterM;
  const includeCavityBattens =
    input.includeCavityBattens ?? CLADDING_DEFAULTS.includeCavityBattens;
  const includeBuildingWrap =
    input.includeBuildingWrap ?? CLADDING_DEFAULTS.includeBuildingWrap;
  const includeFlashings =
    input.includeFlashings ?? CLADDING_DEFAULTS.includeFlashings;

  const warnings: string[] = [];
  if (!Number.isFinite(wallLengthM) || wallLengthM <= 0) {
    warnings.push("Wall length is missing or invalid.");
  }
  if (wallHeightM <= 0) warnings.push("Wall height is missing or invalid.");
  if (wastePercent < 0) warnings.push("Waste percent cannot be negative.");

  const wallAreaM2 = round2(wallLengthM * wallHeightM);
  const netCladdingAreaM2 = round2(Math.max(wallAreaM2 - openingAreaM2, 0));
  const wasteMultiplier = 1 + wastePercent / 100;
  const materials: MaterialTakeoffLine[] = [];

  // Cladding boards — linear m needed = area / coverage band.
  const claddingLinearM = round2(
    (netCladdingAreaM2 * 1000) / claddingCoverageMm,
  );
  const claddingStock = safeCeil(
    (claddingLinearM * wasteMultiplier) / timberStockLengthM,
  );
  materials.push({
    id: "cladding-boards",
    name: `Weatherboards (${claddingStock} × ${timberStockLengthM}m stock)`,
    category: "Cladding",
    quantity: claddingStock,
    unit: "lengths",
    formula: `ceil(claddingLinearM=${claddingLinearM} × (1+${wastePercent}/100) / ${timberStockLengthM}m) = ${claddingStock}`,
    priceMatchKey: "weatherboard-cladding",
    notes: `180mm bevel-back, ${claddingCoverageMm}mm coverage`,
  });

  // Cavity battens — vertical 20×45 battens at batten spacing, plus
  // horizontal head/sill closures.
  if (includeCavityBattens) {
    const verticalCount =
      safeCeil((wallLengthM * 1000) / battenSpacingMm) + 1;
    const battenLinearM = round2(
      verticalCount * wallHeightM + wallLengthM * 2,
    );
    const battenStock = safeCeil(
      (battenLinearM * wasteMultiplier) / timberStockLengthM,
    );
    materials.push({
      id: "cavity-battens",
      name: `Cavity battens (${battenStock} × ${timberStockLengthM}m stock)`,
      category: "Battens",
      quantity: battenStock,
      unit: "lengths",
      formula: `verticals=${verticalCount} × heightM=${wallHeightM} + horiz=${wallLengthM * 2}m, ceil(× (1+${wastePercent}/100) / ${timberStockLengthM}m) = ${battenStock}`,
      priceMatchKey: "cavity-battens",
      notes: `20×45 H3.1 cavity batten, ${battenSpacingMm}mm centres`,
    });
  }

  // Building wrap — 27.5m² per standard roll, includes wall area plus
  // 100mm lap allowance built into the waste %.
  if (includeBuildingWrap) {
    const wrapRolls = safeCeil(
      (netCladdingAreaM2 * wasteMultiplier) /
        CLADDING_DEFAULTS.buildingWrapCoverageM2,
    );
    materials.push({
      id: "building-wrap",
      name: "Building wrap",
      category: "Weatherproofing",
      quantity: wrapRolls,
      unit: "rolls",
      formula: `ceil(netAreaM2=${netCladdingAreaM2} × (1+${wastePercent}/100) / ${CLADDING_DEFAULTS.buildingWrapCoverageM2}m² per roll) = ${wrapRolls}`,
      priceMatchKey: "building-wrap",
    });
  }

  // Flashings — corner flashings = perimeter; opening flashings = head
  // + jamb + sill per opening (approx 4m linear m per opening).
  if (includeFlashings) {
    const cornerFlashingM = buildingPerimeterM;
    const openingFlashingM = numberOfOpenings * 4;
    const flashingLinearM = round2(cornerFlashingM + openingFlashingM);
    materials.push({
      id: "flashings",
      name: "Aluminium flashings",
      category: "Flashings",
      quantity: flashingLinearM,
      unit: "m",
      formula: `perimeter=${cornerFlashingM}m + openings=${numberOfOpenings} × 4m = ${flashingLinearM}m`,
      priceMatchKey: "aluminium-flashing",
      notes: "Corner + head/jamb/sill flashings",
    });
  }

  // Cladding fixings — galvanised cladding nails, ~12 per m².
  const claddingNails = safeCeil(netCladdingAreaM2 * 12 * wasteMultiplier);
  materials.push({
    id: "cladding-nails",
    name: "Cladding nails (galvanised)",
    category: "Fixings",
    quantity: claddingNails,
    unit: "each",
    formula: `ceil(netAreaM2=${netCladdingAreaM2} × 12 × (1+${wastePercent}/100)) = ${claddingNails}`,
    priceMatchKey: "cladding-nails",
  });

  return {
    summary: {
      wallAreaM2,
      openingAreaM2,
      netWallAreaM2: netCladdingAreaM2,
      wastePercent,
    },
    materials,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Chunk 1 — Subfloor takeoff
//
// Structurally identical to a deck (piles + bearers + joists), but with
// a plywood/strandfloor flooring deck instead of spaced decking boards.
// Default joist centres are 450mm for residential per NZS 3604. Plywood
// is structural 17mm tongue-and-groove, 2.4m × 1.2m sheets.
// ─────────────────────────────────────────────────────────────────────────

export type SubfloorTakeoffInput = {
  floorLengthM: number;
  floorWidthM: number;
  joistSpacingMm?: number;
  bearerSpacingM?: number;
  pileSpacingM?: number;
  wastePercent?: number;
  timberStockLengthM?: number;
  plywoodSheetWidthM?: number;
  plywoodSheetHeightM?: number;
  includePiles?: boolean;
  includePlywoodFloor?: boolean;
};

export const SUBFLOOR_DEFAULTS = {
  joistSpacingMm: 450,
  bearerSpacingM: 1.8,
  pileSpacingM: 1.8,
  wastePercent: 10,
  timberStockLengthM: 4.8,
  plywoodSheetWidthM: 2.4,
  plywoodSheetHeightM: 1.2,
  includePiles: true,
  includePlywoodFloor: true,
};

export function calculateSubfloorTakeoff(
  input: SubfloorTakeoffInput,
): MaterialTakeoffResult {
  const floorLengthM = Number(input.floorLengthM);
  const floorWidthM = Number(input.floorWidthM);
  const joistSpacingMm =
    input.joistSpacingMm ?? SUBFLOOR_DEFAULTS.joistSpacingMm;
  const bearerSpacingM =
    input.bearerSpacingM ?? SUBFLOOR_DEFAULTS.bearerSpacingM;
  const pileSpacingM =
    input.pileSpacingM ?? SUBFLOOR_DEFAULTS.pileSpacingM;
  const wastePercent =
    input.wastePercent ?? SUBFLOOR_DEFAULTS.wastePercent;
  const timberStockLengthM =
    input.timberStockLengthM ?? SUBFLOOR_DEFAULTS.timberStockLengthM;
  const plywoodSheetWidthM =
    input.plywoodSheetWidthM ?? SUBFLOOR_DEFAULTS.plywoodSheetWidthM;
  const plywoodSheetHeightM =
    input.plywoodSheetHeightM ?? SUBFLOOR_DEFAULTS.plywoodSheetHeightM;
  const includePiles =
    input.includePiles ?? SUBFLOOR_DEFAULTS.includePiles;
  const includePlywoodFloor =
    input.includePlywoodFloor ?? SUBFLOOR_DEFAULTS.includePlywoodFloor;

  const warnings: string[] = [];
  if (!Number.isFinite(floorLengthM) || floorLengthM <= 0) {
    warnings.push("Floor length is missing or invalid.");
  }
  if (!Number.isFinite(floorWidthM) || floorWidthM <= 0) {
    warnings.push("Floor width is missing or invalid.");
  }
  if (![300, 400, 450, 600].includes(joistSpacingMm)) {
    warnings.push(
      `Unusual joist spacing ${joistSpacingMm}mm; NZ residential floors use 400 or 450mm.`,
    );
  }
  if (wastePercent < 0) warnings.push("Waste percent cannot be negative.");

  const floorAreaM2 = round2(floorLengthM * floorWidthM);
  const wasteMultiplier = 1 + wastePercent / 100;
  const materials: MaterialTakeoffLine[] = [];

  // Joists — same geometry as deck.
  const joistCount = safeCeil((floorLengthM * 1000) / joistSpacingMm) + 1;
  const joistLinearM = round2(joistCount * floorWidthM);
  const joistLengths = safeCeil(
    (joistLinearM * wasteMultiplier) / timberStockLengthM,
  );
  materials.push({
    id: "subfloor-joists",
    name: `Subfloor joists (${joistLengths} × ${timberStockLengthM}m stock)`,
    category: "Joists",
    quantity: joistLengths,
    unit: "lengths",
    formula: `ceil(joistCount=${joistCount} × widthM=${floorWidthM} × (1+${wastePercent}/100) / ${timberStockLengthM}m) = ${joistLengths}`,
    priceMatchKey: "subfloor-joists",
    notes: `200×50 H1.2 SG8, ${joistSpacingMm}mm centres`,
  });

  // Bearers.
  const bearerRows = safeCeil(floorWidthM / bearerSpacingM) + 1;
  const bearerLinearM = round2(bearerRows * floorLengthM);
  const bearerLengths = safeCeil(
    (bearerLinearM * wasteMultiplier) / timberStockLengthM,
  );
  materials.push({
    id: "subfloor-bearers",
    name: `Subfloor bearers (${bearerLengths} × ${timberStockLengthM}m stock)`,
    category: "Bearers",
    quantity: bearerLengths,
    unit: "lengths",
    formula: `ceil(bearerRows=${bearerRows} × lengthM=${floorLengthM} × (1+${wastePercent}/100) / ${timberStockLengthM}m) = ${bearerLengths}`,
    priceMatchKey: "subfloor-bearers",
    notes: `200×100 H4 SG8, ${bearerSpacingM}m spans`,
  });

  // Piles.
  if (includePiles) {
    const pilesPerRow = Math.floor(floorLengthM / pileSpacingM) + 1;
    const piles = bearerRows * pilesPerRow;
    materials.push({
      id: "subfloor-piles",
      name: "Concrete piles",
      category: "Piles",
      quantity: piles,
      unit: "each",
      formula: `bearerRows=${bearerRows} × pilesPerRow=${pilesPerRow} = ${piles}`,
      priceMatchKey: "concrete-piles",
    });
  }

  // Plywood floor sheets — 17mm structural T&G.
  if (includePlywoodFloor) {
    const sheetCoverageM2 = plywoodSheetWidthM * plywoodSheetHeightM;
    const plywoodSheets = safeCeil(
      (floorAreaM2 * wasteMultiplier) / sheetCoverageM2,
    );
    materials.push({
      id: "subfloor-plywood",
      name: "Structural plywood floor (17mm T&G)",
      category: "Flooring",
      quantity: plywoodSheets,
      unit: "sheets",
      formula: `ceil(floorAreaM2=${floorAreaM2} × (1+${wastePercent}/100) / (${plywoodSheetWidthM}×${plywoodSheetHeightM})) = ${plywoodSheets}`,
      priceMatchKey: "structural-plywood",
    });
  }

  // Joist hangers (ledger end only, same as deck).
  materials.push({
    id: "subfloor-joist-hangers",
    name: "Joist hangers",
    category: "Hardware",
    quantity: joistCount,
    unit: "each",
    formula: `joistCount=${joistCount} (one per joist at ledger end)`,
    priceMatchKey: "joist-hangers",
  });

  // Subfloor screws — typical 8 per m² for plywood fixing on joists.
  const screws = safeCeil(floorAreaM2 * 8 * wasteMultiplier);
  materials.push({
    id: "subfloor-screws",
    name: "Subfloor screws",
    category: "Fixings",
    quantity: screws,
    unit: "each",
    formula: `ceil(floorAreaM2=${floorAreaM2} × 8 × (1+${wastePercent}/100)) = ${screws}`,
    priceMatchKey: "subfloor-screws",
  });

  return {
    summary: {
      wallAreaM2: floorAreaM2,
      openingAreaM2: 0,
      netWallAreaM2: floorAreaM2,
      wastePercent,
    },
    materials,
    warnings,
  };
}
