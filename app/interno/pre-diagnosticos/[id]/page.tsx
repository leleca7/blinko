import Link from "next/link";
import { notFound } from "next/navigation";
import PreDiagnosticReviewView from "../../../internal/PreDiagnosticReviewView";
import { requireInternalSession } from "../../../../lib/blinko/internal-auth";
import { getPreDiagnosticReviewWorkspace } from "../../../../lib/blinko/neon-server";
import { normalizeReviewWorkspace } from "../../../../lib/blinko/review-workspace";
import styles from "../../interno.module.css";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ id: string }> };

export default async function PreDiagnosticReviewPage({ params }: Props) {
  const session = await requireInternalSession();
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();

  const workspace = normalizeReviewWorkspace(await getPreDiagnosticReviewWorkspace(id));
  if (!workspace) notFound();

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
        </div>

        <div className={styles.reviewShell}>
          <PreDiagnosticReviewView workspace={workspace} />
        </div>
      </div>
    </main>
  );
}
