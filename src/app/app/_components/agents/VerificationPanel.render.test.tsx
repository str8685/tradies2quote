import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VerificationPanel } from "./VerificationPanel";
import type { VerificationReport } from "@/lib/agents/verify/quoteVerify";

const render = (report: VerificationReport) =>
  renderToStaticMarkup(createElement(VerificationPanel, { report }));

describe("VerificationPanel", () => {
  it("shows a green 'checks passed' line when there are no issues", () => {
    const html = render({ ok: true, issues: [], checkedBy: ["deterministic"] });
    expect(html).toContain("quote-verification-ok");
    expect(html).toContain("checks passed");
    expect(html).toContain("deterministic");
    expect(html).not.toContain("quote-verification&quot;"); // not the callout
  });

  it("shows an amber 'worth a glance' callout for warnings only", () => {
    const html = render({
      ok: true,
      issues: [{ code: "zero_price", severity: "warning", message: "No price on decking" }],
      checkedBy: ["deterministic", "critic"],
    });
    expect(html).toContain('data-testid="quote-verification"');
    expect(html).toContain('data-ok="true"');
    expect(html).toContain("worth a glance");
    expect(html).toContain("No price on decking");
  });

  it("shows a red 'fix before sending' callout when there's an error", () => {
    const html = render({
      ok: false,
      issues: [
        { code: "subtotal_mismatch", severity: "error", message: "Subtotal is wrong" },
        { code: "zero_price", severity: "warning", message: "Check the GIB price" },
      ],
      checkedBy: ["deterministic"],
    });
    expect(html).toContain('data-ok="false"');
    expect(html).toContain("fix before sending");
    expect(html).toContain("Subtotal is wrong");
    expect(html).toContain("Check the GIB price");
  });
});
