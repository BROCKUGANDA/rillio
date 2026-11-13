/**
 * Bank / financial-data provider adapter interface.
 *
 * Per blueprint §4.2 FR-DATA-003, §10.4 Financial connections domain:
 *   - Provider adapters only in markets with verified coverage and agreements
 *   - Explicit consent, encrypted credentials, signed webhooks, refresh/revoke
 *   - Historical data retained per policy
 *
 * Real providers (Plaid, Teller, MX, GoCardless, etc.) implement this interface.
 * The DemoProvider below returns clearly-labelled synthetic test data so the
 * consent + sync pipeline is fully exercisable in any environment.
 */

export type ProviderAccount = {
  id: string;
  label: string;
  currency: string;
  type: string; // checking | savings | credit | investment
  mask?: string;
};

export type ProviderTransaction = {
  externalId: string;
  occurredAt: string; // ISO
  description: string;
  merchantName?: string;
  amount: string; // signed decimal string
  currency: string;
  accountExternalId: string;
  status: string; // posted | pending
};

export type ProviderInfo = {
  code: string;
  name: string;
  description: string;
  logo?: string;
  regions: string[];
  features: string[];
  authMethods: string[];
  isAvailable: boolean;
  availabilityNote?: string;
  isDemo?: boolean;
};

export type ProviderSyncResult = {
  accounts: ProviderAccount[];
  transactions: ProviderTransaction[];
  syncToken?: string;
  completedAt: string;
};

export interface BankProvider {
  readonly info: ProviderInfo;

  /**
   * List accounts accessible under a connection.
   */
  listAccounts(credential: ProviderCredentialRef): Promise<ProviderAccount[]>;

  /**
   * Fetch transactions for an account since the given date.
   */
  fetchTransactions(
    credential: ProviderCredentialRef,
    accountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProviderTransaction[]>;

  /**
   * Refresh access token if needed. Returns updated credential or null if
   * no refresh was required.
   */
  refreshCredential?(credential: ProviderCredentialRef): Promise<ProviderCredentialRef | null>;

  /**
   * Revoke the connection on the provider side.
   */
  revoke?(credential: ProviderCredentialRef): Promise<void>;
}

export type ProviderCredentialRef = {
  ciphertext: string;
  iv: string;
  algorithm: string;
  // Decrypted plaintext (only set in trusted server context)
  plaintext?: string;
};
