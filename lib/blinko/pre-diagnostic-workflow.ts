import { supabaseRpc } from "./supabase-server";
import { INITIAL_READING_VERSION, type InitialReadingChannel } from "./initial-reading";

type CreateInitialReadingDraftInput = {
  preDiagnosticId: string;
  analysisRunId?: string | null;
  channel: InitialReadingChannel;
  subject?: string;
  body: string;
  createdByType: "ai" | "human" | "system";
  createdById?: string;
  supersedesId?: string | null;
};

export async function createInitialReadingDraft(input: CreateInitialReadingDraftInput) {
  return supabaseRpc<string>("create_pre_diagnostic_initial_reading_draft", {
    p_pre_diagnostic_id: input.preDiagnosticId,
    p_analysis_run_id: input.analysisRunId ?? null,
    p_channel: input.channel,
    p_subject: input.subject ?? "",
    p_body: input.body,
    p_content_version: INITIAL_READING_VERSION,
    p_created_by_type: input.createdByType,
    p_created_by_id: input.createdById ?? null,
    p_supersedes_id: input.supersedesId ?? null,
  });
}

type ApproveInitialReadingInput = {
  readingId: string;
  humanReviewId: string;
  body: string;
  subject?: string;
  reviewerUserId?: string | null;
  reviewerLabel?: string;
};

/**
 * Único caminho da aplicação para transformar um rascunho em mensagem autorizada.
 * A função Postgres também valida que a revisão humana pertence ao mesmo pré-diagnóstico.
 */
export async function approveInitialReading(input: ApproveInitialReadingInput) {
  return supabaseRpc<string>("approve_pre_diagnostic_initial_reading", {
    p_reading_id: input.readingId,
    p_human_review_id: input.humanReviewId,
    p_approved_body: input.body,
    p_approved_subject: input.subject ?? "",
    p_reviewer_user_id: input.reviewerUserId ?? null,
    p_reviewer_label: input.reviewerLabel ?? "",
  });
}

/**
 * Chamar somente DEPOIS que o provedor externo confirmar o envio.
 * O banco recusará esta transição se a mensagem não estiver previamente aprovada.
 */
export async function recordInitialReadingSent(input: {
  readingId: string;
  deliveryProvider: string;
  deliveryMessageId?: string;
}) {
  return supabaseRpc<string>("record_pre_diagnostic_initial_reading_sent", {
    p_reading_id: input.readingId,
    p_delivery_provider: input.deliveryProvider,
    p_delivery_message_id: input.deliveryMessageId ?? "",
  });
}

export async function recordInitialReadingDeliveryFailed(input: {
  readingId: string;
  deliveryProvider: string;
  error: string;
}) {
  return supabaseRpc<string>("record_pre_diagnostic_initial_reading_failed", {
    p_reading_id: input.readingId,
    p_delivery_provider: input.deliveryProvider,
    p_error: input.error,
  });
}
