# Runbook: Solana RPC

## Production config
- Set SOLANA_RPC_URL to a dedicated endpoint (Helius/QuickNode/Triton) plus SOLANA_RPC_FALLBACK_URL.
- Never ship the public mainnet endpoint to production.

## Degraded mode
- `checkSolanaBoundary()` returns kind "missing_config" / "public_rpc" when misconfigured.
- Portfolio UI shows stale badge; balances are never zeroed.
- Alert on 3 consecutive RPC failures; page on-call if > 5 min.

## Verification
- `curl` the RPC health endpoint; run `/api/wallets/[id]/refresh` for a known wallet and confirm non-stale.
