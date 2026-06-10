// ─────────────────────────────────────────────────────────────────────────
// P0 REGRESSION PACK — weather job-location resolution.
//
// Hard rules: weather resolves from the client/customer JOB location on
// record (clients.address → quote_data.client.address), never implicitly
// from the tradie's device, and a missing/unresolvable address BLOCKS
// (skip with reason) instead of defaulting.
//
// Deterministic — geocoding is exercised via a mocked fetchImpl. Runs in
// CI on every push.
// ─────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from "vitest";
import {
  addressFromQuoteData,
  pickJobAddress,
} from "../jobAddress";
import { candidateQueries, geocodeAddress } from "../geocode";

describe("P0 regression — job address resolution order", () => {
  const quoteData = {
    client: { name: "Sam", address: "12 Quote St, Tauranga", email: null, phone: null },
    job_summary: "Reroof the garage",
  };

  it("clients.address wins when present", () => {
    const picked = pickJobAddress({
      clientsAddress: "5 Client Rd, Hamilton",
      quoteData,
    });
    expect(picked).toEqual({
      address: "5 Client Rd, Hamilton",
      source: "clients_table",
    });
  });

  it("falls back to quote_data.client.address when clients table has nothing", () => {
    const picked = pickJobAddress({ clientsAddress: null, quoteData });
    expect(picked).toEqual({
      address: "12 Quote St, Tauranga",
      source: "quote_client_address",
    });
  });

  it("whitespace-only clients.address is not an address", () => {
    const picked = pickJobAddress({ clientsAddress: "   ", quoteData });
    expect(picked?.source).toBe("quote_client_address");
  });

  it("neither source → null (caller must BLOCK, never default)", () => {
    expect(pickJobAddress({ clientsAddress: null, quoteData: {} })).toBeNull();
    expect(pickJobAddress({ clientsAddress: undefined, quoteData: null })).toBeNull();
    expect(
      pickJobAddress({
        clientsAddress: "",
        quoteData: { client: { address: "   " } },
      }),
    ).toBeNull();
  });

  it("addressFromQuoteData is shape-tolerant (never throws)", () => {
    expect(addressFromQuoteData(null)).toBeNull();
    expect(addressFromQuoteData("garbage")).toBeNull();
    expect(addressFromQuoteData({ client: null })).toBeNull();
    expect(addressFromQuoteData({ client: { address: 42 } })).toBeNull();
    expect(addressFromQuoteData({ client: { address: " 1 Real St " } })).toBe(
      "1 Real St",
    );
  });

  it("determinism: same inputs → same pick", () => {
    const a = pickJobAddress({ clientsAddress: null, quoteData });
    const b = pickJobAddress({ clientsAddress: null, quoteData });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("P0 regression — geocode behaviour (mocked provider)", () => {
  const geoHit = (name: string) =>
    new Response(
      JSON.stringify({
        results: [
          { latitude: -37.7, longitude: 176.2, timezone: "Pacific/Auckland", name, admin1: "Bay of Plenty", country: "New Zealand" },
        ],
      }),
      { status: 200 },
    );
  const geoMiss = () => new Response(JSON.stringify({}), { status: 200 });

  it("queries progressively coarser candidates and returns the first hit", async () => {
    const queried: string[] = [];
    const fetchImpl: typeof fetch = async (url) => {
      const name = new URL(String(url)).searchParams.get("name") ?? "";
      queried.push(name);
      // First candidate misses; second hits.
      return queried.length === 1 ? geoMiss() : geoHit(name);
    };
    const result = await geocodeAddress({
      address: "12 Example Street, Tauranga, Bay of Plenty, NZ",
      fetchImpl,
    });
    expect(queried[0]).toBe("Tauranga, Bay of Plenty");
    expect(result).not.toBeNull();
    expect(result!.latitude).toBe(-37.7);
    expect(result!.matchedName).toContain("New Zealand");
  });

  it("all candidates fail → null (caller skips, never fabricates a location)", async () => {
    const fetchImpl: typeof fetch = async () => geoMiss();
    const result = await geocodeAddress({ address: "Nowhere Lane", fetchImpl });
    expect(result).toBeNull();
  });

  it("provider errors are tolerated per-candidate, not fatal", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) throw new Error("network down");
      return geoHit("Tauranga");
    };
    const result = await geocodeAddress({
      // Yields 3 candidates ("Tauranga, Bay of Plenty", "Tauranga",
      // "Bay of Plenty") so the thrown first attempt has fallbacks.
      address: "12 Example Street, Tauranga, Bay of Plenty, NZ",
      fetchImpl,
    });
    expect(result).not.toBeNull();
  });

  it("candidate coarsening drops street numbers and country tokens", () => {
    expect(candidateQueries("12 Example Street, Upper Hutt, Wellington, NZ")).toEqual([
      "Upper Hutt, Wellington",
      "Upper Hutt",
      "Wellington",
    ]);
  });
});

describe("P0 regression — no device-location pathway in the resolution layer", () => {
  it("the pure resolution layer has no geolocation inputs at all", () => {
    // pickJobAddress's only inputs are stored records. This assertion locks
    // the contract: adding a device-location parameter would change the
    // function arity/shape and fail here, forcing a deliberate decision.
    expect(pickJobAddress.length).toBe(1);
    const picked = pickJobAddress({
      clientsAddress: null,
      quoteData: { client: { address: "1 Site St, Rotorua" } },
    });
    expect(picked?.source).toBe("quote_client_address");
    expect(Object.keys(picked!)).toEqual(["address", "source"]);
  });
});
