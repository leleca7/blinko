import type { Metadata } from "next";
import Link from "next/link";
import QuickTriageForm from "./QuickTriageForm";
import styles from "./diagnostico.module.css";

export const metadata: Metadata = {
  title: "Converse com a Blinko | Triagem rápida",
  description: "Em poucos passos, conte à Blinko o que sua empresa precisa. Um primeiro contato simples, sem diagnóstico longo.",
};

export default function DiagnosticoPage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="Voltar para Blinko">
          <img src="/brand/logo-blinko-color.png" alt="Blinko Studio" width={400} height={199}
            style={{ display: "block", width: 122, maxWidth: "36vw", height: "auto" }} />
        </Link>
        <Link href="/" className={styles.back}>← voltar ao site</Link>
      </header>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>BLINKO · PRIMEIRO CONTATO</p>
        <h1>Vamos entender <em>por onde começar.</em></h1>
        <p className={styles.lede}>Não precisa preencher um diagnóstico longo agora. Deixe seu contato e conte brevemente o que trouxe você até aqui.</p>
        <div className={styles.notice}>
          <strong>Uma conversa, não um laudo.</strong> A triagem rápida não confirma causas nem gera um diagnóstico automático. Caso faça sentido, convidaremos você para uma investigação mais completa.
        </div>
      </section>
      <QuickTriageForm />
    </main>
  );
}
