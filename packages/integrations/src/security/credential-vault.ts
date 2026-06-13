/**
 * Encrypted credential vault (T067, constitution principle IV).
 *
 * Envelope encryption: each credential is sealed with a freshly-generated
 * DEK (AES-256-GCM); the DEK itself is wrapped by a KEK via the KmsAdapter.
 * The stored blob is { wrappedDek, iv, authTag, ciphertext } — all base64.
 * Plaintext never appears in logs or error messages.
 *
 * Scope: one vault entry per (tenantId, provider, key) triple.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

// ---------------------------------------------------------------------------
// KMS adapter interface
// ---------------------------------------------------------------------------

export interface KmsAdapter {
  wrapKey(dek: Buffer, tenantId: string): Promise<string>;
  unwrapKey(wrappedDek: string, tenantId: string): Promise<Buffer>;
}

/** In-memory KMS for tests: XOR-wraps with a static master key. */
export class InMemoryKmsAdapter implements KmsAdapter {
  private readonly masterKey: Buffer;

  constructor(masterKeyHex?: string) {
    this.masterKey = masterKeyHex ? Buffer.from(masterKeyHex, "hex") : randomBytes(32);
  }

  wrapKey(dek: Buffer, _tenantId: string): Promise<string> {
    const master = this.masterKey;
    const out = Buffer.from(dek.map((byte, i) => byte ^ (master[i % master.length] ?? 0)));
    return Promise.resolve(out.toString("base64"));
  }

  unwrapKey(wrappedDek: string, _tenantId: string): Promise<Buffer> {
    const wrapped = Buffer.from(wrappedDek, "base64");
    const master = this.masterKey;
    return Promise.resolve(
      Buffer.from(wrapped.map((byte, i) => byte ^ (master[i % master.length] ?? 0))),
    );
  }
}

// ---------------------------------------------------------------------------
// Storage port
// ---------------------------------------------------------------------------

export interface VaultBlob {
  wrappedDek: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export interface VaultStorage {
  set(tenantId: string, provider: string, key: string, blob: VaultBlob): Promise<void>;
  get(tenantId: string, provider: string, key: string): Promise<VaultBlob | null>;
  delete(tenantId: string, provider: string, key: string): Promise<void>;
  listKeys(tenantId: string, provider: string): Promise<string[]>;
}

export class InMemoryVaultStorage implements VaultStorage {
  private readonly map = new Map<string, VaultBlob>();

  private ref(tenantId: string, provider: string, key: string): string {
    return `${tenantId}:${provider}:${key}`;
  }

  set(tenantId: string, provider: string, key: string, blob: VaultBlob): Promise<void> {
    this.map.set(this.ref(tenantId, provider, key), blob);
    return Promise.resolve();
  }

  get(tenantId: string, provider: string, key: string): Promise<VaultBlob | null> {
    return Promise.resolve(this.map.get(this.ref(tenantId, provider, key)) ?? null);
  }

  delete(tenantId: string, provider: string, key: string): Promise<void> {
    this.map.delete(this.ref(tenantId, provider, key));
    return Promise.resolve();
  }

  listKeys(tenantId: string, provider: string): Promise<string[]> {
    const prefix = `${tenantId}:${provider}:`;
    const results: string[] = [];
    for (const k of this.map.keys()) {
      if (k.startsWith(prefix)) {
        results.push(k.slice(prefix.length));
      }
    }
    return Promise.resolve(results);
  }
}

// ---------------------------------------------------------------------------
// Credential vault
// ---------------------------------------------------------------------------

export interface CredentialVault {
  store(tenantId: string, provider: string, key: string, plaintext: string): Promise<void>;
  retrieve(tenantId: string, provider: string, key: string): Promise<string | null>;
  delete(tenantId: string, provider: string, key: string): Promise<void>;
  listKeys(tenantId: string, provider: string): Promise<string[]>;
}

export class EnvelopeCredentialVault implements CredentialVault {
  constructor(
    private readonly kms: KmsAdapter,
    private readonly storage: VaultStorage,
  ) {}

  async store(tenantId: string, provider: string, key: string, plaintext: string): Promise<void> {
    const dek = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", dek, iv);
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(plaintext, "utf8")),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    const wrappedDek = await this.kms.wrapKey(dek, tenantId);
    await this.storage.set(tenantId, provider, key, {
      wrappedDek,
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    });
  }

  async retrieve(tenantId: string, provider: string, key: string): Promise<string | null> {
    const blob = await this.storage.get(tenantId, provider, key);
    if (blob === null) return null;
    const dek = await this.kms.unwrapKey(blob.wrappedDek, tenantId);
    const iv = Buffer.from(blob.iv, "base64");
    const authTag = Buffer.from(blob.authTag, "base64");
    const ciphertext = Buffer.from(blob.ciphertext, "base64");
    const decipher = createDecipheriv("aes-256-gcm", dek, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  }

  async delete(tenantId: string, provider: string, key: string): Promise<void> {
    await this.storage.delete(tenantId, provider, key);
  }

  async listKeys(tenantId: string, provider: string): Promise<string[]> {
    return this.storage.listKeys(tenantId, provider);
  }
}

// ---------------------------------------------------------------------------
// Log-safe credential reference (never leaks plaintext)
// ---------------------------------------------------------------------------

export function redactedRef(tenantId: string, provider: string, key: string): string {
  const hmac = createHmac("sha256", "redact");
  hmac.update(`${tenantId}:${provider}:${key}`);
  return `[credential:${hmac.digest("hex").slice(0, 8)}]`;
}

export function isTimingSafe(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
