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
