import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import {
  getProjectWorkspace,
  isExecutionSchemaPending,
  recordProjectTask,
} from "../../../../../../lib/blinko/execution-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const priorities = new Set(["low", "normal", "high", "critical"]);

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim().slice(0, 300);
  const interventionIdRaw = String(form.get("intervention_id") ?? "").trim();
  const responsibleLabel = String(form.get("responsible_label") ?? "").trim().slice(0, 180);
  const dueAtLocal = String(form.get("due_at") ?? "").trim();
  const priorityRaw = String(form.get("priority") ?? "normal").trim();
  const estimate = String(form.get("estimate") ?? "").trim().slice(0, 500);
  const dependencies = String(form.get("dependencies") ?? "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 30);
  const approvalRequired = String(form.get("approval_required") ?? "") === "yes";

  if (!title || (interventionIdRaw && !uuidPattern.test(interventionIdRaw)) || (dueAtLocal && !localDateTimePattern.test(dueAtLocal))) {
    return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=task_invalid`, request.url), 303);
  }

  try {
    const workspace = await getProjectWorkspace(id);
    if (!workspace.schemaReady) {
      return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=execution_schema_pending`, request.url), 303);
    }
    if (!workspace.project || !["onboarding", "active", "waiting_client", "at_risk"].includes(String(workspace.project.status ?? ""))) {
      return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=task_blocked`, request.url), 303);
    }
    const allowedInterventions = new Set(workspace.interventions.map((item) => String(item.id ?? "")));
    if (interventionIdRaw && !allowedInterventions.has(interventionIdRaw)) {
      return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=task_invalid`, request.url), 303);
    }

    await recordProjectTask({
      projectId: id,
      actorLabel: session.user,
      interventionId: interventionIdRaw || null,
      title,
      responsibleLabel,
      dueAt: dueAtLocal ? new Date(`${dueAtLocal}:00-03:00`).toISOString() : null,
      dependencies,
      priority: priorities.has(priorityRaw) ? priorityRaw : "normal",
      estimate,
      approvalRequired,
    });

    return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=task_created`, request.url), 303);
  } catch (error) {
    if (isExecutionSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=execution_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao criar tarefa inicial", error);
    return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=task_blocked`, request.url), 303);
  }
}
