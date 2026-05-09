import type { MetadataRoute } from "next";

/**
 * Web App Manifest for tradies2Quote.
 *
 * Next 16 App Router serves this at `/manifest.webmanifest` automatically and
 * injects the `<link rel="manifest" />` into every page in the layout tree.
 *
 * Theme + background colours mirror the design tokens declared in
 * `src/app/globals.css`:
 *   - theme_color  = brand orange (#FF5F15)  — what the OS tints address bars,
 *                                              taskbars, and PWA chrome with
 *   - background_color = ink-950 (#0A0A0A)   — splash background on launch,
 *                                              prevents flash-of-white
 *
 * `start_url: "/app"` lands installed-app users directly on the dashboard.
 * If unauthenticated, the existing `/app` server-component redirects to
 * `/login` (defense-in-depth on top of `proxy.ts`).
 *
 * Icons reference `/icon.svg` at two declared sizes — the same file resolved
 * with different size hints, since SVG is resolution-independent. Browsers
 * pick whichever entry best fits a given install surface.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "tradies2Quote",
    short_name: "T2Q",
    description:
      "Voice-first AI quoting for tradies. Record, generate, send a branded quote in under 60 seconds.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#FF5F15",
    background_color: "#0A0A0A",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "192x192 512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
