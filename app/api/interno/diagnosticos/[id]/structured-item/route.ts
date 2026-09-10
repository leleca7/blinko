import { NextResponse } from "next/server";
import { requireInternalSession } from "../../../../../../lib/blinko/internal-auth";
import { getDiagnosticWorkspace } from "../../../../../../lib/blinko/diagnostic-collection-server";
import { getStructuredDiagnosticWorkspace, isStructuredDiagnosticSchemaPending, saveStructuredDiagnosticItem } from "../../../../../../lib/blinko/diagnostic-structured-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const itemPattern = /^(F|M|O|C|MK|CL|OP|FI|T|G)\d{2}$/;
const pillarPattern = /^P(0[1-9]|10)$/;
type Context = { params: Promise<{ id: string }> };
function text(value: FormDataEntryValue | null, max = 5000) { return String(value ?? "").trim().slice(0, max); }

export async function POST(request: Request, context: Context) {
  const session = await requireInternalSession("diagnostics.manage");
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const collectionVersionId = text(form.get("collection_version_id"), 64);
  const itemCode = text(form.get("item_code"), 8).toUpperCase();
  const rawState = text(form.get("score_state"), 8).toLowerCase();
  if (!uuidPattern.test(collectionVersionId) || !itemPattern.test(itemCode) || !["nv","na","0","1","2","3","4"].includes(rawState)) return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=structured_item_invalid`, request.url), 303);

  const responseState = rawState === "nv" ? "nv" : rawState === "na" ? "na" : "score";
  const score = responseState === "score" ? Number(rawState) : null;
  const relatedPillars = text(form.get("related_pillars"), 160).split(/[,;\s]+/).map((item) => item.toUpperCase()).filter((item, index, array) => pillarPattern.test(item) && array.indexOf(item) === index).slice(0, 10);
  const evidenceSummary = text(form.get("evidence_summary"), 4000);
  const evidenceType = text(form.get("evidence_type"), 2) as "A" | "B" | "C" | "D" | "E";
  const evidenceConfidence = text(form.get("evidence_confidence"), 12) as "low" | "medium" | "high";

  try {
    const [workspace, structured] = await Promise.all([getDiagnosticWorkspace(id), getStructuredDiagnosticWorkspace(id)]);
    if (!workspace.diagnostic || !structured.schemaReady || structured.collectionVersionId !== collectionVersionId) return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=structured_item_invalid`, request.url), 303);
    const status = typeof workspace.diagnostic.status === "string" ? workspace.diagnostic.status : "";
    if (!["collection","analysis"].includes(status)) return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=structured_item_locked`, request.url), 303);

    await saveStructuredDiagnosticItem({
      collectionVersionId,
      itemCode,
      responseState,
      score,
      applicabilityNote: text(form.get("applicability_note"), 3000),
      responseContext: text(form.get("response_context"), 5000),
      consultantNote: text(form.get("consultant_note"), 4000),
      relatedPillars,
      actorLabel: session.user,
      evidence: evidenceSummary && ["A","B","C","D","E"].includes(evidenceType) && ["low","medium","high"].includes(evidenceConfidence)
        ? { type: evidenceType, reference: text(form.get("evidence_reference"), 3000), summary: evidenceSummary, confidence: evidenceConfidence }
        : null,
    });
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=structured_item_saved`, request.url), 303);
  } catch (error) {
    if (isStructuredDiagnosticSchemaPending(error)) return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=structured_schema_pending`, request.url), 303);
    console.error("Blinko OS: falha ao salvar item estruturado", error);
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=structured_item_failed`, request.url), 303);
  }
}
