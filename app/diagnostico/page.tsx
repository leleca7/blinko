import type { Metadata } from "next";
import Link from "next/link";
import PreDiagnosticForm from "./PreDiagnosticForm";
import styles from "./diagnostico.module.css";

export const metadata: Metadata = {
  title: "Pré-Diagnóstico | Blinko",
  description: "Mostre o que está acontecendo na sua empresa. A Blinko organiza os sinais e prepara a próxima conversa.",
};

export default function DiagnosticoPage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="Voltar para Blinko">
          <img
            src="/brand/logo-blinko-color.png"
            alt="Blinko"
            width={400}
            height={199}
            style={{ display: "block", width: 122, maxWidth: "36vw", height: "auto" }}
          />
        </Link>
        <Link href="/" className={styles.back}>← voltar ao site</Link>
      </header>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>PRÉ-DIAGNÓSTICO BLINKO · TRIAGEM INICIAL</p>
        <h1>Você não precisa saber <em>qual serviço contratar.</em></h1>
        <p className={styles.lede}>
          Mostre onde a empresa quer chegar e o que está acontecendo hoje. Vamos organizar os sinais para entender se existe algo que vale aprofundar.
        </p>
        <div className={styles.notice}>
          <strong>Importante.</strong> Esta etapa não é o Diagnóstico Blinko profundo e não gera uma conclusão automática. A tecnologia organiza os sinais internamente, e a equipe Blinko revisa antes de qualquer leitura personalizada enviada por WhatsApp ou e-mail.
        </div>
      </section>

      <PreDiagnosticForm />
    </main>
  );
}
