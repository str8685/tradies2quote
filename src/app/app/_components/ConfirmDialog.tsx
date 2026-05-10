"use client";

import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";

/**
 * Small accessible confirmation dialog used before destructive quote
 * actions (archive, soft-delete). Wraps the platform `<dialog>` element
 * so we inherit modal focus-trapping + Escape-to-close for free.
 *
 * Confirm runs the parent's async handler. Caller is responsible for
 * showing its own loading state if it wants one — we simply close the
 * modal on success and re-throw on error so the caller can render an
 * inline toast.
 */
interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmTone?: "primary" | "destructive";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  confirmTone = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  // Drive the platform `<dialog>` open state from the prop.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  // Map a native dialog close (Escape, backdrop click) back to onCancel.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const handler = () => {
      if (!busy) onCancel();
    };
    dlg.addEventListener("close", handler);
    return () => dlg.removeEventListener("close", handler);
  }, [onCancel, busy]);

  return (
    <dialog
      ref={dialogRef}
      data-testid="confirm-dialog"
      className="m-auto w-[min(420px,calc(100vw-2rem))] rounded-sm border border-ink-700 bg-ink-900 p-0 text-white backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      onClick={(e) => {
        // Click on the backdrop closes the dialog. Click inside the form
        // doesn't bubble up because we stop propagation on the inner div.
        if (e.target === dialogRef.current && !busy) onCancel();
      }}
    >
      <div onClick={(e) => e.stopPropagation()} className="t2q-premium-card-static p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg uppercase tracking-tight text-white">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Cancel"
            className="rounded-sm p-1 text-ink-400 hover:text-white disabled:opacity-40"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
        <p className="mt-2 text-sm text-ink-300">{description}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            data-testid="confirm-cancel"
            className="t2q-btn-ghost inline-flex h-10 items-center justify-center px-4 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            data-testid="confirm-accept"
            className={
              confirmTone === "destructive"
                ? "inline-flex h-10 items-center justify-center rounded-sm border border-red-500/60 bg-red-500/15 px-4 font-display text-sm uppercase tracking-tight text-red-200 transition-colors hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                : "t2q-btn-primary inline-flex h-10 items-center justify-center px-4 disabled:cursor-not-allowed disabled:opacity-50"
            }
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
