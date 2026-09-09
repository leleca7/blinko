import "server-only";

import { neon } from "@neondatabase/serverless";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("neon_not_configured");
  return neon(databaseUrl);
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  return typeof (error as { code?: unknown }).code === "string"
    ? String((error as { code?: string }).code)
    : "";
}

export function isStructuredDiagnosticSchemaPending(error: unknown) {
  return ["42P01", "42703", "42883"].includes(errorCode(error));
}

function records(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object") as Record<string, unknown>[]
    : [];
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export type StructuredDiagnosticWorkspace = {
  schemaReady: boolean;
  collectionVersionId: string | null;
  methodologyVersion: string | null;
  overall: Record<string, unknown> | null;
  pillars: Record<string, unknown>[];
  items: Record<string, unknown>[];
  findings: Record<string, unknown>[];
};

export async function getStructuredDiagnosticWorkspace(diagnosticId: string): Promise<StructuredDiagnosticWorkspace> {
  const sql = getSql();
  try {
    const head = await sql`
      select d.current_collection_version_id as collection_version_id,
             cv.methodology_version
      from public.diagnostics d
      left join public.diagnostic_collection_versions cv on cv.id=d.current_collection_version_id
      where d.id=${diagnosticId}::uuid
      limit 1
    `;
    const collectionVersionId = typeof head[0]?.collection_version_id === "string" ? head[0].collection_version_id : null;
    const methodologyVersion = typeof head[0]?.methodology_version === "string" ? head[0].methodology_version : null;
    if (!collectionVersionId || !methodologyVersion) {
      return { schemaReady: true, collectionVersionId, methodologyVersion, overall: null, pillars: [], items: [], findings: [] };
    }

    const [overallRows, pillarRows, itemRows, findingRows] = await Promise.all([
      sql`select to_jsonb(s) as result from public.diagnostic_overall_scores s where s.collection_version_id=${collectionVersionId}::uuid limit 1`,
      sql`select to_jsonb(s) as result from public.diagnostic_pillar_scores s where s.collection_version_id=${collectionVersionId}::uuid order by s.position`,
      sql`
        select jsonb_build_object(
          'item_code',i.item_code,
          'pillar_code',i.pillar_code,
          'position',i.position,
          'question',i.question,
          'subtheme',i.subtheme,
          'response_id',r.id,
          'response_state',coalesce(r.response_state,'nv'),
          'score',r.score,
          'applicability_note',r.applicability_note,
          'response_context',r.response_context,
          'consultant_note',r.consultant_note,
          'related_pillars',coalesce(r.related_pillars,'[]'::jsonb),
          'evidence',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.diagnostic_item_evidence e where e.response_id=r.id),'[]'::jsonb),
          'quality_flags',coalesce((select jsonb_agg(q.quality_flag) from public.diagnostic_quality_flags q where q.collection_version_id=${collectionVersionId}::uuid and q.item_code=i.item_code),'[]'::jsonb)
        ) as result
        from public.diagnostic_items_catalog i
        left join public.diagnostic_item_responses r
          on r.methodology_version=i.methodology_version
         and r.item_code=i.item_code
         and r.collection_version_id=${collectionVersionId}::uuid
        where i.methodology_version=${methodologyVersion} and i.active
        order by i.pillar_code,i.position
      `,
      sql`select to_jsonb(f) as result from public.diagnostic_findings_scored f where f.diagnostic_id=${diagnosticId}::uuid order by f.icb_score desc nulls last,f.created_at`
    ]);

    return {
      schemaReady: true,
      collectionVersionId,
      methodologyVersion,
      overall: record(overallRows[0]?.result),
      pillars: pillarRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
      items: itemRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
      findings: findingRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
    };
  } catch (error) {
    if (isStructuredDiagnosticSchemaPending(error)) {
      return { schemaReady: false, collectionVersionId: null, methodologyVersion: null, overall: null, pillars: [], items: [], findings: [] };
    }
    throw error;
  }
}

export async function initializeStructuredDiagnosticCollection(input: { collectionVersionId: string; actorLabel: string }) {
  const sql = getSql();
  const rows = await sql`select public.initialize_diagnostic_structured_collection(${input.collectionVersionId}::uuid,${input.actorLabel}) as result`;
  return Number(rows[0]?.result ?? 0);
}

export async function saveStructuredDiagnosticItem(input: {
  collectionVersionId: string;
  itemCode: string;
  responseState: "score" | "nv" | "na";
  score: number | null;
  applicabilityNote: string;
  responseContext: string;
  consultantNote: string;
  relatedPillars: string[];
  actorLabel: string;
  evidence?: { type: "A" | "B" | "C" | "D" | "E"; reference: string; summary: string; confidence: "low" | "medium" | "high" } | null;
}) {
  const sql = getSql();
  const responseRows = await sql`
    select public.upsert_diagnostic_item_response(
      ${input.collectionVersionId}::uuid,
      ${input.itemCode},
      ${input.responseState},
      ${input.score},
      ${input.applicabilityNote},
      ${input.responseContext},
      ${input.consultantNote},
      ${JSON.stringify(input.relatedPillars)}::jsonb,
      ${input.actorLabel}
    ) as result
  `;
  const responseId = String(responseRows[0]?.result ?? "");
  if (input.evidence?.summary && responseId) {
    await sql`
      select public.add_diagnostic_item_evidence(
        ${responseId}::uuid,
        ${input.evidence.type},
        ${input.evidence.reference},
        ${input.evidence.summary},
        ${input.evidence.confidence},
        ${input.actorLabel}
      )
    `;
  }
  return responseId;
}
