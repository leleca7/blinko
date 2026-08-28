import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import { collectionFromForm, validateDiagnosticCollection } from "../../../../../../lib/blinko/diagnostic-collection";
import {
  getDiagnosticWorkspace,
  isDiagnosticCollectionSchemaPending,
  recordDiagnosticCollectionVersion,
} from "../../../../../../lib/blinko/diagnostic-collection-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const payload = collectionFromForm(form);
  const validation = validateDiagnosticCollection(payload);
  if (!validation.ok) {
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=collection_incomplete`, request.url), 303);
  }

  try {
    const workspace = await getDiagnosticWorkspace(id);
    if (!workspace.schemaReady) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    if (!workspace.diagnostic) return NextResponse.json({ ok: false }, { status: 404 });

    const status = typeof workspace.diagnostic.status === "string" ? workspace.diagnostic.status : "";
    if (!['collection', 'analysis'].includes(status)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=collection_failed`, request.url), 303);
    }

    await recordDiagnosticCollectionVersion({
      diagnosticId: id,
      actorLabel: session.user,
      payload,
    });

    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=collection_saved`, request.url), 303);
  } catch (error) {
    if (isDiagnosticCollectionSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao salvar coleta do diagnóstico", error);
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=collection_failed`, request.url), 303);
  }
}
