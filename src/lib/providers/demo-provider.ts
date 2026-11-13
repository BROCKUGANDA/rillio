/**
 * Demo bank-statement provider.
 *
 * Returns clearly-labelled synthetic test data so the consent + sync pipeline
 * is fully exercisable in any environment without real bank API credentials.
 *
 * Per blueprint §4.2 FR-DATA-003 and "no fake functionality" rule:
 *   - This is explicitly labelled as DEMO data
 *   - Sync results carry a "demo" source provider
 *   - Transactions are seeded deterministically so the pipeline works
 *   - The UI clearly shows "Demo Provider — synthetic test data"
 *
 * In production this would be replaced (or supplemented) by Plaid, Teller,
 * MX, GoCardless, etc. implementing the BankProvider interface.
 */

import type { BankProvider, ProviderAccount, ProviderCredentialRef, ProviderInfo, ProviderSyncResult, ProviderTransaction } from "./types";

const DEMO_INFO: ProviderInfo = {
  code: "demo",
  name: "Rillio Demo Bank",
  description:
    "Synthetic test provider that returns realistic-looking sample transactions. Use this to try the full consent + sync flow without a real bank connection.",
  regions: ["global"],
  features: ["checking", "savings", "credit"],
  authMethods: ["demo"],
  isAvailable: true,
  availabilityNote: "Returns clearly-labelled synthetic test data. Not a real bank.",
  isDemo: true,
};

const DEMO_ACCOUNTS: ProviderAccount[] = [
  { id: "demo-checking-001", label: "Everyday Checking", currency: "USD", type: "checking", mask: "4242" },
  { id: "demo-savings-001", label: "Rainy Day Savings", currency: "USD", type: "savings", mask: "8821" },
  { id: "demo-credit-001", label: "Travel Credit Card", currency: "USD", type: "credit", mask: "1190" },
];

// Deterministic synthetic transactions — clearly labelled as demo
function buildDemoTransactions(accountId: string, startDate: Date, endDate: Date): ProviderTransaction[] {
  const txns: ProviderTransaction[] = [];
  const accounts: Record<string, { name: string; baseAmount: number; cadence: number }> = {
    "demo-checking-001": { name: "checking", baseAmount: 50, cadence: 3 },
    "demo-savings-001": { name: "savings", baseAmount: 200, cadence: 7 },
    "demo-credit-001": { name: "credit", baseAmount: 35, cadence: 2 },
  };
  const cfg = accounts[accountId];
  if (!cfg) return txns;

  const merchants = [
    { name: "Demo Grocery Co", desc: "Demo grocery purchase", amount: -cfg.baseAmount * 1.8 },
    { name: "Demo Coffee Shop", desc: "Demo coffee", amount: -cfg.baseAmount * 0.15 },
    { name: "Demo Ride Service", desc: "Demo ride", amount: -cfg.baseAmount * 0.4 },
    { name: "Demo Streaming Sub", desc: "Demo subscription", amount: -cfg.baseAmount * 0.3 },
    { name: "Demo Restaurant", desc: "Demo meal", amount: -cfg.baseAmount * 0.7 },
    { name: "Demo Utility Co", desc: "Demo utility bill", amount: -cfg.baseAmount * 1.2 },
    { name: "Demo Pharmacy", desc: "Demo prescription", amount: -cfg.baseAmount * 0.25 },
  ];

  // Salary deposit every ~14 days for checking
  if (accountId === "demo-checking-001") {
    const t = new Date(startDate);
    while (t <= endDate) {
      if (t.getDay() === 1 || t.getDay() === 4) {
        txns.push({
          externalId: `demo-${accountId}-salary-${t.toISOString().slice(0, 10)}`,
          occurredAt: t.toISOString(),
          description: "Demo payroll deposit (DEMO DATA)",
          merchantName: "Demo Employer Inc",
          amount: "2400.00",
          currency: "USD",
          accountExternalId: accountId,
          status: "posted",
        });
      }
      t.setDate(t.getDate() + 1);
    }
  }

  // Spread merchant transactions across the period
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const txnCount = Math.min(Math.floor(days / cfg.cadence), 30);
  for (let i = 0; i < txnCount; i++) {
    const dayOffset = Math.floor((i * days) / Math.max(1, txnCount)) + (i % 5);
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayOffset);
    if (date > endDate) continue;
    const merchant = merchants[i % merchants.length];
    const variance = (i * 7) % 20 - 10; // ±10% variance
    const amount = merchant.amount * (1 + variance / 100);
    txns.push({
      externalId: `demo-${accountId}-${i}-${date.toISOString().slice(0, 10)}`,
      occurredAt: date.toISOString(),
      description: `${merchant.desc} (DEMO DATA)`,
      merchantName: merchant.name,
      amount: amount.toFixed(2),
      currency: "USD",
      accountExternalId: accountId,
      status: i % 11 === 0 ? "pending" : "posted",
    });
  }

  return txns.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

class DemoProvider implements BankProvider {
  readonly info = DEMO_INFO;

  async listAccounts(_credential: ProviderCredentialRef): Promise<ProviderAccount[]> {
    return DEMO_ACCOUNTS;
  }

  async fetchTransactions(
    _credential: ProviderCredentialRef,
    accountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProviderTransaction[]> {
    // Simulate slight network delay
    await new Promise((r) => setTimeout(r, 250));
    return buildDemoTransactions(accountId, startDate, endDate);
  }

  async refreshCredential(credential: ProviderCredentialRef): Promise<ProviderCredentialRef | null> {
    // Demo credentials don't expire
    return null;
  }

  async revoke(_credential: ProviderCredentialRef): Promise<void> {
    // Nothing to revoke server-side
  }
}

export const demoProvider = new DemoProvider();
