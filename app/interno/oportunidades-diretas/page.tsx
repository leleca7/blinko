import Link from "next/link";
import { requireInternalSession } from "../../../lib/blinko/internal-auth";
import { listDirectOpportunities } from "../../../lib/blinko/direct-sales-server";
import InternalTopbar from "../InternalTopbar";
import styles from "../interno.module.css";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function statusLabel(status: string) {
  return {
    new: "Nova",
    qualifying: "Qualificação",
    ready_to_quote: "Orçar",
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

function typeLabel(type: string) {
  return type === "marketing_subscription" ? "Marketing mensal" : type === "graphic_production" ? "Produção gráfica" : type;
}

export default async function DirectOpportunitiesPage() {
  const session = await requireInternalSession();
  const result = await listDirectOpportunities();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <InternalTopbar user={session.user} active="opportunities" />

        <section className={styles.hero}>
          <span className={styles.eyebrow}>COMERCIAL · VENDA DIRETA</span>
          <h1>Oportunidades.</h1>
          <p>Serviços que já chegam com demanda definida, sem obrigar o cliente a passar pelo Diagnóstico Blinko completo.</p>
        </section>

        {!result.schemaReady ? (
          <div className={styles.empty}>A estrutura de venda direta ainda não foi aplicada ao Neon neste ambiente.</div>
        ) : result.opportunities.length === 0 ? (
          <div className={styles.empty}>Nenhuma oportunidade direta registrada ainda.</div>
        ) : (
          <section className={styles.list} aria-label="Oportunidades diretas">
            {result.opportunities.map((opportunity) => {
              const id = text(opportunity.id);
              const status = text(opportunity.status);
              const companyName = text(opportunity.company_name) || text(opportunity.lead_name) || "Lead";
              const productCode = text(opportunity.product_code);
              const projectId = text(opportunity.project_id);
              return (
                <Link className={styles.action} href={`/interno/oportunidades-diretas/${id}`} key={id}>
                  <span className={styles.priority}>{statusLabel(status)}</span>
                  <span>
                    <span className={styles.company}>{companyName}</span>
                    <span className={styles.meta}>{typeLabel(text(opportunity.opportunity_type))} · {productCode} · {text(opportunity.source) || "manual"}</span>
                  </span>
                  <span className={styles.badge}>{projectId ? `Projeto ${text(opportunity.project_status)}` : "Sem projeto"}</span>
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
