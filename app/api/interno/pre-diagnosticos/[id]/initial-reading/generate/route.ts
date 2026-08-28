import { NextResponse } from "next/server";
import {
  BlinkoAiAnalysisError,
  generateBlinkoInitialReadingDraft,
} from "../../../../../../../lib/blinko/ai-server";
import { getInternalSession } from "../../../../../../../lib/blinko/internal-auth";
import { INITIAL_READING_VERSION, type InitialReadingChannel } from "../../../../../../../lib/blinko/initial-reading";
import {
  createPreDiagnosticInitialReadingDraft,
  getPreDiagnosticReviewWorkspace,
} from "../../../../../../../lib/blinko/neon-server";
import { normalizeReviewWorkspace } from "../../../../../../../lib/blinko/review-workspace";

export const maxDuration = 60;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedChannels = new Set<InitialReadingChannel>(["whatsapp", "email", "manual"]);

type Context = { params: Promise<{ id: string }> };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const requestedChannel = String(form.get("channel") ?? "whatsapp") as InitialReadingChannel;
  const channel = allowedChannels.has(requestedChannel) ? requestedChannel : "whatsapp";

  const workspace = normalizeReviewWorkspace(await getPreDiagnosticReviewWorkspace(id));
  if (!workspace) return NextResponse.json({ ok: false }, { status: 404 });

  const analysisRun = asRecord(workspace.current_analysis);
  if (!analysisRun || typeof analysisRun.id !== "string") {
    return NextResponse.redirect(new URL(`/interno/pre-diagnosticos/${id}?status=reading_missing_analysis`, request.url), 303);
  }

  if (!workspace.current_human_review) {
    return NextResponse.redirect(new URL(`/interno/pre-diagnosticos/${id}?status=reading_missing_review`, request.url), 303);
  }

  if (workspace.latest_initial_reading) {
    return NextResponse.redirect(new URL(`/interno/pre-diagnosticos/${id}?status=reading_exists`, request.url), 303);
  }

  try {
    const result = await generateBlinkoInitialReadingDraft(workspace, channel);

    await createPreDiagnosticInitialReadingDraft({
      preDiagnosticId: id,
      analysisRunId: analysisRun.id,
      channel,
      subject: result.draft.subject,
      body: result.draft.body,
      contentVersion: INITIAL_READING_VERSION,
      createdByType: "ai",
      createdById: `blinko-ai:${result.model}`,
    });

    return NextResponse.redirect(new URL(`/interno/pre-diagnosticos/${id}?status=reading_draft`, request.url), 303);
  } catch (error) {
    const code = error instanceof BlinkoAiAnalysisError ? error.code : "initial_reading_generation_failed";
    const detail = error instanceof Error ? error.message.slice(0, 1200) : "Falha desconhecida.";
    console.error("Blinko AI: falha ao gerar leitura inicial", { code, detail });
    return NextResponse.redirect(new URL(`/interno/pre-diagnosticos/${id}?status=reading_failed`, request.url), 303);
  }
}
