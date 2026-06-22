/**
 * Stripe payment gateway adapter (real wiring behind the PaymentGateway port).
 *
 * Implements charges and refunds via Stripe PaymentIntents/Refunds. When the
 * tenant has an onboarded Stripe Connect account (stored by StripeConnectService
 * under provider "stripe_connect", key "account_id"), charges become destination
 * charges: funds settle to the connected account and the platform takes an
 * application fee. Without a connected account the adapter falls back to a plain
 * charge on the platform account, so a single-merchant deployment works too.
 *
 * The platform secret key lives in the vault under (platformVaultTenant,
 * "stripe", "secret_key"). All amounts are integer minor units.
 */

import type { CredentialVault } from "../security/credential-vault.js";
import type {
  ChargeRequest,
  ChargeResult,
  PaymentGateway,
  RefundRequest,
  RefundResult,
} from "./payment-gateway.js";
import type { StripeHttpAdapter } from "./stripe-http.js";

export interface StripeGatewayConfig {
  http: StripeHttpAdapter;
  /** Vault holding the platform secret key and per-tenant connected account ids. */
  vault: CredentialVault;
  /**
   * Platform application fee in basis points (e.g. 200 = 2%). Only applied to
   * destination charges (tenants with a connected account). 0 disables the fee.
   */
  applicationFeeBasisPoints?: number;
  /** Vault tenant key used for platform-level secrets. Defaults to "platform". */
  platformVaultTenant?: string;
}

interface StripeErrorBody {
  error?: { code?: string; type?: string; message?: string };
}

interface StripeIntent {
  id: string;
  status: string;
}

interface StripeRefund {
  id: string;
}

export class StripePaymentGateway implements PaymentGateway {
  readonly name = "stripe";

  private readonly http: StripeHttpAdapter;
  private readonly vault: CredentialVault;
  private readonly feeBasisPoints: number;
  private readonly platformVaultTenant: string;

  constructor(config: StripeGatewayConfig) {
    this.http = config.http;
    this.vault = config.vault;
    this.feeBasisPoints = config.applicationFeeBasisPoints ?? 0;
    this.platformVaultTenant = config.platformVaultTenant ?? "platform";
  }

  async createCharge(request: ChargeRequest): Promise<ChargeResult> {
    const secretKey = await this.platformSecretKey();
    if (secretKey === null) return { ok: false, reason: "gateway-error" };

    const params: Record<string, string> = {
      amount: String(request.amount),
      currency: request.currency.toLowerCase(),
      "payment_method_types[0]": "card",
    };
    if (request.description !== undefined) params.description = request.description;
    for (const [key, value] of Object.entries(request.metadata ?? {})) {
      params[`metadata[${key}]`] = value;
    }
    if (request.paymentMethod !== undefined) {
      // Confirm immediately against the supplied funding source (works for
      // off-session/saved methods and Stripe test tokens like pm_card_visa).
      params.payment_method = request.paymentMethod;
      params.confirm = "true";
      params.off_session = "true";
    }

    const connectedAccount = await this.connectedAccount(request.tenantId);
    if (connectedAccount !== null) {
      params["transfer_data[destination]"] = connectedAccount;
      if (this.feeBasisPoints > 0) {
        const fee = Math.round((request.amount * this.feeBasisPoints) / 10_000);
        params.application_fee_amount = String(fee);
      }
    }

    const resp = await this.http.post("/v1/payment_intents", params, secretKey, {
      idempotencyKey: request.idempotencyKey,
    });

    if (!isOk(resp.status)) {
      return { ok: false, reason: classifyChargeError(resp.data) };
    }

    const intent = resp.data as StripeIntent;
    // succeeded → captured now; requires_capture → authorized (manual capture);
    // processing → async settlement in flight. All three are accepted; the
    // payment webhook reconciles the final state. Anything else is a decline.
    if (
      intent.status === "succeeded" ||
      intent.status === "requires_capture" ||
      intent.status === "processing"
    ) {
      return { ok: true, chargeId: intent.id };
    }
    return { ok: false, reason: "declined" };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    const secretKey = await this.platformSecretKey();
    if (secretKey === null) return { ok: false, reason: "gateway-error" };

    const params: Record<string, string> = {
      payment_intent: request.chargeId,
      amount: String(request.amount),
    };
    // Destination charges: pull the refund from the connected account and claw
    // back the proportional application fee. Only valid when a transfer existed.
    if ((await this.connectedAccount(request.tenantId)) !== null) {
      params.reverse_transfer = "true";
      params.refund_application_fee = "true";
    }

    const resp = await this.http.post("/v1/refunds", params, secretKey, {
      idempotencyKey: `refund:${request.chargeId}:${String(request.amount)}`,
    });

    if (!isOk(resp.status)) {
      return { ok: false, reason: classifyRefundError(resp.data) };
    }

    const refund = resp.data as StripeRefund;
    return { ok: true, refundId: refund.id };
  }

  private platformSecretKey(): Promise<string | null> {
    return this.vault.retrieve(this.platformVaultTenant, "stripe", "secret_key");
  }

  private connectedAccount(tenantId: string): Promise<string | null> {
    return this.vault.retrieve(tenantId, "stripe_connect", "account_id");
  }
}

function isOk(status: number): boolean {
  return status >= 200 && status < 300;
}

function classifyChargeError(data: unknown): "declined" | "gateway-error" {
  const err = (data as StripeErrorBody).error;
  if (err?.type === "card_error" || err?.code === "card_declined") return "declined";
  return "gateway-error";
}

function classifyRefundError(
  data: unknown,
): "charge-not-found" | "exceeds-charge" | "gateway-error" {
  const err = (data as StripeErrorBody).error;
  if (err?.code === "resource_missing") return "charge-not-found";
  if (err?.code === "charge_already_refunded" || err?.code === "amount_too_large") {
    return "exceeds-charge";
  }
  return "gateway-error";
}
