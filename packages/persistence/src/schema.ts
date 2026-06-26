/**
 * Drizzle schema mirroring infra/postgres/001-tenancy.sql + 002-domain.sql.
 * SQL migrations remain the source of truth (ADR-0003); keep both in sync.
 */

import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { BookingExtra, BookingStatus } from "@saas-reservas/domain/bookings/booking";
import type {
  ManualPaymentMethod,
  ManualPaymentStatus,
} from "@saas-reservas/domain/payments/manual-payment";
import type {
  ProviderScheduleEntry,
  StaffPermission,
} from "@saas-reservas/domain/providers/provider";
import type { TenantBranding, TenantPolicies } from "@saas-reservas/domain/tenancy/tenant";

// --- Platform-global tables (no RLS) ---

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  status: text("status").$type<"active" | "suspended" | "archived">().notNull(),
  defaultTimezone: text("default_timezone").notNull(),
  defaultLocale: text("default_locale").notNull(),
  currency: text("currency").notNull(),
  branding: jsonb("branding").$type<TenantBranding>().notNull(),
  policies: jsonb("policies").$type<TenantPolicies>().notNull(),
});

export const platformOperators = pgTable("platform_operators", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status").$type<"active" | "disabled">().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const tenantDomains = pgTable("tenant_domains", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  hostname: text("hostname").notNull().unique(),
  kind: text("kind").$type<"subdomain" | "custom">().notNull(),
  verificationStatus: text("verification_status").$type<"pending" | "verified">().notNull(),
});

// --- Tenant-owned tables (RLS via apply_tenant_rls in the SQL migration) ---

type CatalogStatus = "active" | "inactive";

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  status: text("status").$type<CatalogStatus>().notNull(),
});

export const services = pgTable("services", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  categoryId: uuid("category_id").notNull(),
  name: text("name").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  priceAmount: integer("price_amount").notNull(),
  currency: text("currency").notNull(),
  bufferBeforeMinutes: integer("buffer_before_minutes").notNull(),
  bufferAfterMinutes: integer("buffer_after_minutes").notNull(),
  minCapacity: integer("min_capacity").notNull(),
  maxCapacity: integer("max_capacity").notNull(),
  status: text("status").$type<CatalogStatus>().notNull(),
});

export const extras = pgTable("extras", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  serviceId: uuid("service_id").notNull(),
  name: text("name").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  priceAmount: integer("price_amount").notNull(),
  multiplyByPeople: boolean("multiply_by_people").notNull(),
  status: text("status").$type<CatalogStatus>().notNull(),
});

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  timezone: text("timezone"),
  address: text("address"),
  status: text("status").$type<CatalogStatus>().notNull(),
});

export const resources = pgTable("resources", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull(),
  status: text("status").$type<CatalogStatus>().notNull(),
});

export const providers = pgTable("providers", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  timezone: text("timezone").notNull(),
  permissions: jsonb("permissions").$type<StaffPermission[]>().notNull(),
  status: text("status").$type<CatalogStatus>().notNull(),
});

export const providerSchedules = pgTable(
  "provider_schedules",
  {
    tenantId: uuid("tenant_id").notNull(),
    providerId: uuid("provider_id").notNull(),
    entries: jsonb("entries").$type<ProviderScheduleEntry[]>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.providerId] })],
);

export const serviceProviders = pgTable(
  "service_providers",
  {
    tenantId: uuid("tenant_id").notNull(),
    serviceId: uuid("service_id").notNull(),
    providerId: uuid("provider_id").notNull(),
    status: text("status").$type<CatalogStatus>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.serviceId, table.providerId] })],
);

// --- Resource hub model (ADR-0016): resource-owned N:M associations ---
// Additive; mirrors infra/postgres/004-resource-hub.sql. Retained alongside
// service_resources / provider_resources for backward compatibility.

export const resourceServices = pgTable(
  "resource_services",
  {
    tenantId: uuid("tenant_id").notNull(),
    resourceId: uuid("resource_id").notNull(),
    serviceId: uuid("service_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.resourceId, table.serviceId] })],
);

export const resourceLocations = pgTable(
  "resource_locations",
  {
    tenantId: uuid("tenant_id").notNull(),
    resourceId: uuid("resource_id").notNull(),
    locationId: uuid("location_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.resourceId, table.locationId] })],
);

export const resourceEmployees = pgTable(
  "resource_employees",
  {
    tenantId: uuid("tenant_id").notNull(),
    resourceId: uuid("resource_id").notNull(),
    providerId: uuid("provider_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.resourceId, table.providerId] })],
);

// Provider locations (ADR-0016 follow-up); mirrors infra/postgres/005-provider-locations.sql.
export const providerLocations = pgTable(
  "provider_locations",
  {
    tenantId: uuid("tenant_id").notNull(),
    providerId: uuid("provider_id").notNull(),
    locationId: uuid("location_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.providerId, table.locationId] })],
);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  serviceId: uuid("service_id").notNull(),
  providerId: uuid("provider_id").notNull(),
  status: text("status").$type<BookingStatus>().notNull(),
  startAt: timestamp("start_at", { withTimezone: true, mode: "date" }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true, mode: "date" }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  attendees: integer("attendees").notNull(),
  extras: jsonb("extras").$type<BookingExtra[]>().notNull(),
  totalAmount: integer("total_amount").notNull(),
  currency: text("currency").notNull(),
  source: text("source").$type<"widget" | "admin" | "api">().notNull(),
});

// Feature 004: staff-entered payment record, one per booking, for money taken
// outside the gateway. Distinct from cart_transactions/sub_payments.
export const manualPayments = pgTable("manual_payments", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  bookingId: uuid("booking_id").notNull(),
  method: text("method").$type<ManualPaymentMethod>().notNull(),
  status: text("status").$type<ManualPaymentStatus>().notNull(),
  amount: integer("amount").notNull(),
  deposit: integer("deposit").notNull(),
  currency: text("currency").notNull(),
  transactionRef: text("transaction_ref"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const cartTransactions = pgTable("cart_transactions", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  gateway: text("gateway").notNull(),
  gatewayTransactionId: text("gateway_transaction_id"),
  status: text("status")
    .$type<"pending" | "authorized" | "captured" | "partially-refunded" | "refunded" | "failed">()
    .notNull(),
  totalAmount: integer("total_amount").notNull(),
  currency: text("currency").notNull(),
});

export const subPayments = pgTable("sub_payments", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  cartTransactionId: uuid("cart_transaction_id").notNull(),
  bookingId: uuid("booking_id").notNull(),
  amount: integer("amount").notNull(),
  refundedAmount: integer("refunded_amount").notNull(),
  status: text("status")
    .$type<"pending" | "captured" | "partially-refunded" | "refunded">()
    .notNull(),
});

export const domainEvents = pgTable("domain_events", {
  eventId: uuid("event_id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  type: text("type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
  actor: jsonb("actor").notNull(),
  payload: jsonb("payload").notNull(),
  correlationId: text("correlation_id"),
});

export const auditRecords = pgTable("audit_records", {
  auditId: uuid("audit_id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  eventId: uuid("event_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  actor: jsonb("actor").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
  metadata: jsonb("metadata"),
});

export const processedWebhooks = pgTable(
  "processed_webhooks",
  {
    tenantId: uuid("tenant_id").notNull(),
    gateway: text("gateway").notNull(),
    eventId: text("event_id").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.gateway, table.eventId] })],
);

export const providerBusy = pgTable("provider_busy", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  providerId: uuid("provider_id").notNull(),
  bookingId: uuid("booking_id"),
  startAt: timestamp("start_at", { withTimezone: true, mode: "date" }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const resourceAllocations = pgTable("resource_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  resourceId: uuid("resource_id").notNull(),
  bookingId: uuid("booking_id"),
  startAt: timestamp("start_at", { withTimezone: true, mode: "date" }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true, mode: "date" }).notNull(),
  units: integer("units").notNull(),
});

export const staffAccounts = pgTable("staff_accounts", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<"admin" | "staff">().notNull(),
  status: text("status").$type<"active" | "inactive">().notNull(),
  providerId: uuid("provider_id"),
});

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  gdprStatus: text("gdpr_status").$type<"active" | "anonymized">().notNull(),
  anonymizedAt: timestamp("anonymized_at", { withTimezone: true, mode: "date" }),
});

export const checkoutHolds = pgTable("checkout_holds", {
  cartId: uuid("cart_id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  bookingId: uuid("booking_id").notNull(),
  providerId: uuid("provider_id").notNull(),
  occupied: jsonb("occupied").$type<{ start: number; end: number }>().notNull(),
  resources: jsonb("resources").$type<{ resourceId: string; units: number }[]>().notNull(),
  slots: jsonb("slots")
    .$type<
      {
        slot: { tenantId: string; providerId: string; resourceId: string; startAt: string };
        token: string;
      }[]
    >()
    .notNull(),
});
