/**
 * WhatsApp Cloud API integration (T072, constitution principle IV).
 *
 * Operations:
 *  - checkHealth: verifies the phone number ID and API key are valid
 *  - syncTemplates: fetches approved message templates from Meta
 *  - sendMessage: dispatches a template message with placeholder substitution
 *
 * Credentials are tenant-scoped in the vault (provider = "whatsapp").
 * The HttpAdapter boundary prevents direct network calls from tests.
 */

import type { CredentialVault } from "../security/credential-vault.js";

// ---------------------------------------------------------------------------
// HTTP adapter boundary (same pattern as calendar OAuth gateway)
// ---------------------------------------------------------------------------

export interface WhatsAppHttpAdapter {
  get(url: string, headers: Record<string, string>): Promise<{ status: number; data: unknown }>;
  post(
    url: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<{ status: number; data: unknown }>;
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface WhatsAppTemplate {
  name: string;
  language: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  components: TemplateComponent[];
}

export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  text?: string | undefined;
  parameters?: { type: string; text?: string | undefined }[] | undefined;
}

export interface SendMessageParams {
  tenantId: string;
  to: string;
  templateName: string;
  language: string;
  placeholders: Record<string, string>;
}

export interface SendMessageResult {
  messageId: string;
  status: "sent" | "failed";
  error?: string | undefined;
}

export interface HealthCheckResult {
  ok: boolean;
  phoneNumberId: string;
  displayName?: string | undefined;
  error?: string | undefined;
}

// ---------------------------------------------------------------------------
// WhatsApp Cloud service
// ---------------------------------------------------------------------------

const BASE_URL = "https://graph.facebook.com/v18.0";

export class WhatsAppCloudService {
  constructor(
    private readonly vault: CredentialVault,
    private readonly http: WhatsAppHttpAdapter,
  ) {}

  private async getCredentials(
    tenantId: string,
  ): Promise<{ apiKey: string; phoneNumberId: string; wabaId: string }> {
    const [apiKey, phoneNumberId, wabaId] = await Promise.all([
      this.vault.retrieve(tenantId, "whatsapp", "api_key"),
      this.vault.retrieve(tenantId, "whatsapp", "phone_number_id"),
      this.vault.retrieve(tenantId, "whatsapp", "waba_id"),
    ]);
    if (apiKey === null || phoneNumberId === null || wabaId === null) {
      throw new Error(`Missing WhatsApp credentials for tenant ${tenantId}`);
    }
    return { apiKey, phoneNumberId, wabaId };
  }

  async checkHealth(tenantId: string): Promise<HealthCheckResult> {
    let creds: { apiKey: string; phoneNumberId: string; wabaId: string };
    try {
      creds = await this.getCredentials(tenantId);
    } catch {
      return { ok: false, phoneNumberId: "", error: "missing credentials" };
    }

    const url = `${BASE_URL}/${creds.phoneNumberId}?fields=display_phone_number,verified_name`;
    const resp = await this.http.get(url, { Authorization: `Bearer ${creds.apiKey}` });
    if (resp.status !== 200) {
      return {
        ok: false,
        phoneNumberId: creds.phoneNumberId,
        error: `API error: ${resp.status.toString()}`,
      };
    }
    const data = resp.data as Record<string, string>;
    return {
      ok: true,
      phoneNumberId: creds.phoneNumberId,
      displayName: data.verified_name,
    };
  }

  async syncTemplates(tenantId: string): Promise<WhatsAppTemplate[]> {
    const creds = await this.getCredentials(tenantId);
    const url = `${BASE_URL}/${creds.wabaId}/message_templates`;
    const resp = await this.http.get(url, { Authorization: `Bearer ${creds.apiKey}` });
    if (resp.status !== 200) {
      throw new Error(`Failed to fetch templates: ${resp.status.toString()}`);
    }
    const body = resp.data as { data: WhatsAppTemplate[] };
    return body.data;
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const creds = await this.getCredentials(params.tenantId);
    const url = `${BASE_URL}/${creds.phoneNumberId}/messages`;

    const components = this.buildComponents(params.placeholders);

    const body = {
      messaging_product: "whatsapp",
      to: params.to,
      type: "template",
      template: {
        name: params.templateName,
        language: { code: params.language },
        components,
      },
    };

    const resp = await this.http.post(url, body, {
      Authorization: `Bearer ${creds.apiKey}`,
      "Content-Type": "application/json",
    });

    if (resp.status !== 200) {
      const err = resp.data as { error?: { message?: string } };
      return {
        messageId: "",
        status: "failed",
        error: err.error?.message ?? `HTTP ${resp.status.toString()}`,
      };
    }

    const data = resp.data as { messages?: { id: string }[] };
    const messageId = data.messages?.[0]?.id ?? "";
    return { messageId, status: "sent" };
  }

  private buildComponents(
    placeholders: Record<string, string>,
  ): { type: string; parameters: { type: string; text: string }[] }[] {
    const entries = Object.values(placeholders);
    if (entries.length === 0) return [];
    return [
      {
        type: "body",
        parameters: entries.map((text) => ({ type: "text", text })),
      },
    ];
  }
}

// ---------------------------------------------------------------------------
// Fake HTTP adapter for tests
// ---------------------------------------------------------------------------

export class FakeWhatsAppHttp implements WhatsAppHttpAdapter {
  private getHandlers = new Map<string, (url: string) => { status: number; data: unknown }>();
  private postHandlers = new Map<
    string,
    (url: string, body: unknown) => { status: number; data: unknown }
  >();

  onGet(urlPattern: string, fn: (url: string) => { status: number; data: unknown }): void {
    this.getHandlers.set(urlPattern, fn);
  }

  onPost(
    urlPattern: string,
    fn: (url: string, body: unknown) => { status: number; data: unknown },
  ): void {
    this.postHandlers.set(urlPattern, fn);
  }

  get(url: string): Promise<{ status: number; data: unknown }> {
    for (const [pattern, fn] of this.getHandlers) {
      if (url.includes(pattern)) return Promise.resolve(fn(url));
    }
    return Promise.resolve({ status: 404, data: { error: "no handler" } });
  }

  post(url: string, body: unknown): Promise<{ status: number; data: unknown }> {
    for (const [pattern, fn] of this.postHandlers) {
      if (url.includes(pattern)) return Promise.resolve(fn(url, body));
    }
    return Promise.resolve({ status: 404, data: { error: "no handler" } });
  }
}
