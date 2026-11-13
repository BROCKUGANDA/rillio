# Rillio

**Small habits. Stronger financial futures.**

A financial-progress app that connects real imported spending data, deterministic cash-flow
insight, honest savings planning, and non-custodial read-only Solana portfolio visibility.

> **Rillio is a working codename.** A trademark/domain review is outstanding — do not adopt this
> name publicly without clearance. See `docs/implementation/ASSUMPTIONS_AND_BLOCKERS.md` (B4).
>
> **This is not production-ready.** The build and unit tests pass; that is not the same claim.
> Read `docs/implementation/EXECUTION_PLAN.md` for the actual state of every requirement.

---

## What it does

The core loop is **Earn → Spend → Understand → Plan → Save → Own → Review**.

| Area | What you get |
|---|---|
| **Activity** | Import a bank CSV, map columns, see accepted/rejected/duplicate counts, recategorise with history |
| **Home** | Cash-flow snapshot, top categories, recurring-spend detection, burn rate — all from real rows |
| **Goals** | Savings plans with deterministic projections. A plan is a plan, **never held money** |
| **Portfolio** | Read-only Solana balances with mint identity, price provenance, honest stale/unpriced states |
| **Privacy** | Granular consent, one-click data export, deletion request with a documented grace period |

## Non-negotiables (enforced in code, not just documented)

- **No float money.** Every amount is a `BigInt` in minor units (`src/lib/money.ts`).
- **No fabricated data.** A failed RPC or price lookup is *stale*, never zero. An unpriced token
  is labelled unpriced, never valued at 0.
- **No custody, no keys.** The wallet path is read-only. Seed phrases and private keys are never
  requested, stored or logged.
- **No fake success.** Payments unlock entitlement only after the server verifies the onchain
  transfer — a browser redirect never grants access.
- **No silent row loss.** CSV rows are accepted, rejected with a reason, or marked duplicate.
  Totals always reconcile.

---

## Quick start

### Prerequisites

- Node 20+ (developed on Node 26)
- npm (Bun is referenced by `bun.lock` but is **not** required locally)

### Setup

```powershell
cd "D:\AI AZIMARA(AAA)\Rilio"

# On machines where ~/.npmrc sets allow-scripts, npm 11 refuses a project install.
# Clear it for this shell (see .npmrc for why):
$env:npm_config_allow_scripts=$null

npm install --legacy-peer-deps

# Environment
Copy-Item .env.example .env    # then edit

# Database
npx prisma generate
npx prisma db push

# Run
npm run dev                    # http://localhost:3000
```

### Quality gates

```powershell
npm run typecheck     # tsc --noEmit      -> expect 0 errors
npm run lint          # eslint .          -> expect 0 errors
npm test              # vitest run        -> expect 77 passing
npm run build         # next build        -> expect 46 routes
```

---

## Configuration

Copy `.env.example` to `.env`. **Never commit real secrets.**

| Variable | Purpose | Production |
|---|---|---|
| `DATABASE_URL` | SQLite path | Required |
| `SOLANA_RPC_URL` | Solana JSON-RPC endpoint | Required, **dedicated** (not public) |
| `SOLANA_CLUSTER` | `mainnet-beta` / `devnet` / `testnet` | Required |
| `USDC_RECIPIENT_WALLET` | USDC treasury address | Required, real |
| `SOL_RECIPIENT_WALLET` | SOL treasury address | Required, real |
| `SOL_PRICE_USD` | Operator-fixed SOL fallback rate | Optional |
| `PROVIDER_CREDENTIAL_KEY` | AES-256-GCM key for provider credentials | **Required** |

Production **fails closed**: `src/instrumentation.ts` calls `assertEnvOrThrow()` on boot, so a
missing secret or a shared public RPC stops the server instead of serving a degraded state.
Values are never logged — only variable names and safe reasons.

---

## Architecture

One Next.js 16 application (App Router). API route handlers are the BFF/API layer; `src/lib/*` is
the domain layer. See `docs/adr/0001-architecture-baseline.md` for why this beats a monorepo
rewrite at this stage.

```
src/
  app/
    page.tsx              # authenticated shell + view router
    layout.tsx            # fonts, metadata, toaster
    globals.css           # design tokens
    api/                  # 45 route files (46 handlers)
  components/
    rillio/               # product views
    ui/                   # shadcn primitives
  lib/
    money.ts              # BigInt minor-unit arithmetic
    csv.ts                # import pipeline + fingerprint
    categorize.ts         # deterministic categorisation
    goals.ts              # goal projection (pure)
    solana.ts             # challenge/verify boundary
    solana-rpc.ts         # read-only JSON-RPC
    billing/              # entitlements, settle, usdc, sol
    providers/            # bank provider registry (demo only)
    auth.ts               # sessions, hashing
    errors.ts             # RFC 7807 envelope
    rate-limit.ts         # sliding-window limiter
    audit.ts              # JSON log lines + audit trail
    env.ts                # runtime env validation
  instrumentation.ts      # production env assertion
prisma/schema.prisma      # 28 models
tests/                    # vitest unit suites
docs/                     # audit, ADR, plan, baseline
```

### Design system

Midnight-ink surfaces with lime/mint accents, Space Grotesk display type over Inter, tabular
figures for all money. Motion respects `prefers-reduced-motion`. Tokens live in
`src/app/globals.css` and `tailwind.config.ts`; brand assets in `public/brand/`.

---

## Testing

```powershell
npm test                # 77 unit tests
npm run test:coverage   # v8 coverage over src/lib
```

| Suite | Covers |
|---|---|
| `money.test.ts` | Exact parsing across locales, accounting negatives, truncation-not-rounding, values past `Number.MAX_SAFE_INTEGER` |
| `csv.test.ts` | Delimiter detection, mapping, date formats, formula injection, dedupe, rejected-row reconciliation |
| `categorize.test.ts` | Precedence: user rule → verified merchant → heuristic → uncategorized |
| `goals.test.ts` | No-yield default, explicit-return labelling, shortfall, cadence scaling, plan≠held-funds |
| `solana-verify.test.ts` | ed25519 verification, wrong-key rejection, nonce binding, malformed input |
| `rate-limit.test.ts` | Window reset, per-principal and per-bucket isolation, bucket routing |
| `env.test.ts` | Production fail-closed, public-RPC rejection, no value leakage |

---

## Known limitations

Full detail in `docs/implementation/ASSUMPTIONS_AND_BLOCKERS.md`.

- **No migrations yet** — `db push` only. Release blocker.
- **No CI/CD.**
- **No E2E tests** (no Playwright).
- **No live Solana call verified** — the client is implemented and unit-tested against injected
  responses; no dedicated RPC endpoint is configured.
- **No live payment verified** — verification logic exists; no transaction was submitted.
- **No bank provider** — only a clearly-labelled `demo` provider.
- **No MFA / passkeys / step-up auth** — sessions only.
- **Single-currency** — multi-currency totals are excluded rather than converted at an invented rate.
- **Import is synchronous**, capped at 100k rows / 25 MB.

## Security

- CSP, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` on every response
  (`src/middleware.ts`).
- Sliding-window rate limiting per principal and route bucket, stricter on auth/billing/wallets.
- bcrypt (cost 12) password hashing; SHA-256-hashed session tokens; HttpOnly, SameSite cookies
  with server-side revocation.
- AES-256-GCM encryption for provider credentials at rest.
- Per-record authorization on every user route (41/45 handlers authenticate; the other 4 are
  pre-session or re-exports).
- RFC 7807 error envelope with stable machine codes; no stack traces, SQL or secrets to clients.
- Append-only audit trail for security-relevant actions.

If you find a vulnerability, please report it privately rather than opening a public issue.

## Documentation

| Document | Purpose |
|---|---|
| `docs/implementation/REPOSITORY_AUDIT.md` | Phase 0 — what existed, what was broken, what changed |
| `docs/implementation/BASELINE.md` | Exact commands and before/after results |
| `docs/implementation/EXECUTION_PLAN.md` | Requirement → code → test → evidence |
| `docs/implementation/ASSUMPTIONS_AND_BLOCKERS.md` | Assumptions, external blockers, honest non-claims |
| `docs/adr/0001-architecture-baseline.md` | Why a single Next.js app, not a monorepo |
| `upload/rillio_extracted/rillio_blueprint/` | The source specification |

## License

Private / unlicensed. All rights reserved.