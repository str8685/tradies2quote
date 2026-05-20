// ─────────────────────────────────────────────────────────────────────────
// Calculator dispatcher.
//
// Maps a ScopeType to its calculator function. The orchestrator imports
// this single entry point; individual calculators don't need to be
// imported elsewhere.
// ─────────────────────────────────────────────────────────────────────────

import type { ExtractedExtraction, ScopeResult, ScopeType } from "../schemas";
import { runCladdingCalculator } from "./cladding";
import { runConcreteCalculator } from "./concrete";
import { runDeckCalculator } from "./deck";
import { runFencingCalculator } from "./fencing";
import { runFixingCalculator } from "./fixing";
import { runFramingCalculator } from "./framing";
import { runGenericCalculator } from "./generic";
import { runInsulationCalculator } from "./insulation";
import { runLiningCalculator } from "./lining";
import { runRoofingCalculator } from "./roofing";

export const CALCULATORS: Record<
  ScopeType,
  (ext: ExtractedExtraction) => ScopeResult
> = {
  deck: runDeckCalculator,
  cladding: runCladdingCalculator,
  framing: runFramingCalculator,
  roofing: runRoofingCalculator,
  lining: runLiningCalculator,
  insulation: runInsulationCalculator,
  fencing: runFencingCalculator,
  concrete: runConcreteCalculator,
  fixing: runFixingCalculator,
  generic: runGenericCalculator,
};

export function runCalculator(
  scope: ScopeType,
  ext: ExtractedExtraction,
): ScopeResult {
  return CALCULATORS[scope](ext);
}

export {
  runCladdingCalculator,
  runConcreteCalculator,
  runDeckCalculator,
  runFencingCalculator,
  runFixingCalculator,
  runFramingCalculator,
  runGenericCalculator,
  runInsulationCalculator,
  runLiningCalculator,
  runRoofingCalculator,
};
