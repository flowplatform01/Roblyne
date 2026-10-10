# EVENUM — Founder Product Assessment & Pre-Launch Scorecard

**Assessment date:** October 10, 2026  
**Assessment type:** Read-only product, implementation, and launch-readiness review  
**Overall product-strength score:** **6.2 / 10**

## Executive assessment

EVENUM is a substantial, working multi-workflow product—not a landing-page prototype. Organizations can create and manage events, elections, and campaigns; visitors can discover public activities and participate; the platform includes organization finance and platform administration. The strongest evidence is in the implemented workflows, their shared organizational model, the public-facing pages, and production-shaped backend foundations.

That progress is real, but it is not the same as being ready to accept unrestricted public traffic or real money. This review found two verified access-control/security issues and a source-level race in paid voting. The FlowPay production path also has not been verified against live production credentials and transactions. Until the first two findings are corrected, and paid workflows are verified, a broad production launch that handles private elections or payments would be premature.

**Current-stage judgment:** late MVP / controlled-pilot candidate. A carefully scoped, free pilot can be considered after resolving the access-control issues and verifying the deployment configuration. Real-money workflows—especially paid voting—need their own production verification and safeguards before they are enabled.

The market case remains a hypothesis. The repository and current environment do not establish customer demand, paid conversion, retention, or competitor differentiation. The next phase should combine a small number of safety fixes with controlled production verification and real organizer/participant observation—not an open-ended expansion of features.

## Scope and evidence limits

This review covered the public Evenum experience, the three major product areas, organization and platform-finance code, relevant API routes and schemas, production configuration, project readiness documentation, tests, and build/type-check results.

Evidence gathered on October 10, 2026:

- The public home page was captured at desktop size, including its discovery feed and capability sections. A mobile home-page screenshot was also reviewed. The browser was not signed into Evenum, so authenticated pages—including the platform-admin finance screen—were assessed from code and the founder's reported experience, not from an authenticated visual walkthrough.
- `pnpm run typecheck` passed.
- The API unit-test command passed **7 tests** across the two test files found. These are focused unit tests, not end-to-end product tests.
- The Evenum production Vite build and API-server production build passed when run separately with the frontend's required build environment. The Vite build emitted non-fatal source-map warnings and precached 87 files totaling about 2.75 MiB.
- The root aggregate `pnpm run build` stopped at the mockup-sandbox build because that build requires `PORT` and the variable was not set for that invocation. This did not prevent the individual Evenum and API builds from passing.
- An unauthenticated local API preflight check using an arbitrary test origin returned `Access-Control-Allow-Origin` for that origin and `Access-Control-Allow-Credentials: true`. This confirms the configured development API behavior; it is not a test of a separately deployed production network.
- No production payment, cross-user authorization, paid-vote concurrency, backup-restore, or full accessibility test was performed. No production deployment or customer account was accessed. Secret values were not read.

**Evidence labels used below**

- **Verified:** directly visible in source/configuration, a build/test result, or a captured page.
- **Partially verified:** source supports the capability, but the full interaction, protected screen, production service, or external provider has not been exercised.
- **Judgment / hypothesis:** a reasoned product or market assessment without customer research or measured outcomes.

Scores are founder-level assessments, not industry benchmarks. Higher is better, except for **remaining uncertainty**, where a higher score means more uncertainty remains.

## What EVENUM actually does today

### For organizations

- **Events:** create and publish events, offer free registration or paid ticket types, manage attendee information, and support ticket/check-in workflows. Event registration checks event and ticket availability, capacity, eligibility, and sale windows. Paid registration is asynchronous: the user starts a payment, then the application confirms the ticket after payment status is finalized.
- **Elections:** set up positions and candidates, choose public or restricted visibility and eligibility modes, collect ballots, publish results, and share candidate/election pages. Ballot validation checks election ownership, position limits, and candidate membership. The database also enforces one vote per voter identity and election.
- **Campaigns:** configure participation/application forms, publish a campaign, collect responses, and optionally collect money. Campaign responses and totals are finalized when a paid submission succeeds.
- **Organization operations:** manage an organization's activity, team, settings, and finance. Finance includes balances, ledger/transaction views, settlement requests, and exports. Commission calculations are centralized rather than hardcoded in each activity.
- **Platform administration:** manage users, organizations, finance, governance, and operations. The first platform administrator is created through a configured, one-time bootstrap secret rather than an unrestricted public admin-registration path.

### For participants and visitors

Visitors can browse public events, elections, and campaigns, use discovery/search, and open shared activity pages. Each pillar has a page and action flow suited to its purpose. Sharing controls and entity-specific social metadata support links distributed through messaging and social platforms. Some actions require an account or eligibility information; paid actions use a separate payment/status step.

### Architecture and operational foundations

The application is a TypeScript pnpm workspace. The web client uses React, Vite, Wouter, React Query, and generated typed API hooks; the API uses Express and PostgreSQL/Drizzle with shared validation schemas. Sessions are stored in PostgreSQL rather than process memory. The server includes rate limits, request IDs, structured logging, and route-level HTTP metrics. Production startup refuses to run without a session secret and requires configured S3-compatible image storage.

The foundation is more production-shaped than a demo, but these features do not prove the deployed environment is configured, backed up, monitored, or resilient. The current metrics module is process-local HTTP request/latency counting; this review did not find a user-level organizer activation or conversion funnel.

## Scorecards

### A. Product and experience — **6.7 / 10**

**Category judgment:** the product is broad and coherent enough to demonstrate, with a polished public surface and real workflows behind it. First-time organizer usability and authenticated workflows have not been tested with users. The founder has also specifically reported that platform-admin finance still feels excessively long, scroll-heavy, and cluttered; I could not independently inspect that signed-in screen in the browser.

| Dimension | Score | Assessment | Evidence status |
|---|---:|---|---|
| Overall product completeness | 7/10 | All three pillars have organizer and participant paths, with organization and platform-finance surfaces. Completeness of individual live workflows is not established by the presence of their pages alone. | Partially verified |
| Usefulness and clarity of purpose | 7/10 | “Elections, events & campaigns” makes the core scope understandable. “The platform for organized participation” is coherent but abstract until a visitor sees the concrete workflows. | Partially verified |
| UI/UX quality | 6/10 | Public pages have a considered visual system, clear calls to action, and structured cards. The reported finance-administration friction and the lack of signed-in usability testing keep this below a strong overall score. | Partially verified; includes founder feedback |
| Mobile experience | 7/10 | The public home page has been captured on a phone and shows a responsive layout and usable primary actions. Event, ballot, form, and finance workflows have not been fully exercised on a range of mobile devices. | Partially verified |
| Desktop experience | 8/10 | The desktop landing page is visually coherent, with strong hierarchy and distinct discovery/capability sections. The current preview's test-like activity records reduce its credibility. | Partially verified |
| First-time organizer ease | 6/10 | Registration, organization creation, and activity creation are implemented. No observed organizer session or measured time-to-first-publication is available. | Judgment / hypothesis |
| Public presentation and branding | 7/10 | The brand, public activity pages, share controls, and social metadata form a credible base. Test-looking current preview content, generic support contact presentation, and unverified trust claims weaken launch polish. | Partially verified |
| Consistency across pillars | 7/10 | The pillars share the organization model, visual language, publishing/discovery, and finance foundations, while retaining activity-specific workflows. Their participant completion paths are not identical, which is appropriate but needs end-to-end testing. | Partially verified |
| Accessibility and action discoverability | 6/10 | The landing page explains the three main capabilities and the finance navigation exposes named sections. No automated accessibility audit or screen-reader/keyboard pass was run. | Judgment / partial source review |
| Recovery from ordinary mistakes | 6/10 | Status handling, error responses, protected deletion/history, and recovery-oriented UI components exist. Full recovery paths for abandoned payments, lost access, and mistaken organizer actions were not exercised. | Partially verified |

### B. Engineering and production readiness — **5.6 / 10**

**Category judgment:** the architecture and several integrity controls are solid for an MVP. The score is held down by concrete access-control findings, an unclosed paid-vote race, limited automated workflow coverage, and a payment integration that has not been production-verified.

| Dimension | Score | Assessment | Evidence status |
|---|---:|---|---|
| Architecture and maintainability | 7/10 | Shared typed schemas/client hooks, PostgreSQL persistence, modular routes, and a centralized commission engine are good structural choices. Long routes and concentrated UI code still deserve measured maintenance attention. | Partially verified |
| Performance and responsiveness | 6/10 | The code includes pagination, compact list media, and query/performance work. No representative load test or real-user timing data was found. The PWA precache is about 2.75 MiB and should be checked on constrained mobile connections. | Partially verified |
| Reliability of major workflows | 6/10 | Event capacity, lifecycle boundaries, ballot validation, payment status transitions, and webhook processing have meaningful server-side controls. Only narrow unit tests are present; paid flows and participant journeys were not integration-tested here. | Partially verified |
| Security and authorization | 3/10 | Production-style sessions, rate limits, and role middleware are present, but credentialed CORS reflects arbitrary origins and private-election results require only a signed-in session, not election/organization authorization. | Verified source-level findings; local CORS behavior tested |
| Data integrity and organization isolation | 6/10 | Organization-role checks, transactional updates, event/election locks, and a unique vote constraint provide useful safeguards. The private-results authorization gap and paid-vote race materially weaken the boundary. | Partially verified |
| Payment and financial correctness | 4/10 | Durable intents, idempotency keys, signature verification, webhook deduplication, a ledger, commission snapshots, and settlement allocation are implemented. There is no verified live provider transaction; paid voting has a race that could create multiple intents for one voter. | Partially verified |
| Voting integrity and safeguards | 5/10 | The application validates ballot structure and enforces one stored vote per voter/election. It does not establish independent, cryptographic verifiability or certified-election assurances; private result visibility and paid-vote concurrency need correction. | Partially verified |
| Error handling, diagnostics, and recovery | 7/10 | Request IDs, structured logs, rate limits, status polling, explicit API errors, and route-level metrics provide a useful base. Operational alerts, durable product funnels, and incident exercises were not verified. | Partially verified |
| Scalability | 6/10 | PostgreSQL-backed state, query improvements, and pagination are preferable to process-only application state. No traffic/load evidence, multi-instance exercise, or production capacity test was available. | Judgment / partial implementation review |
| Deployment and operations | 5/10 | Separate web/API artifacts, production startup guards, persistent sessions, and health endpoints show deployment intent. Production storage, restore procedures, alerting, payment reconciliation, and on-call ownership remain unverified. | Partially verified |

### C. Business and market readiness — **5.5 / 10**

**Category judgment:** the product has a plausible organizational use case and some built-in sharing loops. There is no evidence in the repository or current review of demand, willingness to pay, retention, customer acquisition, or competitor advantage. The low demand-evidence score below describes the evidence available, not proof that demand is absent.

| Dimension | Score | Assessment | Evidence status |
|---|---:|---|---|
| Value proposition clarity | 7/10 | A single platform for elections, events, and campaigns is understandable and the landing page names those uses. “Organized participation” could become the umbrella, but customers will likely respond to a more specific first-use promise. | Judgment / partially verified |
| Potential usefulness to organizations | 6/10 | Consolidating public pages, registration/ballots/forms, participation records, and finance could reduce tool-switching for organizations. No customer interviews or live workflow observation were reviewed. | Hypothesis |
| Differentiation | 5/10 | The bundle and shared organization/discovery model are promising differentiators. No competitor study was performed, so distinctiveness and defensibility are not established. | Judgment; unvalidated |
| Suitability for Cameroon and wider African markets | 6/10 | XAF defaults, phone requirements for paid actions, and a payment-provider adapter suggest regional intent. Provider availability, payout operations, local currency precision, regulatory needs, language preferences, and user demand still need confirmation. | Hypothesis / partially verified |
| Shareability and organic discovery | 7/10 | Public activity links, share controls, social previews, and a discovery feed give organizers ways to introduce Evenum to existing audiences. This is a distribution mechanism, not evidence of traffic or conversion. | Partially verified |
| Demonstration and marketing readiness | 6/10 | The three pillars can be demonstrated through real flows and the public brand looks developed. Test-looking content and unproven security/payment claims should be addressed before broad promotion. | Partially verified |
| New organizer onboarding | 6/10 | The necessary account, organization, and activity-creation paths exist. No evidence shows how often a new organizer completes them without assistance. | Judgment / hypothesis |
| Repeat-use potential | 6/10 | Annual elections, recurring events, and repeated application/participation campaigns could bring organizations back. No retention or repeat-creation data exists. | Hypothesis |
| Sustainable revenue potential | 5/10 | Transaction commissions and settlements are represented in code. Actual pricing acceptance, provider costs, manual operations, payout timing, disputes, and unit economics have not been demonstrated. | Hypothesis / partially verified |
| Evidence of customer demand | 1/10 | No independently verified customer pipeline, customer interviews, paid usage, conversion, or retention evidence was available for this assessment. This is an evidence score, not a verdict that customers will not want the product. | Verified absence of evidence in reviewed materials |

### D. Overall maturity — **5.2 / 10**

| Dimension | Score | Assessment | Evidence status |
|---|---:|---|---|
| Product maturity | 7/10 | The application contains real workflows across the three pillars, public and organization surfaces, platform administration, and backend state handling. | Partially verified |
| Closeness to a responsible production launch | 4/10 | Access-control issues need correction. Paid workflows need live verification, and paid elections need the concurrency gap closed. A restricted, free pilot has a narrower path once the security issues are fixed. | Verified blockers plus unverified production state |
| Original vision realized | 7/10 | The central Events/Elections/Campaigns concept is present in working application paths, not only in a pitch deck. Commercial success and provider-backed money movement are not yet established. | Partially verified |
| Confidence in the current state | 5/10 | Builds and focused tests pass, but there is no broad route-level test suite, live payment verification, independent security assessment, or customer validation. | Judgment based on verified evidence |
| Remaining uncertainty (higher means more uncertainty) | 8/10 | Demand, safe private-election access, browser session boundaries, provider behavior with real transactions, and real-world completion/retention remain unresolved. | Judgment grounded in explicit evidence gaps |

### Separate score: marketing readiness — **5.5 / 10**

EVENUM has enough product and visual substance for a guided demonstration or a narrowly targeted pilot. It is not yet ready for broad claims about secure/verified elections or reliable live payments. The public preview also needs clean, representative content. Marketing readiness is therefore higher than production readiness but not a proxy for customer validation.

## What is genuinely strong

1. **The three pillars are implemented as workflows, not just labels.** Event registration and tickets, ballot creation and submission, and configurable campaigns have distinct organizer and participant journeys. This is a meaningful product accomplishment.
2. **There is a shared organizational foundation.** Organizations have public identities, members, activity, and finance rather than each pillar being an unrelated tool. That makes a coherent organizational product possible.
3. **Integrity work is visible in the backend.** Event capacity is locked transactionally; ballot contents are validated server-side; votes have a database uniqueness guarantee; payment webhook state changes are deduplicated and transactional. These controls show attention to real failure modes, even though the remaining findings still matter.
4. **Finance is modeled more seriously than a basic “amount raised” counter.** A centralized commission engine, transaction ledger, currency-aware balances, settlement records, allocation, and exports provide a foundation for reconciliation and admin operations. A provider-verified disbursement process was not established.
5. **The public experience has a real distribution surface.** Branded activity pages, search/discovery, share actions, and entity-specific social previews can help organizations introduce Evenum to their existing audiences. The website is visually coherent and the major capabilities are easy to identify.

These strengths represent substantial product-building work. The remaining concerns are not a reason to dismiss that work; they identify where the product must earn trust before it handles consequential votes or money.

## First-impression psychology and trust

### Organizers

**Advantages:** The umbrella promise is visible, and the public pages can make an organizer look more organized than a collection of unrelated forms and posts. Shareable pages let the organization reach its own members and audience. Election eligibility modes, event registration controls, and campaign form configuration provide some meaningful control.

**Likely hesitation (hypothesis, not user-research result):**

- “Can I trust this with a real election or payment?” is hard to answer from the current public presentation. The code does not establish independent election verifiability, and live payment behavior has not been confirmed.
- An organizer needs to know the fee, payment state, settlement timing, refund/cancellation process, and who handles an unresolved transaction before inviting participants. Those operational answers were not established by this review.
- The current public preview includes conspicuously test-like activity names and organization labels. That conflicts with the landing page's “serious teams” framing. Whether production data has the same issue is unknown.
- The founder has already described the platform-admin finance area as too long and scroll-heavy. The code now separates finance into five views, but I could not inspect the authenticated screen to determine whether the reported clutter remains in each view.
- The auth routes inspected support registration, login, logout, profile update, and password change; I did not find an email-verification or forgotten-password flow. That can make account recovery and organizer onboarding less reassuring.

### Participants, voters, and applicants

**Advantages:** Visitors can arrive directly on an activity page from a shared link; the activity type and desired action are generally clear. Payment status has a dedicated asynchronous status flow. The responsive public landing experience and social metadata help links feel like a product rather than an unbranded form.

**Likely hesitation (hypothesis):**

- Participants need to understand who is organizing, what data is collected, what happens after submission, whether payment has completed, and how to get help. The implementation includes organizer identity and completion/payment states, but this review did not run the participant flows end to end.
- A voter may interpret “live verifiable results” as an independently auditable election. The current implementation supports aggregate results and ballot uniqueness, but the assessment found no independent cryptographic verification mechanism. That wording should be narrowed unless the stronger claim is substantiated.
- Any cross-origin access to a signed-in account or exposure of a private election's results would undermine participant trust even if the page itself looks polished.

All psychology statements above are product-based hypotheses; no participant or organizer interviews were conducted.

## Marketing potential

### Positioning

The umbrella brand can remain broad, but initial outreach should focus on one concrete activity and one organizer type. A plain-language version of the current value could be:

> **Evenum helps organizations run shareable events, internal elections, and participation campaigns from one place.**

For a first campaign, the most important sentence should name the audience and the job Evenum removes friction from. “Organized participation” is a useful brand idea, but it is less actionable by itself.

### Promising initial segments (ranked hypotheses)

1. **Schools, student associations, and member-based organizations running internal elections.** This is the clearest differentiated demonstration of positions, candidates, eligibility, ballots, and results. Start only with controlled, non-legally-consequential pilots and fix private-results authorization first. Do not market the current system as independently certified or cryptographically verifiable.
2. **Organizations hosting recurring events and member gatherings.** The event path supports free registration and paid ticket types, capacity, attendee lists, and check-in. A free-registration pilot can validate organizer and participant usability without claiming live money movement; paid tickets must wait for provider and operations verification.
3. **Organizations collecting applications, memberships, or structured participation through campaigns.** Configurable forms may support these workflows, but the breadth of “campaign” use cases makes positioning and privacy expectations less obvious. Begin with a narrow, well-understood form type rather than promising every kind of fundraising or application workflow.

These are rankings for testing, not market findings. No segment has been validated through customer research, and this review did not perform competitor research.

### Distribution and discovery

Evenum has a plausible “organizer-to-audience” loop: the organizer publishes a page, shares it through existing channels, and participants see the Evenum brand while completing an action. The discovery feed can add a second entry point. The actual result depends on page credibility, organizer trust, audience behavior, and successful completion. No referral attribution or conversion data was found, so organic acquisition remains potential rather than proof.

### Claims that are supportable today

Based on the implementation, the founder can confidently demonstrate that:

- an organization can create and publish an event, election, or campaign;
- public activity pages and sharing/social-preview support exist;
- the product contains event registration/ticket, ballot, and configurable campaign workflows;
- finance records and commission/settlement foundations are implemented.

Claims that need narrowing or further proof:

- **“Live verifiable results”** — the current evidence supports displaying aggregated results, not independent verification. Use “live results” unless an independently checkable mechanism is delivered and tested.
- **“Secure elections”** — the code contains useful safeguards, but this assessment found unresolved authorization and paid-vote issues and did not conduct a security audit. Avoid any certification-like implication.
- **“Integrated payments” / “secure payments”** — an integration path is implemented, but real production authentication, transaction, webhook reachability, and reconciliation have not been verified. Describe the feature as in testing until those steps are completed.
- **Automatic or reliable payouts** — settlement records exist, but this assessment did not find evidence of a verified provider disbursement workflow. State the actual processing and timing clearly before money is collected.

## Development-to-launch assessment

EVENUM has crossed the prototype line: its public and authenticated product areas, shared data model, business rules, and operational surfaces are substantial. The next transition is less about adding another pillar and more about proving that private data stays private, payment state is safe, deployment is configured, and real people can finish their first task.

Some milestone evidence is strong: the type-check passes, the Evenum and API production builds pass separately, focused tests exist, persistent sessions and production startup guards are implemented, and public pages render. Important milestones remain unverified: authorization under adversarial identities, low-bandwidth mobile usage across key flows, production S3/session configuration, database restore, FlowPay production settlement and replay, and real customer onboarding.

### Group A — Verified launch blockers

These are blockers for the scopes stated. A free, tightly controlled pilot is different from a public paid launch.

#### 1. Credentialed cross-origin access is not restricted

- **Problem:** API CORS is configured with `origin: true` and `credentials: true`. Production session cookies are configured with `SameSite=None`. No application-level CSRF token or origin/referer validation was found in the inspected API middleware/routes.
- **Evidence:** `artifacts/api-server/src/app.ts` lines 71–74 and 94–110. A local preflight request from an arbitrary test origin received that origin in `Access-Control-Allow-Origin`, with `Access-Control-Allow-Credentials: true`.
- **Why it matters:** This removes the API's browser-origin trust boundary. When a browser sends a user's session cookie cross-site, an attacker-controlled page may be able to issue and read credentialed API requests. Exact exploitability depends on browser cookie policy and deployment topology, but the application-level policy is too permissive for a production session API.
- **Smallest appropriate next step:** Restrict CORS to the actual web origins and add explicit Origin/CSRF protections for state-changing requests. Then test allowed and disallowed origins with authenticated reads and writes. Reassess whether `SameSite=None` is actually required by the deployed topology.
- **Status:** Source/configuration verified; arbitrary-origin local preflight verified; production deployment behavior not tested.

#### 2. Private election results are available to any signed-in account

- **Problem:** For a non-public election, the results endpoint rejects anonymous visitors but does not verify that the signed-in user belongs to the owning organization or is otherwise allowed to view that election.
- **Evidence:** `artifacts/api-server/src/routes/elections.ts` lines 997–1007. The condition checks only whether `req.session.userId` exists. The response then queries aggregate totals and candidate results.
- **Why it matters:** A normal user from an unrelated organization can retrieve results for a private election if they know or discover its ID. For an active vote, revealing interim totals can affect voter behavior and compromise organizer expectations.
- **Smallest appropriate next step:** Apply the same election/organization visibility rule used by protected election resources, and add tests for anonymous visitors, unrelated signed-in users, eligible organization members, and administrators.
- **Status:** Verified by direct source inspection; no authenticated API exploit test was performed.

#### 3. Paid-vote duplicate-intent race must be closed before enabling paid elections

- **Problem:** The paid-ballot path checks for an existing pending payment intent before opening its database transaction. It then locks the election row but does not repeat the pending-intent check under that lock. Two concurrent submissions for the same voter can therefore pass the earlier check and create two distinct intents.
- **Evidence:** `artifacts/api-server/src/routes/elections.ts` lines 749–777 perform the voter and pending-intent checks before the transaction; lines 779–842 create the intent after locking the election. The votes table has a unique `(election_id, voter_identifier)` index, and payment finalization inserts the vote in `artifacts/api-server/src/lib/payment-intents.ts` lines 282–319.
- **Why it matters:** If both provider intents are paid, the unique vote constraint should prevent a second ballot, but one successful charge may then fail to finalize into a vote. This can create a paid-but-unrecorded ballot or require manual reconciliation. No live double-charge or webhook failure was reproduced; this is a verified source-level race with a conditional financial consequence.
- **Smallest appropriate next step:** Make pending payment intent creation atomic per election/voter (or otherwise idempotent at that boundary), define compensation/reconciliation for a paid intent that cannot finalize, and add a concurrent integration test before offering paid voting.
- **Status:** Race window verified in source; production provider outcome not verified.

#### 4. Production payments are not verified; this blocks real-money launch

- **Problem:** The payment integration is not verified against FlowPay production, and the current readiness document says the development environment lacks production credentials/endpoints, operational dashboards, and live transaction access.
- **Evidence:** `docs/flowpay-production-readiness.md` lines 3–5 and 73–84. The checklist still requires production contract confirmation, a controlled live/provider-approved transaction, webhook reachability, and reconciliation/replay checks.
- **Why it matters:** A sandbox run cannot demonstrate that real funds settle, webhooks reach Evenum, or participant records and the ledger reconcile correctly. Event tickets, paid campaign submissions, and paid votes affect money and user trust.
- **Smallest appropriate next step:** Complete the provider-approved verification transaction and webhook/reconciliation exercise for each enabled paid context. If that cannot happen yet, keep those contexts unavailable and run only free pilot workflows.
- **Status:** The absence of production verification is documented and verified for the current development environment; the state of any separate production account was not inspected.

### Group B — Important but non-blocking improvements

- **Clean up the public demo surface before demonstrations or launch.** The current preview shows activity names and organization labels that look like test data, plus a generic support contact. Replace them with approved demo records or clearly label the environment. The production dataset was not inspected, so this is not evidence that production contains the same records.
- **Resolve the reported platform-finance UX pain.** The founder has described the admin finance experience as too long, repetitive to scroll, and cluttered. The implementation exposes five finance views and pagination, but I could not inspect the authenticated rendering. Validate the complaint with a real admin and shorten the most frequent tasks before broad promotion; do not remove finance controls without usage evidence.
- **Add focused route/integration coverage.** The seven passing tests cover narrow units, not the security findings, event registration, campaign completion, paid payment callbacks, organization access boundaries, or browser flows. Prioritize regression tests around the Group A fixes rather than starting with a broad generic test program.
- **Verify legal and customer-facing disclosures.** I did not find public privacy/terms pages in the inspected routes/source. Before collecting personal data or money, confirm the required notices and clearly explain data use, fees, refunds/cancellations, settlement timing, support, and organizer responsibilities. This is not a legal opinion; applicable requirements depend on launch jurisdictions and business arrangements.
- **Improve account recovery.** The inspected auth routes include password change but no forgotten-password or email-verification flow. For an open public launch, decide how users recover access and establish that account email belongs to them.
- **Check mobile first-use cost and performance.** The generated service worker precaches about 2.75 MiB across 87 entries, including large feature chunks. This can help repeat visits but may be expensive on an initial constrained connection. Measure first install and core journeys on representative lower-end devices and slower networks before deciding whether to refine the precache.
- **Verify deployment configuration without exposing secret values.** The API intentionally refuses production startup without S3-compatible image storage and a real session secret. Confirm the required variable names are configured in the target environment, plus backups, restore, monitoring, and database migration status. This review did not inspect secret values or prove whether the production environment is complete.
- **Make settlement operations explicit.** Ledger and settlement records are present, but this review did not verify automated disbursement or a live reconciliation process. Before describing “payouts,” state who processes them, how long they take, and how failed or disputed transfers are handled.

### Group C — Future opportunities after initial validation

- Use observed organizer and participant behavior to decide whether to deepen one initial segment or expand across all three.
- Consider additional election audit/verification features only if target organizations require them and the trust model can be specified and tested.
- Refine platform-admin finance navigation based on the top real support/admin tasks and record volumes, rather than adding more finance subsections in advance.
- Expand integrations, automations, and distribution features only after the first organizer acquisition and repeat-use loop is understood.
- Optimize caching and list behavior based on real traffic and performance measurements, not hypothetical scale.

## What to measure in the first month

The current request metrics can show server route activity and latency, but they are not enough to tell whether an organization succeeds. Add a small, privacy-conscious event funnel and establish a baseline rather than choosing arbitrary success targets.

1. **Organizer activation:** new organizations created, percentage that publish their first activity, and elapsed time from organization creation to first publication. This tells the founder whether onboarding reaches a meaningful outcome.
2. **Participant completion by pillar:** public page visits to completed event registration, completed ballot, or completed campaign submission. Separate free and paid paths, and record where users abandon or encounter errors.
3. **Payment safety and reconciliation:** initialization success, provider success/failure, pending age, webhook-finalization outcome, and any provider-paid transaction without a matching Evenum completion. This is essential before scaling money flows.
4. **Repeat organizer behavior:** organizations that publish a second activity or return to manage the first one. This is an early signal of utility beyond a one-off demo.
5. **Support and failed workflows:** support requests by issue type, API errors in key flows, and recurring points of confusion. Pair numeric events with short organizer/participant interviews.

During the first month, prioritize successful first publication and completion of the intended participant action. For any paid pilot, payment/ledger reconciliation is a safety metric, not an optional growth metric. Do not collect unnecessary personal data in analytics.

## Final verdict

1. **How strong is Evenum today?** **6.2/10 overall product strength.** It is a substantial MVP with working product breadth, not a validated business.
2. **Dimension scores:** product quality **6.7/10**; engineering maturity **5.6/10**; production readiness **3.5/10**; marketing readiness **5.5/10**; market validation **1/10**; overall product maturity **6.2/10**. Market validation is low because evidence is missing, not because demand has been disproven.
3. **Three reasons for confidence:** the three pillars contain real end-to-end product intent; the shared organization and finance model is substantial; the public pages and sharing surfaces can support an organizer-led distribution loop.
4. **Three largest uncertainties:** whether target organizers will adopt and pay; whether private/session boundaries and concurrent paid voting are safe after remediation; whether production payment and operational settlement work reliably with the chosen provider.
5. **Ready to move toward production?** Yes, toward a controlled production pilot after fixing the two access-control blockers and verifying deployment safeguards. No, not yet for a broad public launch that exposes private elections or accepts real payments. Paid voting needs an additional atomicity fix and test.
6. **What should the founder focus on next?** A combination, in this order: close the verified security issues; validate payment and deployment only for the workflows intended to handle money; prepare a clean public demo; then onboard a small number of real organizations and observe their first activity and participant completion.
7. **Most important advice:** stop treating more feature volume as the main proof of progress. EVENUM has enough substance to learn from real use. Make the smallest safety corrections that protect trust, select one narrow pilot segment, and let actual organizer and participant behavior decide what deserves further development.

EVENUM has progressed well beyond a concept: there is a real platform here, with several interacting workflows and serious backend work behind them. That is worth recognizing. The next confidence step is not to assume the work is finished; it is to close the specific trust gaps, test the production boundary, and learn whether organizations return to use what has been built.

## Evidence index

- Product and stack: `EVENUM_STACK.md`; `artifacts/evenum/src/pages/Home.tsx`; `artifacts/evenum/src/pages/EventRegister.tsx`; `artifacts/evenum/src/pages/ElectionVote.tsx`; `artifacts/evenum/src/pages/CampaignParticipate.tsx`.
- Security and authorization: `artifacts/api-server/src/app.ts`; `artifacts/api-server/src/routes/elections.ts`; `artifacts/api-server/src/middlewares/orgAccess.ts`; `lib/db/src/schema/elections.ts`.
- Payments and finance: `artifacts/api-server/src/lib/payment-intents.ts`; `artifacts/api-server/src/lib/commission-engine.ts`; `artifacts/api-server/src/routes/financial.ts`; `artifacts/evenum/src/pages/AdminDashboard.tsx`.
- Production provider status: `docs/flowpay-production-readiness.md`.
- Operational instrumentation: `artifacts/api-server/src/lib/metrics.ts`.
- Verification performed: workspace type-check; API focused unit tests (7 passing); separate Evenum and API production builds; public homepage desktop/mobile captures; local arbitrary-origin CORS preflight.
