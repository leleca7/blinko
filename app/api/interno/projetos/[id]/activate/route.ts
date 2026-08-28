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

  const form = await request.formData();
  if (String(form.get("activation_confirmed") ?? "") !== "yes") {
    return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=activation_confirmation_required`, request.url), 303);
  }

  try {
    const workspace = await getProjectWorkspace(id);
    if (!workspace.schemaReady) {
      return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=execution_schema_pending`, request.url), 303);
    }
    if (workspace.project?.status !== "onboarding" || !workspace.tasks.length) {
      return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=activation_blocked`, request.url), 303);
    }

    await activateProject({ projectId: id, actorLabel: session.user });
    return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=project_activated`, request.url), 303);
  } catch (error) {
    if (isExecutionSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=execution_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao ativar projeto", error);
    return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=activation_blocked`, request.url), 303);
  }
}
