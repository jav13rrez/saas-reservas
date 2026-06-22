/**
 * Real Brevo (ex-Sendinblue) HTTP adapter for the transactional email API.
 *
 * Talks to https://api.brevo.com using JSON bodies and the `api-key` header.
 * Application code never imports a Brevo SDK; the BrevoMessageProvider owns the
 * wire format behind this port, so tests stay deterministic with a fake adapter
 * and production swaps in `fetch`. The base URL and fetch implementation are
 * injectable so unit tests run offline and smoke tests can point at a mock.
 */

export interface BrevoHttpResponse {
  status: number;
  data: unknown;
}

export interface BrevoHttpAdapter {
  post(path: string, body: unknown, apiKey: string): Promise<BrevoHttpResponse>;
}

const BREVO_API_BASE = "https://api.brevo.com";

/** Production Brevo transport backed by the global `fetch`. */
export class FetchBrevoHttp implements BrevoHttpAdapter {
  constructor(
    private readonly baseUrl: string = BREVO_API_BASE,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async post(path: string, body: unknown, apiKey: string): Promise<BrevoHttpResponse> {
    const init: RequestInit = {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
    };

    try {
      const resp = await this.fetchImpl(`${this.baseUrl}${path}`, init);
      const text = await resp.text();
      let data: unknown = null;
      if (text.length > 0) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: "non-JSON response from Brevo", raw: text };
        }
      }
      return { status: resp.status, data };
    } catch (err) {
      // Network/transport failure: surface as a non-2xx so the provider maps it
      // to a failed send rather than throwing through the messaging port.
      const message = err instanceof Error ? err.message : "network error";
      return { status: 0, data: { code: "connection_error", message } };
    }
  }
}
