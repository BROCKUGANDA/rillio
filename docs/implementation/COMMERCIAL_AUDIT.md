# Commercial & Enterprise Audit

## Money
- All amounts BigInt minor units (src/lib/money.ts) — enforced.
- No float money in billing settlement (amountMinor BigInt).

## Security
- Auth sessions revocable; ownership filters on 41/45 handlers.
- Credentials AES-256-GCM at rest (src/lib/providers/registry.ts).
- Nonce hashed at rest (G7 closed).
- No seed phrases/private keys requested anywhere.

## Privacy
- Consent model, data export, deletion request with 30-day grace.
- AuditEvent trail for wallet/billing actions.

## Billing
- USDC + SOL onchain verification with replay protection.
- Entitlements reconciled server-side transactionally.
- Duplicate settlement = one transition.

## Gaps remaining (external)
- B1 dedicated RPC, B2 real treasury wallets, B3 legal, B4 trademark, B5 secret manager, B6 bank agreements.

## Gaps closed this pass
- G1 initial Prisma migration (PostgreSQL).
- G2 CI pipeline.
- G7 hashed nonce.
- G8 next-auth removed.
- G9 dead auth-screen removed.
- G5 runbooks (DB/RPC/PAYMENTS/SECRETS).
