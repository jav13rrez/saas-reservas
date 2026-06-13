/**
 * OpenAPI contract generation foundation.
 *
 * The seed contract lives in `specs/001-saas-multitenant-booking/contracts/openapi.yaml`.
 * At runtime the API service registers its route schemas through this builder so the
 * served document is always generated from code, and contract tests can diff it
 * against the spec seed.
 */

export interface OpenApiInfo {
  title: string;
  version: string;
  description?: string;
}

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export interface OpenApiOperation {
  operationId: string;
  summary: string;
  tags?: string[];
  /** JSON Schema fragments, compatible with Fastify route schemas. */
  parameters?: unknown[];
  requestBody?: unknown;
  responses: Record<string, unknown>;
  security?: Record<string, string[]>[];
}

export interface OpenApiDocument {
  openapi: "3.1.0";
  info: OpenApiInfo;
  servers: { url: string; description?: string }[];
  tags: { name: string; description?: string }[];
  paths: Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
}

export interface RegisterPathInput {
  path: string;
  method: HttpMethod;
  operation: OpenApiOperation;
}

/**
 * Accumulates path/schema registrations from API modules and produces the
 * OpenAPI 3.1 document. Duplicate operation registrations are rejected so two
 * modules cannot silently claim the same route.
 */
export class OpenApiBuilder {
  private readonly paths: OpenApiDocument["paths"] = {};
  private readonly schemas: Record<string, unknown> = {};
  private readonly tags = new Map<string, string | undefined>();

  constructor(private readonly info: OpenApiInfo) {}

  registerTag(name: string, description?: string): this {
    this.tags.set(name, description);
    return this;
  }

  registerSchema(name: string, schema: unknown): this {
    if (name in this.schemas) {
      throw new Error(`OpenAPI schema "${name}" is already registered`);
    }
    this.schemas[name] = schema;
    return this;
  }

  registerPath({ path, method, operation }: RegisterPathInput): this {
    const entry = (this.paths[path] ??= {});
    if (entry[method]) {
      throw new Error(`OpenAPI operation ${method.toUpperCase()} ${path} is already registered`);
    }
    entry[method] = operation;
    return this;
  }

  build(servers: OpenApiDocument["servers"]): OpenApiDocument {
    return {
      openapi: "3.1.0",
      info: this.info,
      servers,
      tags: [...this.tags.entries()].map(([name, description]) =>
        description === undefined ? { name } : { name, description },
      ),
      paths: this.paths,
      components: {
        securitySchemes: {
          staffSession: { type: "apiKey", in: "cookie", name: "staff_session" },
          customerSession: { type: "apiKey", in: "cookie", name: "customer_session" },
        },
        schemas: this.schemas,
      },
    };
  }
}
