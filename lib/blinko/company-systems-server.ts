import { neon } from "@neondatabase/serverless";

// Esta leitura roda no servidor e depende de DATABASE_URL disponível no ambiente do deployment.
export type ConnectedSystem = {
  id: string;
  company_id: string;
  system_key: string;
  name: string;
  system_type: string;
  app_url: string | null;
  health_url: string | null;
  repository_url: string | null;
  environment: string;
  status: string;
  auth_strategy: string;
  last_health_checked_at: string | null;
  last_health_status_code: number | null;
  last_health_detail: string | null;
  metadata: Record<string, unknown>;
};

export type CompanyWithSystems = {
  id: string;
  name: string;
  segment: string | null;
  city_state: string | null;
  relationship_status: string;
  responsible_label: string | null;
  systems: ConnectedSystem[];
};

export type ConnectedSystemOperationalSummary = {
  state: "ready" | "not_configured" | "unavailable";
  status?: string;
  generatedAt?: string;
  metrics?: Record<string, string | number | boolean>;
  integrations?: Record<string, boolean>;
  message?: string;
};

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("neon_not_configured");
  return neon(databaseUrl);
}

function safeMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isAllowedSummarySecretEnv(value: string) {
  return /^[A-Z][A-Z0-9_]*_BLINKO_API_SECRET$/.test(value);
}

function sanitizePrimitiveRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => typeof item === "string" || typeof item === "number" || typeof item === "boolean")
    .slice(0, 20) as Array<[string, string | number | boolean]>;

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function sanitizeBooleanRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => typeof item === "boolean")
    .slice(0, 30) as Array<[string, boolean]>;

  return entries.length ? Object.fromEntries(entries) : undefined;
}

export async function getConnectedSystemOperationalSummary(
  system: ConnectedSystem,
): Promise<ConnectedSystemOperationalSummary> {
  const summaryUrl = safeMetadataString(system.metadata, "summary_url");
  const secretEnv = safeMetadataString(system.metadata, "summary_secret_env");

  if (!summaryUrl || !secretEnv) {
    return { state: "not_configured", message: "Resumo operacional ainda não configurado." };
  }

  if (!isAllowedSummarySecretEnv(secretEnv)) {
    return { state: "unavailable", message: "Credencial de integração não autorizada." };
  }

  let parsedUrl: URL;
  let parsedAppUrl: URL;
  try {
    parsedUrl = new URL(summaryUrl);
    if (!system.app_url) throw new Error("missing_app_url");
    parsedAppUrl = new URL(system.app_url);
  } catch {
    return { state: "unavailable", message: "Endpoint de resumo inválido." };
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedAppUrl.protocol !== "https:" ||
    parsedUrl.origin !== parsedAppUrl.origin ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    return { state: "unavailable", message: "Endpoint de resumo não autorizado para este sistema." };
  }

  const secret = process.env[secretEnv]?.trim();
  if (!secret) {
    return { state: "not_configured", message: "Credencial do resumo ainda não configurada no servidor." };
  }

  try {
    const response = await fetch(parsedUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${secret}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        state: "unavailable",
        message: `Resumo indisponível agora (HTTP ${response.status}).`,
      };
    }

    const payload = await response.json() as Record<string, unknown>;
    const status = typeof payload.status === "string" ? payload.status : undefined;
    const generatedAt = typeof payload.generatedAt === "string" ? payload.generatedAt : undefined;
    const metrics = sanitizePrimitiveRecord(payload.metrics);
    const integrations = sanitizeBooleanRecord(payload.integrations);

    return {
      state: "ready",
      status,
      generatedAt,
      metrics,
      integrations,
    };
  } catch {
    return { state: "unavailable", message: "Resumo operacional indisponível neste momento." };
  }
}

export async function listCompaniesWithSystems(): Promise<CompanyWithSystems[]> {
  const sql = getSql();
  const rows = await sql`
    select
      c.id,
      c.name,
      c.segment,
      c.city_state,
      c.relationship_status,
      c.responsible_label,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'company_id', s.company_id,
            'system_key', s.system_key,
            'name', s.name,
            'system_type', s.system_type,
            'app_url', s.app_url,
            'health_url', s.health_url,
            'repository_url', s.repository_url,
            'environment', s.environment,
            'status', s.status,
            'auth_strategy', s.auth_strategy,
            'last_health_checked_at', s.last_health_checked_at,
            'last_health_status_code', s.last_health_status_code,
            'last_health_detail', s.last_health_detail,
            'metadata', s.metadata
          ) order by s.created_at asc
        ) filter (where s.id is not null),
        '[]'::jsonb
      ) as systems
    from public.companies c
    left join public.company_systems s on s.company_id = c.id
    group by c.id
    order by
      case c.relationship_status when 'active' then 0 when 'paused' then 1 else 2 end,
      lower(c.name) asc
  `;

  return rows as unknown as CompanyWithSystems[];
}

export async function getCompanyWithSystems(companyId: string): Promise<CompanyWithSystems | null> {
  const sql = getSql();
  const rows = await sql`
    select
      c.id,
      c.name,
      c.segment,
      c.city_state,
      c.relationship_status,
      c.responsible_label,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'company_id', s.company_id,
            'system_key', s.system_key,
            'name', s.name,
            'system_type', s.system_type,
            'app_url', s.app_url,
            'health_url', s.health_url,
            'repository_url', s.repository_url,
            'environment', s.environment,
            'status', s.status,
            'auth_strategy', s.auth_strategy,
            'last_health_checked_at', s.last_health_checked_at,
            'last_health_status_code', s.last_health_status_code,
            'last_health_detail', s.last_health_detail,
            'metadata', s.metadata
          ) order by s.created_at asc
        ) filter (where s.id is not null),
        '[]'::jsonb
      ) as systems
    from public.companies c
    left join public.company_systems s on s.company_id = c.id
    where c.id = ${companyId}::uuid
    group by c.id
    limit 1
  `;

  return (rows[0] as unknown as CompanyWithSystems | undefined) ?? null;
}
