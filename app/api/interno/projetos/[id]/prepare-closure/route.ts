import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import { isProjectExtensionsSchemaPending, prepareProjectClosure } from "../../../../../../lib/blinko/project-extensions-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const feedbackStatuses = new Set(["not_requested", "requested", "received", "unavailable"]);
const nextSteps = new Set(["none", "monitor", "reassessment", "renewal", "new_opportunity"]);

type Context = { params: Promise<{ id: string }> };

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  if (field(form, "closure_confirmed") !== "yes") {
    return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=closure_confirmation_required`, request.url), 303);
  }

  const deliverySummary = field(form, "delivery_summary");
  const deliveryEvidenceReference = field(form, "delivery_evidence_reference");
  const resultSummary = field(form, "result_summary");
  const lessonsLearned = field(form, "lessons_learned");
  const clientFeedbackStatus = field(form, "client_feedback_status");
  const clientFeedbackNotes = field(form, "client_feedback_notes");
  const financePendingNote = field(form, "finance_pending_note");
  const nextStep = field(form, "next_step");
  const reassessmentRequired = field(form, "reassessment_required") === "yes";

  if (!deliverySummary || !deliveryEvidenceReference || !resultSummary || !lessonsLearned || !feedbackStatuses.has(clientFeedbackStatus) || !nextSteps.has(nextStep)) {
    return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=closure_invalid`, request.url), 303);
  }

  try {
    await prepareProjectClosure({
      projectId: id,
      actorLabel: session.user,
      deliverySummary,
      deliveryEvidenceReference,
      resultSummary,
      lessonsLearned,
      clientFeedbackStatus,
      clientFeedbackNotes,
      financePendingNote,
      nextStep,
      reassessmentRequired,
    });
    return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=closure_prepared`, request.url), 303);
  } catch (error) {
    if (isProjectExtensionsSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=extensions_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao preparar encerramento", error);
    return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=closure_blocked`, request.url), 303);
  }
}
