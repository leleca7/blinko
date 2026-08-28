import {
  getDiagnosticAnalysisContext,
} from "../../../../lib/blinko/diagnostic-analysis-server";
import { normalizeDiagnosticAnalysis } from "../../../../lib/blinko/diagnostic-analysis";
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

export default async function DiagnosticAnalysisSection({ diagnosticId }: { diagnosticId: string }) {
  const context = await getDiagnosticAnalysisContext(diagnosticId);

  if (!context.schemaReady) {
    return (
      <section className={styles.reviewCard}>
        <span className={styles.eyebrow}>ANÁLISE PROFUNDA · ETAPA SEGUINTE</span>
        <h2>Rascunho analítico da Blinko AI</h2>
        <div className={styles.notice}>A análise profunda já está desenhada no código, mas depende das migrações 003, 004 e 005 no Neon. Nenhuma análise será simulada enquanto essa estrutura não estiver ativa.</div>
      </section>
    );
  }

  const diagnosticStatus = text(context.diagnostic?.status);
  const collectionId = text(context.collection?.id);
  const analysisRun = context.currentAnalysis;
  const analysisRunId = text(analysisRun?.id);
  const analysisStatus = text(analysisRun?.status);
  const analysis = normalizeDiagnosticAnalysis(analysisRun?.output);
  const review = context.currentReview;
  const reviewDecision = record(review?.decision) ?? {};

  const canGenerate = diagnosticStatus === "analysis" && Boolean(collectionId) && !analysisRun;
  const canReview = diagnosticStatus === "analysis" && analysisStatus === "ready" && Boolean(analysisRunId) && !review;

  return (
    <section className={styles.reviewCard} style={{ borderColor: "rgba(239,59,127,.24)", background: "rgba(239,59,127,.03)" }}>
      <span className={styles.eyebrow}>ANÁLISE PROFUNDA · BLINKO AI + HUMANO</span>
      <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, fontWeight: 500, marginBottom: 8 }}>Interpretar a coleta sem pular para conclusões</h2>
      <p style={{ opacity: .7, maxWidth: 900, lineHeight: 1.55 }}>
        A IA organiza forças, sinais, padrões e hipóteses. Problema confirmado, causa, prioridade e intervenção ainda dependem de validação humana.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <span className={styles.badge}>Diagnóstico: {diagnosticStatus || "indisponível"}</span>
        <span className={styles.badge}>Análise IA: {analysisStatus || "ainda não gerada"}</span>
        <span className={styles.badge}>Revisão humana: {review ? "registrada" : "pendente"}</span>
      </div>

      {canGenerate ? (
        <form action={`/api/interno/diagnosticos/${diagnosticId}/analysis/generate`} method="post" style={{ marginTop: 18 }}>
          <button className={styles.button} type="submit">Gerar rascunho analítico com Blinko AI</button>
        </form>
      ) : null}

      {diagnosticStatus === "collection" ? (
        <div className={styles.notice} style={{ marginTop: 18 }}>Finalize e versione a coleta dos 7 pilares antes de liberar a análise profunda.</div>
      ) : null}

      {analysis ? (
        <div style={{ display: "grid", gap: 18, marginTop: 22 }}>
          <div className={styles.notice}>
            <strong>Síntese interna</strong>
            <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{analysis.summary}</p>
          </div>

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

          <div style={{ display: "grid", gap: 10, padding: 16, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16 }}>
            <strong>Lente transversal de Relações Públicas</strong>
            {listBlock("Públicos e stakeholders", analysis.rp_lens.stakeholders)}
            {listBlock("Sinais de confiança e reputação", analysis.rp_lens.trust_reputation_signals)}
            {listBlock("Coerência entre discurso e prática", analysis.rp_lens.discourse_practice_coherence)}
            {listBlock("Riscos reputacionais a validar", analysis.rp_lens.reputational_risks)}
            <span className={styles.badge}>Crise: {analysis.rp_lens.crisis_assessment === "no_evidence_of_crisis" ? "sem evidência de crise" : "requer avaliação humana"}</span>
            {analysis.rp_lens.notes ? <p style={{ marginBottom: 0 }}>{analysis.rp_lens.notes}</p> : null}
          </div>
        </div>
      ) : null}

      {canReview ? (
        <form action={`/api/interno/diagnosticos/${diagnosticId}/analysis/review`} method="post" className={styles.form} style={{ marginTop: 24 }}>
          <input type="hidden" name="analysis_run_id" value={analysisRunId} />
          <strong>Revisão humana da análise</strong>
          <label>Leitura e decisões da revisão<textarea name="notes" required maxLength={7000} rows={8} placeholder="O que faz sentido, o que precisa ser ajustado e o que ainda não pode ser concluído." /></label>
          <label>Pontos considerados sustentados pelas evidências<textarea name="validated_points" maxLength={5000} rows={5} /></label>
          <label>Pontos descartados ou ainda sem prova<textarea name="discarded_or_unproven" maxLength={5000} rows={5} /></label>
          <label>Validações adicionais necessárias<textarea name="additional_validation_needed" maxLength={5000} rows={5} /></label>
          <div className={styles.notice}>Registrar esta revisão não cria causa confirmada automaticamente. A próxima etapa estrutura problemas e causas com base nesta decisão humana.</div>
          <button className={styles.button} type="submit">Registrar revisão humana da análise</button>
        </form>
      ) : null}

      {review ? (
        <div className={styles.notice} style={{ marginTop: 22 }}>
          <strong>Revisão humana registrada.</strong>
          {text(reviewDecision.notes) ? <p style={{ whiteSpace: "pre-wrap" }}>{text(reviewDecision.notes)}</p> : null}
          <p style={{ marginBottom: 0 }}>O diagnóstico agora pode seguir para estruturação de problemas, causas e prioridades sem transformar o rascunho da IA em fato.</p>
        </div>
      ) : null}
    </section>
  );
}
