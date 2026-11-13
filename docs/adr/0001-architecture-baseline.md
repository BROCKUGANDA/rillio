# ADR 0001 — Architecture Baseline

**Status:** Accepted
**Date:** 2026-11-13
**Deciders:** Staff engineer implementation pass

---

## Context

The blueprint (§10) recommends a modular monolith plus independently deployable workers, a
`pnpm`/Turborepo monorepo layout (`apps/web`, `apps/api`, `apps/worker`, `apps/ops`,
`packages/*`), Fastify or NestJS for the API, and PostgreSQL as the source of truth.

The existing repository is a **single Next.js 16 application** with App Router route handlers,
Prisma + SQLite, and an in-process rate limiter. It works, it is already structured by domain,
and it has a substantial UI.

The implementation contract (§22.2 rule 2, "Preserve working code") says: no rewrite without
an ADR and a concrete reason.

## Decision

**Keep the single Next.js application. Do not restructure into a monorepo.**

Concretely:

| Concern | Decision |
|---|---|
| Deployment unit | One Next.js app (App Router). API routes are the BFF/API layer. |
| Domain boundaries | Enforced by folder + import discipline inside `src/lib/<domain>/` and `src/app/api/<domain>/`, not by separate packages. |
| Database | Stay on SQLite via Prisma for local/dev/MVP. Migrations required before any release. |
| Background work | Inline in request handlers for MVP (imports parse synchronously, capped at 100k rows). Documented as the seam where a worker/queue gets introduced. |
| Rate limiting | In-process sliding window. Interface documented so a Redis store drops in. |
| Auth | Existing custom cookie-session auth (not next-auth). |
| Solana client | Hand-rolled JSON-RPC over `fetch`, not `@solana/kit`. |

## Rationale

1. **The blueprint permits it.** §10.2: "Use pnpm workspaces + Turborepo **or the repository's
   proven equivalent**. Do not force a rewrite if an existing project is sound." §22.4: "Select
   the smallest compatible architecture."
2. **Cost/benefit.** Splitting into `apps/*` + `packages/*` would add build orchestration,
   cross-package type plumbing and CI complexity without changing a single line of product
   behaviour. The team gets no user-visible benefit.
3. **The domain boundaries already exist** as module boundaries. `src/lib/{money,csv,categorize,
   goals,solana,solana-rpc,billing,providers,audit,rate-limit,env,auth,errors}.ts` is a clean
   domain layer. If a service later needs to scale independently, these modules are the
   extraction surface — no re-architecture required, just a move.
4. **Prisma + SQLite is adequate for the two-week MVP** and matches what the existing `.zscripts`
   deployment already ships (`db/custom.db` is packaged into the artifact).
5. **`@solana/kit` vs hand-rolled RPC:** the blueprint §14.1 prefers Kit. The existing
   `solana-rpc.ts` already implements the required reads (balance, token accounts by owner,
   mint info, signature status, `getTransaction`) with full control over timeouts, error
   mapping and freshness metadata, and has no version-drift risk. **Deviation accepted**, to be
   revisited if transaction *sending* is ever added (Kit's transaction builder would be the
   right tool then). This is recorded in `ASSUMPTIONS_AND_BLOCKERS.md`.

## Consequences

**Positive**
- Zero re-platforming risk; all effort goes into correctness, tests and docs.
- One deployable, one set of env vars, one build.
- Domain modules are already isolated and unit-tested, so extraction stays cheap.

**Negative / accepted costs**
- No independent scaling of ingestion vs API. Acceptable at 100k registered / 10k DAU design
  target (§5) on a single node; revisit with evidence.
- Import work blocks a request thread for large files. Mitigated by the 100k row cap and the
  25 MB upload cap; the queue-based path is the documented next step.
- `ops` console (§3, `/ops/*`) is not implemented. Operators use the API + DB directly.
  **Gap, not a decision** — see `EXECUTION_PLAN.md`.
- In-process rate limiting is per-instance; a multi-instance deployment needs Redis.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Full monorepo (`apps/*` + `packages/*`) | No product benefit at this stage; large plumbing cost; blueprint explicitly allows the repo's proven equivalent. |
| Fastify/NestJS API beside Next.js | Duplicates routing, auth, validation and types; doubles the surface to secure. |
| PostgreSQL now | Requires a running server for every dev/test; SQLite is sufficient for MVP and already wired into deployment. Migrations make the swap mechanical later. |
| `@solana/kit` rewrite | No functional gain for read-only MVP; introduces dependency-version risk. Revisit if sending is added. |