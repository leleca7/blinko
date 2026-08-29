import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import { createCompanyImplementationPlanFromKit } from "../../../../../../lib/blinko/solution-kits-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

// Este endpoint cria somente um rascunho de implantação. Aprovação, publicação e ativação são etapas separadas.
export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const kitId = String(form.get("kit_id") ?? "").trim();
  const visualDirectionId = String(form.get("visual_direction_id") ?? "").trim();
  const name = String(form.get("name") ?? "").trim().slice(0, 140);
  const objective = String(form.get("objective") ?? "").trim().slice(0, 1000);

  if (!uuidPattern.test(kitId) || (visualDirectionId && !uuidPattern.test(visualDirectionId)) || name.length < 3) {
    return NextResponse.redirect(new URL(`/interno/empresas/${id}?status=implementation_plan_invalid`, request.url), 303);
  }

  try {
    const planId = await createCompanyImplementationPlanFromKit({
      companyId: id,
      kitId,
      name,
      visualDirectionId: visualDirectionId || null,
      objective: objective || null,
      actorLabel: session.user,
    });

    if (!planId) throw new Error("implementation_plan_not_created");

    return NextResponse.redirect(
      new URL(`/interno/empresas/${id}?status=implementation_plan_created#implementation-plans`, request.url),
      303,
    );
  } catch (error) {
    console.error("Blinko OS: falha ao criar plano de implantação", error);
    return NextResponse.redirect(new URL(`/interno/empresas/${id}?status=implementation_plan_failed`, request.url), 303);
  }
}
