/**
 * Four-step progress header for the quote wizard. Pure presentation —
 * server-component-friendly, no hooks.
 *
 *   01 · DESCRIBE   ▰▰▰▱▱▱▱▱   ← active or complete or upcoming
 *   02 · AI REVIEW  ▱▱▱▱▱▱▱▱
 *   03 · TAKEOFF    ▱▱▱▱▱▱▱▱
 *   04 · QUOTE      ▱▱▱▱▱▱▱▱
 *
 * Caller passes `current` (1-4); each step's bar is rendered with a
 * `data-state` attribute that the `t2q-step-bar` utility (in
 * `globals.css`) styles as `complete` / `active` / `upcoming`.
 */

const STEPS = [
  { n: "01", label: "Describe" },
  { n: "02", label: "T2Q Review" },
  { n: "03", label: "Takeoff" },
  { n: "04", label: "Quote" },
];

type Props = {
  /** 1-indexed step number that's currently active. */
  current: 1 | 2 | 3 | 4;
};

export function StepProgressHeader({ current }: Props) {
  return (
    <div data-testid="step-progress-header" className="w-full">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand mb-3">
        {`// step ${current} of 4`}
      </div>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STEPS.map((step, i) => {
          const idx = (i + 1) as 1 | 2 | 3 | 4;
          const state =
            idx < current ? "complete" : idx === current ? "active" : "upcoming";
          return (
            <li
              key={step.n}
              data-state={state}
              data-testid={`step-${step.n}`}
              className="space-y-2"
            >
              <div
                data-state={state}
                className="t2q-step-bar rounded-sm"
              />
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={[
                    "font-display text-base uppercase tracking-tight leading-none",
                    state === "complete"
                      ? "text-hivis"
                      : state === "active"
                        ? "text-white"
                        : "text-ink-500",
                  ].join(" ")}
                >
                  {step.n}
                </span>
                <span
                  className={[
                    "font-mono text-[10px] uppercase tracking-[0.25em] truncate",
                    state === "complete"
                      ? "text-hivis"
                      : state === "active"
                        ? "text-brand"
                        : "text-ink-500",
                  ].join(" ")}
                >
                  · {step.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
