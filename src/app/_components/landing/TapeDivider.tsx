interface TapeDividerProps {
  /** Optional centre band label, rendered as a // status-line. */
  label?: string;
  /** Strip height in px (top + bottom). Defaults to 18. */
  height?: number;
}

/**
 * Section divider — animated horizontal tape-measure strips top + bottom,
 * with an optional centre band for a status-line label. Replaces the older
 * static yellow/black caution-stripe divider.
 *
 * Uses the `t2q-tape-strip` utility from globals.css (pure CSS gradients +
 * GPU-animated background-position). Bottom strip runs reversed so the
 * two layers move past each other for a more mechanical feel.
 *
 * Ported from the Emergent landing-export bundle to TSX.
 */
export default function TapeDivider({ label, height = 18 }: TapeDividerProps) {
  return (
    <div
      className="relative overflow-hidden"
      aria-hidden="true"
      data-testid="tape-divider"
    >
      <div
        className="t2q-tape-strip border-y-2 border-ink-900"
        style={{ height: `${height}px` }}
      />
      {label && (
        <div className="bg-ink-900 border-y-2 border-ink-700 py-3">
          <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-ink-300 gap-4">
            <span className="text-brand truncate">{`// ${label}`}</span>
            <span className="hidden sm:inline whitespace-nowrap">
              site safe · in service · 24/7
            </span>
          </div>
        </div>
      )}
      <div
        className="t2q-tape-strip t2q-tape-strip-reverse border-y-2 border-ink-900"
        style={{ height: `${height}px` }}
      />
    </div>
  );
}
