import { neon } from "@neondatabase/serverless";

export type TriageKind = "known_service" | "need_clarity" | "not_sure";
export type TriageChannel = "whatsapp" | "email";
export type TriageRow = {
  id: string; created_at: string; updated_at: string;
  completed_at: string | null; whatsapp_link_opened_at: string | null;
  stage: number; status: "started" | "submitted"; name: string;
  company_name: string; whatsapp: string; email: string;
  request_kind: string; challenge: string; timeframe: string; preferred_channel: string;
};

const getSql = () => {
  if (!process.env.DATABASE_URL) throw new Error("neon_not_configured");
  return neon(process.env.DATABASE_URL);
};

export function hasTriageDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

const SELECT_FIELDS = "id::text, created_at::text, updated_at::text, completed_at::text, whatsapp_link_opened_at::text, stage, status, name, company_name, whatsapp, email, request_kind, challenge, timeframe, preferred_channel";

export async function saveTriageContact(data: {
  id: string; name: string; companyName: string; whatsapp: string; email: string;
}): Promise<TriageRow> {
  const sql = getSql();
  const rows = await sql.query(
    "INSERT INTO public.blinko_triage_v2 (id, name, company_name, whatsapp, email, stage, status) VALUES ($1::uuid, $2, $3, $4, $5, 1, 'started') ON CONFLICT (id) DO UPDATE SET updated_at = now() RETURNING " + SELECT_FIELDS,
    [data.id, data.name, data.companyName, data.whatsapp, data.email],
  );
  if (!rows[0]) throw new Error("triage_contact_not_saved");
  return rows[0] as TriageRow;
}

export async function submitTriage(data: {
  id: string; kind: TriageKind; challenge: string;
  timeframe: string; channel: TriageChannel;
}): Promise<TriageRow | null> {
  const sql = getSql();
  const rows = await sql.query(
    "UPDATE public.blinko_triage_v2 SET request_kind = $2, challenge = $3, timeframe = $4, preferred_channel = $5, stage = 3, status = 'submitted', completed_at = coalesce(completed_at, now()), updated_at = now() WHERE id = $1::uuid RETURNING " + SELECT_FIELDS,
    [data.id, data.kind, data.challenge, data.timeframe, data.channel],
  );
  return (rows[0] as TriageRow | undefined) ?? null;
}

export async function markWhatsAppLinkOpened(id: string) {
  const sql = getSql();
  await sql.query(
    "UPDATE public.blinko_triage_v2 SET whatsapp_link_opened_at = coalesce(whatsapp_link_opened_at, now()), updated_at = now() WHERE id = $1::uuid AND status = 'submitted'",
    [id],
  );
}

export function getBusinessWhatsAppUrl(row: TriageRow) {
  const phone = (process.env.BLINKO_WHATSAPP_NUMBER || "").replace(/\D/g, "");
  if (phone.length < 10 || phone.length > 15) return null;
  const name = row.name.split(/\s+/)[0].slice(0, 60);
  const ref = row.id.split("-")[0].toUpperCase();
  const message = "Olá! Sou " + name + ", preenchi a triagem inicial da Blinko (ref. " + ref + "). Podemos conversar?";
  return "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
}

/**
 * Espelho opcional em Google Sheets via Web App do Apps Script.
 * Neon continua como fonte primária. Falha do espelho não invalida a captura.
 * Dados são transmitidos após consentimento e nunca colocados no link WhatsApp.
 */
export async function mirrorTriageToSheets(row: TriageRow) {
  const endpoint = process.env.BLINKO_SHEETS_WEBHOOK_URL || "";
  const secret = process.env.BLINKO_SHEETS_WEBHOOK_SECRET || "";
  if (!endpoint || !secret) return { configured: false, delivered: false };

  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.hostname !== "script.google.com") {
      throw new Error("invalid_sheets_endpoint");
    }
    const response = await fetch(url.href, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        secret,
        kind: "triage",
        event: row.status,
        lead: {
          id: row.id,
          created_at: row.created_at,
          updated_at: row.updated_at,
          completed_at: row.completed_at || "",
          whatsapp_link_opened_at: row.whatsapp_link_opened_at || "",
          name: row.name,
          company_name: row.company_name,
          whatsapp: row.whatsapp,
          email: row.email,
          request_kind: row.request_kind,
          challenge: row.challenge,
          timeframe: row.timeframe,
          preferred_channel: row.preferred_channel,
          status: row.status,
          stage: row.stage,
          source: "blinko_site_triage_v2",
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
    });
    if (!response.ok) throw new Error("sheet_webhook_http_" + response.status);
    const result = (await response.json()) as { ok?: boolean };
    if (result.ok !== true) throw new Error("sheet_webhook_rejected");
    return { configured: true, delivered: true };
  } catch (error) {
    console.error("Blinko triage: Sheets mirror failed", error instanceof Error ? error.message : "unknown");
    return { configured: true, delivered: false };
  }
}
