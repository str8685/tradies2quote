import { describe, expect, it } from "vitest";
import { FetchTimeoutError, fetchWithTimeout, TIMEOUTS } from "./fetchTimeout";

function hangingFetch(): typeof fetch {
  // Resolves only when aborted — simulates a dead upstream socket.
  return ((_input: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(init.signal!.reason ?? new Error("aborted")),
      );
    })) as typeof fetch;
}

describe("fetchWithTimeout", () => {
  it("returns the response when the upstream answers in time", async () => {
    const ok = (() =>
      Promise.resolve(new Response("hi", { status: 200 }))) as typeof fetch;
    const res = await fetchWithTimeout("https://api.example.com/x", {}, 1000, ok);
    expect(res.status).toBe(200);
  });

  it("throws a named FetchTimeoutError when the upstream hangs", async () => {
    await expect(
      fetchWithTimeout("https://api.anthropic.com/v1/messages", {}, 20, hangingFetch()),
    ).rejects.toMatchObject({ name: "FetchTimeoutError", timeoutMs: 20 });
  });

  it("the timeout error message names the host, not the full URL", async () => {
    const err: FetchTimeoutError = await fetchWithTimeout(
      "https://api.resend.com/emails?secret=abc",
      {},
      20,
      hangingFetch(),
    ).then(
      () => {
        throw new Error("expected timeout");
      },
      (e) => e as FetchTimeoutError,
    );
    expect(err).toBeInstanceOf(FetchTimeoutError);
    expect(err.message).toContain("api.resend.com");
    expect(err.message).not.toContain("secret");
  });

  it("honours a caller-supplied abort signal (whichever fires first)", async () => {
    const outer = new AbortController();
    const p = fetchWithTimeout(
      "https://api.example.com/x",
      { signal: outer.signal },
      5_000,
      hangingFetch(),
    );
    outer.abort(new Error("user cancelled"));
    await expect(p).rejects.toThrow("user cancelled");
  });

  it("ships sane default ceilings", () => {
    expect(TIMEOUTS.llm).toBeLessThan(60_000); // under route maxDuration
    expect(TIMEOUTS.email).toBeLessThanOrEqual(15_000);
  });
});
