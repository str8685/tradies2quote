import type { NextConfig } from "next";
import path from "node:path";

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

export default nextConfig;
