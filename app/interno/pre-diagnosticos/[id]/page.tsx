import Link from "next/link";
import { notFound } from "next/navigation";
import PreDiagnosticReviewView from "../../../internal/PreDiagnosticReviewView";
import { requireInternalSession } from "../../../../lib/blinko/internal-auth";
import { getPreDiagnosticReviewWorkspace } from "../../../../lib/blinko/neon-server";
import { normalizeReviewWorkspace } from "../../../../lib/blinko/review-workspace";
import styles from "../../interno.module.css";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ status?: string }>;
};

function statusNotice(status?: string) {
  if (status === "saved") return "Revisão registrada no histórico.";
  if (status === "unchanged") return "Nenhuma alteração detectada. O histórico existente foi preservado sem criar uma versão duplicada.";
  if (status === "missing") return "Escreva uma nota antes de registrar a revisão.";
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

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Link href="/interno" className={styles.brand}>BLINKO OS</Link>
          <nav className={styles.nav}>
            <span className={styles.link}>{session.user}</span>
            <form action="/api/interno/logout" method="post">
              <button className={styles.logout} type="submit">Sair</button>
            </form>
          </nav>
        </header>

        <div className={styles.hero} style={{ paddingBottom: 14 }}>
          <Link className={styles.back} href="/interno">← voltar para Hoje na Blinko</Link>
          {notice ? <div className={styles.notice} style={{ marginTop: 14, maxWidth: 760 }}>{notice}</div> : null}
        </div>

        <div className={styles.reviewShell}>
          <PreDiagnosticReviewView workspace={workspace} />

          <section className={styles.reviewCard}>
            <span className={styles.eyebrow}>REVISÃO HUMANA · HISTÓRICO VERSIONADO</span>
            <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, fontWeight: 500, marginBottom: 8 }}>
              Registrar leitura humana
            </h2>
            <p style={{ opacity: .65, lineHeight: 1.5, maxWidth: 760 }}>
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
        </div>
      </div>
    </main>
  );
}
