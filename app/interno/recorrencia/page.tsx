import Link from "next/link";
import { requireInternalSession } from "../../../lib/blinko/internal-auth";
import { getRecurrenceOverview } from "../../../lib/blinko/recurrence-server";
import InternalTopbar from "../InternalTopbar";
import styles from "../interno.module.css";

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function object(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function when(value: unknown) {
  const raw = text(value);
  if (!raw) return "a definir";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString("pt-BR", { timeZone: "America/Bahia", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function dateOnly(value: unknown) {
  const raw = text(value);
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
function renewalLabel(value: unknown) {
  return { not_scheduled: "Revisão a definir", scheduled: "Revisão agendada", due_to_open: "Abrir revisão", pending_decision: "Decisão pendente", commercial_followup: "Em renovação comercial", resolved: "Resolvida" }[text(value)] ?? text(value) || "Sem revisão";
}

export default async function RecurrenceOverviewPage() {
  const session = await requireInternalSession("projects.view");
  const scopeAll = session.mode === "legacy" || session.accessScope === "global";
  const overview = await getRecurrenceOverview({ scopeAll, userId: session.userId });

  const withPlan = overview.projects.filter((item) => object(item.plan));
  const withoutPlan = overview.projects.filter((item) => !object(item.plan));
  const activeCycles = overview.projects.filter((item) => ["planned","active"].includes(text(object(item.latest_cycle)?.status))).length;
  const renewalActions = overview.projects.filter((item) => ["due_to_open","pending_decision","commercial_followup"].includes(text(object(item.renewal)?.queue_status))).length;

  return <main className={styles.page}><div className={styles.shell}>
    <InternalTopbar user={session.user} active="recurrence" />
    <section className={styles.hero}>
      <span className={styles.eyebrow}>A23 · A24 · A25</span>
      <h1>Recorrência sem projeto infinito.</h1>
      <p>Contrato e projeto permanecem estáveis; cada período tem ciclo próprio, fechamento, carry-over, renovação e reavaliação rastreáveis.</p>
    </section>

    {!overview.schemaReady ? <div className={styles.empty}>A estrutura de recorrência ainda não está disponível no banco conectado. A migração 048 precisa ser aplicada antes desta interface.</div> : <>
      <section className={styles.counts} aria-label="Resumo de recorrência">
        <article className={styles.countCard}><strong>{withPlan.length}</strong><span>projetos com plano recorrente</span></article>
        <article className={styles.countCard}><strong>{activeCycles}</strong><span>ciclos planejados ou ativos</span></article>
        <article className={styles.countCard}><strong>{renewalActions}</strong><span>renovações com ação</span></article>
        <article className={styles.countCard}><strong>{overview.reassessments.length}</strong><span>reavaliações abertas</span></article>
      </section>

      <div className={styles.sectionTitle}><h2>Projetos recorrentes</h2><span>visão por contrato e ciclo</span></div>
      {withPlan.length ? <section className={styles.list}>{withPlan.map((item) => {
        const plan = object(item.plan)!;
        const cycle = object(item.latest_cycle);
        const renewal = object(item.renewal);
        return <Link className={styles.action} href={`/interno/projetos/${text(item.project_id)}/recorrencia`} key={text(item.project_id)}>
          <span className={styles.priority}>{text(plan.status) || "plano"}</span>
          <span><span className={styles.company}>{text(item.company_name)}</span><span className={styles.meta}>{text(item.objective)} · plano v{text(plan.version_number)} · {text(plan.cadence_count)} {text(plan.cadence_unit)}</span></span>
          <span className={styles.badge}>{cycle ? `Ciclo ${text(cycle.sequence_number)} · ${text(cycle.status)}` : "sem ciclo"}</span>
          <span className={styles.score} style={{ fontFamily: "inherit", fontSize: 12, opacity: .7 }}>{renewalLabel(renewal?.queue_status)} · {when(renewal?.due_at)}</span>
        </Link>;
      })}</section> : <div className={styles.empty}>Nenhum projeto autorizado possui plano recorrente vigente.</div>}

      {withoutPlan.length ? <><div className={styles.sectionTitle}><h2>Projetos sem plano recorrente</h2><span>nenhum plano é criado por suposição</span></div><section className={styles.list}>{withoutPlan.map((item) => <Link className={styles.action} href={`/interno/projetos/${text(item.project_id)}/recorrencia`} key={text(item.project_id)}>
        <span className={styles.priority}>A definir</span>
        <span><span className={styles.company}>{text(item.company_name)}</span><span className={styles.meta}>{text(item.objective)}</span></span>
        <span className={styles.badge}>{text(item.project_status)}</span>
        <span className={styles.score} style={{ fontFamily: "inherit", fontSize: 12, opacity: .7 }}>Abrir workspace</span>
      </Link>)}</section></> : null}

      <div className={styles.sectionTitle}><h2>Reavaliações abertas</h2><span>novo diagnóstico sem sobrescrever o anterior</span></div>
      {overview.reassessments.length ? <section className={styles.list}>{overview.reassessments.map((item) => <Link className={styles.action} href={`/interno/projetos/${text(item.project_id)}/recorrencia`} key={text(item.id)}>
        <span className={styles.priority}>{text(item.queue_status)}</span>
        <span><span className={styles.company}>{text(item.company_name)}</span><span className={styles.meta}>{text(item.reason)} · rota {text(item.route)}</span></span>
        <span className={styles.badge}>{text(item.status)}</span>
        <span className={styles.score} style={{ fontFamily: "inherit", fontSize: 12, opacity: .7 }}>{when(item.due_at)}</span>
      </Link>)}</section> : <div className={styles.empty}>Nenhuma reavaliação aberta nos projetos autorizados.</div>}

      <div className={styles.notice} style={{ marginTop: 24 }}>Receita/custo por ciclo aparecem somente para papéis com acesso financeiro. Ausência de data de renovação continua como <strong>a definir</strong>; esta tela não cria prazos automáticos.</div>
    </>}
  </div></main>;
}
