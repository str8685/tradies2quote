"use client";

import type { ClarificationQuestion } from "@/lib/compliance";
import {
  answersAreComplete,
  type ClarificationAnswers,
} from "@/lib/compliance/panel-helpers";

/**
 * Inline clarification form. Pure presentation — owns no state of its
 * own. The CompliancePanel above lifts state so it can refresh when the
 * server returns an updated review.
 *
 * UX:
 *   - Each question rendered as a labelled radio group (when options
 *     exist) or a numeric/text input (currently only studSpacingMm uses
 *     numeric — the other questions have predefined options).
 *   - "Why does this matter?" is shown beneath each question so tradies
 *     understand what's being asked.
 *   - Submit is disabled until every question has an answer.
 */

type Props = {
  questions: ClarificationQuestion[];
  answers: ClarificationAnswers;
  onChange: (a: ClarificationAnswers) => void;
  onSubmit: () => void | Promise<void>;
  submitting: boolean;
  submitError: string | null;
};

export function ClarificationForm({
  questions,
  answers,
  onChange,
  onSubmit,
  submitting,
  submitError,
}: Props) {
  const allAnswered = answersAreComplete(questions, answers);

  return (
    <form
      data-testid="clarification-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!submitting) void onSubmit();
      }}
      className="space-y-4 rounded-sm border border-ink-700 bg-ink-900/60 p-3"
    >
      <p className="t2q-section-label">{"// answer to finalise materials"}</p>
      <ol className="space-y-4">
        {questions.map((q, idx) => {
          const value = answers[q.id] ?? "";
          return (
            <li key={q.id} data-testid={`clarification-q-${q.id}`}>
              <label className="block text-sm">
                <span className="block font-semibold text-white">
                  {idx + 1}. {q.question}
                </span>
                <span className="mt-0.5 block text-xs text-ink-400">{q.why}</span>
              </label>

              {q.options ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {q.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      data-testid={`clarification-opt-${q.id}-${opt.value}`}
                      onClick={() => onChange({ ...answers, [q.id]: opt.value })}
                      className={
                        value === opt.value
                          ? "rounded-sm border border-brand bg-brand/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-brand"
                          : "rounded-sm border border-ink-700 bg-ink-800 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-ink-300 hover:border-ink-500 hover:text-white"
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => onChange({ ...answers, [q.id]: e.target.value })}
                  className="mt-2 w-full rounded-sm border border-ink-700 bg-ink-900 px-2 py-1 text-sm text-white placeholder-ink-500"
                  placeholder="Type answer"
                />
              )}
            </li>
          );
        })}
      </ol>

      {submitError && (
        <p className="rounded-sm border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
          {submitError}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          {allAnswered
            ? "// ready"
            : `// ${questions.filter((q) => !answers[q.id]).length} unanswered`}
        </p>
        <button
          type="submit"
          data-testid="clarification-submit"
          disabled={!allAnswered || submitting}
          className="t2q-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save answers"}
        </button>
      </div>
    </form>
  );
}
