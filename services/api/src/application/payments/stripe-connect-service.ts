/**
 * Stripe Connect account connection and application fee model (T068).
 *
 * Supports both direct gateway mode (tenant provides their own Stripe keys)
 * and platform Connect mode (tenant goes through the platform's Stripe account
 * with application fee routing). Credentials stored in the credential vault.
 */

import type { CredentialVault } from "@saas-reservas/integrations/security/credential-vault";

// ---------------------------------------------------------------------------
// Stripe HTTP adapter boundary
// ---------------------------------------------------------------------------

export interface StripeHttpAdapter {
  post(
    path: string,
    body: Record<string, string>,
    secretKey: string,
  ): Promise<{ status: number; data: unknown }>;
  get(path: string, secretKey: string): Promise<{ status: number; data: unknown }>;
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type ConnectedAccountStatus =
  | "pending"
  | "onboarding"
  | "active"
  | "restricted"
  | "disabled";

export interface ConnectedAccount {
  tenantId: string;
  stripeAccountId: string;
  status: ConnectedAccountStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingUrl?: string | undefined;
}

export interface ApplicationFeeResult {
  /** Amount in integer minor units. */
  fee: number;
  /** Remaining amount after fee. */
  net: number;
}

// ---------------------------------------------------------------------------
// Stripe Connect service
// ---------------------------------------------------------------------------

export class StripeConnectService {
  private readonly PLATFORM_VAULT_TENANT = "platform";

  constructor(
    private readonly vault: CredentialVault,
    private readonly http: StripeHttpAdapter,
  ) {}

  private async getPlatformSecretKey(): Promise<string> {
    const key = await this.vault.retrieve(this.PLATFORM_VAULT_TENANT, "stripe", "secret_key");
    if (key === null) throw new Error("Platform Stripe secret key not configured");
    return key;
  }

  /** Create a new Stripe Express or Standard connected account for a tenant. */
  async createConnectedAccount(
    tenantId: string,
    opts: {
      email: string;
      country: string;
      accountType?: "express" | "standard";
      returnUrl: string;
      refreshUrl: string;
    },
  ): Promise<ConnectedAccount> {
    const secretKey = await this.getPlatformSecretKey();

    const resp = await this.http.post(
      "/v1/accounts",
      {
        type: opts.accountType ?? "express",
        email: opts.email,
        country: opts.country,
        "capabilities[card_payments][requested]": "true",
        "capabilities[transfers][requested]": "true",
      },
      secretKey,
    );
    if (resp.status !== 200)
      throw new Error(`Stripe account creation failed: ${resp.status.toString()}`);

    const account = resp.data as { id: string; charges_enabled: boolean; payouts_enabled: boolean };
    await this.vault.store(tenantId, "stripe_connect", "account_id", account.id);

    // Create onboarding link immediately
    const linkResp = await this.http.post(
      "/v1/account_links",
      {
        account: account.id,
        refresh_url: opts.refreshUrl,
        return_url: opts.returnUrl,
        type: "account_onboarding",
      },
      secretKey,
    );

    const link = linkResp.data as { url?: string };
    return {
      tenantId,
      stripeAccountId: account.id,
      status: "onboarding",
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      onboardingUrl: link.url,
    };
  }

  /** Retrieve current account status from Stripe. */
  async getAccountStatus(tenantId: string): Promise<ConnectedAccount | null> {
    const accountId = await this.vault.retrieve(tenantId, "stripe_connect", "account_id");
    if (accountId === null) return null;

    const secretKey = await this.getPlatformSecretKey();
    const resp = await this.http.get(`/v1/accounts/${accountId}`, secretKey);
    if (resp.status !== 200) throw new Error(`Failed to fetch account: ${resp.status.toString()}`);

    const data = resp.data as {
      id: string;
      charges_enabled: boolean;
      payouts_enabled: boolean;
      requirements?: { disabled_reason?: string };
    };

    let status: ConnectedAccountStatus = "active";
    if (!data.charges_enabled) {
      status = data.requirements?.disabled_reason ? "restricted" : "onboarding";
    }

    return {
      tenantId,
      stripeAccountId: data.id,
      status,
      chargesEnabled: data.charges_enabled,
      payoutsEnabled: data.payouts_enabled,
    };
  }

  /**
   * Calculate the platform application fee.
   * @param amount Total charge amount in integer minor units
   * @param feeBasisPoints Platform fee in basis points (e.g. 200 = 2%)
   */
  calculateApplicationFee(amount: number, feeBasisPoints: number): ApplicationFeeResult {
    const fee = Math.round((amount * feeBasisPoints) / 10_000);
    return { fee, net: amount - fee };
  }

  /** Generate a new Stripe Connect onboarding link for an existing account. */
  async createOnboardingLink(
    tenantId: string,
    opts: { returnUrl: string; refreshUrl: string },
  ): Promise<string> {
    const accountId = await this.vault.retrieve(tenantId, "stripe_connect", "account_id");
    if (accountId === null) throw new Error(`No connected account for tenant ${tenantId}`);

    const secretKey = await this.getPlatformSecretKey();
    const resp = await this.http.post(
      "/v1/account_links",
      {
        account: accountId,
        refresh_url: opts.refreshUrl,
        return_url: opts.returnUrl,
        type: "account_onboarding",
      },
      secretKey,
    );
    if (resp.status !== 200)
      throw new Error(`Failed to create onboarding link: ${resp.status.toString()}`);
    const link = resp.data as { url: string };
    return link.url;
  }
}

// ---------------------------------------------------------------------------
// Fake Stripe HTTP adapter for tests
// ---------------------------------------------------------------------------

export class FakeStripeHttp implements StripeHttpAdapter {
  private postHandlers = new Map<
    string,
    (body: Record<string, string>) => { status: number; data: unknown }
  >();
  private getHandlers = new Map<string, () => { status: number; data: unknown }>();

  onPost(
    path: string,
    fn: (body: Record<string, string>) => { status: number; data: unknown },
  ): void {
    this.postHandlers.set(path, fn);
  }

  onGet(path: string, fn: () => { status: number; data: unknown }): void {
    this.getHandlers.set(path, fn);
  }

  post(path: string, body: Record<string, string>): Promise<{ status: number; data: unknown }> {
    for (const [pattern, fn] of this.postHandlers) {
      if (path.includes(pattern)) return Promise.resolve(fn(body));
    }
    return Promise.resolve({ status: 404, data: { error: "no handler" } });
  }

  get(path: string): Promise<{ status: number; data: unknown }> {
    for (const [pattern, fn] of this.getHandlers) {
      if (path.includes(pattern)) return Promise.resolve(fn());
    }
    return Promise.resolve({ status: 404, data: { error: "no handler" } });
  }
}
