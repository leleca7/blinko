import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalSession } from "../../../../../lib/blinko/internal-auth";
import { getProjectWorkspace } from "../../../../../lib/blinko/execution-server";
import { getProjectSolutions } from "../../../../../lib/blinko/solution-catalog-server";
import InternalBrand from "../../../InternalBrand";
import styles from "../../../interno.module.css";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ status?: string }> };

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }

function label(value: string) {
  const labels: Record<string, string> = {
    required: "obrigatório",
    not_required: "não necessário",
    to_define: "a definir",
    pending: "pendente",
    in_progress: "em andamento",
    blocked: "bloqueado",
    done: "concluído",
    waived: "dispensado",
    not_applicable: "não aplicável",
  };
  return labels[value] || value;
}

function routeLabel(value: string) {
  return {
    R1: "R1 · Blinko executa",
    R2: "R2 · Blinko executa + coordena terceiros",
    R3: "R3 · Parceiro coordenado pela Blinko",
    R4: "R4 · Cliente executa com orientação",
    R5: "R5 · Especialista externo / encaminhamento",
    R6: "R6 · Monitoramento",
  }[value] ?? value;
}

function notice(status?: string) {
  if (status === "onboarding_item_saved") return "Item de onboarding atualizado e gate de prontidão recalculado.";
  if (status === "onboarding_item_invalid") return "Revise o item. Conclusão exige evidência; bloqueio exige motivo, responsável e próxima checagem.";
  if (status === "onboarding_item_blocked") return "O item não foi atualizado. O projeto precisa estar em onboarding e o módulo deve pertencer a este projeto.";
  if (status === "onboarding_schema_pending") return "O onboarding modular depende da migração 026. A ativação permanece bloqueada até o schema estar disponível.";
  if (status === "solution_route_saved") return "Rota de execução da solução confirmada e incorporada ao gate de prontidão.";
  if (status === "solution_route_invalid") return "Selecione uma rota válida e confirme a decisão antes de salvar.";
  if (status === "solution_route_blocked") return "A rota não foi alterada. Ela deve pertencer às rotas permitidas da solução e só pode ser definida durante o onboarding.";
  if (status === "activation_confirmation_required") return "Confirme explicitamente a liberação antes de ativar o projeto.";
  if (status === "activation_onboarding_blocked") return "BLOQUEADO PARA OPERAÇÃO: conclua o onboarding, confirme as rotas das soluções e mantenha ao menos uma tarefa inicial antes de ativar.";
  if (status === "project_activated") return "Projeto ativado após o gate de onboarding. A oportunidade foi liberada para P14.";
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

export default async function ProjectOnboardingPage({ params, searchParams }: Props) {
  const session = await requireInternalSession();
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  if (!uuidPattern.test(id)) notFound();

  const [workspace, projectSolutions] = await Promise.all([
    getProjectWorkspace(id),
    getProjectSolutions(id),
  ]);
  if (!workspace.schemaReady || !workspace.project) notFound();

  const projectStatus = text(workspace.project.status);
  const companyName = text(workspace.company?.name) || "Empresa";
  const statusNotice = notice(query.status);
  const readiness = workspace.onboardingReadiness;
  const ready = readiness?.ready_for_operation === true;
  const blockingCount = Number(readiness?.blocking_count ?? 0);
  const unresolvedCount = Number(readiness?.unresolved_applicability_count ?? 0);
  const blockedCount = Number(readiness?.blocked_item_count ?? 0);
  const canEdit = workspace.onboardingSchemaReady && projectStatus === "onboarding";
  const unresolvedRoutes = projectSolutions.solutions.filter((solution) => text(solution.route_status) !== "confirmed").length;
  const canActivate = canEdit && ready && workspace.tasks.length > 0 && unresolvedRoutes === 0;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <InternalBrand />
          <nav className={styles.nav}>
            <span className={styles.link}>{session.user}</span>
            <form action="/api/interno/logout" method="post"><button className={styles.logout} type="submit">Sair</button></form>
          </nav>
        </header>

        <div className={styles.hero} style={{ paddingBottom: 14 }}>
          <Link className={styles.back} href={`/interno/projetos/${id}`}>← voltar ao projeto</Link>
          {statusNotice ? <div className={styles.notice} style={{ marginTop: 14, maxWidth: 900 }}>{statusNotice}</div> : null}
        </div>

        <div className={styles.reviewShell}>
          <section className={styles.reviewCard} style={{ borderColor: "rgba(239,59,127,.24)", background: "rgba(239,59,127,.025)" }}>
            <span className={styles.eyebrow}>P13 · ONBOARDING MODULAR</span>
            <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 42, fontWeight: 500, marginBottom: 8 }}>{companyName}</h1>
            <p style={{ opacity: .72, lineHeight: 1.55, maxWidth: 900 }}>
              O projeto já passou por contrato e condições de início. Agora a operação só é liberada quando os módulos de onboarding aplicáveis e as rotas das soluções contratadas estiverem confirmados.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <span className={styles.badge}>Projeto: {projectStatus}</span>
              <span className={styles.badge}>Soluções oficiais: {projectSolutions.solutions.length}</span>
              <span className={styles.badge}>Rotas a definir: {unresolvedRoutes}</span>
              <span className={styles.badge}>Tarefas iniciais: {workspace.tasks.length}</span>
              <span className={styles.badge}>Pendências obrigatórias: {blockingCount}</span>
              <span className={styles.badge}>Aplicabilidade a definir: {unresolvedCount}</span>
              <span className={styles.badge}>Bloqueados: {blockedCount}</span>
              <span className={styles.badge}>{ready && unresolvedRoutes === 0 ? "PRONTO PARA OPERAÇÃO" : "ONBOARDING INCOMPLETO"}</span>
            </div>
          </section>

          {projectSolutions.schemaReady && projectSolutions.solutions.length ? (
            <section className={styles.reviewCard}>
              <span className={styles.eyebrow}>SOLUÇÕES CONTRATADAS</span>
              <h2>Rota de execução por solução</h2>
              <p style={{ opacity: .7, lineHeight: 1.55 }}>
                A solução vem do diagnóstico/proposta. Aqui definimos apenas como ela será executada neste projeto. A rota escolhida precisa estar entre as permitidas pelo catálogo oficial.
              </p>
              <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
                {projectSolutions.solutions.map((solution) => {
                  const routes = strings(solution.execution_routes);
                  const prerequisites = strings(solution.prerequisites);
                  const selectedRoute = text(solution.selected_route);
                  return (
                    <article key={text(solution.id)} style={{ padding: 16, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16, background: "rgba(255,255,255,.48)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <strong>{text(solution.solution_code)} · {text(solution.name)}</strong>
                        <span className={styles.badge}>{selectedRoute ? routeLabel(selectedRoute) : "ROTA A DEFINIR"}</span>
                      </div>
                      <small style={{ display: "block", marginTop: 7, opacity: .68 }}>{text(solution.official_status)}</small>
                      {text(solution.intervention_objective) ? <p style={{ lineHeight: 1.5 }}>{text(solution.intervention_objective)}</p> : null}
                      <small style={{ display: "block", marginTop: 5 }}>Rotas permitidas: {routes.map(routeLabel).join(" · ")}</small>
                      {prerequisites.length ? <div className={styles.notice} style={{ marginTop: 10 }}>Pré-requisitos oficiais: {prerequisites.join(" · ")}</div> : null}

                      {canEdit ? (
                        <form action={`/api/interno/projetos/${id}/solutions/${text(solution.id)}/route`} method="post" className={styles.form} style={{ marginTop: 14 }}>
                          <label>Rota de execução<select name="execution_route" required defaultValue={selectedRoute} style={controlStyle}><option value="" disabled>Selecione uma rota permitida</option>{routes.map((route) => <option value={route} key={route}>{routeLabel(route)}</option>)}</select></label>
                          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.45 }}><input type="checkbox" name="route_confirmed" value="yes" required style={{ marginTop: 4 }} /><span>Confirmo que esta rota foi definida para o projeto e é compatível com o escopo contratado.</span></label>
                          <button className={styles.button} type="submit">Confirmar rota</button>
                        </form>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {!workspace.onboardingSchemaReady ? (
            <section className={styles.reviewCard}>
              <span className={styles.eyebrow}>SCHEMA</span>
              <h2>Ativação protegida</h2>
              <div className={styles.notice}>A migração 026 ainda não está disponível neste banco. O projeto não será ativado pelo fluxo antigo.</div>
            </section>
          ) : (
            <section className={styles.reviewCard}>
              <span className={styles.eyebrow}>CHECKLIST DE PRONTIDÃO</span>
              <h2>Módulos do onboarding</h2>
              <p style={{ opacity: .7, lineHeight: 1.55 }}>Os módulos apontam para dados já existentes sempre que possível. Rotas Sxx são protegidas e só podem ser confirmadas no controle especializado acima.</p>

              <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
                {workspace.onboardingItems.map((item) => {
                  const moduleCode = text(item.module_code);
                  const isProtectedRoute = /^solution_s(?:0[1-9]|[1-3][0-9]|40)_route$/.test(moduleCode);
                  return (
                    <article key={text(item.id)} style={{ padding: 16, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16, background: "rgba(255,255,255,.48)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <strong>{text(item.label)}</strong>
                        <span className={styles.badge}>{label(text(item.requirement))} · {label(text(item.status))}</span>
                      </div>
                      <small style={{ display: "block", marginTop: 7, opacity: .68 }}>
                        Fonte: {text(item.source_type) || "manual"}{text(item.source_reference) ? ` · ${text(item.source_reference)}` : ""}
                      </small>
                      {text(item.evidence) ? <small style={{ display: "block", marginTop: 5 }}>Evidência: {text(item.evidence)}</small> : null}
                      {text(item.notes) ? <small style={{ display: "block", marginTop: 5 }}>Regra: {text(item.notes)}</small> : null}
                      {text(item.blocking_reason) ? <div className={styles.notice} style={{ marginTop: 10 }}>Bloqueio: {text(item.blocking_reason)}</div> : null}
                      {isProtectedRoute && canEdit ? <div className={styles.notice} style={{ marginTop: 10 }}>Este módulo é controlado pela rota da solução e não pode ser concluído manualmente aqui.</div> : null}

                      {canEdit && !isProtectedRoute ? (
                        <form action={`/api/interno/projetos/${id}/onboarding`} method="post" className={styles.form} style={{ marginTop: 14 }}>
                          <input type="hidden" name="module_code" value={moduleCode} />
                          <label>Aplicabilidade<select name="requirement" defaultValue={text(item.requirement) || "required"} style={controlStyle}><option value="required">Obrigatório</option><option value="not_required">Não necessário</option><option value="to_define">A definir</option></select></label>
                          <label>Estado<select name="onboarding_status" defaultValue={text(item.status) || "pending"} style={controlStyle}><option value="pending">Pendente</option><option value="in_progress">Em andamento</option><option value="blocked">Bloqueado</option><option value="done">Concluído</option><option value="waived">Dispensado com justificativa</option><option value="not_applicable">Não aplicável</option></select></label>
                          <label>Evidência<textarea name="evidence" rows={3} defaultValue={text(item.evidence)} style={controlStyle} placeholder="Obrigatória ao concluir." /></label>
                          <label>Responsável<input name="responsible_label" defaultValue={text(item.responsible_label)} maxLength={300} style={controlStyle} /></label>
                          <label>Prazo<input name="due_at" type="datetime-local" style={controlStyle} /></label>
                          <label>Motivo do bloqueio<input name="blocking_reason" defaultValue={text(item.blocking_reason)} maxLength={3000} style={controlStyle} /></label>
                          <label>Responsável pelo desbloqueio<input name="blocking_owner_label" defaultValue={text(item.blocking_owner_label)} maxLength={300} style={controlStyle} /></label>
                          <label>Próxima checagem<input name="next_check_at" type="datetime-local" style={controlStyle} /></label>
                          <label>Observação / justificativa<textarea name="notes" rows={3} defaultValue={text(item.notes)} style={controlStyle} /></label>
                          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.45 }}><input type="checkbox" name="onboarding_item_confirmed" value="yes" required style={{ marginTop: 4 }} /><span>Confirmo a atualização deste módulo de onboarding.</span></label>
                          <button className={styles.button} type="submit">Atualizar módulo</button>
                        </form>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {projectStatus === "onboarding" ? (
            <section className={styles.reviewCard} style={{ borderColor: ready && unresolvedRoutes === 0 ? "rgba(1,48,30,.3)" : "rgba(239,59,127,.24)" }}>
              <span className={styles.eyebrow}>GATE DE OPERAÇÃO</span>
              <h2>{ready && unresolvedRoutes === 0 ? "Pronto para ativação" : "BLOQUEADO PARA OPERAÇÃO"}</h2>
              {!workspace.tasks.length ? <div className={styles.notice}>Registre ao menos uma tarefa inicial no workspace do projeto antes da ativação.</div> : null}
              {unresolvedRoutes > 0 ? <div className={styles.notice}>Confirme a rota de execução de {unresolvedRoutes} solução(ões) contratada(s).</div> : null}
              {!ready ? <div className={styles.notice}>Resolva os módulos obrigatórios e qualquer aplicabilidade ainda “a definir”.</div> : null}
              <form action={`/api/interno/projetos/${id}/activate`} method="post" style={{ display: "grid", gap: 12, maxWidth: 760, marginTop: 16 }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.45 }}><input type="checkbox" name="activation_confirmed" value="yes" required style={{ marginTop: 4 }} /><span>Confirmo que revisei o onboarding e que o projeto está pronto para entrar em operação.</span></label>
                <button className={styles.button} type="submit" disabled={!canActivate} style={{ justifySelf: "start", opacity: canActivate ? 1 : .45 }}>Ativar projeto e liberar P14</button>
              </form>
            </section>
          ) : (
            <section className={styles.reviewCard}><span className={styles.eyebrow}>OPERAÇÃO</span><h2>Projeto já saiu do onboarding</h2><div className={styles.notice}>Status atual: {projectStatus}. O checklist e as soluções permanecem preservados como histórico.</div></section>
          )}
        </div>
      </div>
    </main>
  );
}
