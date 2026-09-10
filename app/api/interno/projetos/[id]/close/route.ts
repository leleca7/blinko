import { NextResponse } from "next/server";
import { requireInternalProjectSession } from "../../../../../../lib/blinko/internal-auth";
import { closeProject, isProjectExtensionsSchemaPending } from "../../../../../../lib/blinko/project-extensions-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });
  const session = await requireInternalProjectSession(id, "projects.manage");
  const form = await request.formData();
  if (String(form.get("close_confirmed") ?? "") !== "yes") return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=close_confirmation_required`, request.url), 303);

  try {
    await closeProject({ projectId: id, actorLabel: session.user });
    return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=project_closed`, request.url), 303);
  } catch (error) {
    if (isProjectExtensionsSchemaPending(error)) return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=extensions_schema_pending`, request.url), 303);
    console.error("Blinko OS: falha ao fechar projeto", error);
    return NextResponse.redirect(new URL(`/interno/projetos/${id}?status=close_blocked`, request.url), 303);
  }
}
