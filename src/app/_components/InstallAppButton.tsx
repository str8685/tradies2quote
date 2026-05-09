"use client";

import { useCallback, useEffect, useState } from "react";
import { DownloadSimple, Share, X } from "@phosphor-icons/react";
import {
  isIOSUserAgent,
  isStandalone,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa-helpers";

/**
 * Install-app button for the dashboard header.
 *
 * Behaviour matrix (driven by the helpers in `pwa-helpers.ts`):
 *   - Already running standalone (installed PWA)        → render nothing.
 *   - Chromium browsers that fire `beforeinstallprompt` → show button; click
 *                                                          triggers the
 *                                                          native install
 *                                                          prompt.
 *   - iOS Safari (no beforeinstallprompt)               → show button; click
 *                                                          opens a 3-step
 *                                                          add-to-home-screen
 *                                                          modal.
 *   - Anything else (Firefox desktop, older Safari)     → render nothing.
 *
 * The button matches the existing dashboard header micro-typography
 * (font-mono / 0.2em tracking) so it doesn't clutter the bar; it's only
 * a few pixels wider than the "Sign out" link beside it.
 */
type EnvState = {
  /** True when this page is already running as an installed PWA. */
  installed: boolean;
  /** True when this is iOS Safari (must use Add-to-Home-Screen flow). */
  isIOS: boolean;
};

const INITIAL_ENV: EnvState = { installed: false, isIOS: false };

export function InstallAppButton() {
  const [env, setEnv] = useState<EnvState>(INITIAL_ENV);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // One-shot environment detection on mount. The values we read from
    // `window`/`navigator` are static for the page lifetime (UA never
    // mutates; standalone-mode is set once at launch). The standard
    // alternative — `useSyncExternalStore` — is overkill here; this single
    // setState is intentional and runs exactly once.
    //
    // The setState calls inside the event handlers below are NOT subject
    // to the same rule: they execute later, asynchronously, in response
    // to user-driven events.

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnv({
      installed: isStandalone(window),
      isIOS: isIOSUserAgent(
        navigator.userAgent,
        // navigator.maxTouchPoints disambiguates iPadOS 13+ (Mac UA + touch).
        typeof navigator.maxTouchPoints === "number"
          ? navigator.maxTouchPoints
          : undefined,
      ),
    });

    const onBeforeInstallPrompt = (event: Event) => {
      // Suppress the mini-infobar on Chromium so we control when the prompt
      // appears (otherwise the browser may auto-show it later).
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setEnv((prev) => ({ ...prev, installed: true }));
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const { installed, isIOS } = env;

  const handleClick = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        // Once consumed, a beforeinstallprompt event cannot be reused.
        if (outcome === "accepted") {
          setDeferredPrompt(null);
        }
      } catch {
        // If the browser rejects (e.g. multiple .prompt() calls), the user
        // can simply click again — fall through silently.
      }
      return;
    }

    if (isIOS) {
      setShowIOSModal(true);
    }
  }, [deferredPrompt, isIOS]);

  // Render nothing in three cases:
  //  1. The app is already installed.
  //  2. We're not on iOS AND no install prompt is available (e.g. desktop
  //     Firefox, older Safari).
  if (installed) return null;
  if (!deferredPrompt && !isIOS) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        data-testid="install-app-button"
        className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-ink-300 hover:text-white"
      >
        <DownloadSimple size={14} weight="bold" aria-hidden="true" />
        Install app
      </button>

      {showIOSModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-ios-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={() => setShowIOSModal(false)}
        >
          <div
            className="t2q-card w-full max-w-sm border border-ink-700 bg-ink-950 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="t2q-section-label">{"// install"}</p>
                <h2
                  id="install-ios-title"
                  className="mt-1 font-display text-lg uppercase tracking-tight"
                >
                  Add to home screen
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowIOSModal(false)}
                className="text-ink-400 hover:text-white"
              >
                <X size={20} weight="bold" />
              </button>
            </div>

            <p className="mb-4 text-sm text-ink-300">
              Add tradies2Quote to your home screen for faster access.
            </p>

            <ol className="space-y-2 text-sm text-ink-200">
              <li className="flex items-start gap-2">
                <span className="font-mono text-xs text-brand">1.</span>
                <span className="flex-1">
                  Tap the{" "}
                  <span className="inline-flex items-center gap-1 font-semibold">
                    Share <Share size={14} weight="bold" aria-hidden="true" />
                  </span>{" "}
                  icon in Safari&rsquo;s toolbar.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono text-xs text-brand">2.</span>
                <span className="flex-1">
                  Scroll and tap{" "}
                  <span className="font-semibold">Add to Home Screen</span>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono text-xs text-brand">3.</span>
                <span className="flex-1">
                  Tap <span className="font-semibold">Add</span> in the
                  top-right.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="t2q-btn-primary mt-5 w-full justify-center"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
