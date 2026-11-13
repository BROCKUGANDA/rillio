# EXECUTION_PLAN

Traceability from blueprint requirement → implementation → test → evidence, per the contract
(§22.4 Phase 1). Statuses use the mandated vocabulary:
`NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED_NOT_VERIFIED`, `VERIFIED`, `RELEASED`.

**Snapshot date:** 2026-11-13. Working document; update as evidence lands.

---

## 1. MVP requirements (Phase 1 scope)

| ID | Requirement | Status | Implementation | Test |
|---|---|---|---|---|
| FR-AUTH-001 | Register/login/logout, secure cookies, revocation, no enumeration | **VERIFIED** | `src/lib/auth.ts`, `api/auth/*` | build + inspection |
| FR-AUTH-002 | MFA/passkeys, step-up, session list + revoke | **NOT_STARTED** | Session list/revoke only | — |
| FR-AUTH-003 | Wallet connect distinct from login; read-only | **VERIFIED** | `api/wallets/challenge`, `/verify` | `solana-verify.test.ts` |
| FR-AUTH-004 | Roles; per-record ownership; audited elevation | **IN_PROGRESS** | 41/45 handlers filter by `userId`; no RBAC/`/ops` | — |
| FR-DATA-001 | CSV import, mapping, malformed rows, idempotent | **VERIFIED** | `lib/csv.ts`, `api/imports` | `csv.test.ts` (20) |
| FR-DATA-002 | Immutable raw evidence separate from normalized | **VERIFIED** | `RawTransaction` vs `Transaction` | `csv.test.ts` |
| FR-DATA-003 | Provider adapters gated; encrypted creds; webhooks | **IN_PROGRESS** | `lib/providers/*`, AES-256-GCM | only `demo`; no webhook receiver |
| FR-DATA-004 | No float money; ISO currency; FX source | **VERIFIED** (core) | `lib/money.ts` BigInt | `money.test.ts` (14); **FX not implemented** |
| FR-DATA-005 | Provider IDs else deterministic fingerprint | **VERIFIED** | `fingerprintParts()` | `csv.test.ts` |
| FR-CAT-001 | Deterministic categories, corrections, history, bulk | **VERIFIED** | `lib/categorize.ts`, history + bulk routes | `categorize.test.ts` (8) |
| FR-CASH-001 | Inflow/outflow/net/category; pending/refund/transfer; TZ | **IN_PROGRESS** | `api/transactions` POST, `api/insights` | treatment not surfaced |
| FR-GOAL-001 | Create/edit/pause/archive with validation | **VERIFIED** | `api/goals` + `[id]/{pause,archive}` | `goals.test.ts` |
| FR-GOAL-002 | Deterministic projections; no implicit yield | **VERIFIED** | `lib/goals.ts` | `goals.test.ts` (10) |
| FR-GOAL-003 | Plan ≠ held funds | **VERIFIED** | `Goal`/`GoalEvent` planning records | `goals.test.ts` |
| FR-CHAIN-001 | Connect/disconnect/account-change/unsupported | **IN_PROGRESS** | discovery in `portfolio-view.tsx` | no Kit; account-change unverified |
| FR-CHAIN-002 | SOL + SPL/Token-2022; mint/program/decimals; stale≠zero | **IN_PROGRESS** | `lib/solana-rpc.ts` | **no live RPC test**; 25-account cap |
| FR-CHAIN-003 | Valuation + provenance/staleness/missing price | **IN_PROGRESS** | `api/portfolio/summary` | **no live price fetch**; placeholder USDT feed |
| FR-CHAIN-005 | One-time domain-bound challenge; hashed nonce | **IN_PROGRESS** | challenge + verify routes | 11 tests; **nonce plaintext in audit** (G7) |
| FR-NOT-001 | Durable notifications, event-linked, idempotent | **IN_PROGRESS** | `Notification` model + writers | no idempotency key |
| FR-PRIV-001 | Dated/versioned consent; revoke + cleanup | **IN_PROGRESS** | `Consent`, `api/security/consents` | no cleanup job |
| FR-PRIV-002 | Protected export + deletion with retention | **VERIFIED** (MVP) | `api/me/data-export`, `/deletion-request` | 30-day grace documented |
| FR-PAY-001 | Checkout, webhooks, cancel, invoices, reconciliation | **IN_PROGRESS** | `lib/billing/*`, `api/billing/*` | **no webhooks**; no billing E2E |
| FR-PAY-002 | USDC checks: sig/amount/mint/recipient/ref/finality | **IN_PROGRESS** | `lib/billing/usdc.ts`, `sol.ts` | checks present; **no live verification** |

**P1/P2** (FR-CHAIN-004, FR-CASH-002/003, FR-CAT-002, FR-SOC-*, FR-NOT-002/003, FR-PAY-003,
FR-GOAL-004): **NOT_STARTED** — out of MVP scope per §6 Phase 1.

## 2. Non-functional requirements (§5)

| Area | Target | Status |
|---|---|---|
| API latency p95 < 400 ms | — | **NOT MEASURED** |
| Import 100k rows without timeout | — | **NOT MEASURED** (cap enforced in code) |
| No unresolved critical/high findings | — | **NOT MEASURED** (no SAST/DAST) |
| WCAG 2.2 AA | — | **NOT MEASURED** |
| Recovery RPO 5 min / RTO 60 min | — | **NOT TESTED** |
| Traces across import/billing/chain | — | **IN_PROGRESS** (JSON logs + request id; no OTel) |

## 3. Phase gates

| Gate | Requirement | Status |
|---|---|---|
| 0 | Baseline + architecture documented first | **PASS** |
| 1 | Every P0 mapped, none omitted | **PASS** |
| 2 | Boot + quality checks; no secret leakage | **PASS** — 0 type errors, 0 lint errors, 77/77 tests, build OK |
| 3 | Every user endpoint enforces ownership | **PASS (note)** — 41/45 authenticate; other 4 pre-session/re-export |
| 4 | Ingestion tests; totals reconcile | **PASS** — 20 CSV tests |
| 5 | Corrections recompute; goals never move balances | **PASS** |
| 6 | Real Devnet read-only; no transfer path; prod rejects public RPC | **PARTIAL** — no live fetch |
| 7 | No entitlement from redirect; duplicate webhook = one transition | **PARTIAL** — no webhook receiver |
| 8 | Journeys on desktop/tablet/mobile + keyboard | **NOT VERIFIED** |
| 9 | Outage → alert + degraded UI; runbooks | **NOT STARTED** |
| 10 | All P0 acceptance criteria pass | **NOT MET** |
| 11 | Deployment readiness | **NOT MET** — B1–B5 open |

## 4. Task ledger

| Task | Status |
|---|---|
| T1 Repository reconnaissance | ✅ Done |
| T2 Plan + traceability | ✅ Done |
| T3 Foundations (types, env validation, `.env.example`, request id, error envelope, headers) | ✅ Done |
| T4 Fix build/type/lint failures | ✅ Done |
| T5 Fix pre-existing logic defects | ✅ Done |
| T6 Unit test suite | ✅ Done (77) |
| T7 Prisma migrations | ⬜ G1 |
| T8 CI pipeline | ⬜ G2 |
| T9 E2E (Playwright) | ⬜ G3 |
| T10 README | ⬜ G4 |
| T11 Runbooks | ⬜ G5 |
| T12 Load / fault / security testing | ⬜ G6 |
| T13 Remove `next-auth`, dead `auth-screen.tsx` | ⬜ G8, G9 |
| T14 Hash wallet challenge nonce at rest | ⬜ G7 |
| T15 Ops console (`/ops/*`) | ⬜ Not in MVP |
| T16 Outbox/inbox + queue workers | ⬜ Deferred with the worker seam |
| T17 Final engineering report | ⬜ |

## 5. Verification commands

```powershell
cd "D:\AI AZIMARA(AAA)\Rilio"
$env:npm_config_allow_scripts=$null
npm install --legacy-peer-deps
npx prisma generate
npx tsc --noEmit     # expect 0
npx eslint .         # expect 0 errors
npx vitest run       # expect 77 passed
npx next build       # expect success, 46 routes
```