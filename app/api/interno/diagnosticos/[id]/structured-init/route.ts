import { NextResponse } from "next/server";
import { requireInternalSession } from "../../../../../../lib/blinko/internal-auth";
import { getDiagnosticWorkspace } from "../../../../../../lib/blinko/diagnostic-collection-server";
import { getStructuredDiagnosticWorkspace, initializeStructuredDiagnosticCollection, isStructuredDiagnosticSchemaPending } from "../../../../../../lib/blinko/diagnostic-structured-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await requireInternalSession("diagnostics.manage");
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });
  const form = await request.formData();
  const collectionVersionId = String(form.get("collection_version_id") ?? "").trim();
  if (!uuidPattern.test(collectionVersionId)) return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=structured_item_invalid`, request.url), 303);

  try {
    const [workspace, structured] = await Promise.all([getDiagnosticWorkspace(id), getStructuredDiagnosticWorkspace(id)]);
    if (!workspace.diagnostic || !structured.schemaReady || structured.collectionVersionId !== collectionVersionId) return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=structured_item_invalid`, request.url), 303);
    const status = typeof workspace.diagnostic.status === "string" ? workspace.diagnostic.status : "";
    if (!["collection","analysis"].includes(status)) return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=structured_item_locked`, request.url), 303);
    await initializeStructuredDiagnosticCollection({ collectionVersionId, actorLabel: session.user });
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=structured_initialized`, request.url), 303);
  } catch (error) {
    if (isStructuredDiagnosticSchemaPending(error)) return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=structured_schema_pending`, request.url), 303);
    console.error("Blinko OS: falha ao inicializar diagnóstico estruturado", error);
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=structured_item_failed`, request.url), 303);
  }
}
