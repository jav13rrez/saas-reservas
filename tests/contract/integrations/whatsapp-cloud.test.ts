/**
 * T065 – WhatsApp Cloud API contract tests.
 *
 * Verifies: health check OK/fail, template sync, message dispatch with
 * placeholder mapping, API error handling, and missing credential errors.
 */

import { describe, it, expect } from "vitest";
import {
  WhatsAppCloudService,
  FakeWhatsAppHttp,
} from "@saas-reservas/integrations/notifications/whatsapp-cloud";
import {
  EnvelopeCredentialVault,
  InMemoryKmsAdapter,
  InMemoryVaultStorage,
} from "@saas-reservas/integrations/security/credential-vault";

function makeService() {
  const kms = new InMemoryKmsAdapter();
  const storage = new InMemoryVaultStorage();
  const vault = new EnvelopeCredentialVault(kms, storage);
  const http = new FakeWhatsAppHttp();
  const svc = new WhatsAppCloudService(vault, http);
  return { vault, http, svc };
}

async function seedCreds(vault: InstanceType<typeof EnvelopeCredentialVault>, tenantId = "t1") {
  await vault.store(tenantId, "whatsapp", "api_key", "test-api-key");
  await vault.store(tenantId, "whatsapp", "phone_number_id", "123456789");
  await vault.store(tenantId, "whatsapp", "waba_id", "waba-000");
}

describe("WhatsAppCloudService", () => {
  describe("checkHealth", () => {
    it("returns ok=true with display name on valid credentials", async () => {
      const { vault, http, svc } = makeService();
      await seedCreds(vault);
      http.onGet("123456789", () => ({
        status: 200,
        data: { display_phone_number: "+1555000000", verified_name: "Clinic Demo" },
      }));
      const result = await svc.checkHealth("t1");
      expect(result.ok).toBe(true);
      expect(result.displayName).toBe("Clinic Demo");
    });

    it("returns ok=false when API returns non-200", async () => {
      const { vault, http, svc } = makeService();
      await seedCreds(vault);
      http.onGet("123456789", () => ({ status: 401, data: { error: "unauthorized" } }));
      const result = await svc.checkHealth("t1");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("401");
    });

    it("returns ok=false when credentials are missing", async () => {
      const { svc } = makeService();
      const result = await svc.checkHealth("t1");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("missing");
    });
  });

  describe("syncTemplates", () => {
    it("returns approved templates from Meta API", async () => {
      const { vault, http, svc } = makeService();
      await seedCreds(vault);
      http.onGet("waba-000", () => ({
        status: 200,
        data: {
          data: [
            {
              name: "booking_confirmed",
              language: "es",
              status: "APPROVED",
              components: [{ type: "BODY", text: "Tu reserva ha sido confirmada." }],
            },
            {
              name: "booking_reminder",
              language: "es",
              status: "APPROVED",
              components: [{ type: "BODY", text: "Tienes una reserva mañana." }],
            },
          ],
        },
      }));
      const templates = await svc.syncTemplates("t1");
      expect(templates).toHaveLength(2);
      expect(templates[0].name).toBe("booking_confirmed");
    });

    it("throws on API error", async () => {
      const { vault, http, svc } = makeService();
      await seedCreds(vault);
      http.onGet("waba-000", () => ({ status: 500, data: {} }));
      await expect(svc.syncTemplates("t1")).rejects.toThrow("500");
    });
  });

  describe("sendMessage", () => {
    it("sends template with placeholder substitution and returns message id", async () => {
      const { vault, http, svc } = makeService();
      await seedCreds(vault);

      let capturedBody: unknown;
      http.onPost("123456789/messages", (_, body) => {
        capturedBody = body;
        return { status: 200, data: { messages: [{ id: "wamid.abc123" }] } };
      });

      const result = await svc.sendMessage({
        tenantId: "t1",
        to: "+34600000000",
        templateName: "booking_confirmed",
        language: "es",
        placeholders: { name: "Ana", date: "2026-06-20" },
      });

      expect(result.status).toBe("sent");
      expect(result.messageId).toBe("wamid.abc123");
      const body = capturedBody as { template: { name: string } };
      expect(body.template.name).toBe("booking_confirmed");
    });

    it("returns status=failed on API error", async () => {
      const { vault, http, svc } = makeService();
      await seedCreds(vault);
      http.onPost("messages", () => ({
        status: 400,
        data: { error: { message: "invalid phone number" } },
      }));
      const result = await svc.sendMessage({
        tenantId: "t1",
        to: "invalid",
        templateName: "booking_confirmed",
        language: "es",
        placeholders: {},
      });
      expect(result.status).toBe("failed");
      expect(result.error).toContain("invalid phone number");
    });

    it("throws when credentials are missing", async () => {
      const { svc } = makeService();
      await expect(
        svc.sendMessage({
          tenantId: "t1",
          to: "+34600000000",
          templateName: "tmpl",
          language: "es",
          placeholders: {},
        }),
      ).rejects.toThrow("credentials");
    });
  });

  describe("tenant isolation", () => {
    it("each tenant uses their own phone_number_id", async () => {
      const { vault, http, svc } = makeService();
      await seedCreds(vault, "t1");
      await vault.store("t2", "whatsapp", "api_key", "key2");
      await vault.store("t2", "whatsapp", "phone_number_id", "999888777");
      await vault.store("t2", "whatsapp", "waba_id", "waba-t2");

      const calls: string[] = [];
      http.onGet("123456789", (url) => {
        calls.push("t1:" + url);
        return {
          status: 200,
          data: { verified_name: "T1 Business" },
        };
      });
      http.onGet("999888777", (url) => {
        calls.push("t2:" + url);
        return {
          status: 200,
          data: { verified_name: "T2 Business" },
        };
      });

      const [r1, r2] = await Promise.all([svc.checkHealth("t1"), svc.checkHealth("t2")]);
      expect(r1.displayName).toBe("T1 Business");
      expect(r2.displayName).toBe("T2 Business");
      expect(calls.some((c) => c.startsWith("t1:"))).toBe(true);
      expect(calls.some((c) => c.startsWith("t2:"))).toBe(true);
    });
  });
});
