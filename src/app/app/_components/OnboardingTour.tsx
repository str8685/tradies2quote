"use client";

import { useEffect } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

/**
 * First-run onboarding tour — Driver.js rewrite.
 *
 * Replaces the previous slide-deck modal with a real coachmark tour
 * that highlights actual elements on the live app surface. The driver
 * overlay dims the page and spotlights one element at a time; the
 * popover carries the title + description + Next/Back/Skip buttons.
 *
 * Anchors map to data-testid attributes already in the app (see
 * src/app/app/page.tsx, AppHeaderClient, MobileBottomNavClient). For
 * features that live on other routes (Materials, account settings),
 * we anchor to the always-visible nav tabs — bottom nav on mobile,
 * header tabs on desktop — so the tour can run from any /app/* page
 * even though it's intended to fire on the dashboard.
 *
 * Gating is unchanged: `OnboardingTourGate.tsx` reads
 * `localStorage["t2q-tour-done"]` and only dynamic-imports this chunk
 * for users who haven't completed the tour. After completion or skip
 * we write the same key so the tour never re-runs.
 */

const STORAGE_KEY = "t2q-tour-done";

/** Brand overrides for Driver.js's default white popover. Injected
 *  once per page-load when the tour mounts so the popover picks up the
 *  ink + brand-orange palette instead of the library's vanilla white.
 *  Scoped to `.t2q-tour` via popoverClass so it never leaks to any
 *  other Driver.js instance someone might add later. */
const POPOVER_CSS = `
.driver-popover.t2q-tour {
  background-color: #0A0A0A;
  color: #F5F5F5;
  border: 1px solid #2A2A2A;
  border-radius: 6px;
  padding: 18px 18px 16px;
  max-width: 320px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.driver-popover.t2q-tour .driver-popover-title {
  font-family: 'Archivo Black', system-ui, sans-serif;
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: -0.01em;
  color: #FFFFFF;
  margin-bottom: 8px;
}
.driver-popover.t2q-tour .driver-popover-description {
  font-size: 13.5px;
  line-height: 1.55;
  color: #D4D4D4;
}
.driver-popover.t2q-tour .driver-popover-progress-text {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #FF5F15;
}
.driver-popover.t2q-tour .driver-popover-footer {
  margin-top: 16px;
}
.driver-popover.t2q-tour .driver-popover-footer button {
  font-family: 'Archivo Black', system-ui, sans-serif;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  padding: 8px 14px;
  border-radius: 3px;
  border: 1px solid #2A2A2A;
  background: #1A1A1A;
  color: #F5F5F5;
  text-shadow: none;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}
.driver-popover.t2q-tour .driver-popover-footer button:hover {
  background: #2A2A2A;
  border-color: #FF5F15;
  color: #FF5F15;
}
.driver-popover.t2q-tour .driver-popover-next-btn {
  background: #FF5F15 !important;
  color: #111111 !important;
  border-color: #FF5F15 !important;
}
.driver-popover.t2q-tour .driver-popover-next-btn:hover {
  background: #E04F0A !important;
  border-color: #E04F0A !important;
  color: #111111 !important;
}
.driver-popover.t2q-tour .driver-popover-close-btn {
  color: #737373;
  font-size: 22px;
  width: 36px;
  height: 32px;
}
.driver-popover.t2q-tour .driver-popover-close-btn:hover,
.driver-popover.t2q-tour .driver-popover-close-btn:focus {
  color: #FF5F15;
}
.driver-popover.t2q-tour .driver-popover-arrow {
  border-color: #0A0A0A;
}
.driver-popover.t2q-tour .driver-popover-arrow-side-top { border-bottom-color: transparent; border-left-color: transparent; border-right-color: transparent; }
.driver-popover.t2q-tour .driver-popover-arrow-side-bottom { border-top-color: transparent; border-left-color: transparent; border-right-color: transparent; }
.driver-popover.t2q-tour .driver-popover-arrow-side-left { border-right-color: transparent; border-top-color: transparent; border-bottom-color: transparent; }
.driver-popover.t2q-tour .driver-popover-arrow-side-right { border-left-color: transparent; border-top-color: transparent; border-bottom-color: transparent; }
`;

const STYLE_TAG_ID = "t2q-tour-overrides";

function ensureStyleTag() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_TAG_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_TAG_ID;
  style.textContent = POPOVER_CSS;
  document.head.appendChild(style);
}

/** All possible tour steps. Steps whose anchors don't exist on the
 *  current page are filtered out at runtime before driving the tour,
 *  so the user never sees a missing-anchor flash.
 *
 *  Earlier revisions also pointed at the bottom-nav tabs (Quotes,
 *  Materials, Me), but the 320px popover couldn't fit above a 50px
 *  bottom-nav button on a 390px iPhone and Driver.js fell back to
 *  parking the tooltip in the top-left, pointing at nothing. Those
 *  steps were dropped — the bottom nav is self-evident enough that
 *  losing the coachmarks is the right trade for a tour that actually
 *  works on every viewport. */
const ALL_STEPS: ReadonlyArray<DriveStep> = [
  {
    // Welcome step — no element, popover renders centered.
    popover: {
      title: "Welcome to T2Q",
      description:
        "Talk through a job for 60 seconds and get a branded quote PDF — before you've packed up the ute. Quick tour: 4 stops.",
      showButtons: ["next", "close"],
      nextBtnText: "Start tour →",
    },
  },
  {
    element: '[data-testid="dashboard-stats"]',
    popover: {
      title: "Your pipeline",
      description:
        "Every quote you create lives here, grouped by stage: Draft → Sent → Viewed → Accepted → Scheduled → In progress → Completed. Tap any stage tile to filter.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-testid="dashboard-new-quote"]',
    popover: {
      title: "Start a quote",
      description:
        "Hit New quote to open the recorder. Talk through the job — client, site, what's being done, rough materials. T2Q handles pricing, labour and markup.",
      side: "top",
      align: "end",
    },
  },
  {
    // Final wrap-up step — no element, popover renders centered.
    popover: {
      title: "You're set",
      description:
        "To open T2Q without the browser bar, add it to your home screen: tap the Share icon in Safari → Add to Home Screen. Full manual: Me → Settings → User guide.",
      showButtons: ["previous", "close"],
      doneBtnText: "Get started",
    },
  },
];

function markDone() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // localStorage unavailable — re-showing the tour on next visit is
    // fine if storage fails.
  }
}

export function OnboardingTour() {
  useEffect(() => {
    ensureStyleTag();

    // 300ms delay so the dashboard's tape-measure splash has time to
    // clear and the anchored elements have settled into their final
    // positions before Driver.js measures them.
    const t = setTimeout(() => {
      try {
        // Filter steps to only those whose element exists in the DOM
        // right now. Welcome + final steps have no element and always
        // run.
        const steps = ALL_STEPS.filter((step) => {
          if (typeof step.element !== "string") return true;
          return document.querySelector(step.element) !== null;
        });

        // If only the welcome + done steps survived, there's nothing
        // useful to highlight — skip the tour and mark it done so we
        // don't keep retrying.
        if (steps.length <= 2) {
          markDone();
          return;
        }

        const driverObj = driver({
          showProgress: true,
          progressText: "Step {{current}} of {{total}}",
          allowClose: true,
          overlayOpacity: 0.7,
          stagePadding: 6,
          stageRadius: 6,
          popoverClass: "t2q-tour",
          nextBtnText: "Next →",
          prevBtnText: "← Back",
          doneBtnText: "Done",
          steps,
          onDestroyed: () => {
            markDone();
          },
        });
        driverObj.drive();
      } catch {
        // If Driver.js throws (e.g. DOM removed mid-drive), don't
        // crash the app — just mark the tour done so the user isn't
        // stuck with a broken state on reload.
        markDone();
      }
    }, 300);

    return () => {
      clearTimeout(t);
    };
  }, []);

  // The tour renders into document.body via Driver.js. This component
  // itself produces no DOM — it just kicks off the driver.
  return null;
}
