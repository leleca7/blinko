import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalSession } from "../../../../lib/blinko/internal-auth";
import { getMetaWhatsAppConfigurationState } from "../../../../lib/blinko/whatsapp-meta";
import { getWhatsAppConversationWorkspace } from "../../../../lib/blinko/whatsapp-server";
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

function number(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

function statusLabel(status: string) {
  return {
    open: "Aberta",
    waiting_human: "Aguardando resposta da Blinko",
    waiting_customer: "Aguardando cliente",
    closed: "Fechada",
    archived: "Arquivada",
  }[status] ?? status;
}

function messageStatusLabel(status: string) {
  return {
    received: "recebida",
    draft: "rascunho",
    approved: "aprovada",
    queued: "em envio",
    sent: "enviada",
    delivered: "entregue",
    read: "lida",
    failed: "falhou",
  }[status] ?? status;
}

function notice(status?: string, metaConfigured?: boolean) {
  if (status === "linked") return "Conversa vinculada ao CRM.";
  if (status === "read") return "Conversa marcada como lida.";
  if (status === "draft_created") return "Rascunho criado. Ele ainda não foi enviado.";
  if (status === "draft_approved") return metaConfigured
    ? "Rascunho aprovado. Ele está pronto para envio pelo WhatsApp."
    : "Rascunho aprovado. O provedor oficial ainda precisa ser configurado para envio direto.";
  if (status === "sent_recorded") return "Envio registrado no histórico.";
  if (status === "sent_via_provider") return "Mensagem enviada pelo WhatsApp e registrada no histórico.";
  if (status === "provider_not_configured") return "O envio oficial ainda não está configurado neste ambiente.";
  if (status === "provider_send_blocked") return "O envio foi bloqueado porque a conversa ou a mensagem não está pronta para este provedor.";
  if (status === "provider_send_failed") return "O provedor não aceitou o envio. A mensagem continua aprovada para uma nova tentativa.";
  if (status === "provider_reconciliation_required") return "O provedor aceitou a mensagem, mas o registro local precisa de reconciliação. Não reenvie para evitar duplicidade.";
  if (status === "invalid") return "Revise os dados antes de continuar.";
  if (status === "blocked") return "A ação não é permitida no estágio atual.";
  if (status === "schema_pending") return "A estrutura do WhatsApp ainda precisa ser aplicada ao Neon.";
  return null;
}

const controlStyle = {
  border: "1px solid rgba(1,48,30,.18)",
  background: "rgba(255,255,255,.78)",
  color: "#08271b",
  borderRadius: 14,
  padding: 13,
  font: "inherit",
};

export default async function WhatsAppConversationPage({ params, searchParams }: Props) {
  const session = await requireInternalSession();
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  if (!uuidPattern.test(id)) notFound();

  const [workspace, metaState] = await Promise.all([
    getWhatsAppConversationWorkspace(id),
    Promise.resolve(getMetaWhatsAppConfigurationState()),
  ]);
  if (!workspace.schemaReady) {
    return (
      <main className={styles.page}><div className={styles.shell}><InternalTopbar user={session.user} active="whatsapp" /><section className={styles.reviewCard}><span className={styles.eyebrow}>WHATSAPP</span><h1>Estrutura pendente</h1><div className={styles.notice}>A migration de WhatsApp ainda precisa ser aplicada ao Neon deste ambiente.</div></section></div></main>
    );
  }
  if (!workspace.conversation) notFound();

  const conversation = workspace.conversation;
  const lead = workspace.lead;
  const opportunity = workspace.directOpportunity;
  const currentLeadId = text(conversation.lead_id);
  const currentOpportunityId = text(conversation.direct_opportunity_id);
  const unread = number(conversation.unread_count);
  const provider = text(conversation.provider);
  const directMetaSend = metaState.configured && provider === "meta";
  const flash = notice(query.status, metaState.configured);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <InternalTopbar user={session.user} active="whatsapp" />

        <div className={styles.hero} style={{ paddingBottom: 14 }}>
          <Link className={styles.back} href="/interno/whatsapp">← voltar para caixa de entrada</Link>
          {flash ? <div className={styles.notice} style={{ marginTop: 14, maxWidth: 900 }}>{flash}</div> : null}
        </div>

        <div className={styles.reviewShell}>
          <section className={styles.reviewCard} style={{ borderColor: "rgba(239,59,127,.24)", background: "rgba(239,59,127,.025)" }}>
            <span className={styles.eyebrow}>WHATSAPP · {provider.toUpperCase()}</span>
            <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 42, fontWeight: 500, marginBottom: 8 }}>
              {text(conversation.contact_name) || text(lead?.name) || text(conversation.phone_e164)}
            </h1>
            <p style={{ opacity: .72, lineHeight: 1.55 }}>
              {text(conversation.phone_e164)}{text(lead?.company_name) ? ` · ${text(lead?.company_name)}` : ""}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <span className={styles.badge}>{statusLabel(text(conversation.status))}</span>
              <span className={styles.badge}>{unread > 0 ? `${unread} não lida${unread > 1 ? "s" : ""}` : "Tudo lido"}</span>
              <span className={styles.badge}>{currentLeadId ? "CRM vinculado" : "Sem vínculo no CRM"}</span>
              <span className={styles.badge}>{metaState.configured ? "WhatsApp oficial configurado" : "Provedor aguardando configuração"}</span>
              {currentOpportunityId ? <Link className={styles.badge} href={`/interno/oportunidades-diretas/${currentOpportunityId}`}>Abrir oportunidade →</Link> : null}
            </div>
            {unread > 0 ? (
              <form action={`/api/interno/whatsapp/${id}/read`} method="post" style={{ marginTop: 18 }}>
                <button className={styles.button} type="submit">Marcar conversa como lida</button>
              </form>
            ) : null}
          </section>

          <section className={styles.reviewCard}>
            <span className={styles.eyebrow}>CRM</span>
            <h2>Vincular conversa</h2>
            <p style={{ opacity: .72, lineHeight: 1.55 }}>
              Mensagens novas tentam localizar automaticamente um lead pelo número. Quando não houver correspondência segura, faça o vínculo aqui.
            </p>
            <form action={`/api/interno/whatsapp/${id}/link`} method="post" className={styles.form}>
              <label>Lead
                <select name="lead_id" style={controlStyle} defaultValue={currentLeadId}>
                  <option value="">Sem vínculo</option>
                  {workspace.recentLeads.map((item) => (
                    <option value={text(item.id)} key={text(item.id)}>
                      {[text(item.name), text(item.company_name), text(item.whatsapp)].filter(Boolean).join(" · ")}
                    </option>
                  ))}
                </select>
              </label>
              {currentLeadId ? (
                <label>Oportunidade direta
                  <select name="direct_opportunity_id" style={controlStyle} defaultValue={currentOpportunityId}>
                    <option value="">Sem oportunidade específica</option>
                    {workspace.leadOpportunities.map((item) => (
                      <option value={text(item.id)} key={text(item.id)}>
                        {[text(item.product_code), text(item.status)].filter(Boolean).join(" · ")}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button className={styles.button} type="submit">Salvar vínculo</button>
            </form>
          </section>

          <section className={styles.reviewCard}>
            <span className={styles.eyebrow}>CONVERSA</span>
            <h2>Histórico</h2>
            {workspace.messages.length === 0 ? (
              <div className={styles.empty}>Nenhuma mensagem registrada.</div>
            ) : (
              <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                {workspace.messages.map((message) => {
                  const outbound = text(message.direction) === "outbound";
                  const messageId = text(message.id);
                  const status = text(message.status);
                  return (
                    <article
                      key={messageId}
                      style={{
                        justifySelf: outbound ? "end" : "start",
                        width: "min(760px, 88%)",
                        padding: 16,
                        borderRadius: 18,
                        border: "1px solid rgba(1,48,30,.12)",
                        background: outbound ? "rgba(1,48,30,.07)" : "rgba(255,255,255,.62)",
                      }}
                    >
                      <small style={{ display: "block", opacity: .58, marginBottom: 8 }}>
                        {outbound ? "Blinko" : "Cliente"} · {messageStatusLabel(status)}
                      </small>
                      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{text(message.body) || `[${text(message.message_type)}]`}</div>
                      {status === "draft" ? (
                        <form action={`/api/interno/whatsapp/${id}/approve`} method="post" style={{ marginTop: 12 }}>
                          <input type="hidden" name="message_id" value={messageId} />
                          <button className={styles.button} type="submit">Aprovar rascunho</button>
                        </form>
                      ) : null}
                      {status === "approved" && directMetaSend ? (
                        <form action={`/api/interno/whatsapp/${id}/send`} method="post" style={{ marginTop: 12 }}>
                          <input type="hidden" name="message_id" value={messageId} />
                          <button className={styles.button} type="submit">Enviar pelo WhatsApp</button>
                        </form>
                      ) : null}
                      {status === "approved" && !directMetaSend ? (
                        <form action={`/api/interno/whatsapp/${id}/sent`} method="post" className={styles.form} style={{ marginTop: 12 }}>
                          <input type="hidden" name="message_id" value={messageId} />
                          <label>ID externo, se houver<input name="provider_message_id" style={controlStyle} placeholder="Opcional para envio feito fora do Blinko OS" /></label>
                          <button className={styles.button} type="submit">Registrar como enviada manualmente</button>
                        </form>
                      ) : null}
                      {status === "queued" ? (
                        <div className={styles.notice} style={{ marginTop: 12 }}>Envio reservado pelo provedor. Não reenvie manualmente enquanto estiver neste estado.</div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className={styles.reviewCard}>
            <span className={styles.eyebrow}>RESPOSTA</span>
            <h2>Criar rascunho</h2>
            <p style={{ opacity: .72, lineHeight: 1.55 }}>
              A mensagem entra como rascunho e exige aprovação humana. Mesmo com o provedor conectado, nada é enviado automaticamente pela IA.
            </p>
            <form action={`/api/interno/whatsapp/${id}/draft`} method="post" className={styles.form}>
              <label>Mensagem<textarea name="body" rows={6} required style={controlStyle} /></label>
              <button className={styles.button} type="submit">Salvar rascunho</button>
            </form>
          </section>

          {opportunity ? (
            <section className={styles.reviewCard}>
              <span className={styles.eyebrow}>OPORTUNIDADE VINCULADA</span>
              <h2>{text(opportunity.product_code)}</h2>
              <p style={{ opacity: .72 }}>Status comercial: {text(opportunity.status)}</p>
              <Link className={styles.button} href={`/interno/oportunidades-diretas/${text(opportunity.id)}`}>Abrir oportunidade</Link>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
