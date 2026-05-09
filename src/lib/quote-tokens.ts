import "server-only";
import { randomBytes } from "node:crypto";

export function generatePublicToken(): string {
  return randomBytes(32).toString("base64url");
}
