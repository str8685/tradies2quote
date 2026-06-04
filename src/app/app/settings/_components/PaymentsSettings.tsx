"use client";

import { useState, useTransition } from "react";
import { CreditCard, CheckCircle } from "@phosphor-icons/react";
import { saveDepositPctAction } from "../payments-actions";

type Props = {
  status: {
    connected: boolean;
    chargesEnabled: boolean;
    detailsSubmitted: boolean;
    depositPct: number;
  };
};

export function PaymentsSettings({ status }: Props) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depositPct, setDepositPct] = useState<number>(status.depositPct);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  async function onConnect() {
    setError(null);
    setConnecting(true);
    try {
      const res = await fetch("/api/payments/connect", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError("Couldn't start Stripe setup. Please try again.");
        setConnecting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setConnecting(false);
    }
  }

  function onSaveDeposit() {
    setSaved(false);
    startTransition(async () => {
      const res = await saveDepositPctAction(depositPct);
      if (res.ok) setSaved(true);
      else setError(res.error ?? "Could not save.");
    });
  }

  return (
    <section className="t2q-card-pro mt-6 p-4 sm:p-5" aria-labelledby="payments-settings-title">
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-brand">
        {"// get paid faster"}
      </div>
      <h2
        id="payments-settings-title"
        className="mt-2 font-display text-lg uppercase tracking-tight text-white sm:text-xl"
      >
        Deposits &amp; payments.
      </h2>
      <p className="mt-2 text-sm text-ink-300">
        Let clients pay a deposit online the moment they accept a quote. Money lands
        straight in your bank via Stripe.
      </p>

      {status.chargesEnabled ? (
        <div className="mt-5 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-500">
            <CheckCircle size={16} weight="fill" /> Stripe connected — ready to take deposits
          </div>
          <label className="block max-w-[12rem]">
            <span className="mb-1 block text-xs font-medium text-ink-400">Deposit percentage</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={depositPct}
                onChange={(e) => setDepositPct(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-ink-400">% of the quote total</span>
            </div>
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSaveDeposit}
              disabled={pending}
              className="t2q-btn-primary-pro inline-flex items-center disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            {saved ? <span className="text-sm text-emerald-500">Saved.</span> : null}
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <button
            type="button"
            onClick={onConnect}
            disabled={connecting}
            className="t2q-btn-primary-pro inline-flex items-center gap-2 disabled:opacity-60"
          >
            <CreditCard size={18} weight="bold" />
            {connecting
              ? "Opening Stripe…"
              : status.connected
                ? "Finish Stripe setup"
                : "Connect Stripe"}
          </button>
          {status.connected && !status.chargesEnabled ? (
            <p className="mt-2 text-xs text-ink-400">
              Your Stripe account needs a few more details before you can take payments.
            </p>
          ) : null}
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
    </section>
  );
}
