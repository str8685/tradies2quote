import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Archivo_Black, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeBoot } from "./_components/ThemeBoot";
import { FloatingInstallButton } from "./_components/FloatingInstallButton";

const archivoblack = Archivo_Black({
  variable: "--font-archivo-black",
  weight: "400",
  subsets: ["latin"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Tradies2Quote — Voice in. Quote out. Under 60 seconds.",
    template: "Tradies2Quote | %s",
  },
  description:
    "Voice-first AI quoting app for tradies. Record a 60-second voice memo on the job, get a professional, branded quote PDF emailed to your client before you've left the driveway. Built for builders, plumbers, electricians, sparkies, painters and every tradie who hates writing quotes.",
  applicationName: "tradies2Quote",
  keywords: [
    "quoting app for tradies",
    "voice quote app",
    "AI quote generator",
    "Tradify alternative",
    "Fergus alternative",
    "quote software for builders",
    "quote app for plumbers",
    "quote app for electricians",
  ],
  authors: [{ name: "tradies2Quote" }],
  creator: "tradies2Quote",
  publisher: "tradies2Quote",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "tradies2Quote",
    title: "tradies2Quote — Voice in. Quote out. Under 60 seconds.",
    description:
      "Turn a 60-second voice memo into a professional, branded quote PDF — emailed to your client before you've left the driveway.",
    url: "/",
    locale: "en_NZ",
  },
  twitter: {
    card: "summary_large_image",
    title: "tradies2Quote — Voice in. Quote out. Under 60 seconds.",
    description:
      "Voice-first AI quoting for tradies. NZ, AU, UK, US, CA.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "business",
  // PWA — `app/manifest.ts` is auto-served at `/manifest.webmanifest` and the
  // <link rel="manifest"> is auto-injected by Next 16; we just declare icon
  // links and iOS-specific meta tags here.
  //
  // Wave 10.3 — point all icon paths at the new T2Q mark PNGs generated
  // from `public/logo-mark.png`. The legacy Emergent SVG files are kept
  // on disk for safety but no longer referenced from metadata.
  // Wave 10.4 — `?v=20` cache-bust forces desktop browsers (which
  // cache favicons hard, often forever) to refetch the icon files after
  // the Wave 10.3 mark swap. Drop the query on the next favicon change.
  icons: {
    icon: [
      { url: "/favicon.ico?v=20", sizes: "any" },
      { url: "/favicon-16x16.png?v=20", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png?v=20", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png?v=20", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png?v=20", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png?v=20",
        type: "image/png",
        sizes: "180x180",
      },
    ],
    shortcut: [{ url: "/favicon.ico?v=20" }],
  },
  appleWebApp: {
    // Tells iOS this site can run as a standalone home-screen app.
    capable: true,
    // Short title shown under the icon on iOS.
    title: "T2Q",
    // Wave 14.1 — flipped to `black-translucent` so the iOS PWA renders
    // edge-to-edge: page content fills the area under the notch /
    // dynamic island, making the screen feel taller. Headers (landing
    // + /app) carry their own `pt-[env(safe-area-inset-top)]` so the
    // logo / tabs sit below the notch and never get clipped.
    statusBarStyle: "black-translucent",
  },
  other: {
    // Newer cross-platform equivalent of apple-mobile-web-app-capable.
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Wave 14.1 — `cover` lets the browser render the page under the
  // iPhone notch / Android camera cutout. Combined with each
  // top-of-page header's `pt-[env(safe-area-inset-top)]`, the page
  // feels taller without clipping the logo or tabs.
  viewportFit: "cover",
  themeColor: "#0A0A0A",
};

/**
 * Pre-hydration theme script.
 *
 * Runs synchronously, before React hydrates, before the first paint.
 * Reads `localStorage["t2q-theme"]` + `(prefers-color-scheme: dark)` and
 * writes the resolved value to `<html data-theme="…">`, which the
 * `[data-theme="light"]` CSS overrides in `globals.css` respond to.
 *
 * Without this, the server emits `<html>` with no `data-theme`, so the
 * first paint is always the dark default; the `<ThemeToggle />` then runs
 * its mount effect and flips the value, producing a single-frame flash.
 *
 * Wrapped in try/catch so a strict CSP / private-mode localStorage block
 * never throws — `<ThemeBoot />` then re-applies on mount as a backstop.
 */
const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem("t2q-theme");if(m!=="light"&&m!=="dark"&&m!=="auto"){m="auto";}var e=m==="auto"?(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m;document.documentElement.dataset.theme=e;}catch(_){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // Wave 18.1 — perf — the pre-hydration `THEME_INIT_SCRIPT` below
      // intentionally writes `data-theme="..."` to <html> before React
      // hydrates, so React's hydration check always flagged a mismatch
      // here in dev. Suppress only on the <html> element so other
      // mismatches still surface.
      suppressHydrationWarning
      className={`${archivoblack.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full`}
    >
      <head>
        <Script
          id="t2q-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-ink-900 text-white antialiased">
        <ThemeBoot />
        {children}
        {/* Wave 12.3 — floating Install-App CTA. Renders nothing when
            the app is already installed or the browser can't install,
            so safe to mount globally. */}
        <FloatingInstallButton />
      </body>
    </html>
  );
}
