export const INITIAL_READING_VERSION = "initial-reading-v1" as const;

export type InitialReadingChannel = "whatsapp" | "email" | "manual";

export type InitialReadingDraft = {
  version: typeof INITIAL_READING_VERSION;
  channel: InitialReadingChannel;
  subject: string;
  body: string;
  referencedEvidence: string[];
  inviteToConversation: boolean;
  internalRationale: string;
  safetyNotes: string[];
};

const allowedChannels = new Set<InitialReadingChannel>(["whatsapp", "email", "manual"]);

function asString(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function asStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/**
 * Normaliza o rascunho gerado por IA. Persistir como pending_approval.
 * A existência de um objeto válido NÃO autoriza o envio ao lead.
 */
export function normalizeInitialReadingDraft(input: unknown): InitialReadingDraft | null {
  const value = asObject(input);
  const channel = asString(value.channel, 20) as InitialReadingChannel;
  const body = asString(value.body, 1800);

  if (!allowedChannels.has(channel) || !body) return null;

  return {
    version: INITIAL_READING_VERSION,
    channel,
    subject: asString(value.subject, 180),
    body,
    referencedEvidence: asStringArray(value.referencedEvidence, 8, 500),
    inviteToConversation: value.inviteToConversation === true,
    internalRationale: asString(value.internalRationale, 1200),
    safetyNotes: asStringArray(value.safetyNotes, 8, 600),
  };
}

/**
 * Instrução para gerar a pequena leitura que será revisada pela equipe.
 * Ela deve demonstrar compreensão sem entregar gratuitamente o Diagnóstico Blinko profundo.
 */
export function buildInitialReadingInstruction() {
  return `Você prepara um RASCUNHO de leitura inicial para um lead da Blinko.

Este conteúdo será mostrado primeiro a uma pessoa da equipe. Ele NÃO pode ser enviado automaticamente ao lead.

Objetivo:
- demonstrar que a Blinko entendeu os sinais relatados;
- devolver uma leitura curta, útil e humana;
- indicar que existem pontos que merecem investigação quando houver evidência para isso;
- convidar para uma conversa simples quando existir fit.

Limites obrigatórios:
1. Não declare causa raiz como fato.
2. Não entregue diagnóstico profundo.
3. Não prescreva site, CRM, tráfego, automação, identidade, sistema ou qualquer intervenção como conclusão.
4. Não invente números, faturamento, margem, preço, prazo, disponibilidade ou resultado.
5. Não prometa ganho, crescimento ou retorno.
6. Não exponha score comercial, notas internas, nível de fit ou raciocínio confidencial da Blinko.
7. Use no máximo 3 pontos percebidos, todos sustentados pelas respostas ou pela análise revisável.
8. Se a informação for insuficiente, diga que é cedo para concluir.
9. A linguagem deve ser clara, profissional, próxima e em português do Brasil.
10. O corpo deve caber confortavelmente em WhatsApp/e-mail curto.

Estrutura recomendada do corpo:
- reconhecimento breve do objetivo da empresa;
- 1 a 3 sinais que chamaram atenção, sempre tratados como sinais/percepções;
- explicação de que isso ainda precisa ser aprofundado;
- convite para conversa somente se fizer sentido.

A saída deve seguir exatamente o schema JSON esperado pela aplicação.`;
}

export function buildInitialReadingInput(input: {
  lead: Record<string, unknown>;
  preDiagnostic: Record<string, unknown>;
  analysis: Record<string, unknown>;
  humanReview?: Record<string, unknown>;
  preferredChannel: InitialReadingChannel;
}) {
  return {
    version: INITIAL_READING_VERSION,
    instruction: buildInitialReadingInstruction(),
    context: input,
    expectedShape: {
      version: INITIAL_READING_VERSION,
      channel: "whatsapp | email | manual",
      subject: "string; vazio para WhatsApp quando não necessário",
      body: "string curto",
      referencedEvidence: ["string"],
      inviteToConversation: "boolean",
      internalRationale: "string interno; nunca enviar ao lead",
      safetyNotes: ["string interno"],
    },
  };
}
