import "server-only";

import { neon } from "@neondatabase/serverless";

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("neon_not_configured");
  return databaseUrl;
}

function getSql() {
  return neon(getDatabaseUrl());
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  return typeof (error as { code?: unknown }).code === "string"
    ? String((error as { code?: string }).code)
    : "";
}

export function isDiagnosticSchemaPending(error: unknown) {
  return ["42P01", "42883"].includes(errorCode(error));
}

export type BlinkoDiagnosticContext = {
  schemaReady: boolean;
  currentDiagnostic: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
};

export async function getBlinkoDiagnosticContext(preDiagnosticId: string): Promise<BlinkoDiagnosticContext> {
  const sql = getSql();

  try {
    const rows = await sql`
      select jsonb_build_object(
        'current_diagnostic', (
          select to_jsonb(d)
          from public.diagnostics d
          where d.pre_diagnostic_id = ${preDiagnosticId}::uuid
            and d.status <> 'cancelled'
          order by d.created_at desc
          limit 1
        ),
        'company', (
          select to_jsonb(c)
          from public.diagnostics d
          join public.companies c on c.id = d.company_id
          where d.pre_diagnostic_id = ${preDiagnosticId}::uuid
            and d.status <> 'cancelled'
          order by d.created_at desc
          limit 1
        )
      ) as result
    `;

    const result = rows[0]?.result as Record<string, unknown> | undefined;
    return {
      schemaReady: true,
      currentDiagnostic: result?.current_diagnostic && typeof result.current_diagnostic === "object"
        ? result.current_diagnostic as Record<string, unknown>
        : null,
      company: result?.company && typeof result.company === "object"
        ? result.company as Record<string, unknown>
        : null,
    };
  } catch (error) {
    if (isDiagnosticSchemaPending(error)) {
      return { schemaReady: false, currentDiagnostic: null, company: null };
    }
    throw error;
  }
}

/**
 * Apenas registra que o Diagnóstico Blinko foi oferecido em uma conversa humana.
 * Não define preço, não cria cobrança e não envia mensagem ao lead.
 */
export async function offerBlinkoDiagnostic(input: {
  preDiagnosticId: string;
  actorLabel: string;
  notes?: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.offer_blinko_diagnostic(
      ${input.preDiagnosticId}::uuid,
      ${input.actorLabel},
      ${input.notes ?? ""}
    ) as result
  `;
  return rows[0]?.result as string;
}

/**
 * Registra uma confirmação humana de pagamento já recebido.
 * Esta função não processa, inicia ou captura pagamento.
 */
export async function confirmBlinkoDiagnosticPayment(input: {
  diagnosticId: string;
  actorLabel: string;
  paymentReference?: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.confirm_blinko_diagnostic_payment(
      ${input.diagnosticId}::uuid,
      ${input.actorLabel},
      ${input.paymentReference ?? ""}
    ) as result
  `;
  return rows[0]?.result as string;
}
