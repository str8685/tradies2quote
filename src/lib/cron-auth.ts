import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time check that an incoming Authorization header carries the
 * configured CRON_SECRET as a Bearer token.
 *
 * Uses crypto.timingSafeEqual so a timing attack can't recover the secret
 * byte-by-byte. timingSafeEqual THROWS when the two buffers differ in length,
 * so we guard on length first and return false (the comparison itself stays
 * constant-time for equal-length inputs).
 */
export function isAuthorizedCron(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (!authHeader) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authHeader);

  // Length guard: timingSafeEqual throws on length mismatch.
  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}
