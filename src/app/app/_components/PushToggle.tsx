"use client";

import { useEffect, useState } from "react";
import {
  BellSimple,
  BellSimpleSlash,
  CircleNotch,
} from "@phosphor-icons/react";

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BMh1wyMbQoDS3zhC02ejkeknqX3v6wtZiN7ewUsaBjggVnPqHdDNKarEkcsQrvuPZI3tPFNQ-AvIWFfsfqfePLI";

/** Convert a base64url VAPID key into the Uint8Array the Push API wants. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State =
  | "checking"
  | "unsupported"
  | "off"
  | "enabling"
  | "on"
  | "denied"
  | "error";

/**
 * Enable/disable Web Push for quote events. On iOS this only works once
 * the app is installed to the Home Screen (PushManager is absent in a
 * plain Safari tab) — we surface that as the "unsupported" hint.
 */
export function PushToggle() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!cancelled) setState(sub ? "on" : "off");
      } catch {
        if (!cancelled) setState("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setState("enabling");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          VAPID_PUBLIC_KEY,
        ) as BufferSource,
      });
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error(`subscribe ${res.status}`);
      setState("on");
    } catch (e) {
      console.error("enable push failed", e);
      setState("error");
    }
  }

  async function disable() {
    setState("enabling");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch (e) {
      console.error("disable push failed", e);
      setState("error");
    }
  }

  if (state === "checking") return null;

  const isUnsupported = state === "unsupported";
  const isDenied = state === "denied";
  const isOn = state === "on";
  const busy = state === "enabling";

  const subtitle = isUnsupported
    ? "Add this app to your Home Screen, then reopen it to switch on push."
    : isDenied
      ? "Notifications are blocked — allow them in your phone/browser settings, then come back."
      : isOn
        ? "On — you'll get a push when a client accepts your quote."
        : state === "error"
          ? "Something went wrong. Tap to try again."
          : "Get a push the moment a client accepts your quote.";

  return (
    <div
      data-testid="push-toggle"
      className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">Quote notifications</p>
        <p className="mt-0.5 text-xs text-ink-300">{subtitle}</p>
      </div>
      {!isUnsupported && !isDenied && (
        <button
          type="button"
          onClick={isOn ? disable : enable}
          disabled={busy}
          data-testid="push-toggle-button"
          className={
            isOn
              ? "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink-600 px-3.5 py-2 text-xs font-semibold text-ink-200 hover:border-brand hover:text-brand disabled:opacity-60"
              : "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-xs font-semibold text-ink-900 hover:bg-brand-400 disabled:opacity-60"
          }
        >
          {busy ? (
            <CircleNotch size={14} weight="bold" className="animate-spin" />
          ) : isOn ? (
            <BellSimpleSlash size={14} weight="bold" />
          ) : (
            <BellSimple size={14} weight="bold" />
          )}
          {busy ? "Working…" : isOn ? "Turn off" : "Turn on"}
        </button>
      )}
    </div>
  );
}
