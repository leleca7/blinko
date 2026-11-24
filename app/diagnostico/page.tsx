import type { Metadata } from "next";
import Link from "next/link";
import QuickTriageForm from "./QuickTriageForm";
import styles from "./diagnostico.module.css";

export const metadata: Metadata = {
  title: "Inicie seu Diagnóstico | Blinko Studio",
  description: "Comece com uma triagem inicial gratuita. Entenda como funciona a contratação do Diagnóstico Blinko, nosso serviço principal.",
};

export default function DiagnosticoPage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="Voltar para Blinko">
          <img src="/brand/logo-fundo-claro.svg" alt="Blinko Studio" width={720} height={423}
            style={{ display: "block", width: 175, maxWidth: "36vw", height: "auto" }} />
        </Link>
        <Link href="/" className={styles.back}>← voltar ao site</Link>
      </header>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>BLINKO · PRIMEIRO CONTATO</p>
        <h1>Vamos entender <em>por onde começar.</em></h1>
        <p className={styles.lede}>Esta é só uma triagem gratuita para começarmos a conversa. Conte brevemente sua situação e conheça o Diagnóstico Blinko.</p>
        <div className={styles.notice}>
          <strong>Uma conversa, não um laudo.</strong> A triagem não identifica causas nem substitui o Diagnóstico Blinko. O diagnóstico é nosso serviço principal e contratado. Soluções e execução só são propostas após essa etapa.
        </div>
      </section>
      <QuickTriageForm />
    </main>
  );
}
