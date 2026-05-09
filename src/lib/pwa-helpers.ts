/**
 * PWA install helpers.
 *
 * These are intentionally split out from `InstallAppButton.tsx` so they can
 * be unit-tested in plain Node (vitest) without a jsdom environment. They
 * take their inputs as arguments rather than reaching for global `window`
 * or `navigator`, which keeps them deterministic in tests.
 */

/**
 * The `beforeinstallprompt` event fired by Chromium browsers when the page
 * meets PWA install criteria. The standard `Event` doesn't expose `prompt()`
 * or `userChoice`, so we type-narrow.
 *
 * Some browsers (Safari) never fire this event — see the iOS branch.
 */
export type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt: () => Promise<void>;
};

/**
 * True when the user-agent looks like iOS Safari (or any iOS WebView), where
 * `beforeinstallprompt` is never fired and the user must add to home screen
 * via the Share sheet.
 *
 * iPadOS 13+ defaults to a Mac user-agent string. We accept an optional
 * `maxTouchPoints` arg (browsers expose `navigator.maxTouchPoints`) so the
 * caller can disambiguate "real Mac" from "iPad pretending to be Mac" — a
 * Mac has 0 touch points; an iPad has > 1.
 *
 * @param userAgent - typically `navigator.userAgent`.
 * @param maxTouchPoints - typically `navigator.maxTouchPoints`. Optional;
 *   when omitted we don't try to detect iPadOS-as-Mac.
 */
export function isIOSUserAgent(
  userAgent: string,
  maxTouchPoints?: number,
): boolean {
  if (!userAgent) return false;

  // Direct iOS UA strings (iPhone, iPad on older iOS, iPod).
  if (/iPad|iPhone|iPod/i.test(userAgent)) return true;

  // iPadOS 13+ presents itself as Mac. The only reliable signal from the UA
  // alone is "Mac with multi-touch" — a real Mac never has touch points.
  if (
    typeof maxTouchPoints === "number" &&
    maxTouchPoints > 1 &&
    /Macintosh/i.test(userAgent)
  ) {
    return true;
  }

  return false;
}

/**
 * Minimal subset of `Window` we need for standalone detection. Tests pass
 * a fake conforming to this shape; the React component passes the real
 * `window` global (typed as `Window`).
 *
 * The `navigator.standalone` property is non-standard (iOS Safari only),
 * which is why we declare it explicitly here — the DOM `Navigator` interface
 * doesn't include it.
 */
export type StandaloneWindow = {
  matchMedia?: (query: string) => { matches: boolean };
  navigator?: {
    /** iOS Safari sets this on `navigator` when launched from the home screen. */
    standalone?: boolean;
  };
};

/**
 * True when the page is running as an installed PWA (no browser chrome).
 *
 *   - Modern browsers (Chrome, Edge, Firefox, Safari 16+ on macOS): the CSS
 *     `(display-mode: standalone)` media query matches.
 *   - iOS Safari (Home Screen): exposes `navigator.standalone === true`.
 *
 * Used to hide the install button once the app is installed.
 *
 * The parameter is typed `unknown` so callers can pass either a fake
 * `StandaloneWindow` (tests) or the real DOM `Window` (component). Both
 * work because we duck-type internally — the real `Navigator` happens not
 * to declare `standalone` in TypeScript's lib.dom types, but iOS injects
 * it at runtime.
 */
export function isStandalone(win: unknown): boolean {
  if (!win || typeof win !== "object") return false;

  const w = win as StandaloneWindow;

  try {
    if (
      typeof w.matchMedia === "function" &&
      w.matchMedia("(display-mode: standalone)").matches
    ) {
      return true;
    }
  } catch {
    // matchMedia not available or threw — fall through.
  }

  if (w.navigator?.standalone === true) return true;

  return false;
}
