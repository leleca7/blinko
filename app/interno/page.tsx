import Link from "next/link";
import { hasInternalPermission, requireInternalSession } from "../../lib/blinko/internal-auth";
import { getCommercialTodayActions } from "../../lib/blinko/commercial-server";
import { getChangeRequestTodayActions } from "../../lib/blinko/change-requests-today-server";
import { normalizeBlinkoTodayQueue, type BlinkoTodayAction } from "../../lib/blinko/internal-queue";
import { getBlinkoTodayQueue } from "../../lib/blinko/today-server";
import InternalTopbar from "./InternalTopbar";
import styles from "./interno.module.css";

function labelPriority(priority: string) {
  return { urgent: "Urgente", high: "Alta", normal: "Normal", low: "Baixa" }[priority] ?? priority;
}

function actionHref(action: BlinkoTodayAction) {
  if (action.source === "change_request" && action.project_id) return `/interno/projetos/${action.project_id}/alteracoes`;
  if (action.source === "commercial_opportunity" && action.pipeline_stage === "P13" && action.project_id) {
    return `/interno/projetos/${action.project_id}/onboarding`;
  }
  if (action.opportunity_id) return `/interno/comercial/${action.opportunity_id}`;
  if (action.project_id) return `/interno/projetos/${action.project_id}`;
  if (action.pre_diagnostic_id) return `/interno/pre-diagnosticos/${action.pre_diagnostic_id}`;
  return "/interno";
}

function actionBadge(action: BlinkoTodayAction) {
  if (action.source === "commercial_opportunity") return action.pipeline_stage ? `${action.pipeline_stage} · Comercial` : "Comercial";
  if (action.source === "change_request") return "Alteração";
  if (action.source === "approval") return "Aprovação";
  if (action.source === "finance") return "Financeiro";
  if (action.source === "project_closure") return "Encerramento";
  if (action.source === "project_task") return action.responsible_label || action.project_status || "Projeto";
  return action.human_review_status || action.lead_status || "Workflow";
}

function actionMeta(action: BlinkoTodayAction) {
  if (action.source === "commercial_opportunity") return ["Próxima ação comercial", action.responsible_label ? `Responsável: ${action.responsible_label}` : ""].filter(Boolean).join(" · ");
  if (action.source === "change_request") return ["Decisão/execução de alteração", action.responsible_label ? `Responsável: ${action.responsible_label}` : ""].filter(Boolean).join(" · ");
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

function asRecords(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function mergeTodayActions(
  base: unknown,
  commercialActions: Record<string, unknown>[],
  changeActions: unknown,
  changeCounts: unknown,
) {
  if (!base || typeof base !== "object" || Array.isArray(base)) return base;
  const source = base as Record<string, unknown>;
  const baseActions = asRecords(source.actions);
  const opportunityLeadIds = new Set(commercialActions.map((item) => typeof item.lead_id === "string" ? item.lead_id : "").filter(Boolean));
  const withoutMirroredCrm = baseActions.filter((item) => !(item.source === "crm" && typeof item.lead_id === "string" && opportunityLeadIds.has(item.lead_id)));
  const counts = source.counts && typeof source.counts === "object" && !Array.isArray(source.counts) ? source.counts as Record<string, unknown> : {};
  const extraCounts = changeCounts && typeof changeCounts === "object" && !Array.isArray(changeCounts) ? changeCounts as Record<string, unknown> : {};
  return { ...source, counts: { ...counts, ...extraCounts }, actions: [...commercialActions, ...asRecords(changeActions), ...withoutMirroredCrm] };
}

export default async function InternalTodayPage() {
  const session = await requireInternalSession("dashboard.view");
  const canCommercial = hasInternalPermission(session, "commercial.view");
  const canProjects = hasInternalPermission(session, "projects.view");
  const canApprovals = hasInternalPermission(session, "approvals.view");
  const canFinance = hasInternalPermission(session, "finance.view");
  const canChanges = hasInternalPermission(session, "changes.view");

  const [baseRaw, commercial, changes] = await Promise.all([
    getBlinkoTodayQueue({ commercial: canCommercial, projects: canProjects, approvals: canApprovals, finance: canFinance }),
    canCommercial ? getCommercialTodayActions() : Promise.resolve({ schemaReady: true, actions: [] as Record<string, unknown>[] }),
    canChanges ? getChangeRequestTodayActions() : Promise.resolve({ counts: { change_requests_pending_decision: 0, change_requests_ready_for_execution: 0 }, actions: [] }),
  ]);
  const queue = normalizeBlinkoTodayQueue(mergeTodayActions(baseRaw, commercial.actions, changes.actions, changes.counts));
  const doNow = queue?.actions.filter((action) => action.bucket === "do_now") ?? [];
  const waitingClient = queue?.actions.filter((action) => action.bucket === "waiting_client") ?? [];
  const waitingPartner = queue?.actions.filter((action) => action.bucket === "waiting_partner") ?? [];
  const blocked = queue?.actions.filter((action) => action.bucket === "blocked") ?? [];
  const commercialActions = queue?.actions.filter((action) => action.source === "commercial_opportunity") ?? [];
  const overdueCommercial = commercialActions.filter((action) => action.due_at && new Date(action.due_at).getTime() < Date.now()).length;

  return <main className={styles.page}><div className={styles.shell}>
    <InternalTopbar user={session.user} active="today" />
    <section className={styles.hero}><span className={styles.eyebrow}>OPERAÇÃO · AGORA</span><h1>Hoje na Blinko.</h1><p>Sua fila consolidada respeita o papel e as permissões atuais. Cada usuário recebe apenas os domínios operacionais que pode consultar.</p></section>
    {!queue ? <div className={styles.empty}>A fila interna não pôde ser carregada com segurança.</div> : <>
      <section className={styles.counts} aria-label="Resumo de hoje">
        {canCommercial ? <><article className={styles.countCard}><strong>{commercialActions.length}</strong><span>próximas ações comerciais</span></article><article className={styles.countCard}><strong>{overdueCommercial}</strong><span>ações comerciais vencidas</span></article></> : null}
        {canChanges ? <article className={styles.countCard}><strong>{queue.counts.change_requests_pending_decision}</strong><span>alterações aguardando decisão</span></article> : null}
        {canProjects ? <article className={styles.countCard}><strong>{queue.counts.overdue_project_tasks}</strong><span>tarefas de projeto vencidas</span></article> : null}
        {canApprovals ? <article className={styles.countCard}><strong>{queue.counts.pending_approvals}</strong><span>aprovações aguardando cliente</span></article> : null}
        {canFinance ? <article className={styles.countCard}><strong>{queue.counts.overdue_receivables}</strong><span>recebíveis vencidos</span></article> : null}
        {canProjects ? <><article className={styles.countCard}><strong>{queue.counts.projects_ready_to_close}</strong><span>projetos prontos para encerrar</span></article><article className={styles.countCard}><strong>{queue.counts.waiting_partner_project_tasks}</strong><span>aguardando parceiro</span></article><article className={styles.countCard}><strong>{queue.counts.blocked_project_tasks}</strong><span>tarefas bloqueadas</span></article></> : null}
      </section>
      <div className={styles.sectionTitle}><h2>Preciso fazer</h2><span>atualizada em {new Date(queue.generated_at).toLocaleString("pt-BR", { timeZone: "America/Bahia" })}</span></div><ActionList actions={doNow} empty="Nenhuma ação executável permitida para seu papel neste momento." />
      <div className={styles.sectionTitle}><h2>Aguardando cliente</h2><span>itens visíveis conforme suas permissões</span></div><ActionList actions={waitingClient} empty="Nenhum item permitido está aguardando cliente neste momento." />
      <div className={styles.sectionTitle}><h2>Aguardando parceiro</h2><span>itens visíveis conforme suas permissões</span></div><ActionList actions={waitingPartner} empty="Nenhum item permitido está aguardando parceiro neste momento." />
      <div className={styles.sectionTitle}><h2>Bloqueado</h2><span>itens visíveis conforme suas permissões</span></div><ActionList actions={blocked} empty="Nenhum item permitido está bloqueado neste momento." />
    </>}
  </div></main>;
}
