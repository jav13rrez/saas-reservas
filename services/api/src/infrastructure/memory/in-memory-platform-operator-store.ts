/**
 * In-memory PlatformOperatorStore for tests and local dev. Platform-global: no
 * tenant dimension, mirroring the Drizzle adapter's tenant-less queries.
 */

import {
  normalizePlatformEmail,
  type PlatformOperator,
} from "@saas-reservas/domain/identity/platform";
import type { PlatformOperatorStore } from "../../application/identity/platform-auth-service.js";

export class InMemoryPlatformOperatorStore implements PlatformOperatorStore {
  private readonly operators: PlatformOperator[] = [];

  insert(operator: PlatformOperator): Promise<void> {
    this.operators.push(operator);
    return Promise.resolve();
  }

  findByEmail(email: string): Promise<PlatformOperator | null> {
    const normalized = normalizePlatformEmail(email);
    return Promise.resolve(this.operators.find((o) => o.email === normalized) ?? null);
  }

  count(): Promise<number> {
    return Promise.resolve(this.operators.length);
  }

  list(): Promise<PlatformOperator[]> {
    return Promise.resolve([...this.operators]);
  }
}
