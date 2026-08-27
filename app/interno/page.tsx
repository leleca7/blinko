import Link from "next/link";
import { requireInternalSession } from "../../lib/blinko/internal-auth";
import { getBlinkoTodayQueue } from "../../lib/blinko/neon-server";
import { normalizeBlinkoTodayQueue } from "../../lib/blinko/internal-queue";
import InternalBrand from "./InternalBrand";
import styles from "./interno.module.css";

function labelPriority(priority: string) {
  return { urgent: "Urgente", high: "Alta", normal: "Normal", low: "Baixa" }[priority] ?? priority;
}

export default async function InternalTodayPage() {
  const session = await requireInternalSession();
  const queue = normalizeBlinkoTodayQueue(await getBlinkoTodayQueue());

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <InternalBrand />
          <nav className={styles.nav}>
            <span className={styles.link}>{session.user}</span>
            <form action="/api/interno/logout" method="post">
              <button className={styles.logout} type="submit">Sair</button>
            </form>
          </nav>
        </header>

        <section className={styles.hero}>
          <span className={styles.eyebrow}>OPERAÇÃO · AGORA</span>
          <h1>Hoje na Blinko.</h1>
          <p>O que precisa de leitura, decisão ou acompanhamento primeiro. O painel organiza a atenção; não substitui revisão humana.</p>
        </section>

        {!queue ? (
          <div className={styles.empty}>A fila interna não pôde ser carregada com segurança.</div>
        ) : (
          <>
            <section className={styles.counts} aria-label="Resumo de hoje">
              <article className={styles.countCard}>
                <strong>{queue.counts.pending_pre_diagnostic_reviews}</strong>
                <span>pré-diagnósticos aguardando revisão</span>
              </article>
              <article className={styles.countCard}>
                <strong>{queue.counts.ai_ready_waiting_human}</strong>
                <span>análises prontas aguardando humano</span>
              </article>
              <article className={styles.countCard}>
                <strong>{queue.counts.initial_readings_waiting_approval}</strong>
                <span>leituras iniciais aguardando aprovação</span>
              </article>
              <article className={styles.countCard}>
                <strong>{queue.counts.priority_leads}</strong>
                <span>leads com prioridade comercial alta</span>
              </article>
            </section>

            <div className={styles.sectionTitle}>
              <h2>Fila de atenção</h2>
              <span>atualizada em {new Date(queue.generated_at).toLocaleString("pt-BR")}</span>
            </div>

            <section className={styles.list}>
              {queue.actions.length === 0 ? (
                <div className={styles.empty}>Nenhuma ação pendente neste momento.</div>
              ) : queue.actions.map((action) => {
                const href = action.pre_diagnostic_id
                  ? `/interno/pre-diagnosticos/${action.pre_diagnostic_id}`
                  : "/interno";
                return (
                  <Link className={styles.action} href={href} key={action.action_id}>
                    <span className={styles.priority}>{labelPriority(action.priority)}</span>
                    <span>
                      <span className={styles.company}>{action.company_name || action.lead_name}</span>
                      <span className={styles.meta}>{action.title} · {action.lead_name}</span>
                    </span>
                    <span className={styles.badge}>{action.human_review_status || "sem revisão"}</span>
                    <span className={styles.score}>{action.commercial_score}/10</span>
                  </Link>
                );
              })}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
