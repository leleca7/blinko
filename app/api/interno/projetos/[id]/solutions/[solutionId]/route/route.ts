import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../../../lib/blinko/internal-auth";
import {
  isSolutionCatalogSchemaPending,
  setProjectSolutionRoute,
} from "../../../../../../../../lib/blinko/solution-catalog-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const routePattern = /^R[1-6]$/;

type Context = { params: Promise<{ id: string; solutionId: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id, solutionId } = await context.params;
  const form = await request.formData();
  const route = String(form.get("execution_route") ?? "").trim();
  const confirmed = String(form.get("route_confirmed") ?? "") === "yes";

  if (!uuidPattern.test(id) || !uuidPattern.test(solutionId) || !confirmed || !routePattern.test(route)) {
    return NextResponse.redirect(new URL(`/interno/projetos/${id}/onboarding?status=solution_route_invalid`, request.url), 303);
  }

  try {
    await setProjectSolutionRoute({ projectId: id, projectSolutionId: solutionId, route, actorLabel: session.user });
    return NextResponse.redirect(new URL(`/interno/projetos/${id}/onboarding?status=solution_route_saved`, request.url), 303);
  } catch (error) {
    if (!isSolutionCatalogSchemaPending(error)) {
      console.error("Blinko OS: falha ao confirmar rota de solução", error);
    }
    return NextResponse.redirect(new URL(`/interno/projetos/${id}/onboarding?status=solution_route_blocked`, request.url), 303);
  }
}
