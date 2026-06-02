/**
 * Default NZ tradie contract template.
 *
 * This is the starter set of terms & conditions seeded into every
 * newly-generated quote when the tradie hasn't explicitly written
 * their own terms yet. They can edit / replace / delete it per quote
 * via the Terms section in the quote editor.
 *
 * IMPORTANT — disclaimer for future-me: this template is a sensible
 * generic starting point drawn from common NZ residential trade
 * practice. It is NOT legal advice. Tradies launching a real business
 * should run this past a NZ lawyer who specialises in construction
 * contracts, especially around payment terms, dispute resolution, and
 * the interaction with the Construction Contracts Act 2002 for jobs
 * over the $30k commercial / $20k residential thresholds.
 *
 * Provenance of clauses:
 *   - Building Act 2004 § 362I implied warranties — clause 5
 *   - Construction Contracts Act 2002 progress-payment expectations
 *     and dispute mediation flow — clauses 3 and 10
 *   - Common residential builder practice (deposit, variations,
 *     access, cancellation) — clauses 1, 2, 6, 7, 8, 9, 11
 *
 * When `profiles.default_terms` lands as a per-tradie configurable
 * field (post-launch enhancement), prefer that over this constant.
 * Until then, every tradie gets the same starter terms and edits per
 * quote as needed.
 */
export const DEFAULT_NZ_CONTRACT_TERMS = `Standard Terms & Conditions

1. SCOPE OF WORK
The work to be performed is as described in this quote. Any variations or additional work outside this scope will be quoted separately before being undertaken.

2. QUOTE VALIDITY
This quote is valid for 30 days from the date issued. Pricing beyond that period is subject to change due to material cost fluctuations and supplier availability.

3. PAYMENT TERMS
- Deposit: 20% of the total invoice value due upon acceptance of this quote.
- Progress payments: per the milestones agreed at job start.
- Final payment: due within 7 days of practical completion.
- Late payments may attract interest at 1.5% per month on the outstanding balance.

4. MATERIALS & SUPPLIERS
Material pricing is based on supplier quotes valid at the time of quoting. If specified items become unavailable, materials of equivalent quality may be substituted at the contractor's discretion.

5. WARRANTIES
Workmanship is warranted for 12 months from practical completion, consistent with the implied warranties under section 362I of the Building Act 2004. Manufacturer warranties on materials apply per the supplier's own terms.

6. VARIATIONS
Any change to the scope of work requested by the client must be agreed in writing before that work commences. Variations will be charged at the contractor's standard hourly rate plus materials and a 20% project-management margin.

7. ACCESS & SITE CONDITIONS
The client is responsible for ensuring safe and reasonable site access during agreed working hours. Delays caused by access issues, adverse weather, or unforeseen site conditions (including hidden services, asbestos, or non-compliant existing work) may extend the project timeline and incur additional costs, which will be quoted before being undertaken.

8. INSURANCE
The contractor holds public liability insurance to NZD $2 million. The client should ensure their own building / contents insurance adequately covers any work being undertaken on their property.

9. CANCELLATION
If the client cancels the work after acceptance, the client is liable for the cost of all materials already ordered and labour already performed up to the date of cancellation.

10. DISPUTE RESOLUTION
Any dispute arising from this contract will first be addressed by direct discussion between the parties. If unresolved within 14 days, the parties agree to attempt mediation through the Building Disputes Tribunal (or another mutually agreed mediator) before pursuing any other action. This clause does not affect either party's rights under the Construction Contracts Act 2002.

11. GOVERNING LAW
This contract is governed by the laws of New Zealand. Both parties submit to the non-exclusive jurisdiction of the New Zealand courts.

By accepting this quote, the client confirms they have read and agree to these terms.`;
