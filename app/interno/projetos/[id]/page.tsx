import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalSession } from "../../../../lib/blinko/internal-auth";
import { getProjectWorkspace } from "../../../../lib/blinko/execution-server";
import InternalBrand from "../../InternalBrand";
import styles from "../../interno.module.css";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ status?: string }>;
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
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

export default async function ProjectPage({ params, searchParams }: Props) {
  const session = await requireInternalSession();
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  if (!uuidPattern.test(id)) notFound();

  const workspace = await getProjectWorkspace(id);
  const statusNotice = notice(query.status);

  if (!workspace.schemaReady) {
    return (
      <main className={styles.page}><div className={styles.shell}><header className={styles.topbar}><InternalBrand /><nav className={styles.nav}><span className={styles.link}>{session.user}</span></nav></header><div className={styles.reviewShell}><section className={styles.reviewCard}><span className={styles.eyebrow}>PROJETO BLINKO</span><h1>Execução inicial</h1><div className={styles.notice}>A interface está pronta, mas a migração 008 ainda não foi aplicada ao Neon. Nenhum projeto será simulado.</div></section></div></div></main>
    );
  }

  if (!workspace.project) notFound();

  const project = workspace.project;
  const projectStatus = text(project.status);
  const companyName = text(workspace.company?.name) || "Empresa";
  const diagnosticId = text(workspace.diagnostic?.id);
  const canAddTask = ["onboarding", "active", "waiting_client", "at_risk"].includes(projectStatus);
  const canActivate = projectStatus === "onboarding" && workspace.tasks.length > 0;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <InternalBrand />
          <nav className={styles.nav}><span className={styles.link}>{session.user}</span><form action="/api/interno/logout" method="post"><button className={styles.logout} type="submit">Sair</button></form></nav>
        </header>

        <div className={styles.hero} style={{ paddingBottom: 14 }}>
          {diagnosticId ? <Link className={styles.back} href={`/interno/diagnosticos/${diagnosticId}`}>← voltar ao Diagnóstico Blinko</Link> : <Link className={styles.back} href="/interno">← voltar para Hoje na Blinko</Link>}
          {statusNotice ? <div className={styles.notice} style={{ marginTop: 14, maxWidth: 900 }}>{statusNotice}</div> : null}
        </div>

        <div className={styles.reviewShell}>
          <section className={styles.reviewCard} style={{ borderColor: "rgba(239,59,127,.24)", background: "rgba(239,59,127,.025)" }}>
            <span className={styles.eyebrow}>PROJETO / CICLO</span>
            <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 42, fontWeight: 500, marginBottom: 8 }}>{companyName}</h1>
            <p style={{ opacity: .72, lineHeight: 1.55, maxWidth: 900 }}>{text(project.objective)}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <span className={styles.badge}>Status: {projectStatus}</span>
              <span className={styles.badge}>Início: {text(project.start_date)}</span>
              <span className={styles.badge}>Janela: {text(project.target_timeframe)}</span>
              <span className={styles.badge}>Tarefas: {workspace.tasks.length}</span>
            </div>
          </section>

          <section className={styles.reviewCard}>
            <span className={styles.eyebrow}>INTERVENÇÕES CONTRATADAS</span>
            <h2>Escopo que originou este ciclo</h2>
            {workspace.interventions.length ? (
              <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                {workspace.interventions.map((item) => <article key={text(item.id)} style={{ padding: 16, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16, background: "rgba(255,255,255,.5)" }}><strong>{text(item.title)}</strong><p style={{ marginBottom: 0, opacity: .7 }}>{text(item.objective)}</p></article>)}
              </div>
            ) : <div className={styles.notice}>Nenhuma intervenção vinculada foi encontrada.</div>}
          </section>

          <section className={styles.reviewCard}>
            <span className={styles.eyebrow}>TAREFAS INICIAIS</span>
            <h2>Primeiras ações da execução</h2>
            {workspace.tasks.length ? (
              <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                {workspace.tasks.map((task) => {
                  const intervention = workspace.interventions.find((item) => text(item.id) === text(task.intervention_id));
                  return <article key={text(task.id)} style={{ padding: 16, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16, background: "rgba(255,255,255,.5)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>{text(task.title)}</strong><span className={styles.badge}>{text(task.status)}</span></div><small style={{ display: "block", marginTop: 7, opacity: .68 }}>Prioridade: {text(task.priority)} · Responsável: {text(task.responsible_label) || "a definir"}</small>{intervention ? <small style={{ display: "block", marginTop: 5 }}>Intervenção: {text(intervention.title)}</small> : null}</article>;
                })}
              </div>
            ) : <div className={styles.notice} style={{ marginTop: 18 }}>Ainda não há tarefa inicial registrada.</div>}

            {canAddTask ? (
              <form action={`/api/interno/projetos/${id}/tasks`} method="post" className={styles.form} style={{ marginTop: 24 }}>
                <strong>Adicionar tarefa</strong>
                <label>Título<input name="title" required maxLength={300} style={controlStyle} /></label>
                <label>Intervenção relacionada<select name="intervention_id" defaultValue="" style={controlStyle}><option value="">Tarefa transversal</option>{workspace.interventions.map((item) => <option key={text(item.id)} value={text(item.id)}>{text(item.title)}</option>)}</select></label>
                <label>Responsável<input name="responsible_label" maxLength={180} style={controlStyle} /></label>
                <label>Prazo, se definido<input name="due_at" type="datetime-local" style={controlStyle} /></label>
                <label>Dependências, uma por linha<textarea name="dependencies" rows={4} style={controlStyle} /></label>
                <label>Prioridade<select name="priority" defaultValue="normal" style={controlStyle}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label>
                <label>Estimativa<input name="estimate" maxLength={500} style={controlStyle} /></label>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.45 }}><input type="checkbox" name="approval_required" value="yes" style={{ marginTop: 4 }} /><span>Esta tarefa exige aprovação antes de ser considerada concluída.</span></label>
                <button className={styles.button} type="submit">Registrar tarefa inicial</button>
              </form>
            ) : null}
          </section>

          {projectStatus === "onboarding" ? (
            <section className={styles.reviewCard} style={{ borderColor: "rgba(1,48,30,.24)" }}>
              <span className={styles.eyebrow}>ATIVAÇÃO</span>
              <h2>Iniciar execução</h2>
              <p style={{ opacity: .7, lineHeight: 1.5 }}>A ativação só fica disponível depois de pelo menos uma tarefa inicial. Isso evita transformar contratação em projeto ativo sem plano mínimo de ação.</p>
              <form action={`/api/interno/projetos/${id}/activate`} method="post" style={{ display: "grid", gap: 12, maxWidth: 760 }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.45 }}><input type="checkbox" name="activation_confirmed" value="yes" required style={{ marginTop: 4 }} /><span>Confirmo que o onboarding foi revisado e que as primeiras tarefas representam o início real da execução.</span></label>
                <button className={styles.button} type="submit" disabled={!canActivate} style={{ justifySelf: "start", opacity: canActivate ? 1 : .45 }}>Ativar projeto</button>
              </form>
            </section>
          ) : null}

          {projectStatus === "active" ? <section className={styles.reviewCard}><span className={styles.eyebrow}>V1 CONCLUÍDA</span><h2>Execução inicial ativa</h2><div className={styles.notice}>O fluxo central da V1 chegou à execução inicial com histórico preservado desde o pré-diagnóstico.</div></section> : null}
        </div>
      </div>
    </main>
  );
}
