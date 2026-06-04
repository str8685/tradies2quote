"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    /** Defined by uptimewatch's track.js (afterInteractive). */
    uw?: (name: string) => void;
  }
}

/**
 * Fires a `uw('signup')` conversion event into uptimewatch exactly once, when a
 * fresh signup redirect lands with `?signup=1`. Mounted globally in the root
 * layout so it works for BOTH post-signup destinations (/app when email
 * confirmation is off, /login?message=check-inbox when it's on) without
 * touching either page. Strips the flag immediately so a refresh / back never
 * double-counts.
 */
export function SignupBeacon() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("signup") !== "1") return;

    // Remove the flag from the URL so it only ever fires once.
    params.delete("signup");
    const qs = params.toString();
    const cleaned =
      window.location.pathname +
      (qs ? `?${qs}` : "") +
      window.location.hash;
    window.history.replaceState(null, "", cleaned);

    // track.js (window.uw) loads afterInteractive and may not be ready the
    // instant this mounts — poll briefly for it (up to ~3s).
    let tries = 0;
    const fire = () => {
      if (typeof window.uw === "function") {
        window.uw("signup");
        return;
      }
      if (tries++ < 20) window.setTimeout(fire, 150);
    };
    fire();
  }, []);

  return null;
}
