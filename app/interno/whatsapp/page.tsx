import Link from "next/link";
import { requireInternalSession } from "../../../lib/blinko/internal-auth";
import { listWhatsAppConversations } from "../../../lib/blinko/whatsapp-server";
import InternalTopbar from "../InternalTopbar";
import styles from "../interno.module.css";

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
    waiting_human: "Responder",
    waiting_customer: "Aguardando cliente",
    closed: "Fechada",
    archived: "Arquivada",
  }[status] ?? status;
}

function preview(body: string, type: string) {
  if (body) return body.length > 100 ? `${body.slice(0, 100)}…` : body;
  return type ? `[${type}]` : "Sem prévia da mensagem";
}

export default async function WhatsAppInboxPage() {
  const session = await requireInternalSession();
  const result = await listWhatsAppConversations();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <InternalTopbar user={session.user} active="whatsapp" />

        <section className={styles.hero}>
          <span className={styles.eyebrow}>ATENDIMENTO · WHATSAPP</span>
          <h1>Caixa de entrada.</h1>
          <p>
            Conversas do WhatsApp conectadas ao CRM da Blinko. Nesta primeira camada, o sistema organiza,
            vincula e prepara respostas sem enviar mensagens automaticamente.
          </p>
        </section>

        {!result.schemaReady ? (
          <div className={styles.empty}>A estrutura do WhatsApp ainda não foi aplicada ao Neon neste ambiente.</div>
        ) : result.conversations.length === 0 ? (
          <div className={styles.empty}>Nenhuma conversa registrada ainda. A entrada automática será ligada quando o provedor oficial do WhatsApp for conectado.</div>
        ) : (
          <section className={styles.list} aria-label="Conversas do WhatsApp">
            {result.conversations.map((conversation) => {
              const id = text(conversation.id);
              const unread = number(conversation.unread_count);
              const contact = text(conversation.contact_name) || text(conversation.lead_name) || text(conversation.phone_e164);
              const company = text(conversation.company_name);
              const latestBody = text(conversation.latest_body);
              const latestType = text(conversation.latest_message_type);
              const direction = text(conversation.latest_direction);
              return (
                <Link className={styles.action} href={`/interno/whatsapp/${id}`} key={id}>
                  <span className={styles.priority}>{unread > 0 ? `${unread} nova${unread > 1 ? "s" : ""}` : statusLabel(text(conversation.status))}</span>
                  <span>
                    <span className={styles.company}>{contact}</span>
                    <span className={styles.meta}>
                      {[company, text(conversation.product_code), direction === "outbound" ? "Você" : "Cliente"].filter(Boolean).join(" · ")}
                    </span>
                    <span className={styles.meta}>{preview(latestBody, latestType)}</span>
                  </span>
                  <span className={styles.badge}>{text(conversation.lead_id) ? "CRM vinculado" : "Sem vínculo"}</span>
                  <span className={styles.score}>→</span>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
