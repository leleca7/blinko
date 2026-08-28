import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import {
  getPreDiagnosticReviewWorkspace,
  scheduleLeadMeeting,
} from "../../../../../../lib/blinko/neon-server";
import { normalizeReviewWorkspace } from "../../../../../../lib/blinko/review-workspace";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const workspace = normalizeReviewWorkspace(await getPreDiagnosticReviewWorkspace(id));
  if (!workspace) return NextResponse.json({ ok: false }, { status: 404 });

  if (!workspace.current_human_review) {
    return NextResponse.redirect(new URL(`/interno/pre-diagnosticos/${id}?status=meeting_missing_review`, request.url), 303);
  }

  const form = await request.formData();
  const scheduledAtLocal = String(form.get("scheduled_at") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim().slice(0, 2000);

  if (!localDateTimePattern.test(scheduledAtLocal)) {
    return NextResponse.redirect(new URL(`/interno/pre-diagnosticos/${id}?status=meeting_invalid_date`, request.url), 303);
  }

  await scheduleLeadMeeting({
    preDiagnosticId: id,
    leadId: workspace.lead.id,
    scheduledAtLocal,
    notes,
    actorLabel: session.user,
  });

  return NextResponse.redirect(new URL(`/interno/pre-diagnosticos/${id}?status=meeting_scheduled`, request.url), 303);
}
