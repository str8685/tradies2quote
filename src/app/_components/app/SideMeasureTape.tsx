/**
 * Decorative yellow vertical measuring tape rail.
 *
 * Sits in its own grid column on the far left of the dashboard shell.
 * Block-positioned (NOT `position: fixed`) so it can't be clipped by an
 * overflow ancestor and can never overlap the sidebar. Hidden on mobile.
 *
 * Painting comes from the `t2q-mm-tape-vertical` utility in
 * `globals.css`, which paints major / minor / cm ticks via a tiny
 * repeated SVG.
 */
export function SideMeasureTape() {
  return (
    <div
      data-testid="side-measure-tape"
      aria-hidden="true"
      className="hidden lg:block w-full h-full t2q-mm-tape-vertical border-r-2 border-ink-900"
    />
  );
}
