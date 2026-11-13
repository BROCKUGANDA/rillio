# ASSUMPTIONS AND BLOCKERS

What the implementation assumed, and what genuinely blocks a claim of completion. Per the
contract (§22.2 rule 15): "Ask no non-essential questions. Use reasonable defaults and document
assumptions. Stop only for genuine credential, account, provider, legal or product blockers."

---

## 1. Assumptions made

| # | Assumption | Why it is reasonable | If wrong |
|---|---|---|---|
| A1 | The uploaded blueprint is authoritative; `Rillio` remains a **working codename** pending trademark clearance. | The blueprint README says so explicitly. | Brand work (domain, company, mark) must be redone. |
| A2 | Local dev is Windows + Node/npm; Bun is unavailable. | Verified: no `bun` binary; `.zscripts` targets a Linux container. | `.zscripts` still uses Bun at deploy time; local gates run on npm. |
| A3 | SQLite is acceptable for the MVP. | Blueprint §10.2 permits the repo's proven equivalent; ADR 0001. | Swap `datasource db` to Postgres; migrations make it mechanical. |
| A4 | Synchronous CSV import is acceptable up to 100k rows / 25 MB. | §5 names 100k rows as the import target; a modular monolith may parse inline for MVP. | Large imports block a request; move to the documented worker seam. |
| A5 | A placeholder treasury wallet is acceptable **locally only**. | Clearly marked in `.env`; production env validation requires the key but does not detect a placeholder address. | Real payments go to the wrong wallet. **Do not run billing on mainnet with the placeholder.** |
| A6 | `SOL_PRICE_USD` as an operator-fixed fallback rate is acceptable if labelled. | `lib/billing/sol.ts` records `pricingMode: "operator_fixed"` and never presents it as an oracle quote. | Quote drift vs market. Review before charging. |
| A7 | A 30-day session TTL with revocation is sufficient for an MFA-less MVP. | FR-AUTH-002 asks for MFA "where supported"; no MFA provider is configured. | Higher account-takeover risk; add WebAuthn/TOTP before public launch. |
| A8 | English / USD-first is the initial locale and base currency. | Schema and UI defaults. | Multi-currency FX is not implemented; FR-DATA-004 requires an FX source for conversion. |
| A9 | No production user data exists yet. | Fresh repo, no migrations, no seed users. | — |

## 2. Blockers

### 2.1 Hard external blockers (not resolvable by writing code)

| # | Blocker | Blocks | What is needed |
|---|---|---|---|
| B1 | **No dedicated Solana RPC.** `.env` uses public `api.mainnet-beta.solana.com`; §14.3 forbids shared public RPC in production. | Production portfolio; Gate 6 | Helius / QuickNode / Triton key + independent fallback |
| B2 | **No real treasury wallets.** USDC and SOL recipient are the same placeholder. | Any real payment | Two funded, controlled wallets |
| B3 | **No legal/regulatory clearance.** §16.4 forbids claiming "regulated", "licensed", "compliant", "insured", "custody-safe", "investment-ready" without jurisdiction-specific counsel. | Public launch; any custody/execution feature | Qualified counsel per activity per jurisdiction |
| B4 | **No trademark/domain clearance for "Rillio".** The blueprint README records a conflicting application. | Public branding, domain, marketing | Trademark + company-name + domain review; likely a rename |
| B5 | **No `PROVIDER_CREDENTIAL_KEY`** in production. | Production boot (by design) | Secret-manager value (≥16 chars) |
| B6 | **No bank/provider agreements.** Only the `demo` provider exists. | Real bank connections | Signed agreement + verified market coverage |

### 2.2 Self-resolvable gaps (code/config — not correctness blockers)

| # | Gap | Severity | Plan |
|---|---|---|---|
| G1 | No `prisma/migrations/` | **Release blocker** | Generate an initial migration; adopt expand/migrate/contract |
| G2 | No CI/CD | **Release blocker** | Pipeline: lint → typecheck → test → build → migration check |
| G3 | No E2E tests | High | Playwright for the two MVP journeys (§19) |
| G4 | No `README.md` | Medium | Write it |
| G5 | No runbooks | High (§17) | API/DB/RPC/payment/secret-leak runbooks |
| G6 | No load/soak/fault-injection/SAST/DAST | Medium | Schedule; record results in the final report |
| G7 | Wallet challenge nonce stored as plaintext in `AuditEvent.metadata` | Medium | Hash the nonce at rest |
| G8 | `next-auth` declared but unused | Low | Remove from `package.json` (also clears the `ERESOLVE` conflict) |
| G9 | `src/components/rillio/auth-screen.tsx` unreferenced | Low | Delete or wire in |
| G10 | `examples/` has unresolved imports (`socket.io`, `socket.io-client`) | Low | Excluded from build; delete or complete |
| G11 | Env assertion must be confirmed to fire in the target runtime | Low | Verify in the deploy shell |

## 3. What is NOT claimed

- That the app is production-ready. It builds and its unit tests pass; that is not the same thing.
- That any bank connection, custody, transfer or investment feature works. None is implemented;
  the blueprint gates them.
- That Solana mainnet data has been fetched successfully from this machine. The RPC client is
  implemented and unit-tested against injected responses; no live call was made (no dedicated
  endpoint, and the public endpoint must not serve production).
- That any payment has been settled. Verification logic is implemented and type-checked; no real
  transaction was submitted or confirmed.
- That WCAG 2.2 AA conformance holds. Not tested.
- That the §5 performance targets are met. Not measured.

## 4. Recommended next actions, in order

1. Generate the initial Prisma migration (G1).
2. Add CI running the four gates that now pass (G2).
3. Remove `next-auth` (G8) and dead `auth-screen.tsx` (G9).
4. Write `README.md` (G4) and the runbooks (G5).
5. Add Playwright E2E for signup→import→recategorise→goal and signup→wallet→portfolio (G3).
6. Obtain a dedicated RPC and real treasury wallets (B1, B2) — **before** any mainnet demo.
7. Resolve the name and the regulatory position (B3, B4).