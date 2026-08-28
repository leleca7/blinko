import { NextResponse } from "next/server";
import {
  isDiagnosticSchemaPending,
  offerBlinkoDiagnostic,
} from "../../../../../../../../lib/blinko/diagnostic-commercial";
import { getInternalSession } from "../../../../../../../../lib/blinko/internal-auth";
import { getPreDiagnosticReviewWorkspace } from "../../../../../../../../lib/blinko/neon-server";
import { normalizeReviewWorkspace } from "../../../../../../../../lib/blinko/review-workspace";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const workspace = normalizeReviewWorkspace(await getPreDiagnosticReviewWorkspace(id));
  if (!workspace) return NextResponse.json({ ok: false }, { status: 404 });

  if (workspace.lead.status !== "meeting") {
    return NextResponse.redirect(
      new URL(`/interno/pre-diagnosticos/${id}?status=diagnostic_requires_meeting`, request.url),
      303,
    );
  }

  const form = await request.formData();
  const notes = String(form.get("notes") ?? "").trim().slice(0, 2000);

  try {
    await offerBlinkoDiagnostic({
      preDiagnosticId: id,
      actorLabel: session.user,
      notes,
    });

    return NextResponse.redirect(
      new URL(`/interno/pre-diagnosticos/${id}?status=diagnostic_offered`, request.url),
      303,
    );
  } catch (error) {
    if (isDiagnosticSchemaPending(error)) {
      return NextResponse.redirect(
        new URL(`/interno/pre-diagnosticos/${id}?status=diagnostic_schema_pending`, request.url),
        303,
      );
    }

    console.error("Blinko OS: falha ao registrar oferta do diagnóstico", error);
    return NextResponse.redirect(
      new URL(`/interno/pre-diagnosticos/${id}?status=diagnostic_failed`, request.url),
      303,
    );
  }
}
