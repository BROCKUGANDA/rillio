# RILLIO
## Complete Product Requirements, Design System, Systems Architecture & Staff Engineer Execution Blueprint

**Version:** 1.0 | **Status:** Proposed build specification | **Primary chain:** Solana | **Brand:** Rillio (working codename only)  
**Brand line:** Small habits. Stronger financial futures.  
**Decision rule:** Where a provider, jurisdiction, credential, legal interpretation or production secret is unavailable, the agent must implement an honest integration boundary and report the blocker. It must never fabricate success.

# 0. Executive direction

Rillio connects everyday financial behaviour with a clearer path toward saving and asset ownership. It is neither a spreadsheet budget app with a token price widget nor a high-pressure social trading venue.

**Core loop:** Earn → Spend → Understand → Plan → Save → Own → Review.

Rillio turns financial activity into understandable feedback. It shows where money goes, helps people define goals, explains how habits affect those goals, aggregates assets they own or track, and makes verified onchain assets accessible through user-controlled wallet connections.

## 0.1 Product thesis

Consumers experience spending, saving and investing in separate products. That fragmentation makes it difficult to connect today's behaviour to tomorrow's financial position. Rillio creates one financial home where imported or provider-sourced transactions become useful insights, user-defined rules turn insight into a plan, wallet integrations make asset ownership visible, and education helps users understand portfolio changes without promising returns.

## 0.2 Initial customer and wedge

**Initial customer hypothesis:** digitally comfortable early-career earners and independent professionals who use mobile-first services, want to build savings, and are curious about investing but dislike fragmented or intimidating interfaces.

**First wedge:** transaction-to-goal experience using real CSV-imported financial history, meaningful categorisation, user-defined savings rules and read-only Solana portfolio visibility. The first release does not need to custody money or operate a securities marketplace. Validate the customer hypothesis through interviews and usage evidence.

## 0.3 Why Solana

Solana is the asset ownership and settlement rail where relevant, not a database for every product record. Use it for supported wallet ownership, onchain asset visibility, user-authorized transactions when later approved, and optional stablecoin payments. Keep private bank transaction detail, identity, goals, most analytics and social preferences offchain.

## 0.4 Product principles

1. User control first: no hidden transfers, automatic trades, secret approvals or backend custody.
2. Truthful money language: projected savings are not funds held; an asset displayed is not necessarily liquid or redeemable.
3. Explainability: show source, date, confidence and calculation behind insights.
4. Calm engagement: reward healthy habits, not trading frequency, leverage, FOMO or public profit rankings.
5. Privacy by default: financial data, wallet addresses and portfolios remain private until users deliberately share them.
6. No fake functionality: no production mocks, pretend bank syncs, simulated payment confirmations or silent fallbacks.
7. Composable delivery: start as a modular monolith; split services only when evidence supports it.
8. Compliance as a product gate: financial activities require qualified counsel and appropriate providers before release.

## 0.5 Initial non-goals

No bank/deposit-taking, brokerage, investment advice, exchange, custody, private key storage, Rillio investment token, yield product, derivatives, leverage, copy trading, autonomous trading, unverified real-world asset claims or global all-bank coverage at launch.

# A. PRODUCT REQUIREMENTS DOCUMENT

# 1. Positioning and business model

## 1.1 Positioning

For people who want everyday money habits to lead somewhere, Rillio is a personal finance and ownership companion connecting spending insight, savings goals and portfolio visibility in one understandable experience. Unlike standalone budgeting tools or trading-first apps, Rillio links daily behaviour to long-term progress while keeping users in control.

**Brand promise:** Make progress visible. Make ownership understandable. Keep control with the user.

## 1.2 Value proposition

| Audience | Job | Value |
|---|---|---|
| Everyday earner | Understand spending | Categorised transactions, recurring spend and trends |
| Goal-driven saver | Make a realistic plan | Goals, contribution tracking, scenarios |
| Curious investor | Understand existing assets | Portfolio overview, allocation and risk context |
| Solana user | View supported onchain assets | Wallet connection, balances, history, provenance |
| Social learner | Learn without blind copying | Opt-in ideas, source-linked discussions, watchlists |
| Independent earner | Manage irregular cash flow | Income variability, buffers and flexible goals |

## 1.3 Revenue model

**Free:** one workspace, limited CSV imports, basic spend categories/trends, limited goals, read-only wallet overview, basic explainers.

**Rillio Plus:** higher import limits, supported multi-account / multi-currency connections, advanced recurring spend, custom rules, multiple goals, scenario planning, portfolio analytics/alerts, exports and configurable notifications.

**Future, subject to review:** employer financial wellness, B2B tools, disclosed referral fees, paid integrations, permitted transaction fees, and issuer integrations with clear compensation disclosure.

**Prohibitions:** no hidden spread, no sale of identifiable financial activity, no implication that subscription buys returns, no rewards for leverage/trade frequency, no undisclosed sponsored ranking.

## 1.4 Competitive differentiation to prove

Rillio sits between personal finance, savings automation, portfolio aggregation and onchain asset interfaces. Its differentiation must be demonstrated, not asserted:

1. Shared financial narrative from cash-flow behaviour to savings goals to owned assets.
2. Pleasant consumer UX with serious financial data integrity.
3. Chain-aware ownership view without forcing a crypto-trader mental model.
4. Social discovery for learning and privacy, not PnL competition.
5. Explainable calculations, source provenance and user-controlled execution.

Refresh named competitor, pricing, market and geography research before investor submission. Never invent market-share or competitor feature claims.

# 2. Personas and journeys

## 2.1 Everyday Builder

Illustrative age 20–35, regular income, several subscriptions, variable discretionary spending. Wants an emergency buffer and a first meaningful savings habit. **JTBD:** help me understand my spending and choose a realistic amount to set aside without shaming me.

## 2.2 Curious Owner

Owns SOL, USDC or other supported tokens across wallets. Wants consolidated context and provenance. **JTBD:** help me understand assets in my wallet without taking control of my keys.

## 2.3 Social Learner

Follows creators and communities but is frustrated by noise, hindsight screenshots and pressure to copy trades. **JTBD:** help me assess an idea and its sources before deciding whether it matters.

## 2.4 Variable-Income Earner

Freelancer / creator with uneven income. Wants flexible goals and buffers. **JTBD:** help me adjust my plan without assuming every month is identical.

## 2.5 Primary journey: first useful insight

1. Explain Rillio on landing page.
2. Create account.
3. Choose locale, timezone and base currency.
4. Choose supported provider connection or CSV.
5. Explain requested permissions.
6. Import real data.
7. Validate rows and flag ambiguity.
8. Review/correct categories.
9. Display cash flow, major categories and recurring candidates.
10. Create a goal with a clearly labelled plan, not held cash.

**Acceptance:** no silent row loss; rejected rows are visible/exportable; totals reconcile to accepted rows; revocation/deletion follows the documented policy.

## 2.6 Wallet journey

1. Explain read-only wallet visibility.
2. Select Wallet Standard-compatible wallet.
3. Connect without requesting a transfer.
4. If proof is needed, create a short-lived, domain-bound one-use signing challenge.
5. User sees exact signed message and purpose.
6. Backend verifies signature/domain/nonce/expiry/replay.
7. Store association only after verification.
8. Index supported balances/activity.
9. Show price provenance and timestamp; unknown tokens unverified.
10. Disconnect and stop polling.

**Acceptance:** connecting does not sign a transaction, private keys never reach Rillio, portfolio is private by default.

## 2.7 Future investment / payment journey

Disabled in MVP. Only release after provider, jurisdiction, legal, custody, security and disclosure gates. Show instrument/issuer/rights/liquidity/fees/settlement/risks/eligibility; obtain live terms; require explicit authorization; record signature and states separately; reconcile settlement; never duplicate on retry.

# 3. Information architecture

## Public
`/`, `/how-it-works`, `/security`, `/pricing`, `/learn`, `/legal/terms`, `/legal/privacy`, `/legal/risk`, `/legal/cookies`, `/status`, `/help`.

## Authenticated
`/app`, `/app/activity`, `/app/activity/import`, `/app/goals`, `/app/goals/new`, `/app/goals/[id]`, `/app/portfolio`, `/app/portfolio/assets/[assetId]`, `/app/wallets`, `/app/wallets/[id]`, `/app/discover`, `/app/discover/[slug]`, `/app/insights`, `/app/notifications`, `/app/profile`, `/app/settings/security`, `/app/settings/privacy`, `/app/settings/connections`, `/app/settings/billing`, `/app/settings/currency`.

## Operations (separate app/auth boundary)
`/ops`, `/ops/imports`, `/ops/providers`, `/ops/chain`, `/ops/payments`, `/ops/risk`, `/ops/audit`, `/ops/feature-flags`, `/ops/support`. Admin must never edit balances directly; corrections use auditable compensating actions with actor, reason, approval and evidence.

# 4. Functional requirements and acceptance criteria

Priority: P0 = launch blocker; P1 = next phase; P2 = later. Every item needs tests and observable evidence.

## 4.1 Identity

- **FR-AUTH-001 P0:** register, authenticate, logout, recover. Secure HttpOnly SameSite cookies, rotation, server revocation, no account enumeration.
- **FR-AUTH-002 P0:** MFA/passkeys where supported; recent authentication for sensitive changes; session/device list and revocation.
- **FR-AUTH-003 P0:** wallet connection is distinct from login and transaction authorization; read-only connect never requests signing.
- **FR-AUTH-004 P0:** role/attribute access for user/support/operator/admin; ownership checks on every route; time-bound logged admin elevation.

## 4.2 Financial ingestion

- **FR-DATA-001 P0:** CSV import with explicit/detected mappings; date, amount, currency, description, merchant, optional account; malformed rows surfaced; duplicate import idempotent; quarantined processing.
- **FR-DATA-002 P0:** preserve immutable/versioned raw evidence separately from normalized transaction records; store source, import ID and normalizer version.
- **FR-DATA-003 P1:** provider adapters only in markets with verified coverage and agreements; explicit consent, encrypted credentials, signed webhooks, refresh/revoke, historical data retained per policy.
- **FR-DATA-004 P0:** no float money math; integer minor units or exact decimal + ISO currency/scale; FX source and quote timestamp persisted.
- **FR-DATA-005 P0:** provider IDs preferred; otherwise deterministic fingerprint with collision safeguards and possible duplicate review.

## 4.3 Categorization and cash flow

- **FR-CAT-001 P0:** deterministic categories; user correction overrides merchant defaults; versioned rationale; uncategorized records visible; bulk edit.
- **FR-CAT-002 P1:** optional ML/LLM suggestions with confidence and review; low confidence stays uncategorized; minimize sensitive text; no money movement.
- **FR-CASH-001 P0:** inflow/outflow/net/category views; explicit pending/refund/transfer treatment and time zone.
- **FR-CASH-002 P1:** recurring detection with evidence/confidence and confirm/dismiss; forecasts labelled estimates.
- **FR-CASH-003 P1:** changes explained with source transaction groups, formula and comparison period.

## 4.4 Goals

- **FR-GOAL-001 P0:** create/edit/pause/archive goals with validated amount, currency, dates, starting amount and contribution plan.
- **FR-GOAL-002 P0:** deterministic versioned projections; no guaranteed return; no implicit yield.
- **FR-GOAL-003 P0:** planned allocation distinct from actual held funds; only verified settlement can mark transfer completed.
- **FR-GOAL-004 P1:** user-defined rules simulated against history; buffers and limits; no execution in MVP.

## 4.5 Solana

- **FR-CHAIN-001 P0:** current Kit/React wallet connection; handle connect/disconnect/account change/unsupported wallet.
- **FR-CHAIN-002 P0:** read SOL and supported SPL/Token-2022; validate mint/program/decimals; RPC failure is stale, not zero.
- **FR-CHAIN-003 P0:** portfolio valuation with provider/timestamp/staleness/missing-price state; never fabricate price.
- **FR-CHAIN-004 P1:** history with signature, slot, timestamp, status, reliable decoded counterparty, token delta and explorer link; unknown instruction labelled.
- **FR-CHAIN-005 P0:** one-time domain-bound wallet challenge; hashed nonce; replay/wrong-domain/expired signatures rejected.
- **FR-CHAIN-006 P2:** multi-chain only after Solana data accuracy and retention prove demand.

## 4.6 Social / education

- **FR-SOC-001 P1:** source-linked posts/watchlists/explainers; disclosures; moderation/reporting.
- **FR-SOC-002 P1:** privacy independently controlled; default private; caches respect changes.
- **FR-SOC-003 P1:** no copy trading or execution from another user's post; no short-term PnL leaderboard.
- **FR-SOC-004 P1:** disclose sponsorship; quality/safety moderation; mute/block/report.

## 4.7 Notifications

- **FR-NOT-001 P0:** durable in-app notifications for import, goals, wallet and security; event-linked and idempotent.
- **FR-NOT-002 P1:** configurable email/push, quiet hours, locale, unsubscribe; separate security vs marketing.
- **FR-NOT-003 P1:** milestones reward planning/learning, not trade volume/risk; disable animation.

## 4.8 Payments / billing

- **FR-PAY-001 P0 for paid launch:** subscription checkout, webhooks, cancellation, invoices and entitlement reconciliation; browser redirect never grants access.
- **FR-PAY-002 P1:** USDC checkout only after server checks signature, exact amount, mint, recipient, reference and confirmation/finality; replay/wrong token rejected.
- **FR-PAY-003 P2:** transfers or investment execution only after legal/provider/custody/security review and explicit confirmation of asset, amount, destination, network, fee and risk.

## 4.9 Privacy / support

- **FR-PRIV-001 P0:** dated/versioned granular consent; revoke stops future provider access and starts cleanup.
- **FR-PRIV-002 P0:** protected export and deletion request with documented legal retention handling.
- **FR-SUP-001 P0:** support workflow masks financial detail by default; reason-coded/audited staff access.

# 5. Non-functional requirements

Targets are initial engineering objectives, not claims about current performance.

| Area | Target | Verification |
|---|---|---|
| Availability | 99.9% monthly after public launch | SLIs/incidents |
| API latency | p95 <400 ms cached/read CRUD, excluding provider/RPC | Load test/tracing |
| Dashboard shell | <2 s p75 on supported broadband devices | RUM |
| Import | 100k CSV rows async without request timeout | Worker load test |
| Integrity | No silent loss; idempotent duplicates | Reconciliation/property tests |
| Security | No unresolved critical/high exploitable findings | Security scans/penetration test |
| Recovery | Initial RPO 5 min, RTO 60 min | Restore exercise |
| Accessibility | WCAG 2.2 AA target | Automated + manual |
| Scale envelope | 100k registered / 10k DAU initial design target | Capacity test |
| Observability | Trace import, billing and chain flows | Distributed traces |
| Privacy | Least data, private by default, access audited | Threat model/tests |

Performance: cursor pagination, cache with freshness metadata, no unbounded RPC in request handlers, no N+1 queries, indexed filters, async ingestion and measured bundle / image budgets.

Reliability: explicit deadlines, bounded retries, circuit breakers, transactional outbox, inbox deduplication, typed DLQ, encrypted backups and tested restores. Never retry a non-idempotent financial action without reconciliation.

# 6. Roadmap

## Phase 0: discovery
12–20 user interviews; selected geography and activity matrix; provider feasibility for bank aggregation/pricing/billing; prototype tests with five users; threat model; ADRs. Exit: first user/job/geography and product boundaries recorded.

## Phase 1: two-week functional MVP
1. Auth/profile.
2. Real CSV upload, parse, validate, dedupe, import history.
3. Deterministic categories and correction.
4. Cash-flow/category trends.
5. Savings plans clearly marked as plans.
6. Read-only Solana wallet/token visibility.
7. Price provenance / missing quote states.
8. Privacy/export/deletion request workflow.
9. Responsive web and operational logs.
10. Staging and E2E tests.

Exclude bank OAuth, custody, transfers, trading, security issuance, AI advice, social publishing, token launch and native mobile. Exit: a test user imports own data, corrects it, gets insight, creates a goal and connects read-only wallet; core paths pass E2E/privacy/security tests.

## Phase 2: V1 (weeks 3–8, conditional)
One verified market provider, recurring spend, goal buffers, portfolio history/activity, notifications, subscription entitlements, ops console, security review/runbooks/penetration test.

## Phase 3: V2 (months 3–6)
Social learning/private watchlists, explainable optional ML, more wallet/asset sources, USDC billing where appropriate, mobile if retention proves need, employer/creator distribution.

## Phase 4: expansion (6–18 months)
More jurisdictions/currencies/providers; regulated investment execution through licensed partners if justified; properly diligenced tokenized assets; B2B APIs; multi-chain only with user demand. Each has separate release gate.

# 7. KPIs

**North star: Weekly Active Financial Progress Users (WAFPU)** = weekly users who complete one meaningful user-controlled action: review cash-flow insight, correct categorization, update goal or review portfolio change. Opens, price refreshes and feed scrolling do not count.

Activation: signup completion, first import, time to first insight, category correction, first goal, wallet connection after permission explanation.

Retention: D1/D7/D30 by cohort, WAFPU, goal review frequency, repeat sync/import, useful insight rating, notification opt-out.

Trust/quality: import acceptance/rejection, duplicate rate, category correction rate, provider freshness, indexer lag, valuation coverage, payment exceptions, privacy request completion and security incidents.

Business: free-to-paid, MRR, NRR, gross margin, CAC, payback, cancellations/refunds and support cost.

Guardrails: misleading projection complaints, unauthorized sharing, duplicate charge, plan mistaken as held funds, social-pressure reports and undisclosed sponsorship.

---
# B. COMPLETE DESIGN SYSTEM

# 8. Brand identity

**Naming warning:** Rillio is a working codename for the design package, not the recommended final public name. Preliminary web screening found an existing media application under the exact name and unrelated digital-currency uses. Do not register a company, buy domains, publish or file the mark under this name without formal clearance; preferably select a replacement before public launch.

**Name:** RILLIO (working name)  
**Tagline:** Small habits. Stronger financial futures.  
**Short description:** The financial progress app connecting spending, saving and ownership.

Voice: clear, calm, capable, human; optimistic without promising wealth; intelligent without sounding like a trading terminal; encouraging without shaming; transparent about uncertainty and incomplete data. Avoid “get rich”, “guaranteed”, “risk-free”, “100x”, “moon”, “copy this trade”, artificial scarcity and pressure countdowns.

## 8.1 Logo concept and deliverables

The symbol is a continuous flowing ribbon forming an abstract R. Two linked paths represent everyday movement and long-term progress; negative space creates a river-like channel. It must remain legible at 16 px.

Deliver primary horizontal, stacked, standalone icon/app icon, light/dark, monochrome, 16/32 px favicon, editable SVG masters, clear-space/minimum-size guidance and favicon/app export sizes. Never approximate a third-party logo. Trademark and visual clearance are required before public launch.

## 8.2 Colour tokens

### Dark theme

| Token | Hex | Use |
|---|---|---|
| `ink-950` | `#080E19` | App background |
| `ink-900` | `#0B1422` | Main canvas |
| `ink-850` | `#111D2D` | Elevated background |
| `ink-800` | `#172538` | Cards / panels |
| `ink-700` | `#25364B` | Borders / separators |
| `slate-500` | `#73849A` | Muted icons / disabled |
| `slate-300` | `#AAB7C7` | Secondary text |
| `paper-100` | `#F4F7F7` | Primary text |
| `lime-400` | `#C5F36A` | Primary action / progress |
| `mint-400` | `#62E0B5` | Secondary accent |
| `aqua-400` | `#64CFE0` | Informational data |
| `violet-400` | `#9B8AFB` | Discovery accent |
| `success-500` | `#39C98A` | Success |
| `warning-500` | `#F3B95F` | Warning |
| `danger-500` | `#F16D79` | Error / destructive |

### Light theme

| Token | Hex | Use |
|---|---|---|
| `canvas-50` | `#F6F8F7` | Background |
| `surface-0` | `#FFFFFF` | Main card |
| `surface-100` | `#EEF3F1` | Secondary surface |
| `surface-200` | `#E1EAE6` | Dividers |
| `text-900` | `#101A22` | Primary text |
| `text-700` | `#40515B` | Secondary text |
| `text-500` | `#71828B` | Muted text |
| `brand-700` | `#215C4C` | Primary action/text |
| `brand-500` | `#6F9E43` | Accent |
| `focus-500` | `#247DC1` | Focus ring |

Semantic meaning must never depend on colour alone. Positive/negative performance states also need labels and icons.

## 8.3 Gradients

- `gradient-brand`: `linear-gradient(120deg, #C5F36A 0%, #62E0B5 100%)`.
- `gradient-flow`: `linear-gradient(135deg, #62E0B5 0%, #64CFE0 50%, #9B8AFB 100%)`.
- `gradient-hero`: two restrained mint/violet radial glows over `#080E19`.
- `gradient-success`: reserved for confirmed progress.

Use gradients as accents, not the foundation of every card. Never use gradient body text or low-contrast decorative fills.

## 8.4 Typography

- Display: Space Grotesk, weight 500–700.
- Interface: Inter, weight 400–650.
- Numeric: Inter tabular figures (`font-variant-numeric: tabular-nums`).
- Fallback: system-ui, sans-serif.

| Style | Size / line height | Weight |
|---|---|---|
| Display XL | 48 / 56 px | 600 |
| Display L | 40 / 48 px | 600 |
| H1 | 32 / 40 px | 650 |
| H2 | 24 / 32 px | 600 |
| H3 | 20 / 28 px | 600 |
| H4 | 16 / 24 px | 650 |
| Body L | 16 / 24 px | 400 |
| Body | 14 / 21 px | 400 |
| Caption | 12 / 18 px | 450 |
| Numeric XL | 36 / 44 px | 600 |
| Numeric M | 24 / 32 px | 600 |

Align financial figures; keep decimal precision consistent and include currency labels where ambiguous.

## 8.5 Spacing, radii and elevation

4 px base spacing; scale 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80. Radii: 8 px controls, 12 px inputs, 16 px cards, 24 px hero panels, 999 px pills. Borders 1 px semantic; dark theme edges use subtle white-alpha and deep shadow. Max content width 1440 px, reading width 720 px, desktop sidebar 248/76 px, gutters 32 desktop / 20 tablet / 16 mobile.

## 8.6 Iconography and custom glyphs

Use Lucide as baseline, consistent 1.75 px stroke and 20/24 px sizes. Custom Rillio glyphs:

- `Flow`: two joined curves (cash flow).
- `Goal`: concentric arc + endpoint (savings goal).
- `Orbit`: ring + dot (portfolio / ownership).
- `Pulse`: three-step waveform (habit insight).
- `Source`: document corner + link node (data provenance).
- `Shield`: rounded shield with river line (security).
- `Spark`: four-point spark (milestone; use sparingly).

Deliver SVG and React wrappers. Decorative icons never replace labels on financial/safety-critical controls.

## 8.7 Illustration direction

Abstract flowing forms, layered surfaces, restrained 3D geometry and editorial lifestyle photography. Avoid luxury-car/cash/rocket/casino imagery. Charts must visualize real data, not decorative made-up balances. Empty illustrations use river lines, open paths, wallet outlines or goal markers.

# 9. UI component library

Every component supports light/dark theme, keyboard navigation, reduced motion, focus-visible and accessible names.

| Component | Variants / behaviour |
|---|---|
| `Button` | Primary, secondary, tertiary, danger, quiet; loading/disabled/icon-only |
| `IconButton` | Tooltip desktop, accessible name |
| `TextField` | Label, hint, error, prefix/suffix, clear, counter |
| `MoneyInput` | Currency selector, exact decimal parsing, locale formatting |
| `Select` | Search, groups, keyboard navigation |
| `DateRangePicker` | Locale/time-zone aware, presets and custom range |
| `Card` | Default, raised, interactive, outlined, compact |
| `MetricCard` | Value, comparison window, trend and timestamp |
| `ChartCard` | Chart, accessible summary and table alternative |
| `TransactionRow` | Merchant, category, date, amount, status, source |
| `TransactionDetail` | Original description, normalized fields, history, provenance |
| `GoalProgress` | Planned amount, target, date; distinguish plan vs held |
| `WalletBadge` | Network, shortened address, status, verification |
| `AssetRow` | Mint identity, verification, quantity, quote timestamp, confidence |
| `PriceChange` | Signed amount/percentage, period, accessible label |
| `SourceChip` | Provider, timestamp, fresh/stale/unverified |
| `ConsentCard` | Scope, provider, granted date, revoke |
| `NotificationItem` | Icon, title/body, time, unread, deep link |
| `InlineAlert` | Info/success/warning/error, action and dismiss policy |
| `Skeleton` | Shape-matched; no shimmer under reduced motion |
| `EmptyState` | Plain explanation and next action |
| `ErrorState` | Human explanation, reference, retry/support |
| `ConfirmSheet` | Action, amount, network, recipient, fee, confirm |
| `DataTable` | Cursor pagination, sort, responsive card mode |
| `PrivacyVisibilityControl` | Private/selected/public with visible current state |

## 9.1 Motion

| Token | Duration | Use |
|---|---:|---|
| `motion-fast` | 120 ms | Hover, press, icon toggle |
| `motion-base` | 180 ms | Buttons, dropdown, tabs |
| `motion-panel` | 240 ms | Drawer/modal/card expansion |
| `motion-data` | 320 ms | Chart reveal, progress update |
| `motion-celebrate` | 500 ms max | User-controlled milestone |

Use `cubic-bezier(0.2,0.8,0.2,1)` for entrances and `cubic-bezier(0.4,0,1,1)` for exits. Avoid parallax on financial data and endless movement. Respect `prefers-reduced-motion`, replacing motion with static states or subtle fades.

## 9.2 Loading states

- **App shell:** stable logo mark; navigation and metric skeletons match final geometry.
- **Import:** Uploading → Validating → Normalizing → Deduplicating → Ready. Percentages only when measurable; otherwise show stage labels.
- **Wallet:** “Waiting for wallet approval” plus cancel; never fake approval.
- **Portfolio refresh:** show last updated timestamp; retain last-known data with stale label.
- **Checkout:** show provider approval and return state; activate entitlement only after server verification.
- **Charts:** preserve axes and skeleton bands; never show random values.

## 9.3 Empty states

| State | Copy | Action |
|---|---|---|
| No transactions | “Your money story starts here.” | Import transactions |
| No goals | “Give your next milestone a name.” | Create a goal |
| No wallet | “Connect a wallet to view supported Solana assets. Rillio cannot access your private keys.” | Connect wallet |
| No priced assets | “We can see this asset, but do not have a reliable price.” | View source |
| No insights | “More history will help us spot useful patterns.” | Import more history |
| No follows | “Follow ideas, not instructions.” | Explore learning feed |
| No notifications | “You're all caught up.” | Go home |

## 9.4 Error/recovery UX

Every error says what happened, whether anything changed and the safest next action. Never show stack traces, SQL or provider secrets.

- CSV failure: row and field, rejected-row report, retention explanation.
- Provider outage: last success time, retry and manual import.
- Wallet rejected: say nothing was sent only when no transaction was submitted.
- Transaction pending: signature/state/explorer link; do not offer retry until status and blockhash checked.
- Transaction failed: distinguish user rejection, simulation failure, program failure, expiry and unknown outcome.
- Payment reconciliation pending: reference and support path; no entitlement yet.
- Stale price: timestamp, suppress invalid percentage changes.
- Permission denied: explain the required role without disclosing protected information.

## 9.5 Responsive behaviour

**Desktop >=1200:** fixed sidebar, 12-column grid, 2–3 column overview, right-side transaction panel.  
**Tablet 768–1199:** collapsible sidebar/top nav, 8-column grid, two-column cards, full-height detail sheet.  
**Mobile <768:** bottom nav, four-column grid, full-screen critical action sheets, transaction cards instead of default horizontal scrolling, charts with accessible summaries, visible full-width CTA.

---
# C. APPLICATION ARCHITECTURE

# 10. Architecture overview

## 10.1 Recommended topology

Use a **modular monolith plus independently deployable workers**. It gives a small team one API deployment and shared domain types while preserving boundaries for later extraction.

```text
[ Next.js Web ]       [ Future Expo Mobile ]
       |                       |
       +------ HTTPS / OIDC ----+
                  |
             [ API / BFF ]
                  |
        [ TypeScript Modular API ]
                  |
  +--------+------+------+---------+--------+
  |        |      |      |         |        |
 Auth   Finance Goals Portfolio  Billing  Social
  |        |      |      |         |        |
  +--------+------+------+---------+--------+
                  |
  +---------------+---------------+
  |               |               |
[Postgres]      [Redis]       [Object Store]
  |               |               |
[Outbox/Inbox] [Queue workers] [CSV quarantine]
                  |
       +----------+-----------+
       |          |           |
 [Bank API] [Solana RPC] [Billing API]
       |          |           |
   Webhooks   Chain jobs   Webhooks
       +----------+-----------+
                  |
       [Observability / Audit]
```

## 10.2 Monorepo layout

Use pnpm workspaces + Turborepo or the repository's proven equivalent. Do not force a rewrite if an existing project is sound.

```text
rillio/
  apps/
    web/                  # Next.js App Router
    api/                  # TypeScript API (Fastify or NestJS)
    worker/               # Background job consumers
    ops/                  # Separate operator UI/auth policy
    mobile/               # Future Expo client
  packages/
    ui/                   # Design system/tokens
    config/               # Shared config/env schema
    contracts/            # API/event schemas/generated clients
    domain/               # Pure domain logic/value objects
    db/                   # Schema/migrations/repositories
    auth/                 # OIDC/session/wallet verification
    solana/               # Kit/RPC/indexer adapters
    providers/            # Bank/billing/pricing adapters
    analytics/            # Event definitions/metrics
    observability/        # Logging/tracing/redaction
    testing/              # Factories/test adapters
  infra/                  # Docker, IaC, deployment, monitoring
  docs/                   # ADRs, architecture, runbooks, threat model, API
  scripts/
  .github/workflows/
```

## 10.3 Backend framework

Preferred TypeScript API: Fastify with strict module/plugin architecture, or NestJS if the team/repository already uses it effectively. Choose one in an ADR. Use OpenAPI 3.1 generated from runtime schemas (Zod/TypeBox/equivalent). Validate at boundaries and use typed domain commands internally. Avoid unvalidated JSON in core services.

## 10.4 Domain boundaries

1. Identity: users, sessions, devices, passkeys, auth challenges.
2. Consent/privacy: provider scopes, wallet visibility, export/deletion.
3. Financial connections: provider lifecycle and webhooks.
4. Transactions: raw records, normalization, dedupe, categories.
5. Insights: aggregates, recurring candidates and explanations.
6. Goals: targets, projections, planned allocations and history.
7. Wallets: association, SIWS challenges and permissions.
8. Portfolio: metadata, balance snapshots, pricing and valuation provenance.
9. Social/education: posts, follows, disclosures, reports and moderation.
10. Billing: plans, checkout, subscriptions, invoices, entitlements.
11. Payments: intents and settlement verification, separate from billing.
12. Notifications: preferences, templates, delivery and suppression.
13. Operations: audit, support access, reconciliation, feature flags and incidents.

Modules communicate through typed interfaces and versioned domain events. Avoid circular imports and direct cross-module table writes.

# 11. Data model and constraints

PostgreSQL is source of truth. Check migrations into source control. Store UTC timestamps (`timestamptz`), original time zone where relevant and ISO currency codes.

## 11.1 Core tables

| Table | Key fields / purpose |
|---|---|
| `users` | id, identity subject, status, created/deleted timestamps |
| `user_profiles` | user, display name, locale, timezone, base currency |
| `user_preferences` | notification, theme, privacy preferences |
| `sessions` | session hash, user, device, expiry, revoked_at |
| `auth_challenges` | nonce hash, domain, purpose, expiry, consumed_at |
| `consents` | user, provider, scope, policy version, granted/revoked timestamps |
| `financial_connections` | user, provider, external ref, status, scopes, last sync |
| `provider_credentials` | encrypted credential reference, rotation metadata; no plaintext tokens |
| `import_jobs` | user, object key, status, row counts, error report key |
| `raw_transactions` | source hash/payload ref, source row, external ID, provenance |
| `transactions` | normalized account/date/amount_minor/currency/direction/merchant/category/status |
| `transaction_category_history` | transaction, category, actor, reason, model/rule version, timestamp |
| `merchants` | canonical merchant, aliases, confidence/source |
| `categorization_rules` | user, condition, category, priority, enabled |
| `cashflow_snapshots` | user, period, currency, totals, calculation version |
| `goals` | user, target_minor, currency, target date, status, planned amount |
| `goal_events` | goal, type, amount, actor, source, created_at |
| `wallets` | user, chain, address, verification, visibility, disconnected_at |
| `chain_observations` | signature, slot, block time, status, provider provenance |
| `token_accounts` | wallet, mint, token program, base-unit amount, decimals, snapshot time |
| `assets` | chain, mint, metadata source, verification, issuer/source |
| `price_quotes` | asset, quote currency, exact price, source, timestamp, confidence/stale |
| `portfolio_snapshots` | wallet, snapshot time, totals, component provenance |
| `social_profiles` | user, handle, visibility, bio |
| `posts` | author, content, status, disclosures, moderation |
| `post_sources` | post, URL/reference, excerpt hash, source type |
| `follows` | follower/followed and timestamp |
| `reports` | reporter, target, reason, status, evidence |
| `plans` | plan code, features, price, currency, interval, version |
| `checkout_sessions` | provider, external ID, user, idempotency key, status |
| `subscriptions` | user, provider, status, current period, cancellation |
| `invoices` | provider invoice ref, amount, currency, state, paid_at |
| `payment_intents` | reference, payer, recipient, mint, amount, expiry, status |
| `payment_settlements` | signature, verified amount/mint/recipient/finality, reconciled_at |
| `entitlements` | user, feature, source subscription, effective interval |
| `notifications` | user, type, payload, source event, status, sent/read timestamps |
| `audit_events` | actor, action, resource, reason, request ID, time, tamper evidence |
| `idempotency_keys` | key, scope, request hash, response ref, expiry |
| `outbox_events` | aggregate, event type, schema version, payload, published_at |
| `inbox_events` | source, external event ID, payload hash, processed_at |
| `job_attempts` | job, attempt, error code, start/end |

## 11.2 Integrity rules

- Every user-owned row has `user_id` or a foreign-key path to it.
- Use composite unique constraints for tenant-scoped identifiers.
- RLS is defense-in-depth, not a substitute for API authorization.
- Money uses BIGINT minor units where safe, NUMERIC or exact decimal strings. Never JS `number` for money.
- Token base units use integer strings / NUMERIC; do not round during storage.
- Raw source evidence is immutable / versioned; categorization never overwrites source.
- Define PII deletion/crypto-shredding policy, legal hold and retention per source.
- No admin endpoint directly overwrites financial state.

## 11.3 Indexes

- `transactions(user_id, occurred_at DESC, id)`
- `transactions(user_id, account_id, occurred_at DESC)`
- `transactions(user_id, category_id, occurred_at DESC)`
- unique `(user_id, source_provider, external_transaction_id)` where non-null
- `import_jobs(user_id, created_at DESC)`
- `chain_observations(signature)` unique
- `price_quotes(asset_id, quote_currency, observed_at DESC)`
- `notifications(user_id, created_at DESC, read_at)`
- partial unpublished outbox index
- unique `(source, external_event_id)` inbox index
- `audit_events(resource_type, resource_id, created_at DESC)`

Validate with actual query plans; do not index every field speculatively.

## 11.4 Financial ledger boundary

In the non-custodial MVP, goal allocations are planning records, not money balances. Do not implement a pretend cash ledger. If Rillio later controls customer funds, create a separate double-entry ledger domain with immutable journal entries, accounts, debit/credit balancing, posting state, compensating reversals, settlement references, reconciliation, approvals and independent audit. Never reuse `goal_events` as a custody ledger.

# 12. API design

Use `/v1`, JSON, OpenAPI-generated types and RFC 7807-style errors extended with stable machine codes, request IDs and field errors. Money-related endpoints require auth, ownership and idempotency as applicable.

## 12.1 Core endpoints

**Identity:** `GET /v1/me`; `PATCH /v1/me/preferences`; `GET /v1/me/sessions`; `DELETE /v1/me/sessions/{sessionId}`; `GET /v1/me/consents`; `POST /v1/me/data-export`; `POST /v1/me/deletion-request`.

**Imports/transactions:** `POST /v1/imports`; `POST /v1/imports/{id}/complete`; `GET /v1/imports/{id}`; `GET /v1/imports/{id}/errors`; `GET /v1/transactions`; `GET /v1/transactions/{id}`; `PATCH /v1/transactions/{id}/category`; `POST /v1/transactions/bulk-category`.

**Goals:** `GET/POST /v1/goals`; `GET/PATCH /v1/goals/{id}`; `POST /v1/goals/{id}/pause`; `POST /v1/goals/{id}/archive`; `POST /v1/goals/{id}/simulate` (plan-only).

**Wallet/portfolio:** `POST /v1/wallet-challenges`; `POST /v1/wallets/verify`; `GET /v1/wallets`; `DELETE /v1/wallets/{id}`; `POST /v1/wallets/{id}/refresh`; `GET /v1/portfolio/summary`; `GET /v1/portfolio/assets`; `GET /v1/portfolio/activity`.

**Billing:** `GET /v1/billing/plans`; `POST /v1/billing/checkout-sessions`; `GET /v1/billing/subscription`; `POST /v1/billing/subscription/cancel`; `GET /v1/billing/invoices`.

**Social/notifications:** `GET /v1/discover`; `POST /v1/posts`; `POST /v1/posts/{id}/report`; `PUT/DELETE /v1/users/{id}/follow`; `GET /v1/notifications`; `PATCH /v1/notifications/{id}/read`.

## 12.2 Error envelope

```json
{
  "type": "https://api.rillio.example/problems/validation-error",
  "title": "The request could not be processed",
  "status": 422,
  "code": "TXN_IMPORT_INVALID_COLUMN_MAPPING",
  "detail": "Map a date column and an amount column before continuing.",
  "requestId": "req_...",
  "retryable": false,
  "fieldErrors": [{ "field": "mapping.date", "code": "REQUIRED", "message": "Choose a date column." }]
}
```

Do not expose service names, SQL, stack traces, secrets, credential-bearing RPC URLs or raw provider errors.

## 12.3 Pagination

Cursor-based for transactions/posts/assets/audit; stable sort with tie-breaker ID; server-enforced max size; allowlisted filters; opaque/signed cursor scoped to user; return `nextCursor`, `hasMore`, `asOf`, `dataFreshness` as relevant.

# 13. Events and jobs

```text
Provider webhook / CSV upload / RPC observation
       → validate source → persist immutable evidence
       → inbox dedupe + transactional outbox → queue
       → parse → normalize → enrich → categorize
       → validate → reconcile → persist → versioned event
       → read model / notifications / analytics
```

Event envelope: `id`, `type`, `occurredAt`, `producer`, `tenantId`, `correlationId`, `schemaVersion`, `data`. Avoid raw descriptions, tokens and secrets in general-purpose events.

Jobs: `csv.parse`, `csv.normalize`, `transactions.dedupe`, `transactions.categorize`, `provider.sync`, `provider.webhook.process`, `wallet.scan`, `wallet.refresh`, `portfolio.price.refresh`, `portfolio.snapshot`, `billing.webhook.process`, `payment.reconcile`, `notification.deliver`, `privacy.export`, `privacy.delete`, `analytics.aggregate`.

Retry transient network errors, 429 and selected 5xx with exponential backoff + full jitter; respect `Retry-After`. Suggested bounded sequence 1/2/4/8/16 seconds plus jitter then DLQ, subject to provider limits. Do not retry validation/authorization/signature/business-rule failures. For submitted chain tx, query signature and blockhash validity before rebuild; never blindly submit another transfer. Every job has timeout, cancellation, attempt cap, structured error and idempotency key.

Outbox: commit domain row and event in one DB transaction; publisher leases/publishes at-least-once; consumers dedupe through inbox; ack only after durable effect; DLQ replay requires reason, actor and audit record.

# 14. Solana architecture

## 14.1 Current client stack

Use current official packages: `@solana/kit` for RPC/transactions/codecs/signers; `@solana/kit-plugin-rpc`; `@solana/kit-plugin-wallet`; `@solana/react`; generated `@solana-program/*` clients. Consider `@solana/keychain` only for a real backend signing requirement after a security design; do not add backend signing by default. Pin compatible versions and re-check the official docs at implementation time.

## 14.2 Read-only wallet path

Browser discovers Wallet Standard wallets → user selects → client obtains public address/capabilities → backend stores association after appropriate proof → scanner reads native/token accounts → parser validates token program/mint/decimals/owner → metadata service checks provenance/spam → pricing adapter returns quotes → portfolio snapshot persists provenance → UI displays stale/unverified/unpriced states.

Never infer token authenticity from symbol/logo. Mint address and token program are canonical identifiers.

## 14.3 RPC resilience

- No public shared RPC in production.
- Use production RPC with documented limits plus independent fallback.
- Separate reads, submissions and websocket workloads as necessary.
- Deadlines, rate limits, circuit breakers.
- Persist signature/slot cursors and resume without gaps.
- Reconcile indexer state with RPC periodically.
- Track provider lag, websocket disconnects and error rates.
- If sources disagree, mark degraded; do not choose an arbitrary balance.

## 14.4 Future transaction execution

Only after launch gates: build from trusted versioned instructions; validate destination, mint, amount, decimals, fee payer and account ownership; simulate; estimate priority fee with visible maximum; show a human-readable summary; user signs; submit via production RPC; persist signature/blockhash; track `submitted → processed → confirmed → finalized` or failed/expired/unknown; reconcile balances; resolve unknown before retry. Solana fees can still be charged on failed transactions, so UI must disclose that possibility.

## 14.5 Custom program policy

No Anchor/Rust program for MVP. Existing primitives and backend services are sufficient. Add a custom program only when a concrete requirement cannot be met otherwise. Then document authority/account constraints/upgrade authority/emergency pause; add invariant, fuzz and adversarial tests; use LiteSVM / Surfpool; reproducible build and verified deployment; independent review before mainnet.

## 14.6 Token-2022 / RWA

Extensions are optional and some combinations are incompatible. Choose only after requirements mapping. Transfer hooks add program execution to transfers; don't use as decoration or speculative tokenomics. For RWA, verify issuer identity, legal rights, custody, transfer restrictions, valuation, distribution eligibility, redemption, insolvency treatment and jurisdiction. Chain data alone does not establish these facts.

# 15. Payments, billing and monetization

Provider contract examples:

```ts
interface BillingProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  getSubscription(providerId: string): Promise<ProviderSubscription>;
  cancelSubscription(providerId: string, atPeriodEnd: boolean): Promise<void>;
  verifyWebhook(rawBody: Uint8Array, headers: Headers): Promise<VerifiedWebhook>;
}

interface ChainPaymentVerifier {
  verifyPayment(input: {
    signature: string;
    expectedRecipient: string;
    expectedMint: string;
    expectedAmountBaseUnits: bigint;
    expectedReference: string;
    minimumCommitment: "confirmed" | "finalized";
  }): Promise<VerifiedPayment | VerificationFailure>;
}
```

These are contracts, not mock implementations. A real adapter needs real credentials and sandbox/live tests. Test adapters must be impossible to register in production.

Subscription lifecycle: `created → checkout_pending → active → past_due → grace_period → canceled/expired`. Webhook is a signal, not unquestioned truth. Verify, dedupe, fetch provider state if necessary, reconcile and update entitlement transactionally. Browser return URL never activates entitlement.

Solana USDC flow: server creates exact recipient/mint/amount/reference/expiry; UI displays token/network/amount/merchant; user approves; frontend submits signature as observation; server independently verifies transaction signature, recipient, mint, amount, reference and finality; unique signature/reference constraints prevent reuse; entitlement only after settlement; wrong/late/underpaid/overpaid payments enter an exception path. Never equate wallet popup success with settlement.

The official Solana payment quickstart documents validation of recipient, amount, token and unique reference; it currently labels `@solana/pay` beta. Isolate behind adapter and re-check maturity before production.

Monetization controls: central server entitlements; server-authoritative prices/tax; explicit proration/grace/retry/refund; visible renewal terms; regional providers only after coverage/settlement/chargeback/licensing review.

# 16. Security, privacy and regulatory readiness

Engineering controls only; this is not legal advice or certification.

## 16.1 Threat model

Account takeover, credential stuffing, session theft, malicious browser extension/compromised wallet, CSV formula injection/parser bombs, cross-tenant IDOR, webhook replay/forgery/out-of-order delivery, RPC/indexer manipulation, stale/spoofed token metadata, token spam/phishing, prompt injection/poisoned social sources, insider support access, secret leakage, dependency/CI compromise, duplicate payment on retry, social manipulation and undisclosed promotion.

## 16.2 Mandatory controls

TLS; encryption at rest for DB/backups/object store/secrets; scoped secret manager and rotation; OIDC/passkeys/MFA; secure session rotation and CSRF; rate limits; strict CORS/CSP/headers/output encoding; server-side object authorization; upload type/size/extension validation, quarantine and scanning where available; CSV formula injection protection on exports; signed webhook raw-body verification and replay prevention; wallet signature and nonce validation; step-up auth for financial actions; immutable audit; PII redaction; dependency pinning, lockfile checks, SAST/secret/container scanning and SBOM; backup encryption/restore tests; incident playbook.

## 16.3 Privacy

Collect minimum necessary data. Do not store bank login credentials; store encrypted provider tokens/reference. Avoid full transaction descriptions / wallet addresses in analytics. Keep portfolio private by default. Separate production support access. Provide access/export/correction/deletion workflows aligned to local law. Define retention. Do not use financial data for external model training without lawful basis, disclosures and consent where required.

## 16.4 Regulatory launch checklist

Before each activity in each jurisdiction obtain qualified local counsel/provider review for open banking and consent; payment initiation/money transmission/stored value/e-money; custody/safeguarding; securities/funds/brokerage/advice/financial promotion; tokenized asset issuance/distribution/redemption; KYC/AML/sanctions/monitoring/records; consumer credit/deposit/savings wording; privacy/cross-border/data localization/marketing; tax, disclosures and complaints. Never claim “regulated”, “licensed”, “compliant”, “insured”, “custody-safe” or “investment-ready” without precise entity/activity/permission/jurisdiction support and counsel approval.

# 17. Reliability / operations

Use OpenTelemetry-compatible metrics/traces/logs; correlate browser action → API → DB → outbox → worker → provider → chain signature. Metrics: API rate/error/latency/saturation; DB pool/locks/slow query/replica lag; queue depth/oldest age/retries/DLQ; import throughput/rejections; provider success/latency/auth/webhook lag; RPC health/slot lag/websocket reconnects; valuation freshness/unpriced ratio; billing reconciliation exceptions; auth anomalies. Logs structured JSON and redacted; high-cardinality IDs in traces/logs, not metric labels.

Page on core availability/error budget burn, DB outage, import SLO breach, payment mismatch/duplicate, unexpected signing authority, RPC gap, credential exposure and backup/restore failure. Dashboard/ticket for provider outage, stale prices, poor category confidence, CSV rejection and support surge.

Runbooks required: API outage/rollback; DB failover/restore; import backlog/poisoned CSV; provider credential expiry/consent revoke; RPC outage/indexer lag; payment under/overpayment or wrong token; duplicate payment/entitlement; account takeover; export/deletion failure; secret leak/rotation; abuse/impersonation; security incident/customer comms.

# 18. Error taxonomy and state machines

Stable codes drive localized messages; never key behaviour on human-readable text.

| Code | HTTP/domain | Meaning | Retry | Recovery |
|---|---|---|---|---|
| `AUTH_SESSION_EXPIRED` | 401 | Session invalid | No | Sign in |
| `AUTH_STEP_UP_REQUIRED` | 403 | Re-auth needed | No | Verify identity |
| `AUTH_WALLET_CHALLENGE_EXPIRED` | 401 | Challenge expired | No | New challenge |
| `AUTH_WALLET_SIGNATURE_INVALID` | 401 | Wrong signature | No | Sign exact message |
| `AUTH_NONCE_REPLAYED` | 409 | Challenge reused | No | New challenge |
| `AUTH_ACCESS_DENIED` | 403 | No permission | No | Return to permitted area |
| `DATA_IMPORT_FILE_TOO_LARGE` | 413 | Size cap exceeded | No | Reduce file |
| `DATA_IMPORT_UNSUPPORTED_FORMAT` | 415 | Wrong format | No | Use CSV |
| `DATA_IMPORT_INVALID_COLUMN_MAPPING` | 422 | Required columns absent | No | Map date/amount |
| `DATA_IMPORT_ROW_INVALID` | 422 | Invalid row(s) | No | Download errors |
| `DATA_IMPORT_DUPLICATE` | 409 | Already imported | No | View existing job |
| `DATA_IMPORT_PROCESSING` | 202 | Still processing | Poll | View status |
| `DATA_PROVIDER_REAUTH_REQUIRED` | 409 | Access expired | No | Reconnect |
| `DATA_PROVIDER_RATE_LIMITED` | 503 | Rate limited | Yes | Retry after delay |
| `DATA_PROVIDER_UNAVAILABLE` | 503 | Provider down | Yes | Cached data/manual import |
| `TXN_NOT_FOUND` | 404 | Missing transaction | No | Refresh |
| `TXN_CATEGORY_INVALID` | 422 | Invalid category | No | Select valid category |
| `GOAL_TARGET_INVALID` | 422 | Invalid goal | No | Review values |
| `GOAL_CURRENCY_MISMATCH` | 409 | Currency conflict | No | Change currency |
| `CHAIN_WALLET_UNSUPPORTED` | 422 | Wallet unsupported | No | Choose supported wallet |
| `CHAIN_RPC_UNAVAILABLE` | 503 | RPC unavailable | Yes | Show last update |
| `CHAIN_DATA_STALE` | 503 | Data too old | Yes | Refresh later |
| `CHAIN_ASSET_UNVERIFIED` | Domain | No trusted verification | No | View unverified |
| `CHAIN_TX_SIMULATION_FAILED` | 422 | Simulation failed | No | Review transaction |
| `CHAIN_TX_BLOCKHASH_EXPIRED` | 409 | Blockhash expired | Conditional | Check status first |
| `CHAIN_TX_STATUS_UNKNOWN` | 202 | Outcome unresolved | No blind retry | Query signature |
| `CHAIN_TX_FAILED` | Domain | Chain failure | No | Explain fees/status |
| `PAYMENT_INTENT_EXPIRED` | 410 | Reference expired | No | New payment request |
| `PAYMENT_AMOUNT_MISMATCH` | 409 | Wrong amount | No | Exception/refund review |
| `PAYMENT_MINT_MISMATCH` | 409 | Wrong token | No | Do not grant entitlement |
| `PAYMENT_RECIPIENT_MISMATCH` | 409 | Wrong recipient | No | Exception review |
| `PAYMENT_SIGNATURE_REPLAYED` | 409 | Signature reused | No | View original receipt |
| `PAYMENT_FINALITY_PENDING` | 202 | Not final enough | Poll | Keep pending |
| `BILLING_WEBHOOK_INVALID` | 401 | Invalid webhook | No | Security alert |
| `BILLING_RECONCILIATION_REQUIRED` | 202 | State mismatch | Background | Pending entitlement |
| `SOCIAL_CONTENT_REJECTED` | 422 | Content blocked | No | Edit/appeal |
| `PRIVACY_EXPORT_PENDING` | 202 | Export running | Poll | Return later |
| `PRIVACY_DELETION_REVIEW` | 202 | Retention review | No | Show status |
| `RATE_LIMITED` | 429 | Limit exceeded | Yes | Respect retry-after |
| `IDEMPOTENCY_CONFLICT` | 409 | Key reused with other payload | No | New operation |
| `INTERNAL_UNEXPECTED` | 500 | Unexpected fault | Maybe | Provide request ID |

Transaction states: `draft → validated → simulated → awaiting_signature → signed → submitted → processed → confirmed → finalized`; alternatives `rejected`, `simulation_failed`, `failed`, `expired`, `cancelled`; `unknown` is reconciliation, never success/failure.

Import states: `created → uploaded → validating → parsing → normalizing → deduplicating → importing → completed`; failure `rejected`, `partial_success`, `failed`, `cancelled`. Every terminal state reports counts and error file as appropriate.

Payment states: `created → awaiting_payment → observed → verifying → confirmed → reconciled → entitlement_granted`; exceptions `expired`, `wrong_asset`, `wrong_amount`, `wrong_recipient`, `duplicate`, `under_review`, `refunded`.

# 19. Testing strategy

**Unit:** money parsing/scale/rounding; categorization precedence; recurring detection; goal math; wallet challenge/domain/replay; token decimals; state machines; error mapping.

**Integration:** Postgres migrations/constraints/tenant auth; Redis retry/DLQ; outbox/inbox; CSV object storage and error report; provider/RPC adapter contracts; billing webhook signature/dedupe/reconciliation.

**E2E:** signup→CSV→category correction→dashboard→goal; signup→wallet→challenge→portfolio→disconnect; checkout→webhook→entitlement→cancel; privacy export/deletion; malformed CSV, stale RPC, cancelled wallet and duplicate webhook.

**Load/resilience:** 100k transaction import; concurrent dashboard/portfolio refresh; provider 429/timeouts/malformed response; RPC failover/websocket disconnect; worker restart; DB restore/failover; burst and out-of-order webhooks.

Solana: Devnet for wallet integration; LiteSVM for custom program in-process tests; Surfpool/local validator for integration as appropriate. Test blockhash expiry, duplicate submission, insufficient fee SOL, ATA creation, wrong mint, frozen/unsupported account, Token-2022 incompatibility, timeout and confirmation progression. Label Devnet and never imply test assets have real value.

Quality gates: strict typing, lint/format/typecheck/build, no unresolved critical/high vuln without approved exception, API contracts pass, migration recovery tested, E2E on supported screens, accessibility and keyboard/screen-reader review, no P0 bug.

# 20. Deployment and CI/CD

Environments: local (test adapters), CI (ephemeral DB/Redis), dev (sandbox provider), staging (prod-like, Devnet, payment sandbox), production (mainnet, approved live providers, real secrets, strict flags). Never reuse devnet credentials/mints/webhooks in production.

Pipeline: PR format/lint/typecheck/unit/secret/SAST/dependency scans; immutable build + SBOM; integration tests; staging deploy; migration safety + E2E; human production approval; backward-compatible migrations; canary; threshold rollback when safe; smoke tests/audit.

Migrations use expand/migrate/contract, resumable backfills and mixed-version safety. Feature flags are server evaluated and scoped by environment/region/cohort. Flag-off must block API action, not just hide button.

# 21. Investor proof plan

The story is not “we built every financial feature.” It is: spending/saving/ownership are fragmented; Rillio's wedge turns real financial history into a plan and understandable assets; Solana supports ownership/settlement where relevant; trust and contextual financial data compound; subscription first; regulated execution only through approvals; proof is activation, repeat progress, data accuracy, portfolio freshness, retention and paid conversion.

Demo: sign in; import genuine sanitized CSV; show validation/dedupe; correct category and recompute; create goal; connect Devnet wallet read-only; show provenance/timestamp; disconnect; show privacy/audit boundary. Never stage fake real-money transfer or display invented balances as live funds.

---
# D. STAFF ENGINEER / SYSTEMS ARCHITECT IMPLEMENTATION CONTRACT

# 22. Master implementation prompt

## START OF IMPLEMENTATION MASTER PROMPT

You are the **Staff Software Engineer, Principal Systems Architect, Security Engineer, Product Engineer and Forward-Deployed Engineer** responsible for implementing Rillio in the supplied repository.

Your task is to turn the existing repository into a working, testable, production-oriented implementation of this specification. Understand the current code before changing it, preserve useful existing functionality, implement real end-to-end flows, and prove what works with tests and runtime evidence.

### 22.1 Mission

Build a polished consumer application connecting real imported/provider-sourced spending data, deterministic categorisation and cash-flow insights, user-defined savings goals, non-custodial read-only Solana portfolio visibility, safe subscription architecture, privacy, security, operational tooling and evidence-driven release controls.

Implement the two-week MVP first. Do not attempt every future capability simultaneously. Make the MVP correct and demonstrable, while preserving clean extension seams.

### 22.2 Non-negotiable rules

1. **Inspect before editing.** Never assume repository structure, framework, routes, schema, provider, deployment or test commands.
2. **Preserve working code.** No rewrite without an ADR and concrete reason.
3. **No fabricated integrations.** Never claim bank, wallet, RPC, billing or payment functionality works without real adapter configuration and verification.
4. **No mock production paths.** Mocks/fakes only in tests or clearly isolated local-only adapters. Production fails closed if required configuration is absent.
5. **No fake financial data.** Demo data must be unmistakably labelled and isolated from user records.
6. **No float arithmetic for money/token base units.**
7. **No private-key custody.** Never request/store seed phrases or user private keys; no secrets in client bundle, repository, logs or screenshots.
8. **No unapproved money movement.** MVP wallet capability is read-only; no auto-trade, transfer, recurring debit, asset issuance or fund custody.
9. **No hidden failure.** Provider/RPC error must not become empty success or zero balance. Show last-known data as stale.
10. **No duplicate financial action.** Idempotency, status reconciliation and audit records are mandatory.
11. **No insecure admin shortcut.** No universal admin, arbitrary balance editing or backdoor.
12. **No DONE without evidence.** A feature is complete only when implemented, tested, integrated, observed and documented.
13. **No unverified code dumps.** Make small changes, run tests, inspect results after each phase.
14. **No false compliance claims.** Legal requirements are jurisdiction-specific. Gated features remain disabled until approved.
15. **No non-essential questions.** Use reasonable defaults and document assumptions. Stop only for genuine credential, account, provider, legal or product blockers.

### 22.3 Phase 0: repository reconnaissance

Before modifying files, inspect:
- repository root, Git status, branch and uncommitted changes;
- top-level folders, manifests, runtime, package manager and lockfiles;
- routes, UI, state management, design tokens and existing journeys;
- database, schema, migrations and auth/authorization;
- API routes/contracts and external adapters;
- queues, scheduler, cache, object store and event pipeline;
- tests, coverage, lint, typecheck and build scripts;
- CI/CD, deployment and environment variable names (never print values);
- TODOs, stubs, hardcoded fixtures, fake API responses, dead links and inert buttons;
- security-sensitive flows and known vulnerabilities.

Run read-only commands first. Do not overwrite user work. Record the baseline install/lint/typecheck/test/build commands and outputs. Separate pre-existing failures from regressions introduced by your changes.

Create:
- `docs/implementation/REPOSITORY_AUDIT.md`
- `docs/implementation/BASELINE.md`
- `docs/adr/0001-architecture-baseline.md`
- `docs/implementation/ASSUMPTIONS_AND_BLOCKERS.md`

**Gate 0:** architecture and baseline are documented before implementation. If a command cannot run, state why and continue with available evidence.

### 22.4 Phase 1: traceable implementation plan

For every requirement record requirement ID, current status, files/modules, schema/API impact, security/privacy impact, tests, metric/evidence, dependency and risk. Create `docs/implementation/EXECUTION_PLAN.md` with phases, task IDs, dependencies, verification commands and completion checkboxes. Select the smallest compatible architecture. If the existing stack differs, document why and adapt rather than blindly replacing it.

**Gate 1:** every MVP P0 is mapped and provider/jurisdiction blockers identified. No feature may disappear because it is difficult.

### 22.5 Phase 2: quality foundations

Implement/repair strict typing, formatting/lint, runtime env validation, structured logging with PII/secret redaction, request correlation IDs, standard error envelope, input validation, health/readiness, migration workflow, isolated test fixtures, secure headers, CSP and CORS.

Provide `.env.example` with names and safe placeholders only. Fail production startup if required secrets are missing. Never expose secrets through public client variables. Document secret scopes and rotation. Record ADRs for infrastructure decisions; do not add a dependency without explaining the need.

**Gate 2:** app boots in local/test, quality commands pass or baseline exceptions documented, no secrets in logs/build output.

### 22.6 Phase 3: identity and authorization

Implement registration/login/logout and session lifecycle with existing identity provider or secure OIDC; secure cookies/rotation; revocation; account status; RBAC/ABAC; per-record ownership; step-up auth; consent; rate limits. Wallet challenge is separate from standard login.

Test expired/revoked session, cross-user IDOR, missing role, CSRF/origin, wallet nonce replay, wrong domain, expired challenge and invalid signature.

**Gate 3:** every user endpoint enforces server-side ownership. Wallet association requires valid proof if proof is required.

### 22.7 Phase 4: database and transaction ingestion

Create migrations for users, profiles, consent, import jobs, raw/normalized transactions, categories/history, merchant aliases, import errors, idempotency, audit and outbox.

CSV pipeline:
1. Authenticate and authorize.
2. Create import job and short-lived upload target.
3. Validate size, MIME, extension and filename.
4. Store in private quarantine.
5. Scan/validate where available.
6. Parse asynchronously with strict row/column/size limits.
7. Detect dialect, delimiter and encoding.
8. Require explicit date/amount/currency mapping.
9. Normalize dates, direction and exact monetary values.
10. Persist raw row evidence with import ID/row number.
11. Deduplicate using source ID/fingerprint.
12. Import valid rows transactionally in batches.
13. Record accepted/duplicate/rejected counts.
14. Produce rejected-row report.
15. Mark terminal state only when durable writes complete.

Protect against formula injection, huge fields, malformed Unicode, ambiguous dates, decimal/group separators, reversed sign conventions, overlap, refunds, pending rows, multi-currency, time-zone boundaries and worker retries after partial commit. Never silently drop rows; never duplicate on retry.

**Gate 4:** tests cover valid, malformed, duplicate, locale ambiguous, oversized, partial, retry and cross-user cases. Totals reconcile to accepted records.

### 22.8 Phase 5: categorization, insights and goals

Rule precedence: user correction → user rule → verified merchant mapping → deterministic heuristic → uncategorized. Store category history and reason. Any optional AI is advisory, confidence-labelled, minimized, reviewable and unable to move money.

Cash flow uses exact arithmetic and explicit treatment of transfers, refunds, pending items, fees and missing FX rates. Goals are planning records, not a custody ledger. Distinguish target, planned contribution, user-reported starting amount, verified external transfer (future) and actual held funds (not MVP).

Projections are deterministic, versioned, exact, time-zone/currency aware, non-guaranteed and do not assume yield by default. Reject impossible values.

**Gate 5:** corrections recompute insights; goal planning never changes actual balances; math boundary tests pass.

### 22.9 Phase 6: Solana read-only wallet and portfolio

Read current official docs for Kit, Next.js, React, Wallet Standard, RPC endpoints/commitments, fees, transactions, production signing and production readiness. Pin compatible `@solana/kit`, `@solana/kit-plugin-rpc`, `@solana/kit-plugin-wallet`, `@solana/react` and generated clients when required.

Implement one typed Kit client; wallet discovery/connect/disconnect; account changes; optional signed challenge; public address association; production RPC adapter + fallback; native SOL and token account retrieval; exact base-unit decoding; mint/program/owner validation; verified metadata and price adapters; freshness timestamps; snapshots; unknown/unpriced/spam-token states.

Never request seed phrase/key, infer authenticity from token logo/name, treat RPC failure as zero, use public shared RPC in production, add a backend keypair for users or add send/trade in MVP.

Test unsupported wallet, wrong cluster, account change, disconnect, RPC timeout, stale data, duplicate observation, wrong mint, decimals, unpriced asset and suspicious token.

**Gate 6:** real Devnet read-only data works; no transfer path is reachable; production rejects missing provider config/public RPC.

### 22.10 Phase 7: billing and monetization

Create provider interface, plan/entitlement model, checkout session and webhook pipeline. If real credentials are available, integrate sandbox and verify signatures. Otherwise implement only contract and a visibly disabled checkout; do not simulate payment success.

Webhook: verify raw body/signature, timestamp/replay, dedupe ID, persist reference, reconcile provider state, update entitlement transactionally, retry safely and alert on mismatch. Browser return URLs never grant access.

USDC checkout only after exact recipient/mint/amount/reference/expiry/finality server checks. Isolate beta packages and re-check maturity.

**Gate 7:** no entitlement from browser redirect or unverified wallet message. Duplicate webhook creates one transition.

### 22.11 Phase 8: UI and design system

Build tokens/theme/typography; responsive shell/navigation; buttons/inputs/cards/alerts/dialogs/sheets; transaction list/import; dashboard/charts; goal list/wizard/detail; wallet/portfolio; privacy/settings/billing; loading/empty/error/stale/permission states; mobile/accessibility.

Follow midnight ink, lime/mint accent, calm editorial typography, restrained gradients and clear financial figures. No casino motifs. Every button works or is disabled with explanation. No dead links, invented progress percentages or random charts. Respect reduced motion; charts provide accessible summaries/tables.

**Gate 8:** primary journeys work at desktop/tablet/mobile and keyboard; no overflow, clipped dialogs, unreadable contrast or inaccessible status.

### 22.12 Phase 9: operations and observability

Implement redacted structured logs, traces, correlation, API/worker metrics, import/provider/chain health, payment exception reconciliation, audited support access, DLQ inspection/replay, privacy export/deletion monitoring, health checks, alerts and runbooks. Support cannot edit balances.

**Gate 9:** injected provider outage, queue backlog and RPC outage produce alert and safe degraded state; runbooks exercised.

### 22.13 Phase 10: end-to-end verification and hardening

Run unit/property tests for financial math/state machines; DB/queue/outbox/provider integration; MVP E2E; CSV/dashboard/portfolio load; timeout/429/5xx/disconnect/duplicate/partial fault injection; accessibility; SAST/DAST; dependency/license review; authorization/privacy review; backup restore; staging smoke tests.

Create requirement-to-code-to-test-to-evidence traceability matrix.

**Gate 10:** all P0 acceptance criteria pass. Any P0 failure blocks release or is clearly identified as an external blocker; never silently waive it.

### 22.14 Phase 11: deployment readiness

Verify production RPC/fallback; real provider credentials/scopes; domains/redirects/webhook allowlists; no Devnet/test keys in production; secret rotation and backup; migration dry run; incident/rollback rehearsal; high-risk flags off; legal/provider approvals documented; support/refund/privacy/incident workflows ready.

The agent cannot self-certify regulatory permission. Report missing approvals and leave gated features disabled.

### 22.15 Definition of DONE

A requirement is DONE only if UI, API/domain, persistence/migrations, authorization, privacy, failure/recovery, tests, observability, documentation and acceptance evidence all exist. Use statuses `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED_NOT_VERIFIED`, `VERIFIED`, `RELEASED`. Never claim 100% completion unless agreed scope is verified and release gates pass.

### 22.16 Required final report

Create `docs/implementation/FINAL_ENGINEERING_REPORT.md` with:
1. Executive summary and delivered scope.
2. Implemented architecture and deviations.
3. Requirement traceability matrix.
4. Routes/APIs/tables implemented.
5. Actual integrations and tested environments.
6. Exact test commands, results, pass/fail counts and artifacts.
7. Security findings/remediation.
8. Load results and bottlenecks.
9. Known bugs, limitations and blockers.
10. Provider credentials/approvals still required (names only, never values).
11. Deployment and rollback.
12. Runbooks and dashboards.
13. Redacted actual screenshots/recordings.
14. Environment status: local, staging, Devnet or production.
15. Reproduction commands for another engineer.

Never claim production readiness merely because the build succeeds.

## END OF IMPLEMENTATION MASTER PROMPT

# E. ENGINEERING EXECUTION CHECKLIST

# 23. Staff engineer release checklist

**Product:** first customer/geography explicit; MVP separate from gated features; plans never represented as held funds; portfolio provenance/freshness; social private by default; no copy trading.  
**Design:** vector brand exports; dark/light tokens; keyboard/reduced-motion; loading/empty/error/stale states on every data page; responsive breakpoints; no dead controls or random charts.  
**Data:** exact money; raw/normalized separation; import idempotency/resume; encrypted provider tokens; outbox/inbox; cross-tenant authorization tests; verified cursor pagination/query plans.  
**Solana:** Kit/React pinned; connection distinct from login/signing; no key collection; mint/program validation; price timestamps; primary/fallback production RPC; no shared public RPC in prod; unknown transaction reconciled before retry; no custom program without need.  
**Payments:** signed webhooks; server reconciliation; exact server verification of amount/mint/recipient/reference; duplicate tests; refund policy; no hidden fees.  
**Security/ops:** secret manager/rotation; rate limits/MFA/session revoke; CSP/CORS/CSRF/input validation; PII redaction; backup restore; incident/rollback runbooks; SAST/DAST/container scans; external review before material customer value.  
**Launch:** legal/provider approval in target geography; provider coverage and support verified; terms/privacy/risk reviewed; support ready; live demo uses real, labelled test/consented data; high-risk features disabled.

# 24. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Bank coverage unavailable | High | CSV MVP, adapters, verify market first |
| Goal mistaken as held funds | High | planned vs transferred wording everywhere |
| Spam/mispriced token | High | mint identity, provenance, unverified state |
| RPC outage | Medium/high | fallback, stale state, reconciliation/alert |
| Duplicate import/charge | High | idempotency, constraints, reconciliation |
| Social promotion harms users | High | disclosure/moderation/reporting, no copy trades |
| License required | Critical | jurisdiction gate, approved partner or disable |
| Wallet phishing | Critical | read-only first, clear signer UX, simulation later |
| Provider data delay | Medium | freshness/completeness indicators |
| AI categorization error | Medium | rules-first, confidence, manual correction |
| Weak agent skips controls | High | phase gates, traceability, automated verification |
| Microservice overbuild | Medium | modular monolith until justified |
| Brand conflict | Medium | trademark/domain/company clearance |
| Investor overclaim | High | evidence-backed metrics/environment labels |

# 25. Recommended build order

1. Repository audit and plan.
2. Theme, app shell and typography.
3. Authentication and ownership.
4. Schema and migrations.
5. CSV import pipeline.
6. Transaction list, categorization and insight.
7. Savings goals and planning.
8. Solana read-only wallet and asset data.
9. Privacy/export/deletion.
10. Monitoring, tests, deployment and demo evidence.
11. Billing/provider connections only with actual credentials and verified requirements.

Build one complete journey rather than many disconnected screens.

# 26. Official technical references

Re-check exact package versions before implementation. Official Solana documentation is authoritative for chain behaviour:

- [Solana TypeScript SDK / Kit](https://solana.com/docs/clients/official/javascript)
- [Solana frontend overview](https://solana.com/docs/frontend)
- [Solana Kit client](https://solana.com/docs/frontend/client)
- [Solana React bindings](https://solana.com/docs/frontend/react-hooks)
- [Solana Next.js integration](https://solana.com/docs/frontend/nextjs-solana)
- [Solana RPC overview](https://solana.com/docs/rpc)
- [Solana transactions](https://solana.com/docs/core/transactions)
- [Solana fees](https://solana.com/docs/core/fees)
- [Signing in production](https://solana.com/docs/core/transactions/signing-in-production)
- [Production readiness](https://solana.com/docs/tools/production-readiness)
- [Solana payments](https://solana.com/docs/payments)
- [Payment quickstart](https://solana.com/docs/payments/quickstart)
- [Token extensions](https://solana.com/docs/tokens/extensions)
- [Tokenization](https://solana.com/docs/tokenization)
- [LiteSVM](https://solana.com/docs/tools/litesvm)
- [Surfpool](https://solana.com/docs/tools/surfpool)
- [Full documentation for coding agents](https://solana.com/llms-full.txt)
- [Solana agent skill](https://solana.com/SKILL.md)

Verified current technical notes: Solana docs identify `@solana/kit` as recommended TypeScript SDK and `@solana/react` as React bindings; official Next.js guide currently describes Kit 7+ and compatible plugin families. Public shared RPC is not intended for production app traffic. Transactions incur base and optional prioritization fees, and fees may be charged for failed transactions. Payment quickstart validates recipient, amount, token and reference and currently notes `@solana/pay` is beta. Token-2022 extensions have initialization/compatibility constraints. LiteSVM runs a fast in-process Solana VM.

# 27. Final product definition

Rillio is a financial progress platform, not a trading gimmick. Its advantage comes from connecting decisions users already make to a clearer understanding of where they are going.

The first release should be small enough to finish and serious enough to trust: real transaction import, understandable cash-flow insight, honest savings planning, real read-only Solana portfolio data, privacy controls, polished UX and verifiable operational quality. Bank connections, payments, investing, tokenized assets, social discovery and mobile expansion build on that foundation through explicit product, provider, security and legal gates.

**Launch standard:** every number has a source, every action has an owner, every money movement has authorization, every failure has a recovery path, and every completion claim has evidence.

# 28. Detailed product experience contracts

This section converts the concept into the interaction model that should appear in the first coherent product experience. These modules are where Rillio should feel different from a standard budget dashboard.

## 28.1 Home: “Your Money Pulse”

**Desktop composition:**
- Greeting and date context, with one sentence explaining the period being viewed.
- Primary `Financial Snapshot` card: income, outflow, net flow and last data update.
- `Your Plan` card: goal progress, planned contribution and next target date.
- `Spending Map` card: top category shares and movement against the user's own previous period.
- `Ownership` card: supported portfolio value with price timestamp, unpriced count and connected wallet state.
- `One Useful Insight` card: a single explainable finding linking to the transactions behind it.
- `Next Small Step` card: one user-controlled suggestion, such as reviewing a recurring merchant or adjusting a goal plan.

**Mobile order:** financial snapshot → goal progress → one insight → spending map → ownership → next step. Keep no more than one dominant CTA per viewport.

**Interaction:** period selector changes all dependent cards; each metric opens its source detail; stale data badges reveal why data is stale; dismissing an insight records feedback, not data deletion.

## 28.2 Activity: “Where it went”

Top row: page title, period selector, account/currency filter and Import button. Below: monthly inflow/outflow summary, search, category chips and sort. Transaction list groups by date and shows merchant, category, account/source, transaction state and signed amount. Details panel shows original imported description, normalized description, amount/currency/date, raw source reference, category decision and edit history.

**Import wizard steps:** choose file → detect columns → confirm date/amount/currency/sign convention → preview accepted/rejected rows → import → results summary. Do not claim an import succeeded before the job reaches a durable terminal state. Partial success must show counts and rejected rows.

## 28.3 Goals: “Give money a direction”

Goal listing uses cards with target, planned progress, target date, suggested contribution and status. Create-goal wizard asks for goal name, exact target/currency, target date, starting amount (user-entered and labelled), contribution cadence and comfort range. Goal detail includes current plan, timeline, contribution history, scenarios and edit/pause/archive. Always distinguish “planned” from “transferred” and “held”.

**Scenario controls:** contribution frequency, amount and date; results are illustrative. Do not add assumed investment return by default. If a user explicitly toggles an assumed return scenario, show the assumption and source, and label it not guaranteed.

## 28.4 Portfolio: “What you own”

Header shows total supported value, quote currency, last updated time, stale status and wallet count. Allocation chart has a table alternative. Asset rows include token logo only when trusted metadata exists, ticker as secondary text, mint identity/verification details, exact quantity, quote source/time and value. Unknown, spam, unpriced and frozen/unsupported assets receive distinct labels and are not silently excluded from the count.

Asset detail contains identity, mint, token program, holder address, source links, balances across user-connected wallets, price history only if the data source supports it, known risks and chain activity. Never imply a token's legal rights or redemption terms based solely on metadata.

## 28.5 Discover: “Ideas worth understanding”

A curated learning surface, not an execution terminal. Content cards have topic, plain-language summary, author, source links, publication date, conflict/sponsorship disclosure, risk label and report action. Discovery filters include asset class, theme and learning level. User can follow an idea, save it, compare sources, or mute a topic. No one-click trade, copy button, PnL leaderboard or countdown hype.

## 28.6 Circles: social layer for healthy financial habits

A Circle is a group around a shared learning theme or goal (for example, building an emergency buffer or learning about public-market sectors). It can contain discussions, educational missions and progress check-ins. It does not pool member funds, promise returns, give members authority over others' accounts or expose members' transactions.

**Circle privacy:** closed by default; invite links expire; member list visibility is configurable; public activity is opt-in; blocking/reporting is immediate; user can leave and remove their contributions where policy permits.

## 28.7 “Spend-to-Theme” insight

A distinctive bridge between spending and investing education: show how a user's aggregate spending categories relate to broad business sectors or public-company themes, using transparent and cautious mappings. Example: frequent grocery/retail spending can open an educational card about retail-sector business models, not a buy recommendation.

Rules:
- Do not infer that spending at a brand means the user should buy its stock.
- No merchant-level identification is shared publicly.
- Every mapping has an explanation and source, plus a confidence label.
- Sponsored merchant/issuer content is clearly labelled.
- Do not infer political, religious, health or other sensitive characteristics from spending.
- If mappings are too weak or data is incomplete, display no insight.

## 28.8 Engagement system: Rillio Rhythm

Reward financial understanding, not speculation:
- `Check-in`: user reviews weekly cash flow or goals.
- `Clarity`: user resolves an uncategorized transaction or reviews an insight.
- `Consistency`: user maintains a self-chosen saving plan (record as plan, not cash held).
- `Learning`: user completes a short educational card and source review.
- `Community`: constructive discussion, helpful source citation or collaborative learning activity.

Points/badges are non-transferable, non-redeemable, have no financial value, and do not determine asset access or trading privileges. Do not reward trading volume, volatility exposure, leverage, referrals that create spam, or public display of returns. Streaks must have grace/rest options and be easy to disable. No shame copy for missed days.

---

# 29. Page interaction and boundary matrix

| Page | Loading | Empty | Error / stale | Critical boundary |
|---|---|---|---|---|
| Home | Card-level skeletons | First-import guidance | Preserve last-known values with timestamp | Aggregate only authorized data |
| Activity | Table skeleton rows | Import prompt | Row error report / provider freshness | Raw vs normalized data remains distinct |
| Import | Stage labels and real progress | File selection | Row-level errors / retry job | No duplicate import on retry |
| Goals | Progress skeleton | Create first goal | Projection error retains existing plan | Planned funds are never represented as held |
| Portfolio | Balance skeleton + quote time | Connect wallet | RPC degraded / price stale / unverified asset | No fake zero balance or false price |
| Discover | Content skeleton | No results / refine filters | Content source unavailable | Sponsored and risky content disclosed |
| Circles | Member/content skeleton | Invite or explore | Permission / blocked / moderation state | No pooled funds or private data leak |
| Wallet settings | Wallet status skeleton | No connected wallet | Signature rejected / RPC offline | Disconnect stops future indexing |
| Billing | Plan skeleton | Free plan | Provider pending / webhook mismatch | Browser redirect never grants entitlement |
| Privacy | Consent skeleton | No provider connections | Export/delete job failure | Revocation and deletion are auditable |

## 29.1 Error copy examples

- `DATA_IMPORT_INVALID_COLUMN_MAPPING`: “We couldn't identify the date and amount columns. Choose them below, then preview the import again.”
- `DATA_IMPORT_PARTIAL_SUCCESS`: “Some transactions were imported. 184 rows were accepted and 7 need review. Download the rejected rows to see why.” Use actual row counts from the job, never illustrative counts.
- `DATA_PROVIDER_UNAVAILABLE`: “Your financial provider isn't responding. Your last successful update was {time}. You can retry or import a statement manually.”
- `CHAIN_RPC_UNAVAILABLE`: “We can't refresh this wallet right now. Your last confirmed view is from {time}; balances may have changed.”
- `CHAIN_ASSET_UNVERIFIED`: “This token's identity hasn't been verified by a source we trust. We are showing its mint address, not an estimated value.”
- `CHAIN_TX_STATUS_UNKNOWN`: “We haven't confirmed the transaction outcome yet. Do not send it again. Check the signature status before taking another action.”
- `PAYMENT_FINALITY_PENDING`: “Payment detected. We're waiting for the required network confirmation before updating your plan.”
- `AUTH_ACCESS_DENIED`: “You don't have permission to view this item. Return to your account or contact support if you think this is a mistake.”
- `INTERNAL_UNEXPECTED`: “Something went wrong. No further action was taken by this request. Share reference {requestId} with support.” Only use the final sentence where the server can prove no side effect occurred.

## 29.2 Boundary and recovery rules

- If a provider returns no data, distinguish “no transactions exist” from “provider failed”.
- If only some accounts sync, show which accounts are current and which are not.
- If CSV import has partial success, make retry scope explicit and preserve idempotency.
- If wallet changes account mid-flow, cancel pending ownership challenge and refresh context.
- If wallet disconnects during a future transaction, preserve signature/status if already submitted; never silently rebuild.
- If chain event arrives twice or out of order, dedupe by stable signature/event identity and reconcile state.
- If a price quote crosses freshness threshold, mark stale and suppress misleading gain/loss comparison.
- If currency conversion is unavailable, show native amount and no base-currency total rather than inventing FX.
- If a goal edit makes the target unreachable under current contribution amount, explain the arithmetic and let the user choose.
- If a subscription expires while a session is active, re-evaluate server entitlements on protected actions; do not rely on stale client state.
- If a deletion request is under a valid retention hold, tell the user what is pending and why; do not report deletion complete.

---

# 30. Product differentiation and moat hypothesis

Adjacent products already exist in budgeting, local-first personal finance, wallet aggregation and investing. A quick scan surfaced products describing financial workspaces with transaction categorisation, income, goals and coaching, as well as a newly visible Rillio media application using the same name. The working name therefore is not clear for public adoption, and a standard budget/goal dashboard is not enough differentiation.

Rillio's proposed distinct wedge is the **Spend-to-Goal-to-Ownership loop**, strengthened by four product systems:

1. **Spend-to-Theme:** educational bridge from aggregate lifestyle spending to business/asset themes, without converting spending into stock-picking advice.
2. **Rillio Rhythm:** low-pressure habit progression based on understanding, planning and learning, not trade volume or returns.
3. **Circles:** social accountability and shared learning without pooled money or exposing private holdings.
4. **Source-first Portfolio:** understandable onchain asset ownership with mint identity, data freshness and price provenance.

The moat is not the wallet connector or a chart. It may emerge from trusted normalization, user-approved habit context, high-quality learning/discovery, issuer/provider distribution and trust. This is a hypothesis: validate it through cohort retention, interviews, organic sharing and willingness to pay. Do not claim proprietary network effects before the behaviour exists.
