/**
 * Clarification engine (rule category E).
 *
 * Given a job context, decides which questions the user must answer
 * before the engine can confidently sign off on materials. The 9 wall
 * questions in the build prompt map directly to the 9 fields on
 * `WallContext` — when a field is missing AND the description names a
 * wall, the engine emits the question.
 *
 * Returns clarifications only — no item enrichments or warnings (those
 * come from the per-category rules).
 */

import { descriptionMentionsWall, knownWallFields } from "./classifier";
import { extractTreatmentClass } from "./treatment-rules";
import type { ClarificationQuestion, JobContext, RuleOutput } from "./types";

/** All canonical wall-context questions, keyed by `WallContext` field. */
function buildWallQuestions(context: JobContext): ClarificationQuestion[] {
  const k = knownWallFields(context.wall);
  const out: ClarificationQuestion[] = [];

  // 1. internal vs external — gates almost every downstream rule.
  if (!k.hasType) {
    out.push({
      id: "wall.type",
      question: "Is this wall internal or external?",
      why: "Internal walls don't need insulation by default; external walls do (per H1) and may need treated framing (H3.1/H3.2 per NZS 3602).",
      options: [
        { value: "internal", label: "Internal" },
        { value: "external", label: "External" },
      ],
    });
  }

  // 2. loadbearing.
  if (!k.hasLoadbearing) {
    out.push({
      id: "wall.isLoadbearing",
      question: "Is this wall loadbearing?",
      why: "Loadbearing walls have NZS 3604 stud/lintel/plate sizing requirements. A non-loadbearing partition is materially cheaper.",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    });
  }

  // 3. bracing.
  if (!k.hasBracing) {
    out.push({
      id: "wall.isBracing",
      question: "Is this wall a bracing wall?",
      why: "Bracing walls require GIB Braceline or equivalent and specific fixing schedules — different to standard linings.",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    });
  }

  // 4. wet area.
  if (!k.hasWetArea) {
    out.push({
      id: "wall.isWetArea",
      question: "Is the wall in a wet area (bathroom, laundry, kitchen splashback)?",
      why: "Wet areas require GIB Aqualine (or equivalent) — standard GIB is not rated for wet areas.",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    });
  }

  // 5. thermal envelope.
  if (!k.hasThermalEnvelope) {
    out.push({
      id: "wall.isThermalEnvelope",
      question: "Is this wall part of the building's thermal envelope?",
      why: "Walls that form the thermal envelope of a heated space must be insulated to meet the H1 R-value for the climate zone.",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    });
  }

  // 6. cladding (only meaningful for external).
  if (!k.hasCladding && context.wall?.type !== "internal") {
    out.push({
      id: "wall.cladding",
      question: "What cladding is used?",
      why: "Cladding system drives E2 cavity decisions and the durability requirement for the framing.",
      options: [
        { value: "weatherboard", label: "Weatherboard" },
        { value: "fibre_cement", label: "Fibre cement (Linea, Stria)" },
        { value: "brick_veneer", label: "Brick veneer" },
        { value: "metal", label: "Metal cladding" },
        { value: "plaster", label: "Plaster" },
        { value: "other", label: "Other" },
      ],
    });
  }

  // 7. lining (only meaningful for internal).
  if (!k.hasLining && context.wall?.type !== "external") {
    out.push({
      id: "wall.lining",
      question: "What lining is used?",
      why: "Standard / Aqualine / Braceline / Noiseline have different fixing schedules and different prices.",
      options: [
        { value: "gib_standard", label: "GIB Standard" },
        { value: "gib_aqualine", label: "GIB Aqualine (wet area)" },
        { value: "gib_braceline", label: "GIB Braceline (bracing)" },
        { value: "gib_noiseline", label: "GIB Noiseline (acoustic)" },
        { value: "other", label: "Other" },
      ],
    });
  }

  // 8. treatment class (only meaningful for timber-bearing wall jobs).
  const jobMentionsTimber = !!extractTreatmentClass(context.description);
  if (!jobMentionsTimber && context.wall?.type !== "internal") {
    out.push({
      id: "wall.treatmentClass",
      question: "What treatment class is required for the timber?",
      why: "NZS 3602 fixes the H-class by exposure: H1.2 protected interior, H3.1 partial exterior, H3.2 fully exposed, H4 in-ground, H5 piles. They are NOT interchangeable.",
      options: [
        { value: "H1.2", label: "H1.2 — protected interior" },
        { value: "H3.1", label: "H3.1 — partial exterior" },
        { value: "H3.2", label: "H3.2 — fully exposed" },
        { value: "H4", label: "H4 — in-ground" },
        { value: "H5", label: "H5 — piles / freshwater" },
      ],
    });
  }

  // 9. stud spacing.
  if (!k.hasStudSpacing) {
    out.push({
      id: "wall.studSpacingMm",
      question: "What is the stud spacing (mm)?",
      why: "NZS 3604 framing tables key off stud centres (typically 400 or 600). Affects stud count and lintel sizing.",
      options: [
        { value: "400", label: "400 mm" },
        { value: "600", label: "600 mm" },
      ],
    });
  }

  // 10. acoustic / fire requirements.
  if (!k.hasAcousticOrFire) {
    out.push({
      id: "wall.acousticOrFireRequired",
      question: "Are there acoustic or fire-rating requirements?",
      why: "Acoustic and fire systems specify proprietary lining + insulation + fixings — different to a standard wall.",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    });
  }

  return out;
}

/** Run the clarification engine. Returns a RuleOutput with clarifications. */
export function runClarificationRules(context: JobContext): RuleOutput {
  if (!descriptionMentionsWall(context.description)) {
    return {
      ruleName: "clarification-rules",
      itemUpdates: {},
      warnings: [],
      clarifications: [],
    };
  }

  return {
    ruleName: "clarification-rules",
    itemUpdates: {},
    warnings: [],
    clarifications: buildWallQuestions(context),
  };
}
