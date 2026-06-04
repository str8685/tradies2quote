"use client";

import { useSyncExternalStore } from "react";

/**
 * Returns `false` during SSR and the first client (hydration) render, then
 * `true` once hydration commits on the client.
 *
 * Use it to defer inherently time-dependent / client-only UI — e.g. relative
 * "5m ago" timestamps that read `Date.now()` — so the server HTML and the first
 * client render are byte-identical, avoiding React hydration mismatches
 * (#418 / #425). Render a stable value while `false`, the live value once `true`.
 *
 * Implemented with `useSyncExternalStore` rather than `useEffect` + `setState`:
 * the server snapshot is `false`, the client snapshot is `true`. React renders
 * the server snapshot during hydration (so first paint matches the SSR HTML),
 * then re-renders with the client snapshot — identical behaviour to a mount
 * flag, but without calling `setState` inside an effect (which the project's
 * `react-hooks/set-state-in-effect` lint rule forbids).
 */
const subscribe = () => () => {};

export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
