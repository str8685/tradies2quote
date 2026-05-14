/**
 * Brand mark — Wave 19.11 — the founder's actual T2Q artwork.
 *
 * History:
 *   - Wave 19.2 swapped every `public/*.png` icon asset to the
 *     founder's uploaded T2Q logo.
 *   - Wave 19.8 then refactored the landing Header, Footer, and
 *     splash to a new SVG `<LogoMark>` that re-drew "T2Q" as plain
 *     Archivo Black <text> — a typographic *approximation*, not the
 *     real custom letterforms. That regressed the brand: the landing
 *     stopped showing the actual logo.
 *   - Wave 19.11 (this) points `<LogoMark>` back at the real PNG
 *     (`/logo-horizontal.png`) so every surface that uses `<Logo>` /
 *     `<LogoMark>` — landing Header, Footer, and the splash screen —
 *     shows the founder's actual artwork again.
 *
 * The PNG has dark letterforms on a transparent background, so the
 * mark sits inside a small white pill to stay legible on the dark
 * site + dark splash. The `?v=20` query busts any copy a browser
 * cached before the wave-19.2 asset swap.
 *
 * `size` controls both width and height — the asset is square. The
 * legacy export name `LogoMark` is preserved so existing imports
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
  return (
    <span
      data-testid="logo-mark"
      className={`inline-flex shrink-0 items-center justify-center rounded-md bg-white p-1 ${className}`}
      style={{ height: size, width: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-horizontal.png?v=20"
        alt={title}
        width={200}
        height={200}
        className="block h-full w-full object-contain"
      />
    </span>
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
