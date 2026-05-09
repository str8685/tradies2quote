/**
 * NZ Building Compliance Knowledge Layer — public re-exports.
 *
 * The route handler imports from here; per-rule modules are
 * implementation details.
 */

export {
  complianceReviewEnabledFromEnv,
  NZ_COMPLIANCE_FLAG_NAME,
} from "./feature-flag";
export { reviewQuote } from "./pipeline";
export { safelyReviewQuote, type SafeReviewOptions } from "./safe-wrapper";
export {
  KNOWLEDGE_SOURCES,
  findSource,
  citationsAreValid,
} from "./sources";
export type {
  Citation,
  ChunkConfidence,
  ClarificationQuestion,
  ComplianceLineItem,
  ComplianceLineItemMeta,
  ComplianceReview,
  ComplianceSourceType,
  ComplianceStatus,
  ComplianceWarning,
  JobContext,
  KnowledgeSource,
  KnowledgeSourceType,
  Severity,
  WallCladding,
  WallContext,
  WallLining,
  WallType,
} from "./types";
