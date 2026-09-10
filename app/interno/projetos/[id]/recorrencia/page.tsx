import Link from "next/link";
import { notFound } from "next/navigation";
import { hasInternalPermission, requireInternalProjectSession } from "../../../../../lib/blinko/internal-auth";
import { getProjectRecurrenceContext } from "../../../../../lib/blinko/recurrence-server";
import InternalTopbar from "../../../InternalTopbar";
import styles from "../../../interno.module.css";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ status?: string }> };

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function display(value: unknown) { return value === null || value === undefined || value === "" ? "—" : String(value); }
function object(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function array(value: unknown) { return Array.isArray(value) ? value : []; }
function dateOnly(value: unknown) {
  const raw = text(value);
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
function dateInput(value: unknown) { const raw = text(value); return raw ? raw.slice(0, 10) : ""; }
function when(value: unknown) {
  const raw = text(value);
  if (!raw) return "a definir";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString("pt-BR", { timeZone: "America/Bahia" });
}
function localInput(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}`;
}
function money(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
}
function lines(value: unknown) { return array(value).map((item) => String(item)).join("\n"); }
function notice(status?: string) {
  return {
    plan_saved: "Nova versão do plano recorrente registrada.", plan_invalid: "Revise os campos do plano recorrente.",
    cycle_created: "Ciclo criado com histórico preservado.", cycle_started: "Ciclo iniciado.", cycle_closed: "Ciclo fechado com evidências e decisão de continuidade.", cycle_invalid: "Revise o ciclo selecionado.",
    cycle_item_created: "Item criado e atribuído ao ciclo.", cycle_item_invalid: "Revise os dados do item do ciclo.",
    renewal_opened: "Revisão de renovação aberta.", renewal_routed: "Renovação encaminhada ao Comercial em nova oportunidade.", renewal_resolved: "Revisão de renovação resolvida com evidência.", renewal_invalid: "Revise os dados da renovação.",
    reassessment_scheduled: "Reavaliação agendada sem alterar o diagnóstico anterior.", reassessment_routed: "Rota da reavaliação registrada.", reassessment_started: "Novo diagnóstico de reavaliação iniciado.", reassessment_commercial: "Reavaliação encaminhada ao Comercial como nova oportunidade.", reassessment_invalid: "Revise os dados da reavaliação.",
    schema_pending: "A migração 048 ainda não está disponível no banco conectado.", action_invalid: "Ação de recorrência inválida.", action_blocked: "A ação foi bloqueada por uma regra de negócio. Nenhum gate foi contornado.",
  }[status ?? ""] ?? null;
}

const controlStyle = { border: "1px solid rgba(1,48,30,.18)", background: "rgba(255,255,255,.82)", color: "#08271b", borderRadius: 14, padding: 13, font: "inherit" };
const cardStyle = { padding: 17, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16, background: "rgba(255,255,255,.52)" };

export default async function ProjectRecurrencePage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const session = await requireInternalProjectSession(id, "projects.view");
  const query = searchParams ? await searchParams : {};
  const canManageProjects = hasInternalPermission(session, "projects.manage");
  const canTasks = hasInternalPermission(session, "tasks.manage");
  const canApprovals = hasInternalPermission(session, "approvals.manage");
  const canViewFinance = hasInternalPermission(session, "finance.view");
  const canManageFinance = hasInternalPermission(session, "finance.manage");
  const canManageContracts = hasInternalPermission(session, "contracts.manage");
  const canCommercial = hasInternalPermission(session, "commercial.manage");
  const canDiagnostics = hasInternalPermission(session, "diagnostics.manage");
  const context = await getProjectRecurrenceContext(id, canViewFinance);
  const statusNotice = notice(query.status);

  if (!context.schemaReady) return <main className={styles.page}><div className={styles.shell}><InternalTopbar user={session.user} active="recurrence" /><section className={styles.hero}><span className={styles.eyebrow}>RECORRÊNCIA</span><h1>Estrutura ainda não aplicada.</h1><p>A interface exige a migração 048 no banco conectado.</p></section></div></main>;
  if (!context.project || !context.company) notFound();

  const project = context.project;
  const company = context.company;
  const plan = context.currentPlan;
  const renewal = context.renewal;
  const projectStatus = text(project.status);

  return <main className={styles.page}><div className={styles.shell}>
    <InternalTopbar user={session.user} active="recurrence" />
    <section className={styles.hero}>
      <Link className={styles.back} href="/interno/recorrencia">← voltar para Recorrência</Link>
      {statusNotice ? <div className={styles.notice} style={{ marginTop: 14 }}>{statusNotice}</div> : null}
      <span className={styles.eyebrow} style={{ marginTop: 22 }}>PROJETO RECORRENTE</span>
      <h1>{text(company.name)}</h1>
      <p>{text(project.objective)} · status {projectStatus}. O projeto pai permanece estável; os períodos abaixo são entidades independentes.</p>
    </section>

    <div className={styles.reviewShell}>
      <section className={styles.reviewCard}>
        <span className={styles.eyebrow}>PLANO RECORRENTE</span><h2>{plan ? `Versão ${display(plan.version_number)} · ${text(plan.status)}` : "Ainda não configurado"}</h2>
        {plan ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <span className={styles.badge}>Cadência: {display(plan.cadence_count)} {text(plan.cadence_unit)}</span>
          <span className={styles.badge}>1º período: {dateOnly(plan.first_period_start)}–{dateOnly(plan.first_period_end)}</span>
          <span className={styles.badge}>Contrato até: {dateOnly(plan.contract_valid_until)}</span>
          <span className={styles.badge}>Revisão: {when(plan.renewal_review_at)}</span>
        </div> : <div className={styles.notice}>Nenhuma recorrência é presumida. Um plano só existe quando contrato, cadência, entregáveis e evidência são registrados.</div>}
        {plan ? <p style={{ opacity: .7, lineHeight: 1.55, marginTop: 16 }}>Entregáveis previstos: {array(plan.expected_deliverables).map(String).join(" · ")}. Evidência: {text(plan.evidence_reference)}</p> : null}

        {canManageProjects ? <form action="/api/interno/recorrencia" method="post" className={styles.form} style={{ marginTop: 24 }}>
          <input type="hidden" name="action" value="plan_save" /><input type="hidden" name="project_id" value={id} />
          <strong>{plan ? "Criar nova versão do plano" : "Configurar plano recorrente"}</strong>
          <label>Status<select name="status" defaultValue={text(plan?.status) || "active"} style={controlStyle}><option value="draft">Rascunho</option><option value="active">Ativo</option><option value="paused">Pausado</option><option value="ended">Encerrado</option></select></label>
          <label>Cadência<select name="cadence_unit" defaultValue={text(plan?.cadence_unit) || "month"} style={controlStyle}><option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option><option value="custom">Período customizado</option></select></label>
          <label>Quantidade por cadência<input name="cadence_count" type="number" min="1" defaultValue={display(plan?.cadence_count) === "—" ? "1" : display(plan?.cadence_count)} required style={controlStyle} /></label>
          <label>Primeiro período — início<input name="first_period_start" type="date" defaultValue={dateInput(plan?.first_period_start)} required style={controlStyle} /></label>
          <label>Primeiro período — fim<input name="first_period_end" type="date" defaultValue={dateInput(plan?.first_period_end)} required style={controlStyle} /></label>
          <label>Validade contratual, quando definida<input name="contract_valid_until" type="date" defaultValue={dateInput(plan?.contract_valid_until)} style={controlStyle} /></label>
          <label>Data/hora da revisão de renovação, quando definida<input name="renewal_review_at" type="datetime-local" defaultValue={localInput(plan?.renewal_review_at)} style={controlStyle} /></label>
          <label>Entregáveis previstos, um por linha<textarea name="expected_deliverables" rows={5} required defaultValue={lines(plan?.expected_deliverables)} style={controlStyle} /></label>
          <label>Fonte contratual/referência<input name="source_reference" required maxLength={500} defaultValue={text(plan?.source_reference)} style={controlStyle} /></label>
          <label>Evidência da configuração<input name="evidence_reference" required maxLength={500} defaultValue={text(plan?.evidence_reference)} style={controlStyle} /></label>
          <label>Owner do plano<input name="owner_label" required maxLength={180} defaultValue={text(plan?.owner_label) || session.user} style={controlStyle} /></label>
          <label>Observações<textarea name="notes" rows={3} defaultValue={text(plan?.notes)} style={controlStyle} /></label>
          <button className={styles.button} type="submit">Salvar como nova versão</button>
        </form> : null}

        {plan && context.cycles.length === 0 && canManageProjects && text(plan.status) === "active" ? <form action="/api/interno/recorrencia" method="post" style={{ marginTop: 18 }}><input type="hidden" name="action" value="cycle_first" /><input type="hidden" name="project_id" value={id} /><button className={styles.button} type="submit">Criar primeiro ciclo</button></form> : null}
      </section>

      <section className={styles.reviewCard}>
        <span className={styles.eyebrow}>CICLOS</span><h2>Execução por período</h2>
        {context.cycles.length ? <div style={{ display: "grid", gap: 18, marginTop: 18 }}>{context.cycles.map((cycle) => {
          const cycleId = text(cycle.id);
          const cycleTasks = context.cycleTasks.filter((item) => text(item.service_cycle_id) === cycleId);
          const cycleApprovals = context.cycleApprovals.filter((item) => text(item.service_cycle_id) === cycleId);
          const cycleReceivables = context.cycleReceivables.filter((item) => text(item.service_cycle_id) === cycleId);
          const cycleCosts = context.cycleCosts.filter((item) => text(item.service_cycle_id) === cycleId);
          const cycleStatus = text(cycle.status);
          return <article key={cycleId} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>Ciclo {display(cycle.sequence_number)} · {dateOnly(cycle.period_start)}–{dateOnly(cycle.period_end)}</strong><span className={styles.badge}>{cycleStatus}</span></div>
            <small style={{ display: "block", marginTop: 7 }}>Tarefas abertas: {display(cycle.open_task_count)} · Aprovações abertas: {display(cycle.open_approval_count)} · Continuidade: {text(cycle.continuation_status)}</small>
            {canViewFinance ? <small style={{ display: "block", marginTop: 5 }}>Receita prevista: {money(cycle.cycle_receivable_total)} · recebida: {money(cycle.cycle_received_total)} · custos: {money(cycle.cycle_cost_total)}</small> : null}
            {array(cycle.pending_items).length ? <small style={{ display: "block", marginTop: 5 }}>Pendências: {array(cycle.pending_items).map(String).join(" · ")}</small> : null}
            {array(cycle.carry_over_items).length ? <div className={styles.notice} style={{ marginTop: 10 }}>Carry-over: {array(cycle.carry_over_items).map(String).join(" · ")} · Justificativa: {text(cycle.carry_over_justification)}</div> : null}
            {text(cycle.delivery_evidence_reference) ? <small style={{ display: "block", marginTop: 7 }}>Evidência de fechamento: {text(cycle.delivery_evidence_reference)}</small> : null}

            {cycleStatus === "planned" && canManageProjects ? <form action="/api/interno/recorrencia" method="post" style={{ marginTop: 14 }}><input type="hidden" name="action" value="cycle_start" /><input type="hidden" name="project_id" value={id} /><input type="hidden" name="cycle_id" value={cycleId} /><button className={styles.button} type="submit">Iniciar ciclo</button></form> : null}

            {["planned","active"].includes(cycleStatus) ? <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
              {canTasks ? <form action="/api/interno/recorrencia" method="post" className={styles.form}><input type="hidden" name="action" value="cycle_task" /><input type="hidden" name="project_id" value={id} /><input type="hidden" name="cycle_id" value={cycleId} /><strong>Adicionar tarefa ao ciclo</strong><label>Título<input name="title" required maxLength={300} style={controlStyle} /></label><label>Responsável<input name="responsible_label" maxLength={180} style={controlStyle} /></label><label>Prazo<input name="due_at" type="datetime-local" style={controlStyle} /></label><label>Dependências, uma por linha<textarea name="dependencies" rows={3} style={controlStyle} /></label><label>Prioridade<select name="priority" defaultValue="normal" style={controlStyle}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label><label>Estimativa<input name="estimate" maxLength={500} style={controlStyle} /></label><label style={{ display: "flex", gap: 9 }}><input type="checkbox" name="approval_required" value="yes" /> Exige aprovação</label><button className={styles.button} type="submit">Registrar tarefa</button></form> : null}

              {canApprovals ? <form action="/api/interno/recorrencia" method="post" className={styles.form}><input type="hidden" name="action" value="cycle_approval" /><input type="hidden" name="project_id" value={id} /><input type="hidden" name="cycle_id" value={cycleId} /><strong>Solicitar aprovação no ciclo</strong><label>Tarefa relacionada<select name="task_id" defaultValue="" style={controlStyle}><option value="">Sem tarefa específica</option>{cycleTasks.map((task) => <option key={text(task.id)} value={text(task.id)}>{text(task.title)}</option>)}</select></label><label>Título<input name="title" required maxLength={300} style={controlStyle} /></label><label>Versão/entrega<input name="version_label" required maxLength={120} style={controlStyle} /></label><label>Prazo<input name="due_at" type="datetime-local" style={controlStyle} /></label><button className={styles.button} type="submit">Solicitar aprovação</button></form> : null}

              {canManageFinance ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
                <form action="/api/interno/recorrencia" method="post" className={styles.form}><input type="hidden" name="action" value="cycle_receivable" /><input type="hidden" name="project_id" value={id} /><input type="hidden" name="cycle_id" value={cycleId} /><strong>Recebível do ciclo</strong><label>Descrição<input name="description" required maxLength={500} style={controlStyle} /></label><label>Valor<input name="amount" type="number" min="0.01" step="0.01" required style={controlStyle} /></label><label>Vencimento<input name="due_date" type="date" required style={controlStyle} /></label><button className={styles.button} type="submit">Registrar recebível</button></form>
                <form action="/api/interno/recorrencia" method="post" className={styles.form}><input type="hidden" name="action" value="cycle_cost" /><input type="hidden" name="project_id" value={id} /><input type="hidden" name="cycle_id" value={cycleId} /><strong>Custo do ciclo</strong><label>Tipo<select name="cost_type" defaultValue="internal" style={controlStyle}><option value="internal">Interno</option><option value="partner">Parceiro</option><option value="supplier">Fornecedor</option><option value="logistics">Logística</option><option value="tax_fee">Taxa/tributo</option><option value="software">Software</option><option value="other">Outro</option></select></label><label>Descrição<input name="description" required maxLength={500} style={controlStyle} /></label><label>Valor<input name="amount" type="number" min="0" step="0.01" required style={controlStyle} /></label><label>Status<select name="cost_status" defaultValue="estimated" style={controlStyle}><option value="estimated">Estimado</option><option value="committed">Comprometido</option><option value="realized">Realizado</option></select></label><label>Parceiro, quando aplicável<input name="partner_label" maxLength={180} style={controlStyle} /></label><label>Vencimento<input name="due_date" type="date" style={controlStyle} /></label><button className={styles.button} type="submit">Registrar custo</button></form>
              </div> : null}

              {canManageProjects ? <form action="/api/interno/recorrencia" method="post" className={styles.form} style={{ borderTop: "1px solid rgba(1,48,30,.12)", paddingTop: 18 }}><input type="hidden" name="action" value="cycle_close" /><input type="hidden" name="project_id" value={id} /><input type="hidden" name="cycle_id" value={cycleId} /><strong>Fechar ciclo</strong><label>Resumo da entrega<textarea name="delivery_summary" rows={3} required style={controlStyle} /></label><label>Evidência da entrega<input name="delivery_evidence_reference" required maxLength={1000} style={controlStyle} /></label><label>Snapshot de indicadores em JSON<textarea name="indicator_snapshot" rows={3} placeholder='{"indicador":"valor"}' style={controlStyle} /></label><label>Pendências, uma por linha<textarea name="pending_items" rows={3} style={controlStyle} /></label><label>Nota financeira, obrigatória se houver recebível/custo aberto<textarea name="finance_pending_note" rows={3} style={controlStyle} /></label><label>Carry-over, um por linha<textarea name="carry_over_items" rows={3} style={controlStyle} /></label><label>Justificativa do carry-over<textarea name="carry_over_justification" rows={3} style={controlStyle} /></label><label>Decisão de continuidade<select name="continuation_status" defaultValue="approved" style={controlStyle}><option value="approved">Aprovada</option><option value="blocked">Bloqueada</option><option value="not_applicable">Não aplicável</option></select></label><label>Evidência da decisão<input name="continuation_evidence" maxLength={1000} style={controlStyle} /></label><button className={styles.button} type="submit">Fechar ciclo</button></form> : null}
            </div> : null}

            {cycleStatus === "closed" && text(cycle.continuation_status) === "approved" && canManageProjects ? <form action="/api/interno/recorrencia" method="post" className={styles.form} style={{ marginTop: 18 }}><input type="hidden" name="action" value="cycle_next" /><input type="hidden" name="project_id" value={id} /><input type="hidden" name="cycle_id" value={cycleId} /><strong>Criar próximo ciclo</strong>{text(plan?.cadence_unit) === "custom" ? <><label>Início<input name="custom_period_start" type="date" required style={controlStyle} /></label><label>Fim<input name="custom_period_end" type="date" required style={controlStyle} /></label></> : null}<button className={styles.button} type="submit">Criar próximo ciclo</button></form> : null}

            {cycleTasks.length || cycleApprovals.length || cycleReceivables.length || cycleCosts.length ? <details style={{ marginTop: 18 }}><summary>Itens atribuídos a este ciclo</summary><div style={{ display: "grid", gap: 8, marginTop: 10 }}>{cycleTasks.map((item) => <small key={text(item.id)}>Tarefa · {text(item.title)} · {text(item.status)}</small>)}{cycleApprovals.map((item) => <small key={text(item.id)}>Aprovação · {text(item.title)} · {text(item.status)}</small>)}{canViewFinance ? cycleReceivables.map((item) => <small key={text(item.id)}>Recebível · {text(item.description)} · {money(item.amount)} · {text(item.status)}</small>) : null}{canViewFinance ? cycleCosts.map((item) => <small key={text(item.id)}>Custo · {text(item.description)} · {money(item.amount)} · {text(item.status)}</small>) : null}</div></details> : null}
          </article>;
        })}</div> : <div className={styles.notice} style={{ marginTop: 16 }}>Nenhum ciclo criado. O primeiro ciclo só nasce a partir de um plano ativo e contrato válido.</div>}
      </section>

      <section className={styles.reviewCard}>
        <span className={styles.eyebrow}>A24 · RENOVAÇÃO</span><h2>Revisão contratual antes do próximo ciclo</h2>
        {!plan ? <div className={styles.notice}>Configure um plano recorrente antes de governar renovação.</div> : !text(plan.renewal_review_at) ? <div className={styles.notice}>Data de renovação <strong>a definir</strong>. O sistema não inventará um prazo.</div> : <>
          <p style={{ opacity: .72 }}>Revisão prevista: {when(plan.renewal_review_at)} · validade contratual: {dateOnly(plan.contract_valid_until)}.</p>
          {renewal ? <div style={cardStyle}><strong>Status: {text(renewal.queue_status)} · decisão {text(renewal.decision)}</strong>{text(renewal.opportunity_id) ? <p><Link href={`/interno/comercial/${text(renewal.opportunity_id)}`}>Abrir oportunidade de renovação →</Link></p> : null}{text(renewal.decision_evidence) ? <small>Evidência: {text(renewal.decision_evidence)}</small> : null}</div> : null}
          {!text(renewal?.review_id) && canManageContracts ? <form action="/api/interno/recorrencia" method="post" className={styles.form} style={{ marginTop: 18 }}><input type="hidden" name="action" value="renewal_open" /><input type="hidden" name="project_id" value={id} /><input type="hidden" name="plan_id" value={text(plan.id)} /><label>Responsável<input name="owner_label" required defaultValue={text(plan.owner_label) || session.user} style={controlStyle} /></label><label>Observações<textarea name="notes" rows={3} style={controlStyle} /></label><button className={styles.button} type="submit">Abrir revisão de renovação</button></form> : null}
          {text(renewal?.review_status) === "pending" && canCommercial ? <form action="/api/interno/recorrencia" method="post" className={styles.form} style={{ marginTop: 18 }}><input type="hidden" name="action" value="renewal_route_commercial" /><input type="hidden" name="project_id" value={id} /><input type="hidden" name="review_id" value={text(renewal?.review_id)} /><strong>Encaminhar ao Comercial</strong><label>Decisão<select name="decision" defaultValue="renew" style={controlStyle}><option value="renew">Renovar</option><option value="expand">Expandir</option></select></label><label>Rota<select name="commercial_route" defaultValue="strategic" style={controlStyle}><option value="strategic">Estratégica</option><option value="transactional">Transacional</option></select></label><label>Fit<select name="fit" defaultValue="high" style={controlStyle}><option value="high">Alto</option><option value="medium">Médio</option><option value="low">Baixo</option></select></label><label>Owner<input name="owner_label" required defaultValue={session.user} style={controlStyle} /></label><label>Próxima ação<input name="next_action_title" required defaultValue="Preparar proposta de renovação" style={controlStyle} /></label><label>Prazo da próxima ação<input name="next_action_at" type="datetime-local" required style={controlStyle} /></label><label>Canal<input name="next_action_channel" required defaultValue="interno" style={controlStyle} /></label><label>Notas<textarea name="notes" rows={3} style={controlStyle} /></label><button className={styles.button} type="submit">Criar nova oportunidade P01</button></form> : null}
          {text(renewal?.review_id) && !["resolved","waived"].includes(text(renewal?.review_status)) && canManageContracts ? <form action="/api/interno/recorrencia" method="post" className={styles.form} style={{ marginTop: 18 }}><input type="hidden" name="action" value="renewal_resolve" /><input type="hidden" name="project_id" value={id} /><input type="hidden" name="review_id" value={text(renewal?.review_id)} /><strong>Resolver revisão</strong><label>Decisão<select name="decision" defaultValue={text(renewal?.decision) !== "to_define" ? text(renewal?.decision) : "close"} style={controlStyle}><option value="renew">Renovar</option><option value="expand">Expandir</option><option value="close">Encerrar</option></select></label><label>Status<select name="resolution_status" defaultValue="resolved" style={controlStyle}><option value="resolved">Resolvida</option><option value="waived">Dispensada com evidência</option></select></label><label>Evidência<input name="evidence" required maxLength={1000} style={controlStyle} /></label><label>Notas<textarea name="notes" rows={3} style={controlStyle} /></label><button className={styles.button} type="submit">Registrar decisão</button></form> : null}
        </>}
      </section>

      <section className={styles.reviewCard}>
        <span className={styles.eyebrow}>A25 · REAVALIAÇÃO</span><h2>Novo diagnóstico, histórico preservado</h2>
        {canDiagnostics && context.eligibleDiagnostics.length ? <form action="/api/interno/recorrencia" method="post" className={styles.form} style={{ marginTop: 18 }}><input type="hidden" name="action" value="reassessment_schedule" /><input type="hidden" name="project_id" value={id} /><strong>Agendar reavaliação</strong><label>Diagnóstico-base<select name="source_diagnostic_id" required style={controlStyle}>{context.eligibleDiagnostics.map((item) => <option key={text(item.id)} value={text(item.id)}>Ciclo {display(item.assessment_cycle_number)} · {text(item.status)} · {text(item.id).slice(0,8)}</option>)}</select></label><label>Data/hora<input name="due_at" type="datetime-local" required style={controlStyle} /></label><label>Motivo<textarea name="reason" rows={3} required style={controlStyle} /></label><label>Owner<input name="owner_label" required defaultValue={session.user} style={controlStyle} /></label><label>Fonte/evidência que exige reavaliação<input name="source_reference" required maxLength={1000} style={controlStyle} /></label><label>Notas<textarea name="notes" rows={3} style={controlStyle} /></label><button className={styles.button} type="submit">Agendar sem criar diagnóstico ainda</button></form> : canDiagnostics ? <div className={styles.notice}>Não existe diagnóstico apresentado/concluído elegível nesta Empresa para servir de base.</div> : null}

        {context.reassessments.length ? <div style={{ display: "grid", gap: 16, marginTop: 22 }}>{context.reassessments.map((item) => {
          const requestId = text(item.id);
          const requestStatus = text(item.status);
          const route = text(item.route);
          return <article key={requestId} style={cardStyle}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>{text(item.reason)}</strong><span className={styles.badge}>{text(item.queue_status)}</span></div><small style={{ display: "block", marginTop: 7 }}>Diagnóstico-base: {text(item.source_diagnostic_id).slice(0,8)} · rota: {route} · prazo: {when(item.due_at)}</small>{text(item.new_diagnostic_id) ? <p><Link href={`/interno/diagnosticos/${text(item.new_diagnostic_id)}`}>Abrir novo diagnóstico de reavaliação →</Link></p> : null}{text(item.opportunity_id) ? <p><Link href={`/interno/comercial/${text(item.opportunity_id)}`}>Abrir oportunidade da reavaliação →</Link></p> : null}
            {["scheduled","pending"].includes(requestStatus) && route === "to_define" && canDiagnostics ? <form action="/api/interno/recorrencia" method="post" className={styles.form} style={{ marginTop: 14 }}><input type="hidden" name="action" value="reassessment_route" /><input type="hidden" name="project_id" value={id} /><input type="hidden" name="request_id" value={requestId} /><label>Rota<select name="reassessment_route" defaultValue="included_in_contract" style={controlStyle}><option value="included_in_contract">Incluída no contrato</option><option value="commercial_required">Exige nova contratação</option></select></label><label>Evidência da decisão<input name="evidence" required maxLength={1000} style={controlStyle} /></label><label>Notas<textarea name="notes" rows={3} style={controlStyle} /></label><button className={styles.button} type="submit">Definir rota</button></form> : null}
            {["scheduled","pending"].includes(requestStatus) && route === "included_in_contract" && canDiagnostics ? <form action="/api/interno/recorrencia" method="post" style={{ marginTop: 14 }}><input type="hidden" name="action" value="reassessment_start" /><input type="hidden" name="project_id" value={id} /><input type="hidden" name="request_id" value={requestId} /><button className={styles.button} type="submit">Iniciar novo diagnóstico</button></form> : null}
            {["scheduled","pending"].includes(requestStatus) && route === "commercial_required" && canCommercial ? <form action="/api/interno/recorrencia" method="post" className={styles.form} style={{ marginTop: 14 }}><input type="hidden" name="action" value="reassessment_route_commercial" /><input type="hidden" name="project_id" value={id} /><input type="hidden" name="request_id" value={requestId} /><strong>Encaminhar reavaliação ao Comercial</strong><label>Rota<select name="commercial_route" defaultValue="strategic" style={controlStyle}><option value="strategic">Estratégica</option><option value="transactional">Transacional</option></select></label><label>Fit<select name="fit" defaultValue="high" style={controlStyle}><option value="high">Alto</option><option value="medium">Médio</option><option value="low">Baixo</option></select></label><label>Owner<input name="owner_label" required defaultValue={session.user} style={controlStyle} /></label><label>Próxima ação<input name="next_action_title" required defaultValue="Definir condição da reavaliação diagnóstica" style={controlStyle} /></label><label>Prazo<input name="next_action_at" type="datetime-local" required style={controlStyle} /></label><label>Canal<input name="next_action_channel" defaultValue="interno" required style={controlStyle} /></label><label>Notas<textarea name="notes" rows={3} style={controlStyle} /></label><button className={styles.button} type="submit">Criar nova oportunidade P01</button></form> : null}
          </article>;
        })}</div> : <div className={styles.notice} style={{ marginTop: 18 }}>Nenhuma reavaliação registrada para este projeto.</div>}
      </section>
    </div>
  </div></main>;
}
