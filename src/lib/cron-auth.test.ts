import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAuthorizedCron } from "./cron-auth";

describe("isAuthorizedCron", () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "s3cr3t-token";
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("returns true for the correct Bearer token", () => {
    expect(isAuthorizedCron("Bearer s3cr3t-token")).toBe(true);
  });

  it("returns false for a wrong token of equal length", () => {
    expect(isAuthorizedCron("Bearer wrong-token0")).toBe(false);
  });

  it("returns false for a different-length token without throwing", () => {
    expect(() => isAuthorizedCron("Bearer short")).not.toThrow();
    expect(isAuthorizedCron("Bearer short")).toBe(false);
  });

  it("returns false for a null header", () => {
    expect(isAuthorizedCron(null)).toBe(false);
  });

  it("returns false when CRON_SECRET is missing", () => {
    delete process.env.CRON_SECRET;
    expect(isAuthorizedCron("Bearer s3cr3t-token")).toBe(false);
  });
});
