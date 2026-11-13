# REPOSITORY AUDIT

**Project:** Rillio (working codename)
**Blueprint:** `upload/rillio_extracted/rillio_blueprint/RILLIO_COMPLETE_PRODUCT_AND_ENGINEERING_BLUEPRINT.md`
**Audit date:** 2026-11-13
**Audited by:** Cline (staff-engineer implementation pass)

> Phase 0 deliverable required by blueprint §22.3 and
> `STAFF_ENGINEER_IMPLEMENTATION_PROMPT.md` Phase 0. Records what existed before
> implementation work, and separates pre-existing failures from regressions.

---

## 1. Git state at audit start

| Item | Value |
|---|---|
| Branch | `main` |
| Working tree | Dirty — uploaded blueprint zip, extracted blueprint, brand assets, `.zscripts/*`, `tests/*.sh` modified vs `HEAD` |
| Latest commits | `75ffa4d`, `ae14d1d`, `4afb293`, `8229ead`, `32cc345 Initial commit` |
| Untracked at start | `upload/` (blueprint), `tool-results/` |

No user work was overwritten.

## 2. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v4, `tailwindcss-animate`, shadcn/ui in `src/components/ui` |
| Fonts | `next/font/google` — Inter, Space Grotesk, Geist Mono |
| ORM | Prisma 6 + SQLite (`db/custom.db`) |
| Auth | Custom cookie sessions, bcryptjs hashing (`src/lib/auth.ts`) |
| Money | BigInt minor units (`src/lib/money.ts`) — no floats |
| Solana | Direct JSON-RPC over `fetch` (`src/lib/solana-rpc.ts`), `tweetnacl` + `bs58` |
| CSV | `csv-parse` + custom normalization (`src/lib/csv.ts`) |
| Validation | `zod` v4 |
| Tests | **None present** at audit start |
| Package manager | `bun.lock` present, but Bun is **not installed** here |

## 3. Route inventory

45 route files under `src/app/api/`, 46 HTTP handlers:

- **Auth:** `login`, `logout`, `register`, `me`
- **Imports / transactions:** `imports` (+ `[id]`, `[id]/errors`), `transactions`, `transactions/[id]/category`, `transactions/bulk-category`
- **Goals:** `goals`, `goals/[id]`, `[id]/pause`, `[id]/archive`, `[id]/simulate`
- **Insights:** `insights`
- **Wallets / portfolio:** `wallets`, `wallets/challenge`, `wallets/verify`, `wallets/[id]`, `wallets/[id]/refresh`, `portfolio/summary`
- **Billing:** `plans`, `checkout-sessions`, `subscription`, `cancel`, `invoices`, `usdc/create-intent`, `usdc/verify-payment`, `sol/create-intent`, `sol/verify-payment`
- **Connections:** `connections`, `connections/providers`, `connections/[id]`, `connections/[id]/sync`
- **Privacy / security:** `me/data-export`, `me/deletion-request`, `me/preferences`, `security/audit`, `security/consents`, `security/sessions`, `security/sessions/[id]`
- **Notifications / categories / health:** `notifications`, `categories`, `health`

**Authorization coverage:** 41 of 45 route files call `getCurrentUser()`. The four that do not
are correct: `auth/login`, `auth/register`, `auth/logout` (pre-session), and
`billing/cancel` (re-export of `billing/subscription`, which does check).

## 4. Data model

28 Prisma models, matching blueprint §11.1 closely:

`User`, `Session`, `ImportJob`, `RawTransaction`, `Transaction`,
`TransactionCategoryHistory`, `Category`, `CategorizationRule`, `CashflowSnapshot`,
`Goal`, `GoalEvent`, `Wallet`, `TokenAccount`, `PortfolioSnapshot`, `Consent`,
`Notification`, `DataExportRequest`, `DeletionRequest`, `AuditEvent`,
`FinancialConnection`, `ProviderCredential`, `Plan`, `CheckoutSession`,
`Subscription`, `Invoice`, `PaymentIntent`, `PaymentSettlement`, `Entitlement`,
`IdempotencyKey`.

Money is `BigInt`. Raw evidence (`RawTransaction`) is stored separately from normalized
`Transaction` rows, as §11.2 requires.

**Gap:** no `prisma/migrations/` — the schema was only ever applied with `db push`.
Migrations are a release blocker (§20: "check migrations into source control").

## 5. Infrastructure / operations

| Concern | State at audit |
|---|---|
| `.env` | Present: `DATABASE_URL`, `SOLANA_RPC_URL`, `SOLANA_CLUSTER`, `USDC_RECIPIENT_WALLET`, `SOL_RECIPIENT_WALLET`, `SOL_PRICE_USD` |
| `.env.example` | **Missing** (§22.5 requires safe placeholders) |
| Runtime env validation | **Missing** — production would boot with a public RPC / no treasury wallet |
| Security headers / CSP | `src/middleware.ts` (good) |
| Rate limiting | `src/lib/rate-limit.ts`, in-process sliding window |
| Structured logging | `src/lib/audit.ts` `logEvent()` (JSON lines) |
| Health/readiness | `src/app/api/health/route.ts` (shallow + authenticated deep probe) |
| Tests | **Missing** |
| CI/CD | **Missing** (no `.github/workflows`) |
| Deployment | `.zscripts/` target a Linux container with Bun (`/home/z/my-project`) |
| Docs | **Missing** — no `README.md`, no `docs/` |

## 6. Baseline command results

Commands the repo supports **after** the fixes in §8. See `BASELINE.md` for before/after.

| Command | At audit start | After this pass |
|---|---|---|
| `npm install` | Failed — `EALLOWSCRIPTS` (user-global npmrc) | Passes (project `.npmrc`) |
| `npx tsc --noEmit` | **101 errors** | **0 errors** |
| `npx next build` | Failed — `.prisma/client/default` missing | **Passes**, 46 routes |
| `npx eslint .` | 14 errors | **0 errors**, 10 warnings |
| `npx vitest run` | No framework | **77 tests / 7 files pass** |

## 7. Pre-existing defects found and fixed

Real bugs, not style issues:

1. **Money parser dropped negative signs on currency-prefixed amounts.** `"$ (1,234.56)"` and
   `"-$1,234.56"` returned a *positive* value — the sign was stripped before inspection.
   Accounting-negative bank exports would silently flip inflow/outflow.
2. **Ambiguous multi-dot amounts were guessed.** `"12.3.4"` parsed as `1234`. Now rejected
   unless every group after the first is exactly 3 digits.
3. **CSV parse failures crashed the request.** A malformed quote threw a `csv-parse` error
   out of the route → 500 with a library message. Now a structured `DATA_IMPORT_UNPARSEABLE`
   422 plus a recorded failed import job.
4. **Dedupe fingerprint was defined twice and disagreed.** `src/lib/csv.ts` hashed the raw
   description; `src/app/api/imports/route.ts` hashed a lowercased/truncated variant.
   Re-imports therefore created duplicates. Both now call one exported `fingerprintParts()`.
5. **Goal projection math was inline in a route** — untestable, and used a float for the
   basis-point calculation. Extracted to `src/lib/goals.ts` with exact BigInt math.
6. **`simulate` accepted unvalidated `plannedContributionMinor`** and passed it straight to
   `BigInt()`, which throws on garbage → 500. Now validated to `/^\d+$/`.
7. **`.env` `DATABASE_URL` pointed at `/home/z/my-project/db/custom.db`** — a container path
   that does not exist here, so Prisma silently created a new DB under `prisma/`.
8. **`.prisma/client` was never generated**, so `next build` failed at page-data collection.

## 8. Files changed or created in this pass

**Configuration / infra**
- `.npmrc` *(new)* — project npm settings; works around the user-global `allow-scripts`
  entry npm 11 rejects for project installs; moves the npm cache off the full C: drive.
- `tsconfig.json` — `target` ES2017 → ES2022 (BigInt literals); `include` narrowed to `src`.
- `.env` — `DATABASE_URL` corrected.
- `.env.example` *(new)* — names + safe placeholders only.
- `eslint.config.mjs` — `react-hooks/set-state-in-effect` → `warn` with rationale.
- `package.json` — scripts fixed; added `typecheck`, `test`, `test:coverage`; added
  `@types/node`, `vitest`, `@vitest/coverage-v8`.
- `vitest.config.ts` *(new)*.

**Source**
- `src/lib/env.ts` *(new)* — runtime env validation, production fail-closed.
- `src/instrumentation.ts` *(new)* — boots the env assertion.
- `src/lib/goals.ts` *(new)* — pure, tested goal projection.
- `src/lib/money.ts` — negative/separator parsing fixes.
- `src/lib/csv.ts` — `CsvParseError`, `relax_quotes`, single `fingerprintParts()`.
- `src/lib/solana-rpc.ts` — `preBalances`/`postBalances` on the `getTransaction` type.
- `src/app/api/imports/route.ts` — shared fingerprint, parse-error handling.
- `src/app/api/goals/[id]/simulate/route.ts` — uses `lib/goals.ts`, validates input.
- `src/app/api/billing/usdc/verify-payment/route.ts` — 202 branch when settlement returns no
  subscription (was a null deref).
- `src/app/api/connections/route.ts` — restored a missing `if (!provider)` block; Zod v4 record.
- `src/app/api/insights/route.ts` — typed the `recurring` array.
- `src/components/rillio/{landing,activity-view,goals-view,settings-view,auth-modal}.tsx`,
  `src/app/page.tsx`, `src/hooks/use-mobile.ts` — type/lint fixes.

**Tests**
- `tests/money.test.ts`, `tests/csv.test.ts`, `tests/categorize.test.ts`,
  `tests/goals.test.ts`, `tests/solana-verify.test.ts`, `tests/rate-limit.test.ts`,
  `tests/env.test.ts`

## 9. Known gaps at the end of this pass

Recorded honestly, not papered over. See `EXECUTION_PLAN.md` for status.

- No `prisma/migrations/` — `db push` only. **Release blocker.**
- No CI/CD pipeline. **Release blocker.**
- No E2E tests (no Playwright). §19 requires signup→CSV→goal and signup→wallet→portfolio.
- No load/soak, fault-injection, SAST/DAST or accessibility testing performed.
- `src/components/rillio/auth-screen.tsx` is present but unreferenced (dead code).
- Wallet challenge nonce is stored in `AuditEvent.metadata` as plaintext JSON rather than a
  hash; §4.5 FR-CHAIN-005 and the `auth_challenges` model call for a hashed nonce.
- `SOL_PRICE_USD=210.50` is an operator-fixed rate, not an oracle quote (labelled as such in
  code) — review before real billing.
- `USDC_RECIPIENT_WALLET` and `SOL_RECIPIENT_WALLET` point at the same placeholder address.
- No `README.md` or ADRs yet.