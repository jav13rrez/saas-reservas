/**
 * T078 – Audit log repository and route logic tests.
 */

import { describe, it, expect } from "vitest";
import {
  InMemoryAuditLogRepository,
  type AuditLogEntry,
} from "@saas-reservas/api/api/audit-routes";

function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: "entry-1",
    tenantId: "t1",
    eventType: "booking.created",
    actorType: "customer",
    actorId: "cust-1",
    occurredAt: "2026-06-15T10:00:00Z",
    ...overrides,
  };
}

describe("InMemoryAuditLogRepository", () => {
  it("returns entries for the requested tenant", async () => {
    const repo = new InMemoryAuditLogRepository();
    await repo.append(makeEntry({ tenantId: "t1" }));
    await repo.append(makeEntry({ tenantId: "t2", id: "entry-2" }));
    const page = await repo.search({ tenantId: "t1", limit: 50, offset: 0 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.tenantId).toBe("t1");
  });

  it("filters by actorId", async () => {
    const repo = new InMemoryAuditLogRepository();
    await repo.append(makeEntry({ id: "a1", actorId: "actor-A" }));
    await repo.append(makeEntry({ id: "a2", actorId: "actor-B" }));
    const page = await repo.search({ tenantId: "t1", actorId: "actor-A", limit: 50, offset: 0 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.actorId).toBe("actor-A");
  });

  it("filters by eventType", async () => {
    const repo = new InMemoryAuditLogRepository();
    await repo.append(makeEntry({ id: "e1", eventType: "booking.created" }));
    await repo.append(makeEntry({ id: "e2", eventType: "payment.captured" }));
    const page = await repo.search({
      tenantId: "t1",
      eventType: "booking.created",
      limit: 50,
      offset: 0,
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.eventType).toBe("booking.created");
  });

  it("filters by fromDate", async () => {
    const repo = new InMemoryAuditLogRepository();
    await repo.append(makeEntry({ id: "old", occurredAt: "2026-05-01T00:00:00Z" }));
    await repo.append(makeEntry({ id: "new", occurredAt: "2026-06-15T00:00:00Z" }));
    const page = await repo.search({
      tenantId: "t1",
      fromDate: "2026-06-01T00:00:00Z",
      limit: 50,
      offset: 0,
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe("new");
  });

  it("filters by toDate", async () => {
    const repo = new InMemoryAuditLogRepository();
    await repo.append(makeEntry({ id: "early", occurredAt: "2026-06-01T00:00:00Z" }));
    await repo.append(makeEntry({ id: "late", occurredAt: "2026-06-30T00:00:00Z" }));
    const page = await repo.search({
      tenantId: "t1",
      toDate: "2026-06-15T00:00:00Z",
      limit: 50,
      offset: 0,
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe("early");
  });

  it("paginates with limit and offset", async () => {
    const repo = new InMemoryAuditLogRepository();
    for (let i = 0; i < 10; i++) {
      await repo.append(makeEntry({ id: `e-${i.toString()}` }));
    }
    const page = await repo.search({ tenantId: "t1", limit: 3, offset: 5 });
    expect(page.items).toHaveLength(3);
    expect(page.total).toBe(10);
    expect(page.offset).toBe(5);
  });

  it("returns empty page for unknown tenant", async () => {
    const repo = new InMemoryAuditLogRepository();
    await repo.append(makeEntry({ tenantId: "t1" }));
    const page = await repo.search({ tenantId: "t-unknown", limit: 50, offset: 0 });
    expect(page.items).toHaveLength(0);
    expect(page.total).toBe(0);
  });
});
