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

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("neon_not_configured");
  return neon(databaseUrl);
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
            'last_health_detail', s.last_health_detail
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
            'last_health_detail', s.last_health_detail
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
