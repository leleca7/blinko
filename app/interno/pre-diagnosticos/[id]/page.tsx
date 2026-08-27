import Link from "next/link";
import { notFound } from "next/navigation";
import PreDiagnosticReviewView from "../../../internal/PreDiagnosticReviewView";
import { requireInternalSession } from "../../../../lib/blinko/internal-auth";
import { getPreDiagnosticReviewWorkspace } from "../../../../lib/blinko/neon-server";
import { normalizeReviewWorkspace } from "../../../../lib/blinko/review-workspace";
import InternalBrand from "../../InternalBrand";
import styles from "../../interno.module.css";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ status?: string }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function statusNotice(status?: string) {
  if (status === "saved") return "Revisão registrada no histórico.";
  if (status === "unchanged") return "Nenhuma alteração detectada. O histórico existente foi preservado sem criar uma versão duplicada.";
  if (status === "missing") return "Escreva uma nota antes de registrar a revisão.";
  if (status === "ai_ready") return "A Blinko AI concluiu a análise interna. Agora revise o conteúdo antes de registrar sua leitura humana.";
  if (status === "ai_failed") return "A análise da Blinko AI não foi concluída. A falha foi registrada e pode ser tentada novamente.";
  if (status === "ai_exists") return "Já existe uma análise Blinko AI pronta para este pré-diagnóstico. A versão atual foi preservada.";
  if (status === "ai_review_exists") return "Este pré-diagnóstico já possui revisão humana. A análise posterior foi bloqueada para preservar o histórico.";
  if (status === "reading_draft") return "Rascunho da leitura inicial criado. Revise e edite antes de aprovar.";
  if (status === "reading_failed") return "A Blinko AI não conseguiu gerar o rascunho da leitura inicial. Nenhuma mensagem foi enviada.";
  if (status === "reading_missing_analysis") return "A leitura inicial exige uma análise Blinko AI pronta.";
  if (status === "reading_missing_review") return "A leitura inicial exige revisão humana registrada.";
  if (status === "reading_exists") return "Já existe uma versão de leitura inicial para este pré-diagnóstico.";
  if (status === "reading_missing_body") return "O corpo da leitura inicial não pode ficar vazio.";
  if (status === "reading_not_current") return "A versão informada não é mais a leitura inicial atual.";
  if (status === "reading_not_approvable") return "Esta leitura inicial não está em estado de aprovação.";
  if (status === "reading_approved") return "Leitura inicial aprovada. Ela continua interna e não foi enviada ao cliente.";
  return null;
}

export default async function PreDiagnosticReviewPage({ params, searchParams }: Props) {
  const session = await requireInternalSession();
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  if (!uuidPattern.test(id)) notFound();

  const workspace = normalizeReviewWorkspace(await getPreDiagnosticReviewWorkspace(id));
  if (!workspace) notFound();

  const notice = statusNotice(query.status);
  const hasAnalysis = Boolean(workspace.current_analysis);
  const hasHumanReview = Boolean(workspace.current_human_review);
  const canGenerateAnalysis = !hasAnalysis && !hasHumanReview;

  const latestReading = asRecord(workspace.latest_initial_reading);
  const readingId = typeof latestReading?.id === "string" ? latestReading.id : "";
  const readingStatus = typeof latestReading?.status === "string" ? latestReading.status : "";
  const readingChannel = typeof latestReading?.channel === "string" ? latestReading.channel : "manual";
  const readingSubject = typeof latestReading?.subject === "string" ? latestReading.subject : "";
  const readingBody = typeof latestReading?.body === "string" ? latestReading.body : "";
  const canGenerateReading = hasAnalysis && hasHumanReview && !latestReading;
  const canApproveReading = Boolean(readingId && ["draft", "pending_approval"].includes(readingStatus));

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <InternalBrand />
          <nav className={styles.nav}>
            <span className={styles.link}>{session.user}</span>
            <form action="/api/interno/logout" method="post">
              <button className={styles.logout} type="submit">Sair</button>
            </form>
          </nav>
        </header>

        <div className={styles.hero} style={{ paddingBottom: 14 }}>
          <Link className={styles.back} href="/interno">← voltar para Hoje na Blinko</Link>
          {notice ? <div className={styles.notice} style={{ marginTop: 14, maxWidth: 860 }}>{notice}</div> : null}
        </div>

        <div className={styles.reviewShell}>
          <section className={styles.reviewCard} style={{ borderColor: "rgba(239,59,127,.28)", background: "rgba(239,59,127,.045)" }}>
            <span className={styles.eyebrow}>BLINKO AI · ETAPA 1</span>
            <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, fontWeight: 500, marginBottom: 8 }}>
              Análise interna do pré-diagnóstico
            </h2>
            <p style={{ opacity: .7, lineHeight: 1.55, maxWidth: 850 }}>
              Aqui a IA organiza sinais, evidências, lacunas e hipóteses de investigação. Ela não conclui causa raiz, não escolhe serviço automaticamente e não envia nada ao cliente.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <span className={styles.badge}>IA: {workspace.pre_diagnostic.ai_analysis_status || "pending"}</span>
              <span className={styles.badge}>Humano: {workspace.pre_diagnostic.human_review_status || "pending"}</span>
            </div>

            {canGenerateAnalysis ? (
              <form action={`/api/interno/pre-diagnosticos/${id}/analysis`} method="post" style={{ marginTop: 18 }}>
                <button className={styles.button} type="submit">Gerar análise Blinko AI</button>
              </form>
            ) : hasAnalysis ? (
              <div className={styles.notice} style={{ marginTop: 18, maxWidth: 850 }}>
                A análise Blinko AI já existe e está versionada. O conteúdo completo aparece mais abaixo nesta página. A próxima etapa é a revisão humana.
              </div>
            ) : (
              <div style={{ marginTop: 18, display: "grid", gap: 10, maxWidth: 850 }}>
                <button className={styles.button} type="button" disabled style={{ opacity: .45, cursor: "not-allowed", justifySelf: "start" }}>
                  Gerar análise Blinko AI
                </button>
                <div className={styles.notice}>
                  Este registro foi revisado manualmente antes da implantação da Blinko AI. Por isso a geração está bloqueada neste caso para não criar uma análise posterior à revisão e confundir o histórico. Em um novo pré-diagnóstico ainda não revisado, o botão fica ativo.
                </div>
              </div>
            )}
          </section>

          <PreDiagnosticReviewView workspace={workspace} />

          <section className={styles.reviewCard}>
            <span className={styles.eyebrow}>REVISÃO HUMANA · ETAPA 2</span>
            <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, fontWeight: 500, marginBottom: 8 }}>
              Registrar leitura humana
            </h2>
            <p style={{ opacity: .65, lineHeight: 1.5, maxWidth: 780 }}>
              Registre o que foi validado ou precisa ser investigado. Esta nota não é enviada ao cliente e não apaga a análise original da IA.
            </p>
            <form action={`/api/interno/pre-diagnosticos/${id}/review`} method="post" className={styles.form}>
              <label>
                Nota da revisão
                <textarea
                  name="notes"
                  required
                  maxLength={5000}
                  rows={8}
                  defaultValue={typeof workspace.current_human_review?.decision === "object" && workspace.current_human_review?.decision
                    ? String((workspace.current_human_review.decision as Record<string, unknown>).notes ?? "")
                    : ""}
                  style={{ border: "1px solid rgba(1,48,30,.18)", background: "rgba(255,255,255,.65)", color: "#08271b", borderRadius: 14, padding: 14, font: "inherit", resize: "vertical" }}
                />
              </label>
              <button className={styles.button} type="submit">Registrar revisão humana</button>
            </form>
          </section>

          <section className={styles.reviewCard} style={{ borderColor: "rgba(1,48,30,.2)" }}>
            <span className={styles.eyebrow}>LEITURA INICIAL · ETAPA 3</span>
            <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, fontWeight: 500, marginBottom: 8 }}>
              Preparar devolutiva curta
            </h2>
            <p style={{ opacity: .65, lineHeight: 1.5, maxWidth: 830 }}>
              Depois da análise e da revisão humana, a Blinko AI pode preparar um rascunho curto para WhatsApp, e-mail ou uso manual. Você pode editar e aprovar. Aprovar não envia.
            </p>

            {!latestReading && canGenerateReading ? (
              <form action={`/api/interno/pre-diagnosticos/${id}/initial-reading/generate`} method="post" className={styles.form} style={{ maxWidth: 520 }}>
                <label>
                  Formato do rascunho
                  <select name="channel" defaultValue="whatsapp" style={{ border: "1px solid rgba(1,48,30,.18)", background: "rgba(255,255,255,.72)", color: "#08271b", borderRadius: 14, padding: 13, font: "inherit" }}>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>
                <button className={styles.button} type="submit">Gerar rascunho da leitura inicial</button>
              </form>
            ) : null}

            {!latestReading && !canGenerateReading ? (
              <div className={styles.notice} style={{ marginTop: 18, maxWidth: 850 }}>
                {!hasAnalysis
                  ? "Esta etapa ainda não está disponível porque não existe uma análise Blinko AI versionada para este registro."
                  : "A análise já existe, mas a revisão humana precisa ser registrada antes de gerar uma devolutiva."}
              </div>
            ) : null}

            {latestReading ? (
              <div style={{ marginTop: 20, display: "grid", gap: 14 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span className={styles.badge}>Canal: {readingChannel}</span>
                  <span className={styles.badge}>Status: {readingStatus}</span>
                </div>

                {canApproveReading ? (
                  <form action={`/api/interno/pre-diagnosticos/${id}/initial-reading/approve`} method="post" className={styles.form}>
                    <input type="hidden" name="reading_id" value={readingId} />
                    <label>
                      Assunto
                      <input name="subject" maxLength={180} defaultValue={readingSubject} />
                    </label>
                    <label>
                      Texto da leitura inicial
                      <textarea
                        name="body"
                        required
                        maxLength={1800}
                        rows={10}
                        defaultValue={readingBody}
                        style={{ border: "1px solid rgba(1,48,30,.18)", background: "rgba(255,255,255,.72)", color: "#08271b", borderRadius: 14, padding: 14, font: "inherit", resize: "vertical" }}
                      />
                    </label>
                    <button className={styles.button} type="submit">Aprovar rascunho — não enviar</button>
                  </form>
                ) : (
                  <div className={styles.notice}>
                    <strong>Versão atual:</strong>
                    {readingSubject ? <p style={{ marginBottom: 8 }}>Assunto: {readingSubject}</p> : null}
                    <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{readingBody}</p>
                    <p style={{ marginBottom: 0 }}>Esta versão está {readingStatus}. Nenhum envio automático foi habilitado.</p>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
