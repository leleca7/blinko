import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import {
  getProposalContext,
  isProposalSchemaPending,
  recordDiagnosticPresentation,
} from "../../../../../../lib/blinko/proposal-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const presentedAtLocal = String(form.get("presented_at") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim().slice(0, 3000);
  const confirmed = String(form.get("presentation_confirmed") ?? "") === "yes";

  if (!confirmed || !localDateTimePattern.test(presentedAtLocal)) {
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=presentation_invalid`, request.url), 303);
  }

  try {
    const proposalContext = await getProposalContext(id);
    if (!proposalContext.schemaReady) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    if (proposalContext.diagnostic?.status !== "ready_for_presentation") {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=presentation_blocked`, request.url), 303);
    }

    const presentedAt = new Date(`${presentedAtLocal}:00-03:00`).toISOString();
    await recordDiagnosticPresentation({ diagnosticId: id, actorLabel: session.user, presentedAt, notes });
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=presentation_recorded`, request.url), 303);
  } catch (error) {
    if (isProposalSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao registrar apresentação", error);
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=presentation_failed`, request.url), 303);
  }
}
