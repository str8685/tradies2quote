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
 * src/app/app/page.tsx, AppHeaderClient, MobileAppMenuClient). For
 * features that live on other routes (Materials, account settings),
 * we anchor to the always-visible navigation controls — mobile menu
 * trigger on phones, header tabs on desktop — so the tour can run from
 * any /app/* page even though it's intended to fire on the dashboard.
 *
 * Gating is unchanged: `OnboardingTourGate.tsx` reads
 * `localStorage["t2q-tour-done"]` and only dynamic-imports this chunk
 * for users who haven't completed the tour. After completion or skip
 * we write the same key so the tour never re-runs.
 */

const STORAGE_KEY = "t2q-tour-done";

/** Professional app-shell overrides for Driver.js's default popover.
 *  Scoped to `.t2q-tour` via popoverClass so it never leaks to any
 *  other Driver.js instance someone might add later. */
const POPOVER_CSS = `
.driver-popover.t2q-tour {
  background-color: #FFFFFF;
  color: #17212B;
  border: 1px solid #DDE3EA;
  border-radius: 12px;
  padding: 18px 18px 16px;
  max-width: 340px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
}
@media (max-width: 480px) {
  .driver-popover.t2q-tour {
    max-width: calc(100vw - 32px);
  }
}
.driver-popover.t2q-tour .driver-popover-title {
  font-family: var(--font-plus-jakarta), 'Inter', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #17212B;
  margin-bottom: 8px;
}
.driver-popover.t2q-tour .driver-popover-description {
  font-size: 13.5px;
  line-height: 1.55;
  color: #4B5563;
}
.driver-popover.t2q-tour .driver-popover-progress-text {
  font-family: var(--font-plus-jakarta), 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #FF5F15;
}
.driver-popover.t2q-tour .driver-popover-footer {
  margin-top: 16px;
}
.driver-popover.t2q-tour .driver-popover-footer button {
  font-family: var(--font-plus-jakarta), 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 700;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #DDE3EA;
  background: #FFFFFF;
  color: #17212B;
  text-shadow: none;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}
.driver-popover.t2q-tour .driver-popover-footer button:hover {
  background: #F8FAFC;
  border-color: #FFB68A;
  color: #E04F0A;
}
.driver-popover.t2q-tour .driver-popover-next-btn {
  background: #FF5F15 !important;
  color: #FFFFFF !important;
  border-color: #FF5F15 !important;
}
.driver-popover.t2q-tour .driver-popover-next-btn:hover {
  background: #E04F0A !important;
  border-color: #E04F0A !important;
  color: #FFFFFF !important;
}
.driver-popover.t2q-tour .driver-popover-close-btn {
  color: #94A3B8;
  font-size: 22px;
  width: 36px;
  height: 32px;
}
.driver-popover.t2q-tour .driver-popover-close-btn:hover,
.driver-popover.t2q-tour .driver-popover-close-btn:focus {
  color: #FF5F15;
}
.driver-popover.t2q-tour .driver-popover-arrow {
  border-color: #FFFFFF;
}
.driver-popover.t2q-tour .driver-popover-arrow-side-top { border-bottom-color: transparent; border-left-color: transparent; border-right-color: transparent; }
.driver-popover.t2q-tour .driver-popover-arrow-side-bottom { border-top-color: transparent; border-left-color: transparent; border-right-color: transparent; }
.driver-popover.t2q-tour .driver-popover-arrow-side-left { border-right-color: transparent; border-top-color: transparent; border-bottom-color: transparent; }
.driver-popover.t2q-tour .driver-popover-arrow-side-right { border-left-color: transparent; border-top-color: transparent; border-bottom-color: transparent; }
.driver-overlay {
  background: rgba(15, 23, 42, 0.42) !important;
}
.driver-active-element {
  border-radius: 12px !important;
  box-shadow: 0 0 0 3px rgba(255, 95, 21, 0.28) !important;
}
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
 *  Desktop and mobile often keep both nav surfaces in the DOM, with
 *  one hidden. `kickOff` resolves each selector to the first visible
 *  element before Driver.js sees it, so every surviving step points at
 *  something the customer can actually see and tap. */
const ALL_STEPS: ReadonlyArray<DriveStep> = [
  {
    // Welcome step — no element, popover renders centered.
    popover: {
      title: "Welcome to Tradies2Quote",
      description:
        "This quick tour shows the main work areas: creating quotes, tracking the pipeline, scheduling jobs, finding materials, and opening settings.",
      showButtons: ["next", "close"],
      nextBtnText: "Start tour",
    },
  },
  {
    element: '[data-testid="beta-review-notice"]',
    popover: {
      title: "Review beta guidance",
      description:
        "During beta, treat generated scopes, quantities, and prices as drafts. This notice links to the checklist to review before sending a quote.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-testid="dashboard-actions"]',
    popover: {
      title: "Top actions",
      description:
        "Use these buttons to open your quote list or start a new quote. The orange action is the main next step on each screen.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element:
      '[data-testid="dashboard-new-quote"], [data-tour="new-quote"], [data-testid="dashboard-empty-cta"]',
    popover: {
      title: "Create a quote",
      description:
        "Open New quote to record, type, or scan the job details. This is where the quote workflow begins.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-testid="dashboard-kpi-strip"]',
    popover: {
      title: "Headline numbers",
      description:
        "These cards summarise current quoting activity: this month, replies waiting, accepted work, and drafts needing attention.",
      side: "bottom",
      align: "center",
    },
  },
  {
    // Anchor resolved at runtime to the smallest inner element present.
    // Pointing at the whole pipeline card was ~400px tall on iPhone,
    // which left no room for the popover and Driver.js parked it
    // off-target. The inner grid (or empty-state hint) is much shorter
    // and lets the popover sit cleanly below it.
    element: '[data-testid="dashboard-stage-tiles"]',
    popover: {
      title: "Quote pipeline",
      description:
        "Quotes move through stages from draft to completed. Tap a stage tile to open the quote list filtered to that stage.",
      side: "bottom",
      align: "center",
    },
  },
  {
    // Empty-pipeline fallback for the same step — only one of these
    // two will exist in the DOM, so only one survives the filter at
    // drive time. The fallback covers fresh accounts that haven't
    // created their first quote yet.
    element: '[data-testid="dashboard-pipeline-empty"]',
    popover: {
      title: "Quote pipeline",
      description:
        "Your quotes will appear here grouped by stage once you create the first one.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-testid="dashboard-calendar"]',
    popover: {
      title: "Schedule",
      description:
        "Scheduled jobs and personal day notes live here. Select a date to see what is booked and add reminders.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-testid="quotes-list-client"], [data-testid="dashboard-empty"]',
    popover: {
      title: "Recent quotes",
      description:
        "Your latest quote drafts and sent quotes show here. Open one to review, edit, send, or create a PDF.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-testid="app-header-tabs"], [data-testid="app-mobile-menu-trigger"]',
    popover: {
      title: "Main navigation",
      description:
        "Use the menu to move between Home, New quote, Quotes, Invoices, Materials, Clients, and Settings. Active sections use your orange brand accent.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element:
      '[data-testid="app-header-tab-materials"], [data-testid="app-mobile-menu-trigger"]',
    popover: {
      title: "Materials library",
      description:
        "Materials is where your commonly used items and prices live. Open the menu, then choose Materials to keep your prices updated.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="account-menu"]',
    popover: {
      title: "Account and settings",
      description:
        "Open this menu for business details, quote defaults, invoice defaults, clients, the full guide, and sign out.",
      side: "left",
      align: "start",
    },
  },
  {
    // Final wrap-up step — no element, popover renders centered.
    popover: {
      title: "You're ready",
      description:
        "Start with New quote, then review drafts before sending. You can replay this guided tour or open the full manual from Settings.",
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

interface OnboardingTourProps {
  onFinished?: () => void;
}

export function OnboardingTour({ onFinished }: OnboardingTourProps) {
  useEffect(() => {
    ensureStyleTag();

    let finished = false;
    const finishTour = () => {
      if (finished) return;
      finished = true;
      markDone();
      onFinished?.();
    };

    // Cancellation flag — set by the cleanup function below. Replaces
    // the previous single setTimeout / clearTimeout pattern because we
    // now schedule several timers in sequence (poll loop + settle
    // delay + driver kick-off) and they all need to bail if the
    // component unmounts mid-wait.
    let cancelled = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const schedule = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (!cancelled) fn();
      }, ms);
      timers.add(t);
    };

    /**
     * Wait until the LoadingScreen (data-testid="loading-screen") is
     * gone from the DOM before firing. Previously this was a fixed
     * 300ms delay, which fires inside the 5s tape-measure splash on
     * first /app entry — Driver.js highlights elements behind the
     * splash that the user can't see. Polling the DOM covers both
     * cases:
     *   - First visit: splash plays ~5s → polls until it unmounts → fire
     *   - Returning visit (splash skipped via sessionStorage): element
     *     never appears → polls fall through immediately → fire after
     *     the settle delay
     * Hard ceiling of 10s so a bug in the splash can't permanently
     * block the tour.
     */
    const POLL_INTERVAL_MS = 200;
    const MAX_WAIT_MS = 10_000;
    const SETTLE_AFTER_SPLASH_MS = 350;
    const startedAt = Date.now();

    const waitForSplash = () => {
      if (cancelled) return;
      const splash = document.querySelector(
        '[data-testid="loading-screen"], [data-testid="app-splash"]',
      );
      const elapsed = Date.now() - startedAt;
      if (!splash || elapsed > MAX_WAIT_MS) {
        schedule(kickOff, SETTLE_AFTER_SPLASH_MS);
        return;
      }
      schedule(waitForSplash, POLL_INTERVAL_MS);
    };

    const kickOff = () => {
      try {
        // Resolve each step to the element the user can ACTUALLY SEE.
        //
        // The nav steps use comma selectors that list the desktop header
        // element first (e.g. app-header-tabs, app-header-tab-materials).
        // On mobile those nodes still exist in the DOM but are
        // display:none — and Driver.js's querySelector would grab that
        // first, hidden, zero-size node, parking the popover at the top of
        // the screen pointing at nothing (the "stuck at the top" bug on
        // steps 9–12). We pick the first VISIBLE match instead, and pass
        // the resolved HTMLElement straight to Driver.js.
        const firstVisible = (selector: string): HTMLElement | null => {
          const nodes = Array.from(
            document.querySelectorAll<HTMLElement>(selector),
          );
          for (const el of nodes) {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            if (
              r.width > 1 &&
              r.height > 1 &&
              cs.visibility !== "hidden" &&
              cs.display !== "none"
            ) {
              return el;
            }
          }
          return null;
        };

        const vh =
          window.innerHeight || document.documentElement.clientHeight || 0;

        const steps: DriveStep[] = [];
        for (const step of ALL_STEPS) {
          // Welcome + final steps have no element and always run centred.
          if (typeof step.element !== "string") {
            steps.push(step);
            continue;
          }
          const el = firstVisible(step.element);
          if (!el) continue; // no visible anchor right now — skip it
          // Auto-correct the popover side for elements pinned to a screen
          // edge so the bubble never lands off-screen.
          const rect = el.getBoundingClientRect();
          let side = step.popover?.side;
          if (vh > 0 && rect.top > vh * 0.6) side = "top";
          else if (vh > 0 && rect.bottom < vh * 0.25) side = "bottom";
          steps.push({
            ...step,
            element: el,
            popover: step.popover
              ? { ...step.popover, side }
              : step.popover,
          });
        }

        // If only the welcome + done steps survived, there's nothing
        // useful to highlight — skip the tour and mark it done so we
        // don't keep retrying.
        if (steps.length <= 2) {
          finishTour();
          return;
        }

        const driverObj = driver({
          showProgress: true,
          progressText: "Step {{current}} of {{total}}",
          allowClose: true,
          overlayOpacity: 0.42,
          stagePadding: 8,
          stageRadius: 12,
          popoverClass: "t2q-tour",
          nextBtnText: "Next",
          prevBtnText: "Back",
          doneBtnText: "Done",
          // Scroll the highlighted element into view before positioning
          // the popover. Without this, an anchor that's even partially
          // offscreen on iPhone gets a popover parked at the screen edge
          // and the spotlight border looks disconnected from the bubble.
          smoothScroll: true,
          steps,
          onDestroyed: () => {
            finishTour();
          },
        });
        driverObj.drive();
      } catch {
        // If Driver.js throws (e.g. DOM removed mid-drive), don't
        // crash the app — just mark the tour done so the user isn't
        // stuck with a broken state on reload.
        finishTour();
      }
    };

    waitForSplash();

    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, [onFinished]);

  // The tour renders into document.body via Driver.js. This component
  // itself produces no DOM — it just kicks off the driver.
  return null;
}
