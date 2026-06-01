import { notFound } from "next/navigation";
import { getCachedAuthUser } from "@/lib/supabase/auth";
import { isOwnerEmail } from "@/lib/owner";

/**
 * Owner-only gate for the pre-launch design mocks.
 *
 * The /mocks pages are full-screen dashboard concepts the owner is
 * picking between before Friday's launch. They contain placeholder
 * data and an unfinished visual language — a customer landing on
 * `/mocks/v3` would see something that LOOKS like a logged-in app and
 * draw the wrong conclusion. Anyone who isn't the project owner gets
 * a 404 (Next's `notFound()`), which matches "this URL doesn't exist"
 * instead of "you're not allowed here" — quieter signal, no leakage.
 *
 * One layout file gates all five child routes (`/mocks`, `/mocks/v1`,
 * `/mocks/v2`, `/mocks/v3`, `/mocks/v4`) so the individual pages stay
 * unchanged — easy to delete the whole `mocks/` directory the moment
 * the winner ships.
 */
export default async function MocksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getCachedAuthUser();
  if (!isOwnerEmail(user?.email)) {
    notFound();
  }
  return <>{children}</>;
}
