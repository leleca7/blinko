import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import {
  advanceDiagnosticToAnalysis,
  getDiagnosticWorkspace,
  isDiagnosticCollectionSchemaPending,
} from "../../../../../../lib/blinko/diagnostic-collection-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  try {
    const workspace = await getDiagnosticWorkspace(id);
    if (!workspace.schemaReady) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    if (!workspace.diagnostic) return NextResponse.json({ ok: false }, { status: 404 });
    if (!workspace.currentCollection) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=analysis_blocked`, request.url), 303);
    }

    const status = typeof workspace.diagnostic.status === "string" ? workspace.diagnostic.status : "";
    if (status !== "collection") {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=analysis_blocked`, request.url), 303);
    }

    await advanceDiagnosticToAnalysis({ diagnosticId: id, actorLabel: session.user });
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=analysis_ready`, request.url), 303);
  } catch (error) {
    if (isDiagnosticCollectionSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao avançar diagnóstico para análise", error);
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=analysis_blocked`, request.url), 303);
  }
}
