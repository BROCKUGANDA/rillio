import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { checkSolanaBoundary } from "@/lib/solana";

/**
 * GET /api/portfolio/summary
 *
 * Returns portfolio totals ONLY when balances have been observed and priced.
 * If RPC is not configured, returns an explicit boundary state — no fake totals.
 * Unknown/unpriced/spam assets are returned as counts, not silently excluded.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const boundary = checkSolanaBoundary();

  const wallets = await db.wallet.findMany({
    where: { userId: user.id, disconnectedAt: null },
    include: { tokenAccounts: true },
  });

  if (wallets.length === 0) {
    return NextResponse.json({
      hasWallet: false,
      boundary,
      totalUsd: null,
      pricedAssetCount: 0,
      unpricedAssetCount: 0,
      unverifiedAssetCount: 0,
      wallets: [],
    });
  }

  // Aggregate from observed token accounts (only real observed data)
  let totalUsdCents = 0n;
  let pricedCount = 0;
  let unpricedCount = 0;
  let unverifiedCount = 0;
  const assets: Array<{
    mint: string;
    symbol: string | null;
    name: string | null;
    baseUnitAmount: string;
    decimals: number;
    priceUsd: string | null;
    priceSource: string | null;
    priceObservedAt: string | null;
    verified: boolean;
    unpriced: boolean;
    valueUsdMinor: string | null;
    walletAddress: string;
  }> = [];

  for (const w of wallets) {
    for (const ta of w.tokenAccounts) {
      if (!ta.verified) unverifiedCount++;
      if (ta.unpriced || !ta.priceQuoteUsd) {
        unpricedCount++;
        assets.push({
          mint: ta.mint,
          symbol: ta.symbol,
          name: ta.name,
          baseUnitAmount: ta.baseUnitAmount,
          decimals: ta.decimals,
          priceUsd: null,
          priceSource: ta.priceSource,
          priceObservedAt: ta.priceObservedAt?.toISOString() ?? null,
          verified: ta.verified,
          unpriced: true,
          valueUsdMinor: null,
          walletAddress: w.address,
        });
      } else {
        pricedCount++;
        // valueUsd = baseUnits / 10^decimals * priceUsd -> in minor USD (cents)
        // baseUnits * priceUsd / 10^decimals * 100
        const baseUnits = BigInt(ta.baseUnitAmount);
        const priceScaled = Math.round(Number(ta.priceQuoteUsd) * 100); // cents per whole token
        const valueUsdMinor = (baseUnits * BigInt(priceScaled)) / BigInt(10 ** ta.decimals);
        totalUsdCents += valueUsdMinor;
        assets.push({
          mint: ta.mint,
          symbol: ta.symbol,
          name: ta.name,
          baseUnitAmount: ta.baseUnitAmount,
          decimals: ta.decimals,
          priceUsd: ta.priceQuoteUsd,
          priceSource: ta.priceSource,
          priceObservedAt: ta.priceObservedAt?.toISOString() ?? null,
          verified: ta.verified,
          unpriced: false,
          valueUsdMinor: valueUsdMinor.toString(),
          walletAddress: w.address,
        });
      }
    }
  }

  return NextResponse.json({
    hasWallet: true,
    boundary,
    totalUsdMinor: totalUsdCents.toString() || null,
    quoteCurrency: "USD",
    pricedAssetCount: pricedCount,
    unpricedAssetCount: unpricedCount,
    unverifiedAssetCount: unverifiedCount,
    snapshotAt: new Date().toISOString(),
    stale: boundary.kind === "not_configured",
    wallets: wallets.map((w) => ({ id: w.id, address: w.address, verification: w.verification, lastScanAt: w.lastScanAt?.toISOString() ?? null })),
    assets,
  });
}
