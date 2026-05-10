"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Archive, ArrowCounterClockwise, DotsThreeVertical, Trash } from "@phosphor-icons/react";
import {
  archiveQuote,
  unarchiveQuote,
  softDeleteQuote,
} from "../quotes/actions";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * Per-row "⋯" menu on the dashboard / quote-list cards.
 *
 * Renders a popover with Archive, Restore, Delete (whichever apply based
 * on the row's current archived/active state) and routes through
 * `<ConfirmDialog>` before any destructive action. The actual mutation
 * is handled by the server actions in `src/app/app/quotes/actions.ts`
 * which already verify `auth.getUser()` and scope by `user_id`.
 */
interface Props {
  quoteId: string;
  isArchived: boolean;
}

export function QuoteRowActions({ quoteId, isArchived }: Props) {
  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    null | "archive" | "unarchive" | "delete"
  >(null);
  const [busy, startTransition] = useTransition();
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close the popover on outside click. The confirm dialog uses native
  // `<dialog>` modality so we don't need to share state with it here.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function runConfirmedAction() {
    const action = pendingAction;
    if (!action) return;
    startTransition(async () => {
      const result =
        action === "archive"
          ? await archiveQuote(quoteId)
          : action === "unarchive"
            ? await unarchiveQuote(quoteId)
            : await softDeleteQuote(quoteId);
      if ("error" in result) {
        console.error(`${action} quote failed:`, result.error);
        // We surface failures via the (already-open) dialog title swap
        // below; the dialog stays open so the user can retry.
        alert(result.error);
        return;
      }
      setPendingAction(null);
      setOpen(false);
    });
  }

  // Per-action dialog copy.
  const dialogProps =
    pendingAction === "archive"
      ? {
          title: "Archive this quote?",
          description:
            "Archived quotes stay in your library but disappear from the active list. You can restore them any time.",
          confirmLabel: "Archive",
          confirmTone: "primary" as const,
        }
      : pendingAction === "unarchive"
        ? {
            title: "Restore this quote?",
            description: "It will move back into your active quotes.",
            confirmLabel: "Restore",
            confirmTone: "primary" as const,
          }
        : {
            title: "Delete this quote?",
            description:
              "The quote disappears from your library. Anyone who already received the public quote link can still view it. This action can't be undone from the app.",
            confirmLabel: "Delete",
            confirmTone: "destructive" as const,
          };

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          // Prevent the underlying <Link> in the row from firing.
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Quote actions"
        data-testid={`quote-actions-toggle-${quoteId}`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-transparent text-ink-400 transition-colors hover:border-ink-600 hover:bg-ink-800 hover:text-white"
      >
        <DotsThreeVertical size={18} weight="bold" />
      </button>

      {open ? (
        <div
          role="menu"
          data-testid={`quote-actions-menu-${quoteId}`}
          className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-sm border border-ink-600 bg-ink-900 shadow-lg"
        >
          {isArchived ? (
            <MenuItem
              icon={<ArrowCounterClockwise size={14} weight="bold" />}
              label="Restore"
              testId={`quote-action-restore-${quoteId}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPendingAction("unarchive");
              }}
            />
          ) : (
            <MenuItem
              icon={<Archive size={14} weight="bold" />}
              label="Archive"
              testId={`quote-action-archive-${quoteId}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPendingAction("archive");
              }}
            />
          )}
          <div className="border-t border-ink-700" />
          <MenuItem
            icon={<Trash size={14} weight="bold" />}
            label="Delete"
            tone="destructive"
            testId={`quote-action-delete-${quoteId}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPendingAction("delete");
            }}
          />
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingAction !== null}
        title={dialogProps.title}
        description={dialogProps.description}
        confirmLabel={dialogProps.confirmLabel}
        confirmTone={dialogProps.confirmTone}
        busy={busy}
        onConfirm={runConfirmedAction}
        onCancel={() => {
          if (!busy) setPendingAction(null);
        }}
      />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  tone = "default",
  testId,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "default" | "destructive";
  testId?: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      data-testid={testId}
      className={
        tone === "destructive"
          ? "flex w-full items-center gap-2 px-3 py-2 text-left text-xs uppercase tracking-[0.2em] text-red-300 transition-colors hover:bg-red-500/15 hover:text-red-200"
          : "flex w-full items-center gap-2 px-3 py-2 text-left text-xs uppercase tracking-[0.2em] text-ink-200 transition-colors hover:bg-ink-800 hover:text-white"
      }
    >
      <span className="inline-flex h-4 w-4 items-center justify-center">{icon}</span>
      <span className="font-mono">{label}</span>
    </button>
  );
}
