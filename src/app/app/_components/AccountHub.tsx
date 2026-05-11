"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Pulse,
  Briefcase,
  Bug,
  Camera,
  GearSix,
  Receipt,
  Robot,
  SignOut,
  Trash,
  UserCircle,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import {
  removeAvatarAction,
  uploadAvatarAction,
  type AvatarActionResult,
} from "./account-hub-actions";

/**
 * Shared body of the account hub.
 *
 * One source of truth, two presentations:
 *   - On mobile, `<MobileBottomNavClient>` mounts this inside a
 *     slide-up sheet (rendered with `mode="sheet"`).
 *   - On desktop, `<AppHeaderClient>` mounts this inside a dropdown
 *     panel anchored to the avatar trigger (`mode="panel"`).
 *
 * Why these item groups (per spec):
 *   - Profile / Business / Quote defaults / Invoice defaults all live
 *     on the existing /app/settings route — clicking each scrolls /
 *     anchors to the relevant section (see SettingsForm anchors).
 *     Putting them in the hub gives the user mental separation
 *     without us having to fragment the settings page.
 *   - Clients link goes to the existing /app/clients route.
 *   - Avatar photo: the upload UI is wired (see <AvatarUploadField>)
 *     but disabled-with-explainer until the `profiles.avatar_url`
 *     migration ships. Initials fallback is the current state.
 *   - Owner-only group renders only when `isOwner === true`. Items
 *     are: Agents (/app/agents), Debug (/app/debug), Monitor (the
 *     external 685agents dashboard).
 *
 * Hard rules preserved:
 *   - `/app/agents` and `/app/debug` server pages still gate by
 *     `isOwnerEmail()` — these links are merely conveniences.
 *   - Non-owner tradies never see those links.
 *   - This component is a client component but does NOT import the
 *     server-only agent-monitor logger.
 */
export interface AccountHubProps {
  isOwner: boolean;
  userEmail: string | null;
  avatarUrl: string | null;
  /** "sheet" = full-width mobile slide-up. "panel" = compact desktop
   *  dropdown card. The two share every item; only the chrome
   *  differs. */
  mode: "sheet" | "panel";
  /** Called when the hub wants to close (X button, link click, outside
   *  click). The parent owns open/closed state. */
  onClose: () => void;
}

interface HubLink {
  href: string;
  label: string;
  caption: string;
  Icon: React.ComponentType<{ size?: number; weight?: "bold" | "regular" | "fill"; className?: string }>;
  /** Optional hash so we can jump straight to a settings section. */
  hash?: string;
  /** Owner-only items are filtered out for non-owners. */
  ownerOnly?: boolean;
}

const PRIMARY_ITEMS: ReadonlyArray<HubLink> = [
  {
    href: "/app/settings",
    hash: "profile",
    label: "Profile",
    caption: "Name, email, phone",
    Icon: UserCircle,
  },
  {
    href: "/app/settings",
    hash: "business",
    label: "Business settings",
    caption: "Trading name, address, GST",
    Icon: Briefcase,
  },
  {
    href: "/app/settings",
    hash: "defaults",
    label: "Quote defaults",
    caption: "Labour, markup, currency",
    Icon: GearSix,
  },
  {
    href: "/app/settings",
    hash: "invoice-defaults",
    label: "Invoice defaults",
    caption: "Due date, terms",
    Icon: Receipt,
  },
  {
    href: "/app/clients",
    label: "Clients",
    caption: "Saved contacts",
    Icon: UsersThree,
  },
];

/* Owner-only shortcuts (Wave 13 + Wave 15). These are visually grouped
   in their own section so non-owners never see a half-empty list. */
const OWNER_ITEMS: ReadonlyArray<HubLink> = [
  {
    href: "/app/agents",
    label: "Agents",
    caption: "Wave 12 agent panel",
    Icon: Robot,
    ownerOnly: true,
  },
  {
    href: "/app/debug",
    label: "Debug",
    caption: "Owner-only diagnostics",
    Icon: Bug,
    ownerOnly: true,
  },
  {
    href: "https://685agents.vercel.app/monitor/flow",
    label: "Monitor dashboard",
    caption: "External agent telemetry",
    Icon: Pulse,
    ownerOnly: true,
  },
];

export function AccountHub({
  isOwner,
  userEmail,
  avatarUrl,
  mode,
  onClose,
}: AccountHubProps) {
  const initial =
    (userEmail ?? "?").trim().charAt(0).toUpperCase() || "?";
  const items = PRIMARY_ITEMS;
  const ownerItems = isOwner ? OWNER_ITEMS : [];

  return (
    <div
      role="dialog"
      aria-labelledby="account-hub-heading"
      data-testid="account-hub"
      data-mode={mode}
      data-is-owner={isOwner ? "true" : "false"}
      className={
        // Sheet: full-width, sticks to bottom; rounded only on top.
        // Panel: fixed width ~320px, rounded all around, lives in the
        // desktop header dropdown wrapper.
        mode === "sheet"
          ? "w-full rounded-t-2xl border-t border-ink-700 bg-ink-950 p-5 pb-[calc(env(safe-area-inset-bottom,0)+1.25rem)]"
          : "w-[20rem] rounded-md border border-ink-700 bg-ink-950 p-4 shadow-2xl"
      }
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AccountAvatar
            avatarUrl={avatarUrl}
            initial={initial}
            size={mode === "sheet" ? 40 : 36}
          />
          <div className="min-w-0">
            <p
              id="account-hub-heading"
              className="font-display text-sm uppercase tracking-tight text-white"
            >
              Account
            </p>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
              {userEmail ?? "—"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close account hub"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-ink-700 text-ink-300 hover:border-brand hover:text-brand"
        >
          <X size={14} weight="bold" />
        </button>
      </header>

      {/* Avatar photo section. Disabled-with-explainer until the
          `profiles.avatar_url` migration lands; see plan notes. */}
      <AvatarUploadField avatarUrl={avatarUrl} initial={initial} />

      <p className="mt-4 mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-400">
        {"// account"}
      </p>
      <ul className="space-y-2">
        {items.map((it) => (
          <HubLinkRow key={`${it.href}${it.hash ?? ""}`} item={it} onClose={onClose} />
        ))}
      </ul>

      {ownerItems.length > 0 ? (
        <>
          <p
            data-testid="account-hub-owner-section"
            className="mt-5 mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-brand"
          >
            {"// owner only"}
          </p>
          <ul className="space-y-2">
            {ownerItems.map((it) => (
              <HubLinkRow
                key={`${it.href}${it.hash ?? ""}`}
                item={it}
                onClose={onClose}
              />
            ))}
          </ul>
        </>
      ) : null}

      <form action="/auth/signout" method="POST" className="mt-5">
        <button
          type="submit"
          data-testid="account-hub-sign-out"
          className="flex w-full items-center gap-3 rounded-sm border border-red-500/40 bg-red-500/5 px-4 py-3 text-left hover:border-red-500/70 hover:bg-red-500/10"
        >
          <SignOut
            size={16}
            weight="bold"
            className="text-red-300"
            aria-hidden="true"
          />
          <span className="font-display text-sm uppercase tracking-tight text-red-200">
            Sign out
          </span>
        </button>
      </form>
    </div>
  );
}

function HubLinkRow({
  item,
  onClose,
}: {
  item: HubLink;
  onClose: () => void;
}) {
  const { href, hash, label, caption, Icon } = item;
  const fullHref = hash ? `${href}#${hash}` : href;
  // Use a real anchor for external (Monitor) links so they open in a
  // new tab and don't blow up Next's client-side router.
  const isExternal = /^https?:\/\//.test(href);
  const cls =
    "flex items-center gap-3 rounded-sm border border-ink-700 bg-ink-900/60 px-4 py-3 hover:border-brand hover:bg-brand/5";
  const content = (
    <>
      <Icon
        size={16}
        weight="bold"
        className="text-brand"
        aria-hidden="true"
      />
      <span className="font-display text-sm uppercase tracking-tight text-white">
        {label}
      </span>
      <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
        {caption}
      </span>
    </>
  );
  return (
    <li>
      {isExternal ? (
        <a
          href={fullHref}
          target="_blank"
          rel="noreferrer noopener"
          data-testid={`account-hub-${label.toLowerCase().replace(/\s+/g, "-")}`}
          onClick={onClose}
          className={cls}
        >
          {content}
        </a>
      ) : (
        <Link
          href={fullHref}
          data-testid={`account-hub-${label.toLowerCase().replace(/\s+/g, "-")}`}
          onClick={onClose}
          className={cls}
        >
          {content}
        </Link>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------
 * Avatar field — live upload + remove.
 *
 * Wave 14.7 — wired to the `profile-avatars` storage bucket and the
 * `profiles.avatar_url` column. Validation runs both in the browser
 * (instant feedback) and in the server action (authoritative + RLS-
 * gated). The storage bucket also enforces the same mime allow-list
 * + 2 MB limit, so a malformed call gets rejected at three layers.
 *
 * UX:
 *   1. User taps "Upload" → file picker opens (jpg/png/webp).
 *   2. On change, we submit the file straight away with the upload
 *      server action — no separate "save" button.
 *   3. While the action is pending, the button shows "Saving…" and
 *      both buttons are disabled.
 *   4. On success: router.refresh() repaints headers + sheet from
 *      the revalidated server tree (the action also calls
 *      revalidatePath("/app","layout") for safety).
 *   5. On error: an inline message appears below the row and the
 *      existing avatar (or initials) stays.
 * ------------------------------------------------------------------ */
function AccountAvatar({
  avatarUrl,
  initial,
  size,
}: {
  avatarUrl: string | null;
  initial: string;
  size: number;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-display text-base text-ink-900"
    >
      {initial}
    </span>
  );
}

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

function AvatarUploadField({
  avatarUrl,
  initial,
}: {
  avatarUrl: string | null;
  initial: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleResult = (res: AvatarActionResult) => {
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    router.refresh();
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !(ALLOWED_MIME as ReadonlyArray<string>).includes(file.type)
    ) {
      setError("Use a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("File is over 2 MB.");
      return;
    }
    const fd = new FormData();
    fd.append("avatar", file);
    startTransition(async () => {
      const res = await uploadAvatarAction(fd);
      handleResult(res);
      // Reset the input so the same file can be picked again later.
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  const onRemove = () => {
    setError(null);
    startTransition(async () => {
      const res = await removeAvatarAction();
      handleResult(res);
    });
  };

  return (
    <div
      data-testid="account-hub-avatar-field"
      className="flex flex-col gap-2 rounded-sm border border-dashed border-ink-700 bg-ink-900/40 p-3"
    >
      <div className="flex items-center gap-3">
        <AccountAvatar avatarUrl={avatarUrl} initial={initial} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xs uppercase tracking-tight text-white">
            Avatar photo
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
            {avatarUrl ? "// active" : "// using initials fallback"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {avatarUrl ? (
            <button
              type="button"
              onClick={onRemove}
              disabled={pending}
              data-testid="account-hub-avatar-remove"
              className="inline-flex items-center gap-1.5 rounded-sm border border-ink-700 bg-ink-900/60 px-2.5 py-2 text-[11px] font-display uppercase tracking-tight text-ink-300 hover:border-red-500/60 hover:text-red-200 disabled:opacity-60"
            >
              <Trash size={12} weight="bold" aria-hidden="true" />
              Remove
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            data-testid="account-hub-avatar-upload"
            className="inline-flex items-center gap-2 rounded-sm border border-ink-700 bg-ink-900/60 px-3 py-2 text-xs font-display uppercase tracking-tight text-white hover:border-brand hover:text-brand disabled:opacity-60"
          >
            <Camera size={13} weight="bold" aria-hidden="true" />
            {pending ? "Saving…" : avatarUrl ? "Change" : "Upload"}
          </button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ALLOWED_MIME.join(",")}
        onChange={onPick}
        className="sr-only"
        data-testid="account-hub-avatar-input"
      />
      {error ? (
        <p
          role="alert"
          data-testid="account-hub-avatar-error"
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-300"
        >
          {error}
        </p>
      ) : (
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-400">
          {"// jpg / png / webp · 2 mb max · stored in profile-avatars bucket"}
        </p>
      )}
    </div>
  );
}
