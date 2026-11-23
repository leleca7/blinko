import { NextResponse } from "next/server";
import {
  getBusinessWhatsAppUrl, hasTriageDatabase, markWhatsAppLinkOpened,
  mirrorTriageToSheets, saveTriageContact, submitTriage,
  type TriageChannel, type TriageKind,
} from "../../../lib/blinko/triage-v2-server";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const kinds: TriageKind[] = ["current_problem", "growth_goal", "learn_diagnosis"];
const channels: TriageChannel[] = ["whatsapp", "email"];
const timeframes = ["now", "this_month", "next_months", "just_looking", ""] as const;

function str(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ ok: false, error: "origin_not_allowed" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 6000) return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Bot honeypot. Do not persist or notify.
  if (str(body.companyFax, 100)) return NextResponse.json({ ok: true, filtered: true });

  const id = str(body.id, 64);
  const action = str(body.action, 20);
  if (!uuid.test(id)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  if (!hasTriageDatabase()) {
    return NextResponse.json({ ok: false, error: "service_not_configured" }, { status: 503 });
  }

  try {
    if (action === "start") {
      const name = str(body.name, 120);
      const companyName = str(body.companyName, 140);
      const whatsapp = str(body.whatsapp, 30);
      const email = str(body.email, 180).toLowerCase();
      const digits = whatsapp.replace(/\D/g, "");

      if (name.length < 2 || digits.length < 10 || digits.length > 15 ||
          (email && !emailPattern.test(email)) || body.consent !== true) {
        return NextResponse.json({ ok: false, error: "invalid_contact" }, { status: 400 });
      }
      const row = await saveTriageContact({ id, name, companyName, whatsapp, email });
      const synced = await mirrorTriageToSheets(row);
      return NextResponse.json({ ok: true, saved: true, sheetMirror: synced.delivered });
    }

    if (action === "complete") {
      const kind = str(body.kind, 32) as TriageKind;
      const challenge = str(body.challenge, 650);
      const timeframe = str(body.timeframe, 32);
      const channel = str(body.channel, 32) as TriageChannel;
      if (!kinds.includes(kind) ||
          !timeframes.includes(timeframe as (typeof timeframes)[number]) ||
          !channels.includes(channel)) {
        return NextResponse.json({ ok: false, error: "invalid_details" }, { status: 400 });
      }

      const row = await submitTriage({ id, kind, challenge, timeframe, channel });
      if (!row) return NextResponse.json({ ok: false, error: "contact_not_found" }, { status: 404 });
      const synced = await mirrorTriageToSheets(row);
      return NextResponse.json({
        ok: true, saved: true, sheetMirror: synced.delivered,
        contactUrl: getBusinessWhatsAppUrl(row),
        reference: row.id.split("-")[0].toUpperCase(),
      });
    }

    if (action === "whatsapp_opened") {
      const row = await markWhatsAppLinkOpened(id);
      if (row) await mirrorTriageToSheets(row);
      return NextResponse.json({ ok: true, tracked: "link_opened_not_message_sent" });
    }

    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  } catch (error) {
    // Do not log personal details or raw form bodies.
    const message = error instanceof Error ? error.message : "unknown";
    const migrationNeeded = message.includes("blinko_triage_v2");
    console.error("Blinko triage: storage error", migrationNeeded ? "migration_required" : message.slice(0, 120));
    return NextResponse.json({
      ok: false,
      error: migrationNeeded ? "migration_required" : "temporary_error",
    }, { status: migrationNeeded ? 503 : 500 });
  }
}
