import type { Metadata } from "next";
import Link from "next/link";
import ComprehensiveDiagnosticForm from "./ComprehensiveDiagnosticForm";
import styles from "../diagnostico.module.css";

export const metadata: Metadata = {
  title: "Diagnóstico aprofundado | Blinko Studio",
  description: "Questionário de aprofundamento da Blinko para quem já conversou com nossa equipe e vai participar da etapa detalhada.",
  robots: { index: false, follow: false },
};

export default function FullDiagnosticPage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="Voltar ao início da Blinko">
          <img src="/brand/logo-blinko-color.png" alt="Blinko" width={400} height={199} style={{ display:"block",width:122,maxWidth:"36vw",height:"auto" }} />
        </Link>
        <Link href="/diagnostico" className={styles.back}>← voltar à triagem</Link>
      </header>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>ETAPA 2 · QUESTIONÁRIO DE APROFUNDAMENTO</p>
        <h1>Agora podemos <em>ir mais fundo.</em></h1>
        <p className={styles.lede}>Este questionário é mais completo e deve ser enviado pela equipe após o primeiro contato, quando fizer sentido investigar o negócio com mais profundidade.</p>
        <div className={styles.notice}><strong>Uma etapa diferente da triagem rápida.</strong> As respostas ainda não constituem um diagnóstico ou conclusão automática. A Blinko revisará os dados antes de propor qualquer aprofundamento contratado.</div>
      </section>
      <ComprehensiveDiagnosticForm />
    </main>
  );
}
