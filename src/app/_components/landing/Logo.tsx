/**
 * Brand mark — Wave 19.8 T2Q wordmark logo.
 *
 * Replaces the original "Site-Safe Badge" (caution-tape ring + ²Q
 * monogram + soundwave bars) with the founder's new logo: T + 2 + Q
 * in heavy display type, the 2 in brand orange, the T and Q in
 * currentColor so they inherit white on the dark theme and ink on
 * light. The old SVG paths are dropped — no caution-tape pattern, no
 * soundwave, no pulsing record dot. The new design reads cleaner at
 * small sizes (header, footer) and matches the new brand asset.
 *
 * Aspect is ~1.85:1 (wide). The `size` prop controls HEIGHT; width
 * scales via the viewBox.
 *
 * The font reference is the same chain the rest of the site uses for
 * SVG text — Archivo Black is loaded globally in layout.tsx via
 * next/font/google, so by the time any page renders the font is
 * available.
 *
 * The legacy export name `LogoMark` is preserved so existing imports
 * keep working without churn.
 */
type LogoMarkProps = {
  size?: number;
  className?: string;
  title?: string;
};

export function LogoMark({
  size = 36,
  className = "",
  title = "Tradies2Quote",
}: LogoMarkProps) {
  const height = size;
  const width = Math.round(size * 1.85);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 64"
      role="img"
      aria-label={title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        fontFamily="'Archivo Black','Archivo',system-ui,sans-serif"
        fontSize="64"
        fontWeight="900"
        y="54"
        letterSpacing="-3"
      >
        <tspan x="0" fill="currentColor">T</tspan>
        <tspan dx="-2" fill="#FF5F15">2</tspan>
        <tspan dx="-3" fill="currentColor">Q</tspan>
      </text>
    </svg>
  );
}

// Alias so future imports can be explicit about the new design intent.
export { LogoMark as T2QLogoMark };

type LogoProps = {
  size?: number;
  withWordmark?: boolean;
  /**
   * Optional Tailwind classes applied to the wordmark span. Use to
   * hide the wordmark on small viewports while keeping the mark
   * visible — e.g. `wordmarkClassName="hidden md:inline"` shows just
   * T2Q on mobile and T2Q + TRADIES2QUOTE on tablet/desktop.
   */
  wordmarkClassName?: string;
  className?: string;
};

/**
 * Composite brand lockup — T2Q mark + "TRADIES2QUOTE" wordmark in caps.
 *
 * Wave 19.8 — wordmark switched from `tradies²Quote` (mixed case + the
 * `²` superscript) to `TRADIES2QUOTE` all-caps with the `2` in brand
 * orange. This matches the brutalist display-type aesthetic of the
 * landing (Archivo Black + uppercase) and echoes the orange `2` in
 * the new T2Q logo mark for visual cohesion.
 *
 * Wave 19.9 — added `wordmarkClassName` so the Header can hide the
 * wordmark on mobile (T2Q only fits cleaner against a hamburger menu)
 * while desktop still shows the full lockup.
 */
export function Logo({
  size = 36,
  withWordmark = true,
  wordmarkClassName = "",
  className = "",
}: LogoProps) {
  return (
    <span
      data-testid="brand-logo"
      className={`inline-flex items-center gap-3 ${className}`}
    >
      <LogoMark size={size} />
      {withWordmark && (
        <span
          className={`font-display uppercase tracking-tight leading-none whitespace-nowrap ${wordmarkClassName}`}
        >
          TRADIES<span className="text-brand">2</span>QUOTE
        </span>
      )}
    </span>
  );
}
