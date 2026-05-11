import type { ReactNode } from "react";
import { Eye, EyeClosed } from "@phosphor-icons/react/dist/ssr";

/**
 * Native `<details>` accordion used to compact the quote preview page.
 *
 * Wave 13.1 — the preview was a long flat list of 6+ stacked panels
 * (transcript, compliance, readiness, three Wave 12 agents, plus the
 * editor). Most of those are reference / review tools the owner only
 * needs occasionally. This wrapper hides them behind a tappable
 * "// title" header so the editor and lifecycle card own the
 * above-the-fold real estate.
 *
 * - Uses native `<details>` — works on iOS Safari, no client JS.
 * - The `id` flows through to the `<details>` element so the
 *   LifecycleCard's "Suggested agent → Open" button can both scroll
 *   into view AND programmatically open the section via
 *   `details.open = true`.
 * - The caret rotates 180° when the section is open via the
 *   `group-open:` Tailwind variant.
 */
interface Props {
  /** DOM id so the lifecycle agent shortcut can target it. */
  id?: string;
  /** Short mono-style title (rendered as `// title`). */
  title: string;
  /** Open by default. Use sparingly — defeats the compaction purpose. */
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  id,
  title,
  defaultOpen = false,
  children,
}: Props) {
  return (
    <details
      id={id}
      open={defaultOpen}
      data-testid={id ? `collapsible-${id}` : undefined}
      className="group mb-3 rounded-sm border border-brand/30 bg-ink-900/40 open:border-brand/60 open:bg-ink-900/70 transition-colors"
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-ink-900/80"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-brand">
          {`// ${title}`}
        </span>
        {/* Wave 14.4 — Eye icon instead of caret. Closed = open eye
            ("tap to look inside"); open = squinted eye ("you're
            looking"). The brand-tinted ring + Eye icon makes the
            review tools read as a peek-affordance, not just a
            disclosure widget. */}
        <span aria-hidden="true" className="inline-flex">
          <Eye
            size={18}
            weight="fill"
            className="block text-brand transition-opacity group-open:hidden"
          />
          <EyeClosed
            size={18}
            weight="fill"
            className="hidden text-brand transition-opacity group-open:block"
          />
        </span>
      </summary>
      <div className="border-t border-brand/30 p-3 sm:p-4">{children}</div>
    </details>
  );
}
