"use client";

import { useState } from "react";
import { CreditCard } from "@phosphor-icons/react/dist/ssr";

/**
 * "Manage billing" → POSTs to /api/stripe/portal, gets back a Stripe-
 * hosted Customer Portal URL, redirects the tab there. Stripe handles
 * card updates, cancellations, invoices.
 */
export function ManageBillingButton() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function open() {
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        message?: string;
      };
      if (!res.ok || !data.ok || !data.url) {
        setErrorMsg(data.message ?? "Could not open the billing portal.");
        setState("error");
        return;
      }
      window.location.href = data.url;
    } catch {
      setErrorMsg("Network error. Try again.");
      setState("error");
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="settings-manage-billing"
        onClick={open}
        disabled={state === "loading"}
        className="t2q-btn-ghost-pro inline-flex h-11 items-center gap-2 px-5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <CreditCard size={16} weight="bold" />
        {state === "loading" ? "Opening Stripe…" : "Manage billing"}
      </button>
      {state === "error" && (
        <p
          data-testid="settings-billing-error"
          role="alert"
          className="mt-2 text-xs text-red-300"
        >
          {errorMsg}
        </p>
      )}
    </>
  );
}
