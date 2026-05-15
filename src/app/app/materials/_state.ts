/**
 * Shared state shape for the Materials forms' `useActionState` hooks.
 *
 * Lives in its own module — *not* in `actions.ts` — because Next 16
 * forbids non-async exports from `"use server"` files. The constant
 * below would otherwise crash the route at runtime with
 * `A "use server" file can only export async functions, found object.`
 */
export type ActionResult = { ok: true } | { error: string };

export const ACTION_INITIAL: ActionResult = { ok: true };
