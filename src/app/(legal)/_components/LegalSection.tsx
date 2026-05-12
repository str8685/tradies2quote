import type { ReactNode } from "react";

/**
 * Visual scaffolding for a single section inside a legal page. Keeps
 * spacing, heading style, and anchor IDs consistent across Privacy,
 * Terms, and Support so the pages read as a deliberate set.
 */
export function LegalSection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 py-10 border-t border-ink-700">
      <div className="flex items-baseline gap-4 mb-5">
        {number && (
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-brand">
            {number}
          </span>
        )}
        <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-tight text-white">
          {title}
        </h2>
      </div>
      <div className="space-y-4 text-ink-200 leading-relaxed text-[15px] sm:text-base [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-hivis [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:space-y-2 [&_ol]:pl-5 [&_ol]:list-decimal [&_strong]:text-white">
        {children}
      </div>
    </section>
  );
}
