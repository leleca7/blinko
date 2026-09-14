import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalSession } from "../../../../lib/blinko/internal-auth";
import { getDirectOpportunityWorkspace } from "../../../../lib/blinko/direct-sales-server";
import InternalTopbar from "../../InternalTopbar";
import styles from "../../interno.module.css";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ status?: string }>;
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function statusLabel(status: string) {
  return {
    new: "Nova",
    qualifying: "Qualificação",
    ready_to_quote: "Pronta para orçamento",
    quoted: "Orçada",
    negotiation: "Negociação",
    accepted: "Aceita",
    awaiting_payment: "Aguardando pagamento",
    paid: "Paga",
    won: "Ganha",
    lost: "Perdida",
    cancelled: "Cancelada",
  }[status] ?? status;
}

function notice(status?: string) {
  if (status === "ready") return "Qualificação concluída. A oportunidade está pronta para orçamento.";
  if (status === "quote_saved") return "Nova versão do orçamento registrada.";
  if (status === "event_saved") return "Evento comercial registrado e fluxo atualizado.";
  if (status === "project_created") return "Projeto criado a partir da oportunidade paga.";
  if (status === "invalid") return "Revise os dados antes de continuar.";
  if (status === "blocked") return "A ação não é permitida no estágio atual da oportunidade.";
  if (status === "schema_pending") return "As migrações de venda direta ainda precisam ser aplicadas ao Neon.";
  return null;
}

function pretty(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

const controlStyle = {
  border: "1px solid rgba(1,48,30,.18)",
  background: "rgba(255,255,255,.78)",
  color: "#08271b",
  borderRadius: 14,
  padding: 13,
  font: "inherit",
};

export default async function DirectOpportunityPage({ params, searchParams }: Props) {
  const session = await requireInternalSession();
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  if (!uuidPattern.test(id)) notFound();

  const workspace = await getDirectOpportunityWorkspace(id);
  if (!workspace.schemaReady) {
    return (
      <main className={styles.page}><div className={styles.shell}><InternalTopbar user={session.user} active="opportunities" /><div className={styles.reviewShell}><section className={styles.reviewCard}><span className={styles.eyebrow}>VENDA DIRETA</span><h1>Estrutura pendente</h1><div className={styles.notice}>As migrações 012 a 014 ainda precisam ser aplicadas ao Neon deste ambiente.</div></section></div></div></main>
    );
  }

  if (!workspace.opportunity || !workspace.lead) notFound();

  const opportunity = workspace.opportunity;
  const lead = workspace.lead;
  const currentQuote = workspace.currentQuote;
  const project = workspace.project;
  const stage = text(opportunity.status);
  const message = notice(query.status);
  const productCode = text(opportunity.product_code);
  const opportunityType = text(opportunity.opportunity_type);
  const projectId = text(project?.id);

  const eventOptions = stage === "quoted"
    ? [
        ["quote_sent", "Orçamento enviado"],
        ["negotiation", "Entrou em negociação"],
        ["accepted", "Cliente aceitou"],
        ["refused", "Cliente recusou"],
      ]
    : stage === "negotiation"
      ? [["negotiation", "Atualização da negociação"], ["accepted", "Cliente aceitou"], ["refused", "Cliente recusou"]]
      : stage === "accepted"
        ? [["payment_requested", "Pagamento solicitado"]]
        : stage === "awaiting_payment"
          ? [["payment_confirmed", "Pagamento confirmado"]]
          : [];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <InternalTopbar user={session.user} active="opportunities" />

        <div className={styles.hero} style={{ paddingBottom: 14 }}>
          <Link className={styles.back} href="/interno/oportunidades-diretas">← voltar para oportunidades</Link>
          {message ? <div className={styles.notice} style={{ marginTop: 14, maxWidth: 900 }}>{message}</div> : null}
        </div>

        <div className={styles.reviewShell}>
          <section className={styles.reviewCard} style={{ borderColor: "rgba(239,59,127,.24)", background: "rgba(239,59,127,.025)" }}>
            <span className={styles.eyebrow}>VENDA DIRETA · {opportunityType === "marketing_subscription" ? "MARKETING MENSAL" : "PRODUÇÃO GRÁFICA"}</span>
            <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 42, fontWeight: 500, marginBottom: 8 }}>{text(lead.company_name) || text(lead.name) || "Oportunidade"}</h1>
            <p style={{ opacity: .72, lineHeight: 1.55, maxWidth: 900 }}>{productCode}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <span className={styles.badge}>Status: {statusLabel(stage)}</span>
              <span className={styles.badge}>Origem: {text(opportunity.source) || "manual"}</span>
              <span className={styles.badge}>WhatsApp: {text(lead.whatsapp) || "não informado"}</span>
              {projectId ? <Link className={styles.badge} href={`/interno/projetos/${projectId}`}>Abrir projeto →</Link> : null}
            </div>
          </section>

          <section className={styles.reviewCard}>
            <span className={styles.eyebrow}>BRIEFING</span>
            <h2>Informações registradas</h2>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginTop: 18, padding: 16, borderRadius: 16, background: "rgba(1,48,30,.045)", fontSize: 13, lineHeight: 1.6 }}>{pretty(opportunity.brief)}</pre>
            {text(opportunity.notes) ? <p style={{ opacity: .72 }}>{text(opportunity.notes)}</p> : null}
          </section>

          {["new", "qualifying"].includes(stage) ? (
            <section className={styles.reviewCard}>
              <span className={styles.eyebrow}>01 / QUALIFICAÇÃO</span>
              <h2>Confirmar que já existe informação suficiente para orçar</h2>
              <form action={`/api/interno/oportunidades-diretas/${id}/ready`} method="post" className={styles.form}>
                <label>Observações da qualificação<textarea name="notes" rows={4} style={controlStyle} /></label>
                <button className={styles.button} type="submit">Marcar como pronta para orçamento</button>
              </form>
            </section>
          ) : null}

          {currentQuote ? (
            <section className={styles.reviewCard}>
              <span className={styles.eyebrow}>ORÇAMENTO ATUAL · V{text(currentQuote.version_number) || String(currentQuote.version_number ?? "")}</span>
              <h2>{text(currentQuote.investment)}</h2>
              <p><strong>Escopo:</strong> {text(currentQuote.scope)}</p>
              <p><strong>Prazo:</strong> {text(currentQuote.timeframe)}</p>
              <p><strong>Condições:</strong> {text(currentQuote.conditions)}</p>
              <p><strong>Validade:</strong> {text(currentQuote.validity)}</p>
            </section>
          ) : null}

          {["ready_to_quote", "quoted", "negotiation"].includes(stage) ? (
            <section className={styles.reviewCard}>
              <span className={styles.eyebrow}>02 / ORÇAMENTO</span>
              <h2>{currentQuote ? "Registrar nova versão" : "Montar orçamento"}</h2>
              <form action={`/api/interno/oportunidades-diretas/${id}/quote`} method="post" className={styles.form}>
                <label>Escopo<textarea name="scope" required rows={5} style={controlStyle} defaultValue={text(currentQuote?.scope)} /></label>
                <label>Responsabilidades do cliente<textarea name="client_responsibilities" rows={3} style={controlStyle} defaultValue={text(currentQuote?.client_responsibilities)} /></label>
                <label>Prazo<input name="timeframe" required style={controlStyle} defaultValue={text(currentQuote?.timeframe)} /></label>
                <label>Investimento<input name="investment" required style={controlStyle} defaultValue={text(currentQuote?.investment)} /></label>
                <label>Condições<textarea name="conditions" required rows={3} style={controlStyle} defaultValue={text(currentQuote?.conditions)} /></label>
                <label>Validade<input name="validity" required style={controlStyle} defaultValue={text(currentQuote?.validity)} /></label>
                <label>Riscos e limites<textarea name="risks_limits" rows={3} style={controlStyle} defaultValue={text(currentQuote?.risks_limits)} /></label>
                <button className={styles.button} type="submit">Salvar versão do orçamento</button>
              </form>
            </section>
          ) : null}

          {eventOptions.length ? (
            <section className={styles.reviewCard}>
              <span className={styles.eyebrow}>03 / MOVIMENTO COMERCIAL</span>
              <h2>Registrar o que aconteceu fora do Blinko OS</h2>
              <p style={{ opacity: .72 }}>O OS registra o fato e avança o fluxo. Ele não envia a mensagem por conta própria nesta versão.</p>
              <form action={`/api/interno/oportunidades-diretas/${id}/event`} method="post" className={styles.form}>
                <label>Evento<select name="event_type" required style={controlStyle}>{eventOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label>Canal<select name="channel" defaultValue="whatsapp" style={controlStyle}><option value="whatsapp">WhatsApp</option><option value="olx">OLX</option><option value="email">E-mail</option><option value="phone">Telefone</option><option value="other">Outro</option></select></label>
                <label>Referência externa<input name="external_reference" required maxLength={300} style={controlStyle} placeholder="Ex.: conversa OLX 14/09 ou ID da mensagem" /></label>
                <label>Observações<textarea name="notes" rows={3} style={controlStyle} /></label>
                <button className={styles.button} type="submit">Registrar evento</button>
              </form>
            </section>
          ) : null}

          {workspace.externalEvents.length ? (
            <section className={styles.reviewCard}>
              <span className={styles.eyebrow}>HISTÓRICO COMERCIAL</span>
              <h2>Eventos registrados</h2>
              <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
                {workspace.externalEvents.map((event) => <article key={text(event.id)} style={{ padding: 14, border: "1px solid rgba(1,48,30,.12)", borderRadius: 14 }}><strong>{text(event.event_type)}</strong><small style={{ display: "block", marginTop: 5, opacity: .68 }}>{text(event.channel)} · {text(event.external_reference)}</small>{text(event.notes) ? <p style={{ marginBottom: 0 }}>{text(event.notes)}</p> : null}</article>)}
              </div>
            </section>
          ) : null}

          {stage === "paid" && !projectId ? (
            <section className={styles.reviewCard} style={{ borderColor: "rgba(1,48,30,.24)" }}>
              <span className={styles.eyebrow}>04 / EXECUÇÃO</span>
              <h2>Transformar venda em projeto</h2>
              <p style={{ opacity: .72 }}>O projeto nasce em onboarding, recebe uma tarefa inicial automática e ainda exige confirmação humana antes de ser ativado.</p>
              <form action={`/api/interno/oportunidades-diretas/${id}/create-project`} method="post" className={styles.form}>
                <label>Objetivo do projeto<textarea name="objective" required rows={4} style={controlStyle} /></label>
                <label>Data de início<input name="start_date" type="date" required style={controlStyle} /></label>
                <label>Janela de execução<input name="target_timeframe" required style={controlStyle} placeholder="Ex.: ciclo mensal ou 10 dias úteis" /></label>
                <label>Referência do contrato/pagamento<input name="contract_reference" required style={controlStyle} /></label>
                <label>Próxima revisão, se definida<input name="next_review_at" type="datetime-local" style={controlStyle} /></label>
                <button className={styles.button} type="submit">Criar projeto em onboarding</button>
              </form>
            </section>
          ) : null}

          {projectId ? (
            <section className={styles.reviewCard}>
              <span className={styles.eyebrow}>EXECUÇÃO</span>
              <h2>Esta oportunidade já virou projeto.</h2>
              <Link className={styles.button} href={`/interno/projetos/${projectId}`}>Abrir projeto</Link>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
