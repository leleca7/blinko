import { BLINKO_DIAGNOSTIC_PILLARS } from "../../../../lib/blinko/diagnostic-collection";
import { getDiagnosticStrategyContext } from "../../../../lib/blinko/diagnostic-strategy-server";
import styles from "../../interno.module.css";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function list(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function labelForPillar(key: string) {
  return BLINKO_DIAGNOSTIC_PILLARS.find((item) => item.key === key)?.label || key || "Transversal";
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    candidate: "candidato",
    confirmed: "confirmado",
    discarded: "descartado",
    hypothesis: "hipótese",
    in_validation: "em validação",
    proposed: "proposta",
    selected: "selecionada",
    deferred: "adiada",
    done: "concluída",
    approved_for_proposal: "aprovada para proposta",
  };
  return labels[value] || value;
}

const controlStyle = {
  border: "1px solid rgba(1,48,30,.18)",
  background: "rgba(255,255,255,.78)",
  color: "#08271b",
  borderRadius: 14,
  padding: 13,
  font: "inherit",
};

export default async function DiagnosticStrategySection({ diagnosticId }: { diagnosticId: string }) {
  const context = await getDiagnosticStrategyContext(diagnosticId);

  if (!context.schemaReady) {
    return (
      <section className={styles.reviewCard}>
        <span className={styles.eyebrow}>ESTRUTURA ESTRATÉGICA</span>
        <h2>Problema, causa, prioridade e intervenção</h2>
        <div className={styles.notice}>
          Esta etapa já está preparada no código, mas depende das migrações 003 a 006 no Neon. Nenhum problema, causa ou prioridade será simulado enquanto a estrutura não estiver ativa.
        </div>
      </section>
    );
  }

  const diagnosticStatus = text(context.diagnostic?.status);
  const reviewId = text(context.currentReview?.id);
  const canEdit = diagnosticStatus === "review" && Boolean(reviewId);

  const confirmedProblems = context.problems.filter((item) => text(item.status) === "confirmed");
  const confirmedCauses = context.causes.filter((item) => text(item.validation_status) === "confirmed");
  const selectedPriorities = context.priorities.filter((item) => text(item.status) === "selected");
  const selectedInterventions = context.interventions.filter((item) => text(item.status) === "selected");

  const confirmedProblemIds = new Set(confirmedProblems.map((item) => text(item.id)));
  const confirmedCauseIds = new Set(confirmedCauses.map((item) => text(item.id)));
  const selectedPriorityIds = new Set(selectedPriorities.map((item) => text(item.id)));
  const hasCompleteChain = selectedInterventions.some((item) =>
    confirmedProblemIds.has(text(item.problem_id))
    && confirmedCauseIds.has(text(item.cause_id))
    && selectedPriorityIds.has(text(item.priority_id)),
  );

  return (
    <section className={styles.reviewCard} style={{ borderColor: "rgba(1,48,30,.24)", background: "rgba(1,48,30,.035)" }}>
      <span className={styles.eyebrow}>ESTRUTURA ESTRATÉGICA</span>
      <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, fontWeight: 500, marginBottom: 8 }}>
        Problema → causa → prioridade → intervenção
      </h2>
      <p style={{ opacity: .7, lineHeight: 1.55, maxWidth: 900 }}>
        Aqui a decisão deixa de ser um rascunho da IA e passa a ser uma estrutura registrada por uma pessoa da Blinko. Confirmação de problema e causa exige evidência. A prioridade exige justificativa e a intervenção precisa estar ligada ao que foi validado.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 18 }}>
        <article style={{ padding: 15, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16, background: "rgba(255,255,255,.48)" }}><small>Problemas</small><strong style={{ display: "block", fontSize: 24, marginTop: 5 }}>{context.problems.length}</strong><span style={{ opacity: .65 }}>{confirmedProblems.length} confirmados</span></article>
        <article style={{ padding: 15, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16, background: "rgba(255,255,255,.48)" }}><small>Causas</small><strong style={{ display: "block", fontSize: 24, marginTop: 5 }}>{context.causes.length}</strong><span style={{ opacity: .65 }}>{confirmedCauses.length} confirmadas</span></article>
        <article style={{ padding: 15, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16, background: "rgba(255,255,255,.48)" }}><small>Prioridades</small><strong style={{ display: "block", fontSize: 24, marginTop: 5 }}>{context.priorities.length}</strong><span style={{ opacity: .65 }}>{selectedPriorities.length} selecionadas</span></article>
        <article style={{ padding: 15, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16, background: "rgba(255,255,255,.48)" }}><small>Intervenções</small><strong style={{ display: "block", fontSize: 24, marginTop: 5 }}>{context.interventions.length}</strong><span style={{ opacity: .65 }}>{selectedInterventions.length} selecionadas</span></article>
      </div>

      {!canEdit ? (
        <div className={styles.notice} style={{ marginTop: 18 }}>
          {diagnosticStatus === "ready_for_presentation"
            ? "A estrutura estratégica foi finalizada. O próximo passo é preparar a apresentação do Diagnóstico Blinko."
            : "Esta etapa abre depois que a análise profunda recebe revisão humana registrada."}
        </div>
      ) : null}

      {context.problems.length ? (
        <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
          <strong>Estruturas já registradas</strong>
          {context.problems.map((problem) => {
            const problemId = text(problem.id);
            const causes = context.causes.filter((item) => text(item.problem_id) === problemId);
            const priorities = context.priorities.filter((item) => text(item.problem_id) === problemId);
            const interventions = context.interventions.filter((item) => text(item.problem_id) === problemId);
            return (
              <article key={problemId} style={{ display: "grid", gap: 12, padding: 18, border: "1px solid rgba(1,48,30,.14)", borderRadius: 18, background: "rgba(255,255,255,.48)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div><small style={{ opacity: .58 }}>Problema</small><strong style={{ display: "block", marginTop: 4 }}>{text(problem.title)}</strong></div>
                  <span className={styles.badge}>{statusLabel(text(problem.status))}</span>
                </div>
                <p style={{ margin: 0, lineHeight: 1.5 }}>{text(problem.description)}</p>
                <small style={{ opacity: .65 }}>Pilar principal: {labelForPillar(text(problem.primary_pillar))} · Urgência: {text(problem.urgency) || "não definida"}</small>
                {list(problem.evidence).length ? <small>Evidências: {list(problem.evidence).join(" • ")}</small> : null}

                {causes.map((cause) => (
                  <div key={text(cause.id)} style={{ padding: 12, borderLeft: "3px solid rgba(239,59,127,.35)" }}>
                    <b>Causa {statusLabel(text(cause.validation_status))}</b>
                    <p style={{ margin: "5px 0" }}>{text(cause.description)}</p>
                    <small>Confiança: {text(cause.confidence) || "não definida"}</small>
                  </div>
                ))}

                {priorities.map((priority) => (
                  <div key={text(priority.id)} style={{ padding: 12, border: "1px solid rgba(1,48,30,.1)", borderRadius: 12 }}>
                    <b>Prioridade #{String(priority.sequence_position ?? "?")} · {statusLabel(text(priority.status))}</b>
                    <p style={{ margin: "5px 0" }}>{text(priority.rationale)}</p>
                  </div>
                ))}

                {interventions.map((intervention) => (
                  <div key={text(intervention.id)} style={{ padding: 12, border: "1px solid rgba(1,48,30,.1)", borderRadius: 12 }}>
                    <b>Intervenção · {statusLabel(text(intervention.status))}</b>
                    <p style={{ margin: "5px 0" }}>{text(intervention.title)}</p>
                    <small>{text(intervention.objective)}</small>
                  </div>
                ))}
              </article>
            );
          })}
        </div>
      ) : null}

      {canEdit ? (
        <form action={`/api/interno/diagnosticos/${diagnosticId}/strategy/bundle`} method="post" className={styles.form} style={{ marginTop: 28 }}>
          <div className={styles.notice}>
            Registre uma cadeia por vez. Os estados começam conservadores. Não confirme um problema ou uma causa apenas porque a Blinko AI sugeriu algo acima.
          </div>

          <div style={{ display: "grid", gap: 14, padding: 18, border: "1px solid rgba(239,59,127,.2)", borderRadius: 18 }}>
            <strong>1. Problema</strong>
            <label>Título<input name="problem_title" required maxLength={240} style={controlStyle} /></label>
            <label>Descrição<textarea name="problem_description" required maxLength={5000} rows={5} style={controlStyle} /></label>
            <label>Pilar principal<select name="problem_primary_pillar" defaultValue="" style={controlStyle}><option value="">Transversal ou ainda não definido</option>{BLINKO_DIAGNOSTIC_PILLARS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
            <label>Pilares relacionados, uma chave por linha<textarea name="problem_related_pillars" rows={3} style={controlStyle} placeholder="brand&#10;service" /></label>
            <label>Evidências, uma por linha<textarea name="problem_evidence" rows={5} style={controlStyle} /></label>
            <label>Impacto percebido<textarea name="problem_impact" rows={4} style={controlStyle} /></label>
            <label>Urgência<select name="problem_urgency" defaultValue="medium" style={controlStyle}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label>
            <label>Estado<select name="problem_status" defaultValue="candidate" style={controlStyle}><option value="candidate">Candidato</option><option value="confirmed">Confirmado por revisão humana</option><option value="discarded">Descartado</option></select></label>
            <label>Nota de confirmação ou descarte<textarea name="problem_confirmation_notes" rows={4} style={controlStyle} /></label>
          </div>

          <div style={{ display: "grid", gap: 14, padding: 18, border: "1px solid rgba(1,48,30,.14)", borderRadius: 18 }}>
            <strong>2. Causa</strong>
            <label>Descrição da causa ou hipótese<textarea name="cause_description" rows={5} style={controlStyle} /></label>
            <label>Evidências, uma por linha<textarea name="cause_evidence" rows={5} style={controlStyle} /></label>
            <label>Confiança<select name="cause_confidence" defaultValue="low" style={controlStyle}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></label>
            <label>Estado da validação<select name="cause_status" defaultValue="hypothesis" style={controlStyle}><option value="hypothesis">Hipótese</option><option value="in_validation">Em validação</option><option value="confirmed">Confirmada por revisão humana</option><option value="discarded">Descartada</option></select></label>
            <label>Notas da validação<textarea name="cause_validation_notes" rows={4} style={controlStyle} /></label>
          </div>

          <div style={{ display: "grid", gap: 14, padding: 18, border: "1px solid rgba(1,48,30,.14)", borderRadius: 18 }}>
            <strong>3. Prioridade</strong>
            <label>Impacto<textarea name="priority_impact" rows={4} style={controlStyle} /></label>
            <label>Urgência<select name="priority_urgency" defaultValue="medium" style={controlStyle}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label>
            <label>Dependências, uma por linha<textarea name="priority_dependencies" rows={4} style={controlStyle} /></label>
            <label>Esforço estimado<select name="priority_effort" defaultValue="medium" style={controlStyle}><option value="low">Baixo</option><option value="medium">Médio</option><option value="high">Alto</option></select></label>
            <label>Risco<select name="priority_risk" defaultValue="medium" style={controlStyle}><option value="low">Baixo</option><option value="medium">Médio</option><option value="high">Alto</option></select></label>
            <label>Por que esta ordem faz sentido<textarea name="priority_rationale" rows={5} style={controlStyle} /></label>
            <label>Posição na sequência<input name="priority_position" type="number" min="1" defaultValue="1" style={controlStyle} /></label>
            <label>Estado<select name="priority_status" defaultValue="proposed" style={controlStyle}><option value="proposed">Proposta</option><option value="selected">Selecionada por decisão humana</option><option value="deferred">Adiada</option><option value="done">Concluída</option></select></label>
          </div>

          <div style={{ display: "grid", gap: 14, padding: 18, border: "1px solid rgba(1,48,30,.14)", borderRadius: 18 }}>
            <strong>4. Intervenção</strong>
            <label>Chave da biblioteca, se houver<input name="intervention_library_key" maxLength={160} style={controlStyle} placeholder="Opcional. Não transforma a biblioteca em catálogo." /></label>
            <label>Nome da intervenção<input name="intervention_title" maxLength={240} style={controlStyle} /></label>
            <label>Objetivo<textarea name="intervention_objective" rows={4} style={controlStyle} /></label>
            <label>Escopo<textarea name="intervention_scope" rows={6} style={controlStyle} /></label>
            <label>Entregáveis, um por linha<textarea name="intervention_deliverables" rows={5} style={controlStyle} /></label>
            <label>Responsável previsto<input name="intervention_responsible" maxLength={180} style={controlStyle} /></label>
            <label>Especialistas necessários, um por linha<textarea name="intervention_specialists" rows={4} style={controlStyle} /></label>
            <label>Prazo ou janela estimada<input name="intervention_timeframe" maxLength={240} style={controlStyle} /></label>
            <label>Esforço previsto<input name="intervention_effort" maxLength={500} style={controlStyle} /></label>
            <label>Riscos, um por linha<textarea name="intervention_risks" rows={4} style={controlStyle} /></label>
            <label>Dependências, uma por linha<textarea name="intervention_dependencies" rows={4} style={controlStyle} /></label>
            <label>Indicador de sucesso<textarea name="intervention_success_indicator" rows={4} style={controlStyle} /></label>
            <label>Aprovações necessárias, uma por linha<textarea name="intervention_approvals" rows={4} style={controlStyle} /></label>
            <label>Estado<select name="intervention_status" defaultValue="candidate" style={controlStyle}><option value="candidate">Candidata</option><option value="selected">Selecionada por decisão humana</option><option value="approved_for_proposal">Aprovada para proposta</option><option value="discarded">Descartada</option></select></label>
          </div>

          <button className={styles.button} type="submit">Registrar esta cadeia estratégica</button>
        </form>
      ) : null}

      {canEdit ? (
        <div style={{ display: "grid", gap: 14, marginTop: 28, paddingTop: 22, borderTop: "1px solid rgba(1,48,30,.12)" }}>
          <strong>Finalizar estrutura do diagnóstico</strong>
          <p style={{ margin: 0, opacity: .7, lineHeight: 1.5, maxWidth: 900 }}>
            Para avançar, precisa existir ao menos uma cadeia com problema confirmado, causa confirmada, prioridade selecionada e intervenção selecionada, todas ligadas entre si.
          </p>
          <form action={`/api/interno/diagnosticos/${diagnosticId}/strategy/finalize`} method="post" style={{ display: "grid", gap: 12, maxWidth: 760 }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.45 }}>
              <input type="checkbox" name="strategy_confirmed" value="yes" required style={{ marginTop: 4 }} />
              <span>Confirmo que revisei a cadeia selecionada e que as confirmações registradas estão sustentadas pelas evidências disponíveis.</span>
            </label>
            <button className={styles.button} type="submit" disabled={!hasCompleteChain} style={{ justifySelf: "start", opacity: hasCompleteChain ? 1 : .45 }}>
              Finalizar e preparar apresentação
            </button>
          </form>
          {!hasCompleteChain ? <div className={styles.notice}>Ainda não existe uma cadeia completa validada para finalizar esta etapa.</div> : null}
        </div>
      ) : null}
    </section>
  );
}
