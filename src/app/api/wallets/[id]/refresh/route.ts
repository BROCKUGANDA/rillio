import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { checkSolanaBoundary } from "@/lib/solana";
import { observeWallet } from "@/lib/solana-rpc";

/**
 * POST /api/wallets/[id]/refresh
 * Re-observe the wallet onchain. Stale-data friendly: if RPC fails, prior
 * balances remain and a stale snapshot is recorded.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const { id } = await params;
  const wallet = await db.wallet.findFirst({ where: { id, userId: user.id } });
  if (!wallet) {
    return NextResponse.json(makeError("NOT_FOUND", "Wallet not found", "This wallet connection does not exist.", 404), { status: 404 });
  }
  if (wallet.disconnectedAt) {
    return NextResponse.json(makeError("WALLET_DISCONNECTED", "Wallet disconnected", "Reconnect this wallet to refresh.", 409), { status: 409 });
  }

  const boundary = checkSolanaBoundary();
  if (boundary.kind === "not_configured") {
    return NextResponse.json({
      ok: false,
      boundary,
      error: "RPC not configured. Cannot refresh onchain state.",
    });
  }

  try {
    const observation = await observeWallet(wallet.address);
    // Upsert token accounts
    for (const a of observation.tokenAccounts) {
      // Skip accounts with empty/invalid mint (defensive — should not happen)
      if (!a.mint || a.mint.length < 8) continue;
      const existing = await db.tokenAccount.findUnique({
        where: { walletId_mint: { walletId: wallet.id, mint: a.mint } },
      });
      const data = {
        mint: a.mint,
        tokenProgram: a.tokenProgram,
        symbol: a.symbol,
        name: a.name,
        decimals: a.decimals,
        baseUnitAmount: a.baseUnitAmount,
        snapshotAt: new Date(),
        verified: a.verified,
        unpriced: a.unpriced,
        priceQuoteUsd: a.priceUsd?.toString() ?? null,
        priceSource: a.priceSource,
        priceObservedAt: a.priceObservedAt,
      };
      if (existing) {
        await db.tokenAccount.update({ where: { id: existing.id }, data });
      } else {
        await db.tokenAccount.create({ data: { walletId: wallet.id, ...data } });
      }
    }
    await db.portfolioSnapshot.create({
      data: {
        userId: user.id,
        walletId: wallet.id,
        totalUsd: observation.totalUsdCents?.toString() ?? null,
        quoteCurrency: "USD",
        pricedAssetCount: observation.pricedAssetCount,
        unpricedAssetCount: observation.unpricedAssetCount,
        unverifiedAssetCount: observation.unverifiedAssetCount,
        snapshotAt: observation.observedAt,
        stale: observation.stale,
      },
    });
    await db.wallet.update({ where: { id: wallet.id }, data: { lastScanAt: new Date() } });
    return NextResponse.json({
      ok: true,
      boundary,
      stale: observation.stale,
      error: observation.error,
      pricedAssetCount: observation.pricedAssetCount,
      unpricedAssetCount: observation.unpricedAssetCount,
      totalUsdMinor: observation.totalUsdCents?.toString() ?? null,
      observedAt: observation.observedAt,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      boundary,
      error: e instanceof Error ? e.message : "Refresh failed",
    });
  }
}
