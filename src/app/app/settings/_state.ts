/**
 * Shared state shape for the Settings form's `useActionState` hook.
 *
 * Lives in its own module — *not* in `actions.ts` — because Next 16
 * forbids non-async exports from `"use server"` files. The constant
 * below would otherwise crash the route at runtime with
 * `A "use server" file can only export async functions, found object.`
 */
export type SaveSettingsState =
  | { status: "idle" }
  | { status: "ok"; savedAt: string }
  | { status: "error"; message: string };

export const SAVE_SETTINGS_INITIAL: SaveSettingsState = { status: "idle" };
