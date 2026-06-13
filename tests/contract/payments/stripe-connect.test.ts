/**
 * Stripe Connect service contract tests (T068).
 *
 * Verifies: account creation with onboarding link, account status retrieval,
 * application fee calculation, missing platform key error, and onboarding
 * link generation for existing accounts.
 */

import { describe, it, expect } from "vitest";
import {
  StripeConnectService,
  FakeStripeHttp,
} from "@saas-reservas/api/application/payments/stripe-connect-service";
import {
  EnvelopeCredentialVault,
  InMemoryKmsAdapter,
  InMemoryVaultStorage,
} from "@saas-reservas/integrations/security/credential-vault";

function makeService() {
  const kms = new InMemoryKmsAdapter();
  const storage = new InMemoryVaultStorage();
  const vault = new EnvelopeCredentialVault(kms, storage);
  const http = new FakeStripeHttp();
  const svc = new StripeConnectService(vault, http);
  return { vault, http, svc };
}

async function seedPlatformKey(vault: InstanceType<typeof EnvelopeCredentialVault>) {
  await vault.store("platform", "stripe", "secret_key", "sk_test_platform");
}

describe("StripeConnectService", () => {
  describe("createConnectedAccount", () => {
    it("creates an account and stores the account_id in vault", async () => {
      const { vault, http, svc } = makeService();
      await seedPlatformKey(vault);

      http.onPost("/v1/accounts", () => ({
        status: 200,
        data: { id: "acct_1234", charges_enabled: false, payouts_enabled: false },
      }));
      http.onPost("/v1/account_links", () => ({
        status: 200,
        data: { url: "https://connect.stripe.com/setup/acct_1234" },
      }));

      const account = await svc.createConnectedAccount("t1", {
        email: "tenant@example.com",
        country: "ES",
        returnUrl: "https://app.example.com/connect/return",
        refreshUrl: "https://app.example.com/connect/refresh",
      });

      expect(account.stripeAccountId).toBe("acct_1234");
      expect(account.status).toBe("onboarding");
      expect(account.onboardingUrl).toContain("connect.stripe.com");

      const stored = await vault.retrieve("t1", "stripe_connect", "account_id");
      expect(stored).toBe("acct_1234");
    });

    it("throws when platform secret key is not configured", async () => {
      const { svc } = makeService();
      await expect(
        svc.createConnectedAccount("t1", {
          email: "x@example.com",
          country: "ES",
          returnUrl: "https://example.com",
          refreshUrl: "https://example.com",
        }),
      ).rejects.toThrow("Platform Stripe secret key");
    });
  });

  describe("getAccountStatus", () => {
    it("returns null when no account is stored for tenant", async () => {
      const { vault, svc } = makeService();
      await seedPlatformKey(vault);
      expect(await svc.getAccountStatus("t1")).toBeNull();
    });

    it("returns active status when charges are enabled", async () => {
      const { vault, http, svc } = makeService();
      await seedPlatformKey(vault);
      await vault.store("t1", "stripe_connect", "account_id", "acct_active");

      http.onGet("/v1/accounts/acct_active", () => ({
        status: 200,
        data: { id: "acct_active", charges_enabled: true, payouts_enabled: true },
      }));

      const status = await svc.getAccountStatus("t1");
      expect(status?.status).toBe("active");
      expect(status?.chargesEnabled).toBe(true);
    });

    it("returns onboarding status when charges are not yet enabled", async () => {
      const { vault, http, svc } = makeService();
      await seedPlatformKey(vault);
      await vault.store("t1", "stripe_connect", "account_id", "acct_pending");

      http.onGet("/v1/accounts/acct_pending", () => ({
        status: 200,
        data: { id: "acct_pending", charges_enabled: false, payouts_enabled: false },
      }));

      const status = await svc.getAccountStatus("t1");
      expect(status?.status).toBe("onboarding");
    });
  });

  describe("calculateApplicationFee", () => {
    it("calculates 2% fee correctly (200 basis points)", () => {
      const { svc } = makeService();
      const { fee, net } = svc.calculateApplicationFee(10000, 200);
      expect(fee).toBe(200);
      expect(net).toBe(9800);
    });

    it("rounds fee to integer minor units", () => {
      const { svc } = makeService();
      const { fee, net } = svc.calculateApplicationFee(333, 150);
      expect(fee).toBe(5); // 333 * 0.015 = 4.995 → rounds to 5
      expect(net).toBe(328);
    });

    it("fee + net always equals original amount", () => {
      const { svc } = makeService();
      for (const [amount, bps] of [
        [100, 250],
        [9999, 175],
        [1, 1000],
      ] as const) {
        const { fee, net } = svc.calculateApplicationFee(amount, bps);
        expect(fee + net).toBe(amount);
      }
    });
  });

  describe("createOnboardingLink", () => {
    it("generates a new onboarding link for an existing account", async () => {
      const { vault, http, svc } = makeService();
      await seedPlatformKey(vault);
      await vault.store("t1", "stripe_connect", "account_id", "acct_existing");

      http.onPost("/v1/account_links", () => ({
        status: 200,
        data: { url: "https://connect.stripe.com/onboard/acct_existing" },
      }));

      const url = await svc.createOnboardingLink("t1", {
        returnUrl: "https://app.example.com/return",
        refreshUrl: "https://app.example.com/refresh",
      });
      expect(url).toContain("acct_existing");
    });

    it("throws when no account is stored for tenant", async () => {
      const { vault, svc } = makeService();
      await seedPlatformKey(vault);
      await expect(
        svc.createOnboardingLink("t1", {
          returnUrl: "https://example.com",
          refreshUrl: "https://example.com",
        }),
      ).rejects.toThrow("No connected account");
    });
  });
});
