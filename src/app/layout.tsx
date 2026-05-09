import type { Metadata, Viewport } from "next";
import { Archivo_Black, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

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
    default: "tradies2Quote — Voice in. Quote out. Under 60 seconds.",
    template: "%s · tradies2Quote",
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
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    // Tells iOS this site can run as a standalone home-screen app.
    capable: true,
    // Short title shown under the icon on iOS.
    title: "T2Q",
    // "black" puts an opaque black status bar above the app — visually
    // continuous with the bg-ink-950 dashboard header, no safe-area
    // padding required. Picking "black-translucent" would push content
    // behind the notch and would need a layout-level top inset.
    statusBarStyle: "black",
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
  themeColor: "#0A0A0A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivoblack.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-ink-900 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
