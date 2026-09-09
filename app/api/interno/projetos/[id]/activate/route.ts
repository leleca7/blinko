import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import {
  activateProject,
  getProjectWorkspace,
  isExecutionSchemaPending,
} from "../../../../../../lib/blinko/execution-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });
  const onboardingUrl = (status: string) => new URL(`/interno/projetos/${id}/onboarding?status=${status}`, request.url);

  const form = await request.formData();
  if (String(form.get("activation_confirmed") ?? "") !== "yes") {
    return NextResponse.redirect(onboardingUrl("activation_confirmation_required"), 303);
  }

  try {
    const workspace = await getProjectWorkspace(id);
    if (!workspace.schemaReady) {
      return NextResponse.redirect(onboardingUrl("execution_schema_pending"), 303);
    }
    if (!workspace.onboardingSchemaReady) {
      return NextResponse.redirect(onboardingUrl("onboarding_schema_pending"), 303);
    }

    const onboardingReady = workspace.onboardingReadiness?.ready_for_operation === true;
    if (workspace.project?.status !== "onboarding" || !workspace.tasks.length || !onboardingReady) {
      return NextResponse.redirect(onboardingUrl("activation_onboarding_blocked"), 303);
    }

    await activateProject({ projectId: id, actorLabel: session.user });
    return NextResponse.redirect(onboardingUrl("project_activated"), 303);
  } catch (error) {
    if (isExecutionSchemaPending(error)) {
      return NextResponse.redirect(onboardingUrl("onboarding_schema_pending"), 303);
    }
    console.error("Blinko OS: falha ao ativar projeto", error);
    return NextResponse.redirect(onboardingUrl("activation_onboarding_blocked"), 303);
  }
}
