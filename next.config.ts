import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
  // Wave 17 — perf — tell SWC to per-icon tree-shake these packages.
  // Without this hint, importing 3 icons from `@phosphor-icons/react`
  // can pull the entire icon manifest into the client bundle. Hitting
  // every /app page because the mobile bottom nav, account hub, and
  // onboarding tour all use Phosphor client-side. Same idea for
  // framer-motion (only used on splash + auth panel) and lucide-react.
  // Verified against Next 16 release notes — supported under Turbopack.
  experimental: {
    optimizePackageImports: [
      "@phosphor-icons/react",
      "framer-motion",
      "lucide-react",
    ],
  },
};

// Wire Sentry into the build: enables the build plugin (release tagging +
// source-map upload so production stacks are readable) and the client-side
// instrumentation. All side effects are env-gated and SAFE WHEN ENV IS ABSENT:
//   - No `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` → source-map
//     upload is skipped with a warning; the build still succeeds.
//   - No `NEXT_PUBLIC_SENTRY_DSN` → `Sentry.init` is a no-op at runtime, so no
//     events are sent and behaviour is unchanged.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Quiet build logs unless something is actually wrong.
  silent: !process.env.CI,
  // Upload a wider set of client source maps for readable stack traces.
  widenClientFileUpload: true,
});
