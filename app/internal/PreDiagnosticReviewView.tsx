import { normalizePreDiagnosticAnalysis } from "../../lib/blinko/pre-diagnostic-analysis";
import type { ReviewWorkspace } from "../../lib/blinko/review-workspace";

function display(value: unknown, fallback = "Não informado.") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function confidenceLabel(value: string) {
  return { low: "Baixa", medium: "Média", high: "Alta" }[value] ?? value;
}

function actionLabel(value: string) {
  return {
    priority_contact: "Contato prioritário",
    normal_contact: "Contato normal",
    request_information: "Pedir mais informações",
    low_fit_now: "Baixo fit neste momento",
    mandatory_human_review: "Revisão humana obrigatória",
  }[value] ?? value;
}

function TextList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p style={{ margin: 0, opacity: .6 }}>{empty}</p>;
  return (
    <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 7, lineHeight: 1.5 }}>
      {items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
    </ul>
  );
}

export default function PreDiagnosticReviewView({ workspace }: { workspace: ReviewWorkspace }) {
  const raw = workspace.pre_diagnostic.raw_answers as Record<string, unknown> | undefined;
  const blocker = display(raw?.perceived_blocker ?? workspace.pre_diagnostic.perceived_blocker);
  const context = display(raw?.additional_context ?? workspace.pre_diagnostic.additional_context);
  const areas = Array.isArray(workspace.pre_diagnostic.perceived_areas)
    ? workspace.pre_diagnostic.perceived_areas.filter((item): item is string => typeof item === "string")
    : [];

  const analysisRun = asRecord(workspace.current_analysis);
  const analysis = normalizePreDiagnosticAnalysis(analysisRun?.output);

  return (
    <section style={{ display: "grid", gap: 24 }}>
      <header style={{ display: "grid", gap: 8 }}>
        <span style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", opacity: .6 }}>
          Revisão de pré-diagnóstico
        </span>
        <h1 style={{ margin: 0 }}>{workspace.lead.company_name || workspace.lead.name}</h1>
        <p style={{ margin: 0, opacity: .72 }}>
          {workspace.lead.name} · score {workspace.lead.commercial_score}/10 · {workspace.lead.status}
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <article style={{ padding: 18, border: "1px solid rgba(1,48,30,.14)", borderRadius: 16 }}>
          <small>Objetivo</small>
          <p>{workspace.lead.objective}</p>
        </article>
        <article style={{ padding: 18, border: "1px solid rgba(1,48,30,.14)", borderRadius: 16 }}>
          <small>Bloqueio percebido</small>
          <p>{blocker}</p>
        </article>
        <article style={{ padding: 18, border: "1px solid rgba(1,48,30,.14)", borderRadius: 16 }}>
          <small>Status da IA</small>
          <p>{workspace.pre_diagnostic.ai_analysis_status}</p>
        </article>
        <article style={{ padding: 18, border: "1px solid rgba(1,48,30,.14)", borderRadius: 16 }}>
          <small>Revisão humana</small>
          <p>{workspace.pre_diagnostic.human_review_status}</p>
        </article>
      </div>

      <article style={{ padding: 20, border: "1px solid rgba(1,48,30,.14)", borderRadius: 18 }}>
        <h2 style={{ marginTop: 0 }}>Áreas percebidas</h2>
        <p>{areas.length ? areas.join(" · ") : "Nenhuma área marcada."}</p>
      </article>

      <article style={{ padding: 20, border: "1px solid rgba(1,48,30,.14)", borderRadius: 18 }}>
        <h2 style={{ marginTop: 0 }}>Contexto adicional</h2>
        <p>{context}</p>
      </article>

      <article style={{ padding: 22, border: "1px solid rgba(1,48,30,.14)", borderRadius: 18, background: "rgba(255,255,255,.42)" }}>
        <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <small style={{ textTransform: "uppercase", letterSpacing: ".1em", opacity: .55 }}>Blinko AI</small>
            <h2 style={{ margin: "7px 0 0" }}>Análise interna</h2>
          </div>
          {analysisRun ? (
            <small style={{ opacity: .58 }}>
              {display(analysisRun.model, "modelo não informado")}
            </small>
          ) : null}
        </div>

        {!analysis ? (
          <p style={{ marginBottom: 0, opacity: .65 }}>
            {analysisRun
              ? "Existe um registro técnico de análise, mas a saída não passou pela validação de exibição."
              : "Ainda não existe uma análise Blinko AI pronta para este pré-diagnóstico."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: 24, marginTop: 22 }}>
            <div>
              <strong>Resumo</strong>
              <p style={{ lineHeight: 1.55 }}>{analysis.summary}</p>
            </div>

            <div>
              <strong>Objetivo declarado</strong>
              <p style={{ lineHeight: 1.55 }}>{analysis.declaredObjective}</p>
            </div>

            <div>
              <strong>Sinais por pilar</strong>
              <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                {analysis.pillarSignals.length ? analysis.pillarSignals.map((signal) => (
                  <article key={`${signal.pillar}-${signal.signal}`} style={{ padding: 16, borderRadius: 14, background: "rgba(1,48,30,.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <strong>{signal.pillar}</strong>
                      <small>Confiança: {confidenceLabel(signal.confidence)}</small>
                    </div>
                    <p style={{ lineHeight: 1.5 }}>{signal.signal}</p>
                    <small style={{ display: "block", marginBottom: 7, opacity: .6 }}>Evidências usadas</small>
                    <TextList items={signal.evidence} empty="Nenhuma evidência específica registrada." />
                    {signal.missingInformation.length ? (
                      <div style={{ marginTop: 14 }}>
                        <small style={{ display: "block", marginBottom: 7, opacity: .6 }}>O que ainda falta saber</small>
                        <TextList items={signal.missingInformation} empty="" />
                      </div>
                    ) : null}
                  </article>
                )) : <p style={{ opacity: .6 }}>Nenhum sinal por pilar foi estruturado.</p>}
              </div>
            </div>

            <div>
              <strong>Hipóteses de investigação</strong>
              <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                {analysis.investigationHypotheses.length ? analysis.investigationHypotheses.map((hypothesis, index) => (
                  <article key={`${index}-${hypothesis.hypothesis}`} style={{ padding: 16, border: "1px solid rgba(1,48,30,.1)", borderRadius: 14 }}>
                    <p style={{ marginTop: 0, lineHeight: 1.5 }}><strong>{hypothesis.hypothesis}</strong></p>
                    <small style={{ display: "block", marginBottom: 7, opacity: .6 }}>O que sustenta a hipótese</small>
                    <TextList items={hypothesis.evidence} empty="Ainda sem evidência suficiente." />
                    <div style={{ marginTop: 14 }}>
                      <small style={{ display: "block", marginBottom: 7, opacity: .6 }}>O que ajudaria a confirmar</small>
                      <TextList items={hypothesis.whatWouldConfirm} empty="Não especificado." />
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <small style={{ display: "block", marginBottom: 7, opacity: .6 }}>O que poderia refutar</small>
                      <TextList items={hypothesis.whatWouldRefute} empty="Não especificado." />
                    </div>
                  </article>
                )) : <p style={{ opacity: .6 }}>Nenhuma hipótese foi registrada.</p>}
              </div>
            </div>

            <div>
              <strong>Contradições ou lacunas</strong>
              <div style={{ marginTop: 10 }}>
                <TextList items={analysis.contradictionsOrGaps} empty="Nenhuma contradição ou lacuna relevante foi destacada." />
              </div>
            </div>

            <div>
              <strong>Perguntas para a conversa</strong>
              <div style={{ marginTop: 10 }}>
                <TextList items={analysis.meetingQuestions} empty="Nenhuma pergunta adicional foi sugerida." />
              </div>
            </div>

            <div style={{ padding: 16, borderRadius: 14, background: "rgba(239,59,127,.07)" }}>
              <small style={{ display: "block", marginBottom: 6, opacity: .62 }}>Próxima ação sugerida pela IA, sujeita a decisão humana</small>
              <strong>{actionLabel(analysis.suggestedNextAction)}</strong>
            </div>
          </div>
        )}
      </article>

      <article style={{ padding: 20, border: "1px solid rgba(1,48,30,.14)", borderRadius: 18 }}>
        <h2 style={{ marginTop: 0 }}>Ações abertas</h2>
        <p>{workspace.open_actions.length} ação(ões) aguardando tratamento.</p>
      </article>
    </section>
  );
}
