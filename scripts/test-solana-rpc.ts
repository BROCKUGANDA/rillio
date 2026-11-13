/**
 * Quick test of the Solana RPC client against a real mainnet address.
 */
import { observeWallet } from "../src/lib/solana-rpc";

async function main() {
  // Use env var (set in .env)
  // Binance hot wallet — known active mainnet address with SOL + token accounts
  const address = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";
  console.log(`Observing ${address}...`);
  const observation = await observeWallet(address);
  console.log(JSON.stringify({
    boundary: observation.boundary,
    solBalance: observation.solBalance?.toString(),
    tokenAccounts: observation.tokenAccounts.length,
    pricedAssetCount: observation.pricedAssetCount,
    unpricedAssetCount: observation.unpricedAssetCount,
    unverifiedAssetCount: observation.unverifiedAssetCount,
    totalUsdCents: observation.totalUsdCents?.toString(),
    stale: observation.stale,
    error: observation.error,
    firstFewTokens: observation.tokenAccounts.slice(0, 5).map(t => ({
      mint: t.mint,
      symbol: t.symbol,
      amount: t.baseUnitAmount,
      decimals: t.decimals,
      verified: t.verified,
      unpriced: t.unpriced,
      priceUsd: t.priceUsd,
    })),
  }, null, 2));
}

main().catch(console.error);
