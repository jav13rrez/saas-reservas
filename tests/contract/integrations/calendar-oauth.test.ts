/**
 * T063 – Calendar OAuth gateway contract tests.
 *
 * Verifies: platform-mode vs tenant-owned credential routing, authorization
 * URL construction, code exchange storing tokens in the vault, token refresh
 * using the stored refresh token, token revocation, and missing-credential errors.
 */

import { describe, it, expect } from "vitest";
import {
  OAuthCalendarGateway,
  FakeHttpAdapter,
} from "@saas-reservas/integrations/calendar/calendar-oauth-gateway";
import {
  EnvelopeCredentialVault,
  InMemoryKmsAdapter,
  InMemoryVaultStorage,
} from "@saas-reservas/integrations/security/credential-vault";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

function makeGateway() {
  const kms = new InMemoryKmsAdapter();
  const storage = new InMemoryVaultStorage();
  const vault = new EnvelopeCredentialVault(kms, storage);
  const http = new FakeHttpAdapter();
  const gateway = new OAuthCalendarGateway(vault, http);
  return { vault, http, gateway };
}

async function seedPlatformCreds(
  vault: InstanceType<typeof EnvelopeCredentialVault>,
  provider: "google" | "microsoft" = "google",
) {
  await vault.store("platform", provider, "client_id", "platform-client-id");
  await vault.store("platform", provider, "client_secret", "platform-secret");
}

async function seedTenantCreds(
  vault: InstanceType<typeof EnvelopeCredentialVault>,
  tenantId: string,
  provider: "google" | "microsoft" = "google",
) {
  await vault.store(tenantId, provider, "client_id", `${tenantId}-client-id`);
  await vault.store(tenantId, provider, "client_secret", `${tenantId}-secret`);
}

describe("OAuthCalendarGateway", () => {
  describe("getAuthorizationUrl", () => {
    it("platform-mode uses platform client_id", async () => {
      const { vault, gateway } = makeGateway();
      await seedPlatformCreds(vault);
      const url = await gateway.getAuthorizationUrl({
        provider: "google",
        tenantId: "t1",
        redirectUri: "https://app.example.com/oauth/callback",
        state: "csrf-token",
        mode: "platform",
      });
      expect(url).toContain(GOOGLE_AUTH_URL);
      expect(url).toContain("client_id=platform-client-id");
      expect(url).toContain("state=csrf-token");
    });

    it("tenant-owned mode uses tenant client_id", async () => {
      const { vault, gateway } = makeGateway();
      await seedTenantCreds(vault, "t1");
      const url = await gateway.getAuthorizationUrl({
        provider: "google",
        tenantId: "t1",
        redirectUri: "https://app.example.com/oauth/callback",
        state: "csrf-token",
        mode: "tenant-owned",
      });
      expect(url).toContain("client_id=t1-client-id");
    });

    it("throws when client_id is missing", async () => {
      const { gateway } = makeGateway();
      await expect(
        gateway.getAuthorizationUrl({
          provider: "google",
          tenantId: "t1",
          redirectUri: "https://example.com",
          state: "s",
          mode: "platform",
        }),
      ).rejects.toThrow("client_id");
    });
  });

  describe("exchangeCode", () => {
    it("stores access and refresh tokens in vault after successful exchange", async () => {
      const { vault, http, gateway } = makeGateway();
      await seedPlatformCreds(vault);
      http.register(GOOGLE_TOKEN_URL, () => ({
        status: 200,
        data: {
          access_token: "at-xyz",
          refresh_token: "rt-xyz",
          expires_in: 3600,
          scope: "https://www.googleapis.com/auth/calendar",
          token_type: "Bearer",
        },
      }));
      const tokens = await gateway.exchangeCode({
        provider: "google",
        tenantId: "t1",
        code: "auth-code-123",
        redirectUri: "https://example.com/callback",
        mode: "platform",
      });
      expect(tokens.accessToken).toBe("at-xyz");
      expect(tokens.refreshToken).toBe("rt-xyz");

      const stored = await gateway.getStoredTokens("t1", "google");
      expect(stored?.accessToken).toBe("at-xyz");
    });

    it("throws on non-200 response", async () => {
      const { vault, http, gateway } = makeGateway();
      await seedPlatformCreds(vault);
      http.register(GOOGLE_TOKEN_URL, () => ({ status: 400, data: { error: "bad_request" } }));
      await expect(
        gateway.exchangeCode({
          provider: "google",
          tenantId: "t1",
          code: "bad-code",
          redirectUri: "https://example.com",
          mode: "platform",
        }),
      ).rejects.toThrow("400");
    });
  });

  describe("refreshAccessToken", () => {
    it("uses stored refresh token to get new access token", async () => {
      const { vault, http, gateway } = makeGateway();
      await seedPlatformCreds(vault);
      await vault.store("t1", "google", "refresh_token", "existing-rt");

      http.register(GOOGLE_TOKEN_URL, (body) => {
        expect(body.refresh_token).toBe("existing-rt");
        return {
          status: 200,
          data: {
            access_token: "new-at",
            expires_in: 3600,
            scope: "https://www.googleapis.com/auth/calendar",
            token_type: "Bearer",
          },
        };
      });

      const tokens = await gateway.refreshAccessToken({
        provider: "google",
        tenantId: "t1",
        mode: "platform",
      });
      expect(tokens.accessToken).toBe("new-at");
      // Falls back to the existing refresh token when provider doesn't issue a new one
      expect(tokens.refreshToken).toBe("existing-rt");
    });

    it("throws when no refresh token is stored", async () => {
      const { vault, gateway } = makeGateway();
      await seedPlatformCreds(vault);
      await expect(
        gateway.refreshAccessToken({ provider: "google", tenantId: "t1", mode: "platform" }),
      ).rejects.toThrow("refresh token");
    });
  });

  describe("revokeTokens", () => {
    it("removes all token entries from the vault", async () => {
      const { vault, http, gateway } = makeGateway();
      await seedPlatformCreds(vault);
      http.register(GOOGLE_TOKEN_URL, () => ({
        status: 200,
        data: { access_token: "at", refresh_token: "rt", expires_in: 3600, token_type: "Bearer" },
      }));
      await gateway.exchangeCode({
        provider: "google",
        tenantId: "t1",
        code: "c",
        redirectUri: "https://example.com",
        mode: "platform",
      });

      await gateway.revokeTokens("t1", "google");
      expect(await gateway.getStoredTokens("t1", "google")).toBeNull();
    });
  });

  describe("tenant isolation", () => {
    it("two tenants store tokens independently", async () => {
      const { vault, http, gateway } = makeGateway();
      await seedPlatformCreds(vault);

      let callCount = 0;
      http.register(GOOGLE_TOKEN_URL, () => {
        callCount += 1;
        return {
          status: 200,
          data: {
            access_token: `at-${callCount.toString()}`,
            refresh_token: `rt-${callCount.toString()}`,
            expires_in: 3600,
            token_type: "Bearer",
          },
        };
      });

      await gateway.exchangeCode({
        provider: "google",
        tenantId: "t1",
        code: "c1",
        redirectUri: "https://example.com",
        mode: "platform",
      });
      await gateway.exchangeCode({
        provider: "google",
        tenantId: "t2",
        code: "c2",
        redirectUri: "https://example.com",
        mode: "platform",
      });

      const t1 = await gateway.getStoredTokens("t1", "google");
      const t2 = await gateway.getStoredTokens("t2", "google");
      expect(t1?.accessToken).not.toBe(t2?.accessToken);
    });
  });
});
