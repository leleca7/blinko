import "server-only";

import { neon } from "@neondatabase/serverless";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("neon_not_configured");
  return neon(databaseUrl);
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  return typeof (error as { code?: unknown }).code === "string" ? String((error as { code?: string }).code) : "";
}

export function isSolutionCatalogSchemaPending(error: unknown) {
  return ["42P01", "42703", "42883"].includes(errorCode(error));
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function records(value: unknown) {
  return Array.isArray(value) ? value.map(record).filter(Boolean) as Record<string, unknown>[] : [];
}

export async function listOfficialSolutions() {
  const sql = getSql();
  try {
    const rows = await sql`
      select jsonb_build_object(
        'id',id,'official_code',official_code,'name',name,'category',category,
        'nucleus_code',nucleus_code,'nucleus_name',nucleus_name,'official_status',official_status,
        'catalog_status',catalog_status,'execution_routes',execution_routes,'problem_statement',problem_statement,
        'diagnostic_triggers',diagnostic_triggers,'related_pillars',related_pillars,'applicability',applicability,
        'prerequisites',prerequisites,'base_deliverables',base_deliverables,'exclusions',exclusions,
        'completion_criteria',completion_criteria,'source_version',source_version,'drive_document_url',drive_document_url
      ) as result
      from public.solution_blueprints
      where official_code is not null
      order by official_code
    `;
    return { schemaReady: true, solutions: rows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[] };
  } catch (error) {
    if (isSolutionCatalogSchemaPending(error)) return { schemaReady: false, solutions: [] as Record<string, unknown>[] };
    throw error;
  }
}

export async function getProjectSolutions(projectId: string) {
  const sql = getSql();
  try {
    const rows = await sql`
      select jsonb_build_object(
        'id',ps.id,'project_id',ps.project_id,'intervention_id',ps.intervention_id,
        'blueprint_id',ps.blueprint_id,'solution_code',ps.solution_code,'selected_route',ps.selected_route,
        'route_status',ps.route_status,'status',ps.status,'completion_evidence',ps.completion_evidence,
        'name',b.name,'official_status',b.official_status,'catalog_status',b.catalog_status,
        'execution_routes',b.execution_routes,'problem_statement',b.problem_statement,
        'prerequisites',b.prerequisites,'base_deliverables',b.base_deliverables,'exclusions',b.exclusions,
        'intervention_title',i.title,'intervention_objective',i.objective
      ) as result
      from public.project_solutions ps
      join public.solution_blueprints b on b.id=ps.blueprint_id
      join public.diagnostic_interventions i on i.id=ps.intervention_id
      where ps.project_id=${projectId}::uuid
      order by ps.solution_code
    `;
    return { schemaReady: true, solutions: rows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[] };
  } catch (error) {
    if (isSolutionCatalogSchemaPending(error)) return { schemaReady: false, solutions: [] as Record<string, unknown>[] };
    throw error;
  }
}

export async function setProjectSolutionRoute(input: { projectId: string; projectSolutionId: string; route: string; actorLabel: string }) {
  const sql = getSql();
  const rows = await sql`
    select public.set_project_solution_route(${input.projectId}::uuid,${input.projectSolutionId}::uuid,${input.route},${input.actorLabel}) as result
  `;
  return String(rows[0]?.result ?? "");
}
