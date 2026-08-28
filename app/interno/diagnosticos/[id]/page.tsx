import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalSession } from "../../../../lib/blinko/internal-auth";
import { BLINKO_DIAGNOSTIC_PILLARS } from "../../../../lib/blinko/diagnostic-collection";
import { getDiagnosticWorkspace } from "../../../../lib/blinko/diagnostic-collection-server";
import InternalBrand from "../../InternalBrand";
import styles from "../../interno.module.css";
import DiagnosticAnalysisSection from "./DiagnosticAnalysisSection";
import DiagnosticStrategySection from "./DiagnosticStrategySection";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ status?: string }>;
};

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function list(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function notice(status?: string) {
  if (status === "collection_saved") return "Nova versão da coleta registrada. A versão anterior foi preservada.";
  if (status === "collection_incomplete") return "Revise os 7 pilares. Pilar coletado precisa de evidência ou lacuna registrada; pilar insuficiente precisa explicar o que falta.";
  if (status === "collection_failed") return "A coleta não foi salva. Nenhum dado anterior foi apagado.";
  if (status === "diagnostic_schema_pending") return "A estrutura do Diagnóstico Blinko ainda aguarda aplicação das migrações no Neon principal.";
  if (status === "analysis_ready") return "Coleta encerrada como etapa atual. O diagnóstico avançou para análise.";
  if (status === "analysis_blocked") return "Salve ao menos uma versão válida da coleta antes de avançar para análise.";
  if (status === "deep_analysis_ready") return "A Blinko AI concluiu o rascunho analítico profundo. Agora ele precisa de revisão humana.";
  if (status === "deep_analysis_failed") return "A análise profunda não foi concluída. Nenhuma conclusão foi gravada como válida.";
  if (status === "deep_analysis_exists") return "Já existe uma análise profunda atual. A versão existente foi preservada.";
  if (status === "deep_analysis_blocked") return "A análise profunda só abre depois que o diagnóstico entra oficialmente na etapa de análise.";
  if (status === "deep_review_saved") return "Revisão humana da análise registrada. O diagnóstico avançou para revisão.";
  if (status === "deep_review_missing") return "Preencha a leitura humana antes de registrar a revisão da análise.";
  if (status === "deep_review_not_current") return "A análise informada não é mais a versão atual.";
  if (status === "deep_review_failed") return "A revisão humana não foi registrada. Nenhuma versão existente foi apagada.";
  if (status === "strategy_saved") return "Estrutura estratégica registrada. O histórico anterior foi preservado.";
  if (status === "strategy_invalid") return "Revise os campos. Confirmação exige evidência e intervenção exige objetivo e escopo.";
  if (status === "strategy_review_required") return "A estrutura estratégica só abre depois da revisão humana da análise profunda.";
  if (status === "strategy_failed") return "A estrutura estratégica não foi registrada. Nenhum dado existente foi apagado.";
  if (status === "strategy_finalized") return "Problema, causa, prioridade e intervenção validados. O diagnóstico está pronto para preparar a apresentação.";
  if (status === "strategy_finalize_confirmation_required") return "Confirme explicitamente a revisão antes de finalizar a estrutura.";
  if (status === "strategy_finalize_blocked") return "Para finalizar, é preciso uma cadeia com problema confirmado, causa confirmada, prioridade selecionada e intervenção selecionada.";
  return null;
}

export default async function DiagnosticPage({ params, searchParams }: Props) {
  const session = await requireInternalSession();
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  if (!uuidPattern.test(id)) notFound();

  const workspace = await getDiagnosticWorkspace(id);
  const statusNotice = notice(query.status);

  if (!workspace.schemaReady) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <header className={styles.topbar}>
            <InternalBrand />
            <nav className={styles.nav}><span className={styles.link}>{session.user}</span></nav>
          </header>
          <div className={styles.reviewShell}>
            <section className={styles.reviewCard}>
              <span className={styles.eyebrow}>DIAGNÓSTICO BLINKO</span>
              <h1>Coleta dos 7 pilares</h1>
              <div className={styles.notice}>A interface está pronta, mas as migrações 003 a 006 ainda não foram aplicadas ao Neon principal. Nenhum dado será simulado.</div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  if (!workspace.diagnostic) notFound();

  const diagnostic = workspace.diagnostic;
  const diagnosticStatus = text(diagnostic.status);
  const companyName = text(workspace.company?.name) || text(workspace.lead?.company_name) || "Empresa";
  const collection = workspace.currentCollection;
  const companyContext = record(collection?.company_context) ?? {};
  const pillarValues = record(collection?.pillars) ?? {};
  const currentVersion = typeof collection?.version_number === "number" ? collection.version_number : null;
  const canEdit = ["collection", "analysis"].includes(diagnosticStatus);

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
          {workspace.preDiagnostic?.id ? <Link className={styles.back} href={`/interno/pre-diagnosticos/${workspace.preDiagnostic.id}`}>← voltar ao pré-diagnóstico</Link> : <Link className={styles.back} href="/interno">← voltar para Hoje na Blinko</Link>}
          {statusNotice ? <div className={styles.notice} style={{ marginTop: 14, maxWidth: 900 }}>{statusNotice}</div> : null}
        </div>

        <div className={styles.reviewShell}>
          <section className={styles.reviewCard} style={{ borderColor: "rgba(239,59,127,.24)", background: "rgba(239,59,127,.035)" }}>
            <span className={styles.eyebrow}>DIAGNÓSTICO BLINKO · COLETA</span>
            <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 42, fontWeight: 500, marginBottom: 8 }}>{companyName}</h1>
            <p style={{ opacity: .7, maxWidth: 900, lineHeight: 1.55 }}>
              Registre o que existe de evidência, os sinais percebidos e o que ainda precisa ser validado. Coleta não confirma causa e não escolhe intervenção.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <span className={styles.badge}>Status: {diagnosticStatus}</span>
              <span className={styles.badge}>Método: {text(diagnostic.methodology_version) || "blinko-diagnostic-v1"}</span>
              {currentVersion ? <span className={styles.badge}>Coleta: versão {currentVersion}</span> : <span className={styles.badge}>Coleta: ainda sem versão</span>}
            </div>
          </section>

          <form action={`/api/interno/diagnosticos/${id}/collection`} method="post" style={{ display: "grid", gap: 18 }}>
            <section className={styles.reviewCard}>
              <span className={styles.eyebrow}>CONTEXTO DA EMPRESA</span>
              <h2>Base para interpretar os pilares</h2>
              <div className={styles.form}>
                <label>Modelo de negócio<textarea name="business_model" rows={4} defaultValue={text(companyContext.business_model)} /></label>
                <label>Público principal<textarea name="target_public" rows={4} defaultValue={text(companyContext.target_public)} /></label>
                <label>Oferta principal<textarea name="main_offer" rows={4} defaultValue={text(companyContext.main_offer)} /></label>
                <label>Objetivo atual<textarea name="current_goal" rows={4} defaultValue={text(companyContext.current_goal) || text(workspace.company?.objective) || text(workspace.lead?.objective)} /></label>
                <label>Restrições e contexto relevante<textarea name="constraints" rows={5} defaultValue={text(companyContext.constraints)} /></label>
              </div>
            </section>

            {BLINKO_DIAGNOSTIC_PILLARS.map((pillar, index) => {
              const current = record(pillarValues[pillar.key]) ?? {};
              const currentStatus = text(current.status) === "insufficient" ? "insufficient" : "collected";
              return (
                <section key={pillar.key} className={styles.reviewCard}>
                  <span className={styles.eyebrow}>PILAR {index + 1} DE 7</span>
                  <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, fontWeight: 500 }}>{pillar.label}</h2>
                  <div className={styles.form}>
                    <label>
                      Estado da coleta
                      <select name={`${pillar.key}_status`} defaultValue={currentStatus}>
                        <option value="collected">Coletado</option>
                        <option value="insufficient">Informação insuficiente</option>
                      </select>
                    </label>
                    <label>Evidências e fatos observáveis<textarea name={`${pillar.key}_evidence`} rows={6} defaultValue={text(current.evidence)} placeholder="Dados, documentos, processos observados, exemplos verificáveis." /></label>
                    <label>Sinais percebidos<textarea name={`${pillar.key}_signals`} rows={5} defaultValue={text(current.signals)} placeholder="Sinais que merecem investigação. Não registrar como causa confirmada." /></label>
                    <label>O que ainda falta validar<textarea name={`${pillar.key}_missing`} rows={5} defaultValue={text(current.missing)} placeholder="Informações, documentos ou pessoas que ainda precisamos consultar." /></label>
                    <label>Perguntas de validação<textarea name={`${pillar.key}_questions`} rows={5} defaultValue={text(current.validation_questions)} /></label>
                  </div>
                </section>
              );
            })}

            <section className={styles.reviewCard}>
              <span className={styles.eyebrow}>EVIDÊNCIAS E LACUNAS GERAIS</span>
              <div className={styles.form}>
                <label>Referências de evidência, uma por linha<textarea name="general_evidence" rows={6} defaultValue={list(collection?.general_evidence).join("\n")} placeholder="Ex.: Relatório financeiro jan-jun; pasta Drive /Cliente/Financeiro; entrevista com responsável operacional." /></label>
                <label>Informações ainda pendentes, uma por linha<textarea name="missing_information" rows={6} defaultValue={list(collection?.missing_information).join("\n")} /></label>
                <label>Notas de reunião e contexto<textarea name="meeting_notes" rows={8} defaultValue={text(collection?.meeting_notes)} /></label>
                <div className={styles.notice}>Salvar cria uma nova versão. A versão anterior não é sobrescrita.</div>
                <button className={styles.button} type="submit" disabled={!canEdit}>Salvar nova versão da coleta</button>
              </div>
            </section>
          </form>

          <section className={styles.reviewCard} style={{ borderColor: "rgba(1,48,30,.24)", background: "rgba(1,48,30,.035)" }}>
            <span className={styles.eyebrow}>PRÓXIMA ETAPA</span>
            <h2>Análise do Diagnóstico Blinko</h2>
            <p style={{ opacity: .7, lineHeight: 1.55, maxWidth: 860 }}>Só avance quando os sete pilares tiverem sido percorridos. “Informação insuficiente” é uma resposta válida quando a lacuna estiver explicitamente registrada.</p>
            {diagnosticStatus === "collection" ? (
              <form action={`/api/interno/diagnosticos/${id}/advance-analysis`} method="post">
                <button className={styles.button} type="submit" disabled={!currentVersion}>Encerrar coleta atual e avançar para análise</button>
              </form>
            ) : (
              <div className={styles.notice}>O diagnóstico já está em {diagnosticStatus}. As versões da coleta permanecem disponíveis como evidência do processo.</div>
            )}
          </section>

          <DiagnosticAnalysisSection diagnosticId={id} />
          <DiagnosticStrategySection diagnosticId={id} />
        </div>
      </div>
    </main>
  );
}
