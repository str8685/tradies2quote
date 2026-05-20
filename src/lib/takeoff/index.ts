// Public surface of the takeoff module.
//
// External callers (API routes, agents, UI) should import from here
// rather than reaching into individual files — keeps the boundary
// stable as internals change.

export { runTakeoff, runTakeoffWithExtraction } from "./orchestrator";
export { routeScope, isLegacyScope } from "./scope-router";
export { extractFromText, extractFromLLM } from "./extraction";
export { validateExtractionForScope } from "./validate";
export { buildClarifications } from "./clarify";
export { explainScope, explainLine } from "./explain";
export { runCalculator } from "./calculators";
export type {
  ClarificationQuestion,
  Confidence,
  ExtractedDimensions,
  ExtractedExtraction,
  ExtractedOpening,
  LineBasis,
  ScopeResult,
  ScopeType,
  TakeoffLine,
  TakeoffResult,
  TakeoffStatus,
} from "./schemas";
export { ALL_SCOPES, worstStatus, statusRank } from "./schemas";
