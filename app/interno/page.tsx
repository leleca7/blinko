import Link from "next/link";
import { requireInternalSession } from "../../lib/blinko/internal-auth";
import { getCommercialTodayActions } from "../../lib/blinko/commercial-server";
import { normalizeBlinkoTodayQueue, type BlinkoTodayAction } from "../../lib/blinko/internal-queue";
import { getBlinkoTodayQueue } from "../../lib/blinko/today-server";
import InternalTopbar from "./InternalTopbar";
import styles from "./interno.module.css";

function labelPriority(priority: string) {
  return { urgent: "Urgente", high: "Alta", normal: "Normal", low: "Baixa" }[priority] ?? priority;
}

function actionHref(action: BlinkoTodayAction) {
  if (action.opportunity_id) return `/interno/comercial/${action.opportunity_id}`;
  if (action.project_id) return `/interno/projetos/${action.project_id}`;
  if (action.pre_diagnostic_id) return `/interno/pre-diagnosticos/${action.pre_diagnostic_id}`;
  return "/interno";
}

function actionBadge(action: BlinkoTodayAction) {
  if (action.source === "commercial_opportunity") return action.pipeline_stage ? `${action.pipeline_stage} · Comercial` : "Comercial";
  if (action.source === "approval") return "Aprovação";
  if (action.source === "finance") return "Financeiro";
  if (action.source === "project_closure") return "Encerramento";
  if (action.source === "project_task") return action.responsible_label || action.project_status || "Projeto";
  return action.human_review_status || action.lead_status || "Workflow";
}

function actionMeta(action: BlinkoTodayAction) {
  if (action.source === "commercial_opportunity") return ["Próxima ação comercial", action.responsible_label ? `Responsável: ${action.responsible_label}` : ""].filter(Boolean).join(" · ");
  if (action.source === "approval") return "Aprovação de cliente · projeto";
  if (action.source === "finance") return "Recebível · financeiro";
  if (action.source === "project_closure") return "Checklist final · projeto";
  if (action.source === "project_task") return ["Tarefa de projeto", action.responsible_label ? `Responsável: ${action.responsible_label}` : ""].filter(Boolean).join(" · ");
  return [action.action_type, action.lead_name].filter(Boolean).join(" · ");
}

function formatDue(value: string | null) {
  if (!value) return "sem prazo";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sem prazo";
  return date.toLocaleString("pt-BR", { timeZone: "America/Bahia", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function ActionList({ actions, empty }: { actions: BlinkoTodayAction[]; empty: string }) {
  if (actions.length === 0) return <div className={styles.empty}>{empty}</div>;
  return <section className={styles.list}>{actions.map((action) => <Link className={styles.action} href={actionHref(action)} key={`${action.source}-${action.action_id}`}>
    <span className={styles.priority}>{labelPriority(action.priority)}</span>
    <span><span className={styles.company}>{action.company_name || action.lead_name || "Blinko"}</span><span className={styles.meta}>{action.title} · {actionMeta(action)}</span></span>
    <span className={styles.badge}>{actionBadge(action)}</span>
    <span className={styles.score} style={{ fontFamily: "inherit", fontSize: 12, opacity: .65 }}>{formatDue(action.due_at)}</span>
  </Link>)}</section>;
}

function mergeCommercialActions(base: unknown, commercialActions: Record<string, unknown>[]) {
  if (!base || typeof base !== "object" || Array.isArray(base)) return base;
  const source = base as Record<string, unknown>;
  const baseActions = Array.isArray(source.actions) ? source.actions.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
  const opportunityLeadIds = new Set(commercialActions.map((item) => typeof item.lead_id === "string" ? item.lead_id : "").filter(Boolean));
  const withoutMirroredCrm = baseActions.filter((item) => !(item.source === "crm" && typeof item.lead_id === "string" && opportunityLeadIds.has(item.lead_id)));
  return { ...source, actions: [...commercialActions, ...withoutMirroredCrm] };
}

export default async function InternalTodayPage() {
  const session = await requireInternalSession();
  const [baseRaw, commercial] = await Promise.all([getBlinkoTodayQueue(), getCommercialTodayActions()]);
  const queue = normalizeBlinkoTodayQueue(mergeCommercialActions(baseRaw, commercial.actions));
  const doNow = queue?.actions.filter((action) => action.bucket === "do_now") ?? [];
  const waitingClient = queue?.actions.filter((action) => action.bucket === "waiting_client") ?? [];
  const waitingPartner = queue?.actions.filter((action) => action.bucket === "waiting_partner") ?? [];
  const blocked = queue?.actions.filter((action) => action.bucket === "blocked") ?? [];
  const commercialActions = queue?.actions.filter((action) => action.source === "commercial_opportunity") ?? [];
  const overdueCommercial = commercialActions.filter((action) => action.due_at && new Date(action.due_at).getTime() < Date.now()).length;

  return <main className={styles.page}><div className={styles.shell}>
    <InternalTopbar user={session.user} active="today" />
    <section className={styles.hero}><span className={styles.eyebrow}>OPERAÇÃO · AGORA</span><h1>Hoje na Blinko.</h1><p>Uma fila única para comercial, execução, aprovações, financeiro e encerramento. A próxima ação da Oportunidade é a fonte oficial do funil; ações antigas de CRM ficam como workflow de apoio.</p></section>
    {!queue ? <div className={styles.empty}>A fila interna não pôde ser carregada com segurança.</div> : <>
      <section className={styles.counts} aria-label="Resumo de hoje">
        <article className={styles.countCard}><strong>{commercialActions.length}</strong><span>próximas ações comerciais</span></article>
        <article className={styles.countCard}><strong>{overdueCommercial}</strong><span>ações comerciais vencidas</span></article>
        <article className={styles.countCard}><strong>{queue.counts.overdue_project_tasks}</strong><span>tarefas de projeto vencidas</span></article>
        <article className={styles.countCard}><strong>{queue.counts.pending_approvals}</strong><span>aprovações aguardando cliente</span></article>
        <article className={styles.countCard}><strong>{queue.counts.overdue_receivables}</strong><span>recebíveis vencidos</span></article>
        <article className={styles.countCard}><strong>{queue.counts.projects_ready_to_close}</strong><span>projetos prontos para encerrar</span></article>
        <article className={styles.countCard}><strong>{queue.counts.waiting_partner_project_tasks}</strong><span>aguardando parceiro</span></article>
        <article className={styles.countCard}><strong>{queue.counts.blocked_project_tasks}</strong><span>tarefas bloqueadas</span></article>
      </section>
      <div className={styles.sectionTitle}><h2>Preciso fazer</h2><span>atualizada em {new Date(queue.generated_at).toLocaleString("pt-BR", { timeZone: "America/Bahia" })}</span></div><ActionList actions={doNow} empty="Nenhuma ação executável pendente neste momento." />
      <div className={styles.sectionTitle}><h2>Aguardando cliente</h2><span>inclui materiais, respostas e aprovações pendentes</span></div><ActionList actions={waitingClient} empty="Nenhuma tarefa ou aprovação está aguardando cliente neste momento." />
      <div className={styles.sectionTitle}><h2>Aguardando parceiro</h2><span>depende de fornecedor, especialista ou parceiro coordenado</span></div><ActionList actions={waitingPartner} empty="Nenhuma tarefa está aguardando parceiro neste momento." />
      <div className={styles.sectionTitle}><h2>Bloqueado</h2><span>exige ação de desbloqueio e próxima checagem definida</span></div><ActionList actions={blocked} empty="Nenhuma tarefa está bloqueada neste momento." />
    </>}
  </div></main>;
}
