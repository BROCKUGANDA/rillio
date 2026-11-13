# Runbook: Payments

## Invariants
- No entitlement is granted from a browser redirect — only verified onchain settlement.
- Duplicate signature gives one transition (idempotent via PaymentSettlement.unique(signature)).

## USDC settlement
- Verify: signature, recipient, mint (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v), amount, reference, finality.
- Re-run `/api/billing/usdc/verify-payment` with the same signature → must return idempotent=true.

## SOL settlement
- Verify lamports amount, recipient, reference, finality via getTransaction.
- SOL price quoted as operator_fixed when oracle unreachable (labelled).

## Reconciliation
- Compare PaymentSettlement rows to provider records weekly.
- Escalate mismatches to finance + engineering.
