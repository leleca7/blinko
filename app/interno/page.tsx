import Link from "next/link";
import { requireInternalSession } from "../../lib/blinko/internal-auth";
import { normalizeBlinkoTodayQueue, type BlinkoTodayAction } from "../../lib/blinko/internal-queue";
import { getBlinkoTodayQueue } from "../../lib/blinko/today-server";
import InternalTopbar from "./InternalTopbar";
import styles from "./interno.module.css";

function labelPriority(priority: string) {
  return { urgent: "Urgente", high: "Alta", normal: "Normal", low: "Baixa" }[priority] ?? priority;
}

function actionHref(action: BlinkoTodayAction) {
  if (action.project_id) return `/interno/projetos/${action.project_id}`;
  if (action.pre_diagnostic_id) return `/interno/pre-diagnosticos/${action.pre_diagnostic_id}`;
  return "/interno";
}

function actionBadge(action: BlinkoTodayAction) {
  if (action.source === "project_task") {
    return action.responsible_label || action.project_status || "Projeto";
  }
  return action.human_review_status || action.lead_status || "Comercial";
}

function actionMeta(action: BlinkoTodayAction) {
  if (action.source === "project_task") {
    return ["Tarefa de projeto", action.responsible_label ? `Responsável: ${action.responsible_label}` : ""]
      .filter(Boolean)
      .join(" · ");
  }
  return [action.action_type, action.lead_name].filter(Boolean).join(" · ");
}

function formatDue(value: string | null) {
  if (!value) return "sem prazo";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sem prazo";
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Bahia",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ActionList({ actions, empty }: { actions: BlinkoTodayAction[]; empty: string }) {
  if (actions.length === 0) return <div className={styles.empty}>{empty}</div>;

  return (
    <section className={styles.list}>
      {actions.map((action) => (
        <Link className={styles.action} href={actionHref(action)} key={`${action.source}-${action.action_id}`}>
          <span className={styles.priority}>{labelPriority(action.priority)}</span>
          <span>
            <span className={styles.company}>{action.company_name || action.lead_name || "Blinko"}</span>
            <span className={styles.meta}>{action.title} · {actionMeta(action)}</span>
          </span>
          <span className={styles.badge}>{actionBadge(action)}</span>
          <span className={styles.score} style={{ fontFamily: "inherit", fontSize: 12, opacity: .65 }}>{formatDue(action.due_at)}</span>
        </Link>
      ))}
    </section>
  );
}

export default async function InternalTodayPage() {
  const session = await requireInternalSession();
  const queue = normalizeBlinkoTodayQueue(await getBlinkoTodayQueue());

  const doNow = queue?.actions.filter((action) => action.bucket === "do_now") ?? [];
  const waitingClient = queue?.actions.filter((action) => action.bucket === "waiting_client") ?? [];
  const waitingPartner = queue?.actions.filter((action) => action.bucket === "waiting_partner") ?? [];
  const blocked = queue?.actions.filter((action) => action.bucket === "blocked") ?? [];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <InternalTopbar user={session.user} active="today" />

        <section className={styles.hero}>
          <span className={styles.eyebrow}>OPERAÇÃO · AGORA</span>
          <h1>Hoje na Blinko.</h1>
          <p>Uma fila única para comercial e execução. O sistema separa o que depende da Blinko, do cliente, do parceiro e o que está realmente bloqueado.</p>
        </section>

        {!queue ? (
          <div className={styles.empty}>A fila interna não pôde ser carregada com segurança.</div>
        ) : (
          <>
            <section className={styles.counts} aria-label="Resumo de hoje">
              <article className={styles.countCard}><strong>{queue.counts.overdue_project_tasks}</strong><span>tarefas de projeto vencidas</span></article>
              <article className={styles.countCard}><strong>{queue.counts.project_tasks_due_today}</strong><span>tarefas de projeto com prazo hoje</span></article>
              <article className={styles.countCard}><strong>{queue.counts.waiting_client_project_tasks}</strong><span>aguardando cliente</span></article>
              <article className={styles.countCard}><strong>{queue.counts.waiting_partner_project_tasks}</strong><span>aguardando parceiro</span></article>
              <article className={styles.countCard}><strong>{queue.counts.blocked_project_tasks}</strong><span>tarefas bloqueadas</span></article>
              <article className={styles.countCard}><strong>{queue.counts.pending_pre_diagnostic_reviews}</strong><span>pré-diagnósticos aguardando revisão</span></article>
            </section>

            <div className={styles.sectionTitle}>
              <h2>Preciso fazer</h2>
              <span>atualizada em {new Date(queue.generated_at).toLocaleString("pt-BR", { timeZone: "America/Bahia" })}</span>
            </div>
            <ActionList actions={doNow} empty="Nenhuma ação executável pendente neste momento." />

            <div className={styles.sectionTitle}>
              <h2>Aguardando cliente</h2>
              <span>depende de material, resposta, aprovação ou decisão do cliente</span>
            </div>
            <ActionList actions={waitingClient} empty="Nenhuma tarefa está aguardando cliente neste momento." />

            <div className={styles.sectionTitle}>
              <h2>Aguardando parceiro</h2>
              <span>depende de fornecedor, especialista ou parceiro coordenado</span>
            </div>
            <ActionList actions={waitingPartner} empty="Nenhuma tarefa está aguardando parceiro neste momento." />

            <div className={styles.sectionTitle}>
              <h2>Bloqueado</h2>
              <span>exige ação de desbloqueio e próxima checagem definida</span>
            </div>
            <ActionList actions={blocked} empty="Nenhuma tarefa está bloqueada neste momento." />
          </>
        )}
      </div>
    </main>
  );
}
