/**
 * T062 – Encrypted credential storage and redacted logs.
 *
 * Verifies: roundtrip integrity, ciphertext ≠ plaintext, tenant/provider
 * isolation, tamper detection, deletion, key listing, and redacted references.
 */

import { describe, it, expect } from "vitest";
import {
  EnvelopeCredentialVault,
  InMemoryKmsAdapter,
  InMemoryVaultStorage,
  redactedRef,
} from "@saas-reservas/integrations/security/credential-vault";

function makeVault() {
  const kms = new InMemoryKmsAdapter();
  const storage = new InMemoryVaultStorage();
  const vault = new EnvelopeCredentialVault(kms, storage);
  return { vault, storage };
}

describe("EnvelopeCredentialVault", () => {
  describe("roundtrip", () => {
    it("retrieves stored plaintext unchanged", async () => {
      const { vault } = makeVault();
      await vault.store("t1", "google", "access_token", "secret-value");
      const result = await vault.retrieve("t1", "google", "access_token");
      expect(result).toBe("secret-value");
    });

    it("returns null for missing keys", async () => {
      const { vault } = makeVault();
      const result = await vault.retrieve("t1", "google", "missing");
      expect(result).toBeNull();
    });

    it("overwrites existing key on second store", async () => {
      const { vault } = makeVault();
      await vault.store("t1", "google", "token", "v1");
      await vault.store("t1", "google", "token", "v2");
      expect(await vault.retrieve("t1", "google", "token")).toBe("v2");
    });
  });

  describe("ciphertext never exposes plaintext", () => {
    it("stored blob does not contain the plaintext", async () => {
      const { vault, storage } = makeVault();
      const plaintext = "super-secret-api-key-abc123";
      await vault.store("t1", "stripe", "api_key", plaintext);
      const blob = await storage.get("t1", "stripe", "api_key");
      expect(blob).not.toBeNull();
      const serialized = JSON.stringify(blob);
      expect(serialized).not.toContain(plaintext);
    });

    it("each store produces a different ciphertext (fresh IV per write)", async () => {
      const { vault, storage } = makeVault();
      await vault.store("t1", "stripe", "api_key", "same-value");
      const blob1 = await storage.get("t1", "stripe", "api_key");
      await vault.store("t1", "stripe", "api_key", "same-value");
      const blob2 = await storage.get("t1", "stripe", "api_key");
      expect(blob1?.ciphertext).not.toBe(blob2?.ciphertext);
      expect(blob1?.iv).not.toBe(blob2?.iv);
    });
  });

  describe("tenant isolation", () => {
    it("different tenants cannot read each other's credentials", async () => {
      const { vault } = makeVault();
      await vault.store("tenant-A", "google", "token", "secret-A");
      await vault.store("tenant-B", "google", "token", "secret-B");
      expect(await vault.retrieve("tenant-A", "google", "token")).toBe("secret-A");
      expect(await vault.retrieve("tenant-B", "google", "token")).toBe("secret-B");
    });

    it("same key under different providers is isolated", async () => {
      const { vault } = makeVault();
      await vault.store("t1", "google", "client_secret", "goog-secret");
      await vault.store("t1", "microsoft", "client_secret", "ms-secret");
      expect(await vault.retrieve("t1", "google", "client_secret")).toBe("goog-secret");
      expect(await vault.retrieve("t1", "microsoft", "client_secret")).toBe("ms-secret");
    });
  });

  describe("tamper detection", () => {
    it("rejects tampered ciphertext (GCM auth tag mismatch)", async () => {
      const { vault, storage } = makeVault();
      await vault.store("t1", "google", "token", "real-value");
      const blob = await storage.get("t1", "google", "token");
      if (blob === null) throw new Error("blob should exist");
      const tampered = Buffer.from(blob.ciphertext, "base64");
      tampered[0] = (tampered[0] ?? 0) ^ 0xff;
      await storage.set("t1", "google", "token", {
        ...blob,
        ciphertext: tampered.toString("base64"),
      });
      await expect(vault.retrieve("t1", "google", "token")).rejects.toThrow();
    });
  });

  describe("deletion", () => {
    it("returns null after delete", async () => {
      const { vault } = makeVault();
      await vault.store("t1", "google", "token", "value");
      await vault.delete("t1", "google", "token");
      expect(await vault.retrieve("t1", "google", "token")).toBeNull();
    });

    it("deleting a missing key is idempotent", async () => {
      const { vault } = makeVault();
      await expect(vault.delete("t1", "google", "ghost")).resolves.toBeUndefined();
    });
  });

  describe("key listing", () => {
    it("lists all keys for a tenant/provider pair", async () => {
      const { vault } = makeVault();
      await vault.store("t1", "google", "access_token", "a");
      await vault.store("t1", "google", "refresh_token", "b");
      await vault.store("t1", "stripe", "api_key", "c");
      const keys = await vault.listKeys("t1", "google");
      expect(keys.sort()).toEqual(["access_token", "refresh_token"]);
    });
  });

  describe("redacted log references", () => {
    it("redactedRef never contains the key name in plaintext", () => {
      const ref = redactedRef("t1", "stripe", "live_secret_key_abc123");
      expect(ref).toContain("[credential:");
      expect(ref).not.toContain("live_secret_key_abc123");
      expect(ref).not.toContain("stripe");
    });

    it("same inputs produce the same reference (deterministic)", () => {
      expect(redactedRef("t1", "google", "token")).toBe(redactedRef("t1", "google", "token"));
    });

    it("different inputs produce different references", () => {
      expect(redactedRef("t1", "google", "token")).not.toBe(
        redactedRef("t1", "google", "other_token"),
      );
    });
  });
});
