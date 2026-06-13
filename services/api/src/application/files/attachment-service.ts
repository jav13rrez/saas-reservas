/**
 * Attachment validation, antivirus scan boundary, quota enforcement,
 * and object storage persistence (T074, constitution principle IV).
 *
 * Processing order: MIME check → size limit → quota → antivirus → upload.
 * All paths are under tenants/{tenantId}/attachments/ for tenant isolation.
 */

// ---------------------------------------------------------------------------
// Adapter boundaries
// ---------------------------------------------------------------------------

export interface AntivirusScanResult {
  clean: boolean;
  threat?: string;
}

export interface AntivirusAdapter {
  scan(buffer: Buffer): Promise<AntivirusScanResult>;
}

export interface StorageAdapter {
  put(path: string, buffer: Buffer, mimeType: string): Promise<string>;
  signedUrl(path: string, ttlSeconds: number): Promise<string>;
  delete(path: string): Promise<void>;
}

export interface QuotaStore {
  getUsedBytes(tenantId: string): Promise<number>;
  incrementUsedBytes(tenantId: string, bytes: number): Promise<void>;
  decrementUsedBytes(tenantId: string, bytes: number): Promise<void>;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface AttachmentConfig {
  maxFileSizeBytes: number;
  tenantQuotaBytes: number;
  allowedMimeTypes: readonly string[];
  signedUrlTtlSeconds: number;
}

export const DEFAULT_CONFIG: AttachmentConfig = {
  maxFileSizeBytes: 10 * 1024 * 1024, // 10 MB
  tenantQuotaBytes: 1024 * 1024 * 1024, // 1 GB per tenant
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  signedUrlTtlSeconds: 3600,
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type AttachmentUploadResult =
  | {
      ok: true;
      attachmentId: string;
      storagePath: string;
      signedUrl: string;
      sizeBytes: number;
      mimeType: string;
    }
  | {
      ok: false;
      reason:
        | "mime-not-allowed"
        | "too-large"
        | "quota-exceeded"
        | "antivirus-failed"
        | "storage-error";
      detail: string;
    };

// ---------------------------------------------------------------------------
// Attachment service
// ---------------------------------------------------------------------------

export class AttachmentService {
  constructor(
    private readonly antivirus: AntivirusAdapter,
    private readonly storage: StorageAdapter,
    private readonly quota: QuotaStore,
    private readonly config: AttachmentConfig = DEFAULT_CONFIG,
  ) {}

  async upload(params: {
    tenantId: string;
    filename: string;
    mimeType: string;
    buffer: Buffer;
    bookingId?: string;
  }): Promise<AttachmentUploadResult> {
    // 1. MIME validation
    if (!this.config.allowedMimeTypes.includes(params.mimeType)) {
      return {
        ok: false,
        reason: "mime-not-allowed",
        detail: `MIME type "${params.mimeType}" is not allowed`,
      };
    }

    // 2. Size check
    if (params.buffer.byteLength > this.config.maxFileSizeBytes) {
      return {
        ok: false,
        reason: "too-large",
        detail: `File is ${params.buffer.byteLength.toString()} bytes; limit is ${this.config.maxFileSizeBytes.toString()}`,
      };
    }

    // 3. Quota enforcement
    const used = await this.quota.getUsedBytes(params.tenantId);
    if (used + params.buffer.byteLength > this.config.tenantQuotaBytes) {
      return {
        ok: false,
        reason: "quota-exceeded",
        detail: `Upload would exceed tenant quota of ${this.config.tenantQuotaBytes.toString()} bytes`,
      };
    }

    // 4. Antivirus scan
    const scanResult = await this.antivirus.scan(params.buffer);
    if (!scanResult.clean) {
      return {
        ok: false,
        reason: "antivirus-failed",
        detail: `File flagged as ${scanResult.threat ?? "threat"}`,
      };
    }

    // 5. Upload to storage
    const attachmentId = generateId();
    const safeFilename = sanitizeFilename(params.filename);
    const storagePath = buildStoragePath(params.tenantId, attachmentId, safeFilename);

    try {
      await this.storage.put(storagePath, params.buffer, params.mimeType);
      await this.quota.incrementUsedBytes(params.tenantId, params.buffer.byteLength);
      const signedUrl = await this.storage.signedUrl(storagePath, this.config.signedUrlTtlSeconds);
      return {
        ok: true,
        attachmentId,
        storagePath,
        signedUrl,
        sizeBytes: params.buffer.byteLength,
        mimeType: params.mimeType,
      };
    } catch (err) {
      return {
        ok: false,
        reason: "storage-error",
        detail: err instanceof Error ? err.message : "unknown storage error",
      };
    }
  }

  async getSignedUrl(storagePath: string): Promise<string> {
    return this.storage.signedUrl(storagePath, this.config.signedUrlTtlSeconds);
  }

  async delete(tenantId: string, storagePath: string, sizeBytes: number): Promise<void> {
    await this.storage.delete(storagePath);
    await this.quota.decrementUsedBytes(tenantId, sizeBytes);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildStoragePath(tenantId: string, attachmentId: string, filename: string): string {
  return `tenants/${tenantId}/attachments/${attachmentId}/${filename}`;
}

function sanitizeFilename(filename: string): string {
  // Strip path separators and traversal sequences before any other replacement
  const base = filename.replace(/[/\\]/g, "_").replace(/\.{2,}/g, "_");
  return base
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 128);
}

function generateId(): string {
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Fake adapters for tests
// ---------------------------------------------------------------------------

export class FakeAntivirusAdapter implements AntivirusAdapter {
  private readonly infectedPatterns: string[] = [];

  markAsInfected(pattern: string): void {
    this.infectedPatterns.push(pattern);
  }

  scan(buffer: Buffer): Promise<AntivirusScanResult> {
    const content = buffer.toString();
    for (const pattern of this.infectedPatterns) {
      if (content.includes(pattern)) {
        return Promise.resolve({ clean: false, threat: "EICAR-Test-File" });
      }
    }
    return Promise.resolve({ clean: true });
  }
}

export class FakeStorageAdapter implements StorageAdapter {
  readonly objects = new Map<string, { buffer: Buffer; mimeType: string }>();

  put(path: string, buffer: Buffer, mimeType: string): Promise<string> {
    this.objects.set(path, { buffer, mimeType });
    return Promise.resolve(path);
  }

  signedUrl(path: string, _ttl: number): Promise<string> {
    return Promise.resolve(`https://storage.fake/${path}?sig=abc`);
  }

  delete(path: string): Promise<void> {
    this.objects.delete(path);
    return Promise.resolve();
  }
}

export class InMemoryQuotaStore implements QuotaStore {
  private usageMap = new Map<string, number>();

  getUsedBytes(tenantId: string): Promise<number> {
    return Promise.resolve(this.usageMap.get(tenantId) ?? 0);
  }

  incrementUsedBytes(tenantId: string, bytes: number): Promise<void> {
    this.usageMap.set(tenantId, (this.usageMap.get(tenantId) ?? 0) + bytes);
    return Promise.resolve();
  }

  decrementUsedBytes(tenantId: string, bytes: number): Promise<void> {
    const current = this.usageMap.get(tenantId) ?? 0;
    this.usageMap.set(tenantId, Math.max(0, current - bytes));
    return Promise.resolve();
  }
}
