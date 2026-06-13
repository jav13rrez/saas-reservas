/**
 * T066 – Attachment pipeline: MIME, size, quota, antivirus, signed URLs.
 *
 * Verifies: happy-path upload, MIME rejection, size rejection, quota
 * enforcement, antivirus blocking, storage path tenant isolation, signed URL
 * generation, and deletion with quota decrement.
 */

import { describe, it, expect } from "vitest";
import {
  AttachmentService,
  FakeAntivirusAdapter,
  FakeStorageAdapter,
  InMemoryQuotaStore,
  type AttachmentConfig,
} from "@saas-reservas/api/application/files/attachment-service";

const TEST_CONFIG: AttachmentConfig = {
  maxFileSizeBytes: 1024, // 1 KB for tests
  tenantQuotaBytes: 5 * 1024, // 5 KB
  allowedMimeTypes: ["image/jpeg", "application/pdf"],
  signedUrlTtlSeconds: 3600,
};

function makeService() {
  const antivirus = new FakeAntivirusAdapter();
  const storage = new FakeStorageAdapter();
  const quota = new InMemoryQuotaStore();
  const svc = new AttachmentService(antivirus, storage, quota, TEST_CONFIG);
  return { antivirus, storage, quota, svc };
}

function smallBuffer(content = "fake image data"): Buffer {
  return Buffer.from(content);
}

describe("AttachmentService", () => {
  describe("happy path", () => {
    it("uploads a valid file and returns signed URL", async () => {
      const { svc, storage } = makeService();
      const result = await svc.upload({
        tenantId: "t1",
        filename: "photo.jpg",
        mimeType: "image/jpeg",
        buffer: smallBuffer(),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.signedUrl).toContain("https://storage.fake/");
      expect(result.storagePath).toContain("tenants/t1/");
      expect(storage.objects.size).toBe(1);
    });

    it("sanitizes dangerous filenames", async () => {
      const { svc } = makeService();
      const result = await svc.upload({
        tenantId: "t1",
        filename: "../../../etc/passwd",
        mimeType: "image/jpeg",
        buffer: smallBuffer(),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.storagePath).not.toContain("..");
    });

    it("increments tenant quota after upload", async () => {
      const { svc, quota } = makeService();
      const buf = smallBuffer("hello");
      await svc.upload({ tenantId: "t1", filename: "f.jpg", mimeType: "image/jpeg", buffer: buf });
      const used = await quota.getUsedBytes("t1");
      expect(used).toBe(buf.byteLength);
    });
  });

  describe("MIME validation", () => {
    it("rejects disallowed MIME types", async () => {
      const { svc } = makeService();
      const result = await svc.upload({
        tenantId: "t1",
        filename: "script.exe",
        mimeType: "application/octet-stream",
        buffer: smallBuffer(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("mime-not-allowed");
    });
  });

  describe("size limit", () => {
    it("rejects files exceeding maxFileSizeBytes", async () => {
      const { svc } = makeService();
      const bigBuffer = Buffer.alloc(TEST_CONFIG.maxFileSizeBytes + 1, "x");
      const result = await svc.upload({
        tenantId: "t1",
        filename: "big.jpg",
        mimeType: "image/jpeg",
        buffer: bigBuffer,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("too-large");
    });
  });

  describe("quota enforcement", () => {
    it("rejects upload when tenant quota is exceeded", async () => {
      const { svc, quota } = makeService();
      // Pre-fill quota to near limit
      await quota.incrementUsedBytes("t1", TEST_CONFIG.tenantQuotaBytes - 1);
      const result = await svc.upload({
        tenantId: "t1",
        filename: "f.jpg",
        mimeType: "image/jpeg",
        buffer: smallBuffer("big enough to exceed"),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("quota-exceeded");
    });

    it("each tenant has independent quota", async () => {
      const { svc, quota } = makeService();
      await quota.incrementUsedBytes("t1", TEST_CONFIG.tenantQuotaBytes - 1);
      // t2 should still be able to upload
      const result = await svc.upload({
        tenantId: "t2",
        filename: "f.jpg",
        mimeType: "image/jpeg",
        buffer: smallBuffer(),
      });
      expect(result.ok).toBe(true);
    });
  });

  describe("antivirus scan", () => {
    it("rejects infected files", async () => {
      const { antivirus, svc } = makeService();
      antivirus.markAsInfected("EICAR-TEST");
      const result = await svc.upload({
        tenantId: "t1",
        filename: "virus.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("contains EICAR-TEST signature"),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("antivirus-failed");
    });

    it("allows clean files through", async () => {
      const { antivirus, svc } = makeService();
      antivirus.markAsInfected("EICAR-TEST");
      const result = await svc.upload({
        tenantId: "t1",
        filename: "clean.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("totally clean content"),
      });
      expect(result.ok).toBe(true);
    });
  });

  describe("tenant isolation", () => {
    it("storage paths are scoped to tenant", async () => {
      const { svc, storage } = makeService();
      await svc.upload({
        tenantId: "tenant-A",
        filename: "a.jpg",
        mimeType: "image/jpeg",
        buffer: smallBuffer(),
      });
      await svc.upload({
        tenantId: "tenant-B",
        filename: "b.jpg",
        mimeType: "image/jpeg",
        buffer: smallBuffer(),
      });
      const paths = [...storage.objects.keys()];
      expect(paths.some((p) => p.startsWith("tenants/tenant-A/"))).toBe(true);
      expect(paths.some((p) => p.startsWith("tenants/tenant-B/"))).toBe(true);
      expect(paths.every((p) => !p.includes("tenant-A") || p.startsWith("tenants/tenant-A/"))).toBe(
        true,
      );
    });
  });

  describe("deletion", () => {
    it("removes file from storage and decrements quota", async () => {
      const { svc, storage, quota } = makeService();
      const buf = smallBuffer("data");
      const result = await svc.upload({
        tenantId: "t1",
        filename: "del.jpg",
        mimeType: "image/jpeg",
        buffer: buf,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      await svc.delete("t1", result.storagePath, result.sizeBytes);
      expect(storage.objects.size).toBe(0);
      expect(await quota.getUsedBytes("t1")).toBe(0);
    });
  });

  describe("signed URL generation", () => {
    it("getSignedUrl returns a URL for an existing path", async () => {
      const { svc } = makeService();
      const url = await svc.getSignedUrl("tenants/t1/attachments/att_x/photo.jpg");
      expect(url).toContain("https://storage.fake/");
    });
  });
});
