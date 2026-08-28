import {
  getDiagnosticAnalysisContext,
} from "../../../../lib/blinko/diagnostic-analysis-server";
import { normalizeDiagnosticAnalysis } from "../../../../lib/blinko/diagnostic-analysis";
import { isBlinkoAiEnabled } from "../../../../lib/blinko/ai-server";
import styles from "../../interno.module.css";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function listBlock(title: string, items: string[]) {
  if (!items.length) return null;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <strong>{title}</strong>
      <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
        {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
      </ul>
    </div>
  );
}

const detailStyle = {
  border: "1px solid rgba(1,48,30,.12)",
  borderRadius: 16,
  padding: "15px 16px",
  background: "rgba(255,255,255,.42)",
} as const;

const summaryStyle = {
  cursor: "pointer",
  fontWeight: 700,
  lineHeight: 1.4,
} as const;

export default async function DiagnosticAnalysisSection({ diagnosticId }: { diagnosticId: string }) {
  const context = await getDiagnosticAnalysisContext(diagnosticId);

  if (!context.schemaReady) {
    return (
      <section className={styles.reviewCard}>
        <span className={styles.eyebrow}>ANÁLISE PROFUNDA · ETAPA SEGUINTE</span>
        <h2>Análise do Diagnóstico Blinko</h2>
        <div className={styles.notice}>A estrutura desta etapa ainda não está ativa no banco deste ambiente.</div>
      </section>
    );
  }

  const diagnosticStatus = text(context.diagnostic?.status);
  const collectionId = text(context.collection?.id);
  const analysisRun = context.currentAnalysis;
  const analysisRunId = text(analysisRun?.id);
  const analysisStatus = text(analysisRun?.status);
  const analysisProvider = text(analysisRun?.provider);
  const analysis = normalizeDiagnosticAnalysis(analysisRun?.output);
  const review = context.currentReview;
  const reviewDecision = record(review?.decision) ?? {};
  const aiEnabled = isBlinkoAiEnabled();

  const canCreateAnalysis = diagnosticStatus === "analysis" && Boolean(collectionId) && !analysisRun;
  const canReview = diagnosticStatus === "analysis" && analysisStatus === "ready" && Boolean(analysisRunId) && !review;
  const sourceLabel = analysisProvider === "manual-human"
    ? "manual"
    : analysisProvider
      ? "assistida por IA"
      : "ainda não gerada";

  return (
    <section className={styles.reviewCard} style={{ borderColor: "rgba(239,59,127,.24)", background: "rgba(239,59,127,.03)" }}>
      <span className={styles.eyebrow}>ANÁLISE PROFUNDA · ETAPA DE INTERPRETAÇÃO</span>
      <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, fontWeight: 500, marginBottom: 8 }}>Interpretar a coleta sem pular para conclusões</h2>
      <p style={{ opacity: .7, maxWidth: 900, lineHeight: 1.55 }}>
        Organize forças, sinais, hipóteses e lacunas. Problema confirmado, causa, prioridade e intervenção continuam dependendo de decisão humana explícita.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <span className={styles.badge}>Diagnóstico: {diagnosticStatus || "indisponível"}</span>
        <span className={styles.badge}>Análise: {analysisStatus || "pendente"}</span>
        <span className={styles.badge}>Origem: {sourceLabel}</span>
        <span className={styles.badge}>Revisão humana: {review ? "registrada" : "pendente"}</span>
      </div>

      {canCreateAnalysis ? (
        <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
          {aiEnabled ? (
            <div style={{ display: "grid", gap: 8 }}>
              <form action={`/api/interno/diagnosticos/${diagnosticId}/analysis/generate`} method="post">
                <button className={styles.button} type="submit">Gerar rascunho com Blinko AI</button>
              </form>
              <small style={{ opacity: .58 }}>A IA está habilitada neste ambiente. O rascunho ainda exige revisão humana.</small>
            </div>
          ) : (
            <div className={styles.notice}>
              <strong>IA desativada neste ambiente.</strong>
              O fluxo continua normalmente pela análise manual abaixo.
            </div>
          )}

          <details style={detailStyle} open={!aiEnabled}>
            <summary style={summaryStyle}>Registrar análise manual</summary>
            <form action={`/api/interno/diagnosticos/${diagnosticId}/analysis/manual`} method="post" className={styles.form} style={{ marginTop: 18 }}>
              <label>
                Síntese interna
                <textarea name="summary" required maxLength={5000} rows={6} placeholder="Resuma o que a coleta mostra sem declarar causa raiz ou solução final." />
              </label>
              <label>
                Forças observadas <small>uma por linha</small>
                <textarea name="strengths" maxLength={12000} rows={4} placeholder="Ex.: A equipe demonstra domínio técnico do serviço." />
              </label>
              <label>
                Sinais para investigar <small>um por linha</small>
                <textarea name="signals" maxLength={12000} rows={5} placeholder="Registre sinais, não conclusões." />
              </label>
              <label>
                Hipóteses ainda não confirmadas <small>uma por linha</small>
                <textarea name="hypotheses" maxLength={12000} rows={5} placeholder="Use linguagem de hipótese: pode indicar, pode estar relacionado, precisa ser validado." />
              </label>
              <label>
                Informações que ainda faltam <small>uma por linha</small>
                <textarea name="missing_information" maxLength={12000} rows={4} />
              </label>
              <label>
                Perguntas de validação <small>uma por linha</small>
                <textarea name="validation_questions" maxLength={12000} rows={4} />
              </label>
              <label>
                Lente de Relações Públicas <small>opcional</small>
                <textarea name="rp_notes" maxLength={2500} rows={4} placeholder="Stakeholders, confiança, reputação e coerência entre discurso e prática que mereçam atenção." />
              </label>
              <label>
                Avaliação de crise reputacional
                <select name="crisis_assessment" defaultValue="no_evidence_of_crisis">
                  <option value="no_evidence_of_crisis">Sem evidência de crise</option>
                  <option value="requires_human_assessment">Há sinais que exigem avaliação humana</option>
                </select>
              </label>
              <div className={styles.notice}>Esta análise será registrada como produção humana, com histórico e auditoria. Ela não confirma automaticamente problema, causa ou intervenção.</div>
              <button className={styles.button} type="submit">Registrar análise manual</button>
            </form>
          </details>
        </div>
      ) : null}

      {diagnosticStatus === "collection" ? (
        <div className={styles.notice} style={{ marginTop: 18 }}>Finalize e versione a coleta dos 7 pilares antes de abrir a etapa de análise.</div>
      ) : null}

      {analysis ? (
        <div style={{ display: "grid", gap: 14, marginTop: 22 }}>
          <div className={styles.notice}>
            <strong>Síntese interna</strong>
            <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{analysis.summary}</p>
          </div>

          <details style={detailStyle}>
            <summary style={summaryStyle}>Forças, sinais e padrões</summary>
            <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
              {analysis.strengths.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <strong>Forças observadas</strong>
                  {analysis.strengths.map((item, index) => <article key={`strength-${index}`} style={{ padding: 14, border: "1px solid rgba(1,48,30,.12)", borderRadius: 14 }}><b>{item.pillar || "Transversal"}</b><p>{item.statement}</p>{item.evidence.length ? <small>Evidências: {item.evidence.join(" • ")}</small> : null}</article>)}
                </div>
              ) : null}

              {analysis.signals.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <strong>Sinais para investigação</strong>
                  {analysis.signals.map((item, index) => <article key={`signal-${index}`} style={{ padding: 14, border: "1px solid rgba(1,48,30,.12)", borderRadius: 14 }}><b>{item.pillar || "Transversal"} · confiança {item.confidence}</b><p>{item.statement}</p>{item.evidence.length ? <small>Evidências: {item.evidence.join(" • ")}</small> : null}</article>)}
                </div>
              ) : null}

              {analysis.cross_pillar_patterns.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <strong>Padrões entre pilares</strong>
                  {analysis.cross_pillar_patterns.map((item, index) => <article key={`pattern-${index}`} style={{ padding: 14, border: "1px solid rgba(1,48,30,.12)", borderRadius: 14 }}><b>{item.related_pillars.join(" + ") || "Transversal"} · confiança {item.confidence}</b><p>{item.statement}</p></article>)}
                </div>
              ) : null}

              {!analysis.strengths.length && !analysis.signals.length && !analysis.cross_pillar_patterns.length ? <p style={{ opacity: .6, margin: 0 }}>Nenhum item registrado neste bloco.</p> : null}
            </div>
          </details>

          <details style={detailStyle}>
            <summary style={summaryStyle}>Hipóteses, lacunas e validações</summary>
            <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
              {analysis.hypotheses.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <strong>Hipóteses ainda não confirmadas</strong>
                  {analysis.hypotheses.map((item, index) => <article key={`hyp-${index}`} style={{ padding: 14, border: "1px solid rgba(239,59,127,.18)", borderRadius: 14 }}><b>{item.related_pillars.join(" + ") || "Transversal"} · confiança {item.confidence}</b><p>{item.statement}</p><small>Validar: {item.validation_needed || "não especificado"}</small></article>)}
                </div>
              ) : null}

              {analysis.problem_candidates.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <strong>Problemas candidatos, não confirmados</strong>
                  {analysis.problem_candidates.map((item, index) => <article key={`problem-${index}`} style={{ padding: 14, border: "1px solid rgba(239,59,127,.18)", borderRadius: 14 }}><b>{item.title}</b><p>{item.impact_hypothesis}</p><small>Validar: {item.validation_needed || "não especificado"}</small></article>)}
                </div>
              ) : null}

              {listBlock("Contradições percebidas", analysis.contradictions)}
              {listBlock("Informações faltantes", analysis.missing_information)}
              {listBlock("Perguntas de validação", analysis.validation_questions)}
            </div>
          </details>

          <details style={detailStyle}>
            <summary style={summaryStyle}>Lente transversal de Relações Públicas</summary>
            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {listBlock("Públicos e stakeholders", analysis.rp_lens.stakeholders)}
              {listBlock("Sinais de confiança e reputação", analysis.rp_lens.trust_reputation_signals)}
              {listBlock("Coerência entre discurso e prática", analysis.rp_lens.discourse_practice_coherence)}
              {listBlock("Riscos reputacionais a validar", analysis.rp_lens.reputational_risks)}
              <span className={styles.badge}>Crise: {analysis.rp_lens.crisis_assessment === "no_evidence_of_crisis" ? "sem evidência de crise" : "requer avaliação humana"}</span>
              {analysis.rp_lens.notes ? <p style={{ marginBottom: 0 }}>{analysis.rp_lens.notes}</p> : null}
            </div>
          </details>
        </div>
      ) : null}

      {canReview ? (
        <details style={{ ...detailStyle, marginTop: 20 }} open>
          <summary style={summaryStyle}>Próxima ação: revisão humana</summary>
          <form action={`/api/interno/diagnosticos/${diagnosticId}/analysis/review`} method="post" className={styles.form} style={{ marginTop: 18 }}>
            <input type="hidden" name="analysis_run_id" value={analysisRunId} />
            <label>Leitura e decisões da revisão<textarea name="notes" required maxLength={7000} rows={8} placeholder="O que faz sentido, o que precisa ser ajustado e o que ainda não pode ser concluído." /></label>
            <label>Pontos considerados sustentados pelas evidências<textarea name="validated_points" maxLength={5000} rows={5} /></label>
            <label>Pontos descartados ou ainda sem prova<textarea name="discarded_or_unproven" maxLength={5000} rows={5} /></label>
            <label>Validações adicionais necessárias<textarea name="additional_validation_needed" maxLength={5000} rows={5} /></label>
            <div className={styles.notice}>Registrar esta revisão não cria causa confirmada automaticamente. A próxima etapa estrutura problemas e causas com base nesta decisão humana.</div>
            <button className={styles.button} type="submit">Registrar revisão humana da análise</button>
          </form>
        </details>
      ) : null}

      {review ? (
        <div className={styles.notice} style={{ marginTop: 22 }}>
          <strong>Revisão humana registrada.</strong>
          {text(reviewDecision.notes) ? <p style={{ whiteSpace: "pre-wrap" }}>{text(reviewDecision.notes)}</p> : null}
          <p style={{ marginBottom: 0 }}>O diagnóstico agora pode seguir para estruturação de problemas, causas e prioridades.</p>
        </div>
      ) : null}
    </section>
  );
}
