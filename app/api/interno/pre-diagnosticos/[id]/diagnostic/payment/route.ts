import { NextResponse } from "next/server";
import {
  confirmBlinkoDiagnosticPayment,
  getBlinkoDiagnosticContext,
  isDiagnosticSchemaPending,
} from "../../../../../../../../lib/blinko/diagnostic-commercial";
import { getInternalSession } from "../../../../../../../../lib/blinko/internal-auth";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const diagnosticId = String(form.get("diagnostic_id") ?? "").trim();
  const humanConfirmation = String(form.get("payment_confirmed") ?? "").trim();
  const paymentReference = String(form.get("payment_reference") ?? "").trim().slice(0, 180);

  if (!uuidPattern.test(diagnosticId)) return NextResponse.json({ ok: false }, { status: 404 });
  if (humanConfirmation !== "yes") {
    return NextResponse.redirect(
      new URL(`/interno/pre-diagnosticos/${id}?status=payment_confirmation_required`, request.url),
      303,
    );
  }

  try {
    const contextData = await getBlinkoDiagnosticContext(id);
    const currentId = typeof contextData.currentDiagnostic?.id === "string"
      ? contextData.currentDiagnostic.id
      : "";

    if (!contextData.schemaReady) {
      return NextResponse.redirect(
        new URL(`/interno/pre-diagnosticos/${id}?status=diagnostic_schema_pending`, request.url),
        303,
      );
    }

    if (currentId !== diagnosticId) {
      return NextResponse.redirect(
        new URL(`/interno/pre-diagnosticos/${id}?status=diagnostic_not_current`, request.url),
        303,
      );
    }

    await confirmBlinkoDiagnosticPayment({
      diagnosticId,
      actorLabel: session.user,
      paymentReference,
    });

    return NextResponse.redirect(
      new URL(`/interno/pre-diagnosticos/${id}?status=diagnostic_paid`, request.url),
      303,
    );
  } catch (error) {
    if (isDiagnosticSchemaPending(error)) {
      return NextResponse.redirect(
        new URL(`/interno/pre-diagnosticos/${id}?status=diagnostic_schema_pending`, request.url),
        303,
      );
    }

    console.error("Blinko OS: falha ao confirmar pagamento do diagnóstico", error);
    return NextResponse.redirect(
      new URL(`/interno/pre-diagnosticos/${id}?status=diagnostic_failed`, request.url),
      303,
    );
  }
}
