import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../../lib/blinko/internal-auth";
import {
  finalizeDiagnosticStrategy,
  getDiagnosticStrategyContext,
  isDiagnosticStrategySchemaPending,
} from "../../../../../../../lib/blinko/diagnostic-strategy-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  if (String(form.get("strategy_confirmed") ?? "") !== "yes") {
    return NextResponse.redirect(
      new URL(`/interno/diagnosticos/${id}?status=strategy_finalize_confirmation_required`, request.url),
      303,
    );
  }

  try {
    const strategyContext = await getDiagnosticStrategyContext(id);
    if (!strategyContext.schemaReady) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }

    const diagnosticStatus = typeof strategyContext.diagnostic?.status === "string" ? strategyContext.diagnostic.status : "";
    if (diagnosticStatus !== "review") {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=strategy_finalize_blocked`, request.url), 303);
    }

    const confirmedProblems = new Set(strategyContext.problems.filter((item) => item.status === "confirmed").map((item) => item.id));
    const confirmedCauses = new Set(strategyContext.causes.filter((item) => item.validation_status === "confirmed").map((item) => item.id));
    const selectedPriorities = new Set(strategyContext.priorities.filter((item) => item.status === "selected").map((item) => item.id));
    const hasCompleteChain = strategyContext.interventions.some((item) =>
      item.status === "selected"
      && confirmedProblems.has(item.problem_id)
      && confirmedCauses.has(item.cause_id)
      && selectedPriorities.has(item.priority_id),
    );

    if (!hasCompleteChain) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=strategy_finalize_blocked`, request.url), 303);
    }

    await finalizeDiagnosticStrategy({ diagnosticId: id, actorLabel: session.user });
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=strategy_finalized`, request.url), 303);
  } catch (error) {
    if (isDiagnosticStrategySchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao finalizar estrutura estratégica", error);
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=strategy_finalize_blocked`, request.url), 303);
  }
}
