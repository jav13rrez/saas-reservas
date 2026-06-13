/**
 * Calendar OAuth gateway (T069, constitution principle IV).
 *
 * Two credential modes:
 *  - platform: one shared OAuth app; all tenants share the client id/secret
 *    stored in the vault under tenantId="platform".
 *  - tenant-owned: each tenant supplies their own Google/Microsoft OAuth app
 *    credentials, stored per-tenant in the vault.
 *
 * Token exchange and refresh are provider-agnostic via the HttpAdapter port
 * so that tests never hit the network.
 */

import type { CredentialVault } from "../security/credential-vault.js";

// ---------------------------------------------------------------------------
// HTTP adapter boundary (injected; never fetch() directly)
// ---------------------------------------------------------------------------

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
}

export interface HttpAdapter {
  post(
    url: string,
    body: Record<string, string>,
    headers?: Record<string, string>,
  ): Promise<{ status: number; data: unknown }>;
}

// ---------------------------------------------------------------------------
// Provider config
// ---------------------------------------------------------------------------

export type CalendarProvider = "google" | "microsoft";

const PROVIDER_TOKEN_URLS: Record<CalendarProvider, string> = {
  google: "https://oauth2.googleapis.com/token",
  microsoft: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
};

const PROVIDER_AUTH_URLS: Record<CalendarProvider, string> = {
  google: "https://accounts.google.com/o/oauth2/v2/auth",
  microsoft: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
};

const PROVIDER_SCOPES: Record<CalendarProvider, string> = {
  google: "https://www.googleapis.com/auth/calendar",
  microsoft: "Calendars.ReadWrite offline_access",
};

// ---------------------------------------------------------------------------
// Gateway interface
// ---------------------------------------------------------------------------

export interface AuthorizationParams {
  provider: CalendarProvider;
  tenantId: string;
  redirectUri: string;
  state: string;
  /** "platform" or "tenant-owned" */
  mode: "platform" | "tenant-owned";
}

export interface TokenExchangeParams {
  provider: CalendarProvider;
  tenantId: string;
  code: string;
  redirectUri: string;
  mode: "platform" | "tenant-owned";
}

export interface RefreshParams {
  provider: CalendarProvider;
  tenantId: string;
  mode: "platform" | "tenant-owned";
}

export interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scope: string;
}

export interface CalendarOAuthGateway {
  getAuthorizationUrl(params: AuthorizationParams): Promise<string>;
  exchangeCode(params: TokenExchangeParams): Promise<StoredTokens>;
  refreshAccessToken(params: RefreshParams): Promise<StoredTokens>;
  getStoredTokens(tenantId: string, provider: CalendarProvider): Promise<StoredTokens | null>;
  revokeTokens(tenantId: string, provider: CalendarProvider): Promise<void>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class OAuthCalendarGateway implements CalendarOAuthGateway {
  private readonly PLATFORM_TENANT = "platform";

  constructor(
    private readonly vault: CredentialVault,
    private readonly http: HttpAdapter,
  ) {}

  private credentialTenant(mode: "platform" | "tenant-owned", tenantId: string): string {
    return mode === "platform" ? this.PLATFORM_TENANT : tenantId;
  }

  async getAuthorizationUrl(params: AuthorizationParams): Promise<string> {
    const credTenant = this.credentialTenant(params.mode, params.tenantId);
    const clientId = await this.vault.retrieve(credTenant, params.provider, "client_id");
    if (clientId === null) throw new Error(`No client_id for ${params.provider} (${params.mode})`);

    const baseUrl = PROVIDER_AUTH_URLS[params.provider];
    const scope = PROVIDER_SCOPES[params.provider];
    const url = new URL(baseUrl);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scope);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("state", params.state);
    return url.toString();
  }

  async exchangeCode(params: TokenExchangeParams): Promise<StoredTokens> {
    const credTenant = this.credentialTenant(params.mode, params.tenantId);
    const [clientId, clientSecret] = await Promise.all([
      this.vault.retrieve(credTenant, params.provider, "client_id"),
      this.vault.retrieve(credTenant, params.provider, "client_secret"),
    ]);
    if (clientId === null || clientSecret === null) {
      throw new Error(`Missing OAuth credentials for ${params.provider}`);
    }

    const tokenUrl = PROVIDER_TOKEN_URLS[params.provider];
    const resp = await this.http.post(tokenUrl, {
      client_id: clientId,
      client_secret: clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
    });

    if (resp.status !== 200) throw new Error(`Token exchange failed: ${resp.status.toString()}`);
    const tokens = resp.data as OAuthTokenResponse;
    const stored = this.tokensFromResponse(tokens);
    await this.persistTokens(params.tenantId, params.provider, stored);
    return stored;
  }

  async refreshAccessToken(params: RefreshParams): Promise<StoredTokens> {
    const credTenant = this.credentialTenant(params.mode, params.tenantId);
    const [clientId, clientSecret, refreshToken] = await Promise.all([
      this.vault.retrieve(credTenant, params.provider, "client_id"),
      this.vault.retrieve(credTenant, params.provider, "client_secret"),
      this.vault.retrieve(params.tenantId, params.provider, "refresh_token"),
    ]);
    if (clientId === null || clientSecret === null) {
      throw new Error(`Missing OAuth credentials for ${params.provider}`);
    }
    if (refreshToken === null) {
      throw new Error(`No refresh token stored for tenant ${params.tenantId}`);
    }

    const tokenUrl = PROVIDER_TOKEN_URLS[params.provider];
    const resp = await this.http.post(tokenUrl, {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    if (resp.status !== 200) throw new Error(`Token refresh failed: ${resp.status.toString()}`);
    const tokens = resp.data as OAuthTokenResponse;
    const stored = this.tokensFromResponse(tokens, refreshToken);
    await this.persistTokens(params.tenantId, params.provider, stored);
    return stored;
  }

  async getStoredTokens(
    tenantId: string,
    provider: CalendarProvider,
  ): Promise<StoredTokens | null> {
    const [accessToken, refreshToken, expiresAtStr, scope] = await Promise.all([
      this.vault.retrieve(tenantId, provider, "access_token"),
      this.vault.retrieve(tenantId, provider, "refresh_token"),
      this.vault.retrieve(tenantId, provider, "expires_at"),
      this.vault.retrieve(tenantId, provider, "scope"),
    ]);
    if (accessToken === null || expiresAtStr === null) return null;
    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(expiresAtStr),
      scope: scope ?? "",
    };
  }

  async revokeTokens(tenantId: string, provider: CalendarProvider): Promise<void> {
    await Promise.all([
      this.vault.delete(tenantId, provider, "access_token"),
      this.vault.delete(tenantId, provider, "refresh_token"),
      this.vault.delete(tenantId, provider, "expires_at"),
      this.vault.delete(tenantId, provider, "scope"),
    ]);
  }

  private tokensFromResponse(tokens: OAuthTokenResponse, fallbackRefresh?: string): StoredTokens {
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? fallbackRefresh ?? null,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope ?? "",
    };
  }

  private async persistTokens(
    tenantId: string,
    provider: CalendarProvider,
    tokens: StoredTokens,
  ): Promise<void> {
    const ops: Promise<void>[] = [
      this.vault.store(tenantId, provider, "access_token", tokens.accessToken),
      this.vault.store(tenantId, provider, "expires_at", tokens.expiresAt.toISOString()),
      this.vault.store(tenantId, provider, "scope", tokens.scope),
    ];
    if (tokens.refreshToken !== null) {
      ops.push(this.vault.store(tenantId, provider, "refresh_token", tokens.refreshToken));
    }
    await Promise.all(ops);
  }
}

// ---------------------------------------------------------------------------
// Fake HTTP adapter for tests
// ---------------------------------------------------------------------------

export class FakeHttpAdapter implements HttpAdapter {
  private readonly routes = new Map<
    string,
    (body: Record<string, string>) => { status: number; data: unknown }
  >();

  register(
    url: string,
    handler: (body: Record<string, string>) => { status: number; data: unknown },
  ): void {
    this.routes.set(url, handler);
  }

  post(url: string, body: Record<string, string>): Promise<{ status: number; data: unknown }> {
    const handler = this.routes.get(url);
    if (handler === undefined)
      return Promise.resolve({ status: 500, data: { error: "no handler" } });
    return Promise.resolve(handler(body));
  }
}
