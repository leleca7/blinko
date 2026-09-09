import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import {
  getProjectWorkspace,
  isExecutionSchemaPending,
  setProjectOnboardingItem,
} from "../../../../../../lib/blinko/execution-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const requirements = new Set(["required", "not_required", "to_define"]);
const statuses = new Set(["pending", "in_progress", "blocked", "done", "waived", "not_applicable"]);

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const moduleCode = String(form.get("module_code") ?? "").trim();
  const requirement = String(form.get("requirement") ?? "").trim();
  const onboardingStatus = String(form.get("onboarding_status") ?? "").trim();
  const evidence = String(form.get("evidence") ?? "").trim().slice(0, 5000);
  const responsibleLabel = String(form.get("responsible_label") ?? "").trim().slice(0, 300);
  const dueAtLocal = String(form.get("due_at") ?? "").trim();
  const blockingReason = String(form.get("blocking_reason") ?? "").trim().slice(0, 3000);
  const blockingOwnerLabel = String(form.get("blocking_owner_label") ?? "").trim().slice(0, 300);
  const nextCheckAtLocal = String(form.get("next_check_at") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim().slice(0, 5000);
  const confirmed = String(form.get("onboarding_item_confirmed") ?? "") === "yes";

  if (!confirmed || !moduleCode || !requirements.has(requirement) || !statuses.has(onboardingStatus)
    || (dueAtLocal && !localDateTimePattern.test(dueAtLocal))
    || (nextCheckAtLocal && !localDateTimePattern.test(nextCheckAtLocal))) {
    return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=onboarding_item_invalid`, request.url), 303);
  }

  try {
    const workspace = await getProjectWorkspace(id);
    const itemExists = workspace.onboardingItems.some((item) => String(item.module_code ?? "") === moduleCode);
    if (!workspace.schemaReady || !workspace.onboardingSchemaReady || workspace.project?.status !== "onboarding" || !itemExists) {
      return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=onboarding_item_blocked`, request.url), 303);
    }

    await setProjectOnboardingItem({
      projectId: id,
      moduleCode,
      requirement,
      status: onboardingStatus,
      evidence,
      responsibleLabel,
      dueAt: dueAtLocal ? new Date(`${dueAtLocal}:00-03:00`).toISOString() : null,
      blockingReason,
      blockingOwnerLabel,
      nextCheckAt: nextCheckAtLocal ? new Date(`${nextCheckAtLocal}:00-03:00`).toISOString() : null,
      notes,
      actorLabel: session.user,
    });

    return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=onboarding_item_saved`, request.url), 303);
  } catch (error) {
    if (isExecutionSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=onboarding_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao atualizar item de onboarding", error);
    return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=onboarding_item_blocked`, request.url), 303);
  }
}
