import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalSession } from "../../../../lib/blinko/internal-auth";
import { getProjectWorkspace } from "../../../../lib/blinko/execution-server";
import { getProjectExtensions } from "../../../../lib/blinko/project-extensions-server";
import { getProjectPartnerContext } from "../../../../lib/blinko/partner-commercial-server";
import InternalBrand from "../../InternalBrand";
import styles from "../../interno.module.css";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ status?: string }> };

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function money(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
}
function when(value: unknown) {
  const raw = text(value);
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { timeZone: "America/Bahia" });
}

function notice(status?: string) {
  if (status === "project_created") return "Projeto criado em onboarding a partir da proposta aceita.";
  if (status === "task_created") return "Tarefa inicial registrada no projeto.";
  if (status === "task_invalid") return "Revise os campos da tarefa antes de salvar.";
  if (status === "task_blocked") return "A tarefa não foi registrada. Nenhum dado anterior foi alterado.";
  if (status === "activation_confirmation_required") return "Confirme explicitamente a revisão do onboarding antes de ativar o projeto.";
  if (status === "activation_blocked") return "O projeto precisa estar em onboarding e ter ao menos uma tarefa inicial antes da ativação.";
  if (status === "project_activated") return "Projeto ativado. A execução inicial está oficialmente em andamento no Blinko OS.";
  if (status === "execution_schema_pending") return "A estrutura da execução ainda aguarda aplicação da migração 008 no Neon.";
  if (status === "extensions_schema_pending") return "Os módulos de Drive, aprovações, financeiro e encerramento ainda não estão disponíveis neste banco.";
  if (status === "closure_confirmation_required") return "Confirme o checklist antes de preparar o encerramento.";
  if (status === "closure_invalid") return "Revise os campos obrigatórios do encerramento.";
  if (status === "closure_blocked") return "O projeto ainda possui uma condição que impede o encerramento. Revise tarefas, aprovações, evidências e financeiro.";
  if (status === "closure_prepared") return "Checklist final aprovado. O projeto está concluído e pronto para fechamento definitivo.";
  if (status === "close_confirmation_required") return "Confirme explicitamente o fechamento definitivo.";
  if (status === "close_blocked") return "O fechamento foi bloqueado porque alguma condição foi reaberta.";
  if (status === "project_closed") return "Projeto encerrado com histórico e evidências preservados.";
  return null;
}

const controlStyle = { border: "1px solid rgba(1,48,30,.18)", background: "rgba(255,255,255,.78)", color: "#08271b", borderRadius: 14, padding: 13, font: "inherit" };

export default async function ProjectPage({ params, searchParams }: Props) {
  const session = await requireInternalSession();
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  if (!uuidPattern.test(id)) notFound();

  const [workspace, extensions, partners] = await Promise.all([
    getProjectWorkspace(id),
    getProjectExtensions(id),
    getProjectPartnerContext(id),
  ]);
  const statusNotice = notice(query.status);

  if (!workspace.schemaReady) {
    return <main className={styles.page}><div className={styles.shell}><header className={styles.topbar}><InternalBrand /><nav className={styles.nav}><span className={styles.link}>{session.user}</span></nav></header><div className={styles.reviewShell}><section className={styles.reviewCard}><span className={styles.eyebrow}>PROJETO BLINKO</span><h1>Execução inicial</h1><div className={styles.notice}>A interface está pronta, mas a migração 008 ainda não foi aplicada ao Neon.</div></section></div></div></main>;
  }
  if (!workspace.project) notFound();

  const project = workspace.project;
  const projectStatus = text(project.status);
  const companyName = text(workspace.company?.name) || "Empresa";
  const diagnosticId = text(workspace.diagnostic?.id);
  const canAddTask = ["onboarding", "active", "waiting_client", "at_risk"].includes(projectStatus);
  const canActivate = projectStatus === "onboarding" && workspace.tasks.length > 0;
  const openTasks = workspace.tasks.filter((task) => !["done", "cancelled"].includes(text(task.status))).length;
  const openApprovals = extensions.approvals.filter((approval) => ["draft", "pending", "changes_requested"].includes(text(approval.status))).length;
  const closureStatus = text(extensions.closure?.status);
  const canPrepareClosure = extensions.schemaReady && ["active", "waiting_client", "at_risk"].includes(projectStatus) && openTasks === 0 && openApprovals === 0 && Boolean(extensions.finance);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}><InternalBrand /><nav className={styles.nav}><span className={styles.link}>{session.user}</span><form action="/api/interno/logout" method="post"><button className={styles.logout} type="submit">Sair</button></form></nav></header>
        <div className={styles.hero} style={{ paddingBottom: 14 }}>
          {diagnosticId ? <Link className={styles.back} href={`/interno/diagnosticos/${diagnosticId}`}>← voltar ao Diagnóstico Blinko</Link> : <Link className={styles.back} href="/interno">← voltar para Hoje na Blinko</Link>}
          {statusNotice ? <div className={styles.notice} style={{ marginTop: 14, maxWidth: 900 }}>{statusNotice}</div> : null}
        </div>

        <div className={styles.reviewShell}>
          <section className={styles.reviewCard} style={{ borderColor: "rgba(239,59,127,.24)", background: "rgba(239,59,127,.025)" }}>
            <span className={styles.eyebrow}>PROJETO / CICLO</span><h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 42, fontWeight: 500, marginBottom: 8 }}>{companyName}</h1>
            <p style={{ opacity: .72, lineHeight: 1.55, maxWidth: 900 }}>{text(project.objective)}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}><span className={styles.badge}>Status: {projectStatus}</span><span className={styles.badge}>Início: {text(project.start_date)}</span><span className={styles.badge}>Janela: {text(project.target_timeframe)}</span><span className={styles.badge}>Tarefas abertas: {openTasks}</span><span className={styles.badge}>Aprovações abertas: {openApprovals}</span></div>
          </section>

          <section className={styles.reviewCard}><span className={styles.eyebrow}>INTERVENÇÕES CONTRATADAS</span><h2>Escopo que originou este ciclo</h2>{workspace.interventions.length ? <div style={{ display: "grid", gap: 12, marginTop: 18 }}>{workspace.interventions.map((item) => <article key={text(item.id)} style={{ padding: 16, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16, background: "rgba(255,255,255,.5)" }}><strong>{text(item.title)}</strong><p style={{ marginBottom: 0, opacity: .7 }}>{text(item.objective)}</p></article>)}</div> : <div className={styles.notice}>Nenhuma intervenção vinculada foi encontrada.</div>}</section>

          {partners.schemaReady && partners.assignments.length ? <section className={styles.reviewCard} style={{ borderColor: "rgba(239,59,127,.2)" }}>
            <span className={styles.eyebrow}>PARCEIROS DO PROJETO</span><h2>Terceiros herdados da contratação</h2>
            <p style={{ opacity: .7, lineHeight: 1.5 }}>Estes vínculos nasceram dos compromissos aprovados na proposta. Custo de parceiro não pode ser criado por texto livre.</p>
            <div style={{ display: "grid", gap: 14, marginTop: 18 }}>{partners.assignments.map((assignment) => {
              const cost = assignment.cost && typeof assignment.cost === "object" && !Array.isArray(assignment.cost) ? assignment.cost as Record<string, unknown> : null;
              return <article key={text(assignment.id)} style={{ padding: 17, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16, background: "rgba(255,255,255,.52)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>{text(assignment.partner_code)} · {text(assignment.partner_name)}</strong><span className={styles.badge}>{text(assignment.solution_code)} · {text(assignment.execution_route)}</span></div>
                <small style={{ display: "block", marginTop: 7 }}>Elegibilidade: {text(assignment.partner_eligibility)}</small>
                <small style={{ display: "block", marginTop: 5 }}>Cotação: {text(assignment.quote_reference)} · emitida {when(assignment.quoted_at)} · válida até {when(assignment.quote_valid_until)}</small>
                <small style={{ display: "block", marginTop: 5 }}>Papel da Blinko: {text(assignment.blinko_role)}</small>
                <small style={{ display: "block", marginTop: 5 }}>Obrigação financeira Blinko: {assignment.blinko_payment_obligation === true ? money(assignment.committed_cost_to_blinko) : "não"}</small>
                {cost ? <small style={{ display: "block", marginTop: 5 }}>Custo vinculado: {money(cost.amount)} · {text(cost.status)}{text(cost.payment_reference) ? ` · ref. ${text(cost.payment_reference)}` : ""}</small> : null}
                {assignment.financial_rule_id ? <div className={styles.notice} style={{ marginTop: 10 }}>Regra financeira {text(assignment.financial_rule_model) || "registrada"} · status {text(assignment.financial_rule_status) || "—"} · cálculo automático <strong>{assignment.financial_rule_auto_calculable === true ? "LIBERADO" : "BLOQUEADO"}</strong>.</div> : <div className={styles.notice} style={{ marginTop: 10 }}>Este compromisso usa cotação específica e não possui regra financeira padronizada vinculada.</div>}
              </article>;
            })}</div>
          </section> : partners.schemaReady ? null : <section className={styles.reviewCard}><span className={styles.eyebrow}>PARCEIROS</span><div className={styles.notice}>A governança de parceiros depende das migrações 037–039 no banco conectado.</div></section>}

          <section className={styles.reviewCard}>
            <span className={styles.eyebrow}>TAREFAS</span><h2>Ações da execução</h2>
            {workspace.tasks.length ? <div style={{ display: "grid", gap: 12, marginTop: 18 }}>{workspace.tasks.map((task) => { const intervention = workspace.interventions.find((item) => text(item.id) === text(task.intervention_id)); return <article key={text(task.id)} style={{ padding: 16, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16, background: "rgba(255,255,255,.5)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>{text(task.title)}</strong><span className={styles.badge}>{text(task.status)}</span></div><small style={{ display: "block", marginTop: 7, opacity: .68 }}>Prioridade: {text(task.priority)} · Responsável: {text(task.responsible_label) || "a definir"}</small>{intervention ? <small style={{ display: "block", marginTop: 5 }}>Intervenção: {text(intervention.title)}</small> : null}{text(task.completion_evidence) ? <small style={{ display: "block", marginTop: 5 }}>Evidência: {text(task.completion_evidence)}</small> : null}</article>; })}</div> : <div className={styles.notice} style={{ marginTop: 18 }}>Ainda não há tarefa registrada.</div>}
            {canAddTask ? <form action={`/api/interno/projetos/${id}/tasks`} method="post" className={styles.form} style={{ marginTop: 24 }}><strong>Adicionar tarefa</strong><label>Título<input name="title" required maxLength={300} style={controlStyle} /></label><label>Intervenção relacionada<select name="intervention_id" defaultValue="" style={controlStyle}><option value="">Tarefa transversal</option>{workspace.interventions.map((item) => <option key={text(item.id)} value={text(item.id)}>{text(item.title)}</option>)}</select></label><label>Responsável<input name="responsible_label" maxLength={180} style={controlStyle} /></label><label>Prazo, se definido<input name="due_at" type="datetime-local" style={controlStyle} /></label><label>Dependências, uma por linha<textarea name="dependencies" rows={4} style={controlStyle} /></label><label>Prioridade<select name="priority" defaultValue="normal" style={controlStyle}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label><label>Estimativa<input name="estimate" maxLength={500} style={controlStyle} /></label><label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.45 }}><input type="checkbox" name="approval_required" value="yes" style={{ marginTop: 4 }} /><span>Esta tarefa exige aprovação antes de ser considerada concluída.</span></label><button className={styles.button} type="submit">Registrar tarefa</button></form> : null}
          </section>

          {projectStatus === "onboarding" ? <section className={styles.reviewCard} style={{ borderColor: "rgba(1,48,30,.24)" }}><span className={styles.eyebrow}>ATIVAÇÃO</span><h2>Iniciar execução</h2><p style={{ opacity: .7, lineHeight: 1.5 }}>A ativação só fica disponível depois de pelo menos uma tarefa inicial.</p><form action={`/api/interno/projetos/${id}/activate`} method="post" style={{ display: "grid", gap: 12, maxWidth: 760 }}><label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.45 }}><input type="checkbox" name="activation_confirmed" value="yes" required style={{ marginTop: 4 }} /><span>Confirmo que o onboarding foi revisado e que as primeiras tarefas representam o início real da execução.</span></label><button className={styles.button} type="submit" disabled={!canActivate} style={{ justifySelf: "start", opacity: canActivate ? 1 : .45 }}>Ativar projeto</button></form></section> : null}

          {extensions.schemaReady ? <>
            <section className={styles.reviewCard}><span className={styles.eyebrow}>ARQUIVOS / GOOGLE DRIVE</span><h2>Contexto documental do projeto</h2>{extensions.driveItems.length ? <div style={{ display: "grid", gap: 10, marginTop: 16 }}>{extensions.driveItems.map((item) => <a key={text(item.id)} href={text(item.drive_url)} target="_blank" rel="noreferrer" className={styles.action} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}><span><strong>{text(item.title)}</strong><span className={styles.meta}>{text(item.context_type)} · {text(item.logical_path)}</span></span><span className={styles.badge}>Abrir Drive</span></a>)}</div> : <div className={styles.notice}>Nenhuma pasta ou arquivo contextual registrado.</div>}</section>
            <section className={styles.reviewCard}><span className={styles.eyebrow}>APROVAÇÕES</span><h2>Histórico de decisão do cliente</h2>{extensions.approvals.length ? <div style={{ display: "grid", gap: 10, marginTop: 16 }}>{extensions.approvals.map((approval) => <article key={text(approval.id)} style={{ padding: 16, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>{text(approval.title)}</strong><span className={styles.badge}>{text(approval.status)}</span></div><small style={{ display: "block", marginTop: 7, opacity: .68 }}>Versão {text(approval.version_label)} · resposta: {text(approval.responded_by_label) || "aguardando"}</small>{text(approval.response_notes) ? <p style={{ marginBottom: 0 }}>{text(approval.response_notes)}</p> : null}</article>)}</div> : <div className={styles.notice}>Nenhuma aprovação registrada.</div>}</section>
            <section className={styles.reviewCard}><span className={styles.eyebrow}>FINANCEIRO GERENCIAL</span><h2>Rentabilidade e caixa do projeto</h2>{extensions.finance ? <div className={styles.counts} style={{ marginBottom: 0 }}><article className={styles.countCard}><strong>{money(extensions.finance.contracted_revenue)}</strong><span>receita contratada</span></article><article className={styles.countCard}><strong>{money(extensions.finance.cash_received)}</strong><span>caixa recebido</span></article><article className={styles.countCard}><strong>{money(extensions.finance.realized_total_cost ?? extensions.finance.planned_total_cost)}</strong><span>custo realizado</span></article><article className={styles.countCard}><strong>{text(extensions.finance.realized_margin_pct ?? extensions.finance.projected_margin_pct) || "—"}%</strong><span>margem realizada</span></article></div> : <div className={styles.notice}>Plano financeiro ainda não registrado para este projeto.</div>}</section>

            {canPrepareClosure ? <section className={styles.reviewCard} style={{ borderColor: "rgba(1,48,30,.24)" }}><span className={styles.eyebrow}>ENCERRAMENTO · Q6/Q7</span><h2>Preparar encerramento</h2><p style={{ opacity: .72 }}>O sistema detectou 0 tarefas abertas e 0 aprovações abertas. Registre o fechamento operacional antes de encerrar definitivamente.</p><form action={`/api/interno/projetos/${id}/prepare-closure`} method="post" className={styles.form}><label>Resumo da entrega<textarea name="delivery_summary" rows={4} required style={controlStyle} /></label><label>Referência/evidência da entrega<input name="delivery_evidence_reference" required style={controlStyle} placeholder="Link, ID ou referência rastreável" /></label><label>Resultado alcançado<textarea name="result_summary" rows={4} required style={controlStyle} /></label><label>Aprendizados<textarea name="lessons_learned" rows={4} required style={controlStyle} /></label><label>Status do feedback<select name="client_feedback_status" defaultValue="requested" style={controlStyle}><option value="not_requested">Não solicitado</option><option value="requested">Solicitado</option><option value="received">Recebido</option><option value="unavailable">Indisponível</option></select></label><label>Feedback do cliente<textarea name="client_feedback_notes" rows={3} style={controlStyle} /></label><label>Pendência financeira, se existir<textarea name="finance_pending_note" rows={3} style={controlStyle} /></label><label>Próximo passo<select name="next_step" defaultValue="monitor" style={controlStyle}><option value="none">Nenhum</option><option value="monitor">Monitorar</option><option value="reassessment">Reavaliar diagnóstico</option><option value="renewal">Renovação</option><option value="new_opportunity">Nova oportunidade</option></select></label><label style={{ display: "flex", gap: 10 }}><input type="checkbox" name="reassessment_required" value="yes" /><span>Gerar necessidade de reavaliação do diagnóstico.</span></label><label style={{ display: "flex", gap: 10 }}><input type="checkbox" name="closure_confirmed" value="yes" required /><span>Confirmo que escopo, evidências, aprovações e financeiro foram revisados.</span></label><button className={styles.button} type="submit">Preparar encerramento</button></form></section> : null}

            {projectStatus === "completed" && closureStatus === "prepared" ? <section className={styles.reviewCard} style={{ borderColor: "rgba(239,59,127,.24)" }}><span className={styles.eyebrow}>FECHAMENTO DEFINITIVO</span><h2>Encerrar projeto</h2><div className={styles.notice}>O checklist final foi registrado. Depois do fechamento, o projeto fica somente como histórico e evidência.</div><form action={`/api/interno/projetos/${id}/close`} method="post" style={{ display: "grid", gap: 12, marginTop: 16 }}><label style={{ display: "flex", gap: 10 }}><input type="checkbox" name="close_confirmed" value="yes" required /><span>Confirmo o encerramento definitivo deste projeto.</span></label><button className={styles.button} type="submit" style={{ justifySelf: "start" }}>Encerrar projeto</button></form></section> : null}

            {projectStatus === "closed" && closureStatus === "closed" ? <section className={styles.reviewCard}><span className={styles.eyebrow}>PROJETO ENCERRADO</span><h2>Ciclo concluído e preservado</h2><p>{text(extensions.closure?.delivery_summary)}</p><div className={styles.notice}>Resultado: {text(extensions.closure?.result_summary)} · Próximo passo: {text(extensions.closure?.next_step)}</div></section> : null}
          </> : <section className={styles.reviewCard}><span className={styles.eyebrow}>MÓDULOS EM VALIDAÇÃO</span><h2>Drive, aprovações, financeiro e encerramento</h2><div className={styles.notice}>A interface já possui fallback seguro. Os módulos aparecem quando as migrações 014–018 estiverem disponíveis no banco conectado ao ambiente.</div></section>}
        </div>
      </div>
    </main>
  );
}