/**
 * Feature flag for the NZ Building Compliance Knowledge Layer.
 *
 * Default OFF. Must be explicitly turned on in Vercel production with
 * `NZ_COMPLIANCE_REVIEW_ENABLED=true` once the engine is ready for
 * customer-facing rollout.
 *
 * Mirrors the materialMatchingPipeline's `materialMatchingEnabledFromEnv`.
 */

export const NZ_COMPLIANCE_FLAG_NAME = "NZ_COMPLIANCE_REVIEW_ENABLED" as const;

export function complianceReviewEnabledFromEnv(): boolean {
  return process.env[NZ_COMPLIANCE_FLAG_NAME] === "true";
}
