import {
  approvePreDiagnosticInitialReading,
  createPreDiagnosticInitialReadingDraft,
  markPreDiagnosticInitialReadingFailed,
  markPreDiagnosticInitialReadingSent,
} from "./neon-server";
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
  return createPreDiagnosticInitialReadingDraft({
    preDiagnosticId: input.preDiagnosticId,
    analysisRunId: input.analysisRunId ?? null,
    channel: input.channel,
    subject: input.subject ?? "",
    body: input.body,
    contentVersion: INITIAL_READING_VERSION,
    createdByType: input.createdByType,
    createdById: input.createdById ?? null,
    supersedesId: input.supersedesId ?? null,
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
  return approvePreDiagnosticInitialReading(input);
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
  return markPreDiagnosticInitialReadingSent(input);
}

export async function recordInitialReadingDeliveryFailed(input: {
  readingId: string;
  deliveryProvider: string;
  error: string;
}) {
  return markPreDiagnosticInitialReadingFailed(input);
}
