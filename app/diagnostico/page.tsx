import type { Metadata } from "next";
import Link from "next/link";
import { BLINKO_LOGO_DARK_DATA_URI } from "../../lib/blinko/brand-logo-data";
import PreDiagnosticForm from "./PreDiagnosticForm";
import styles from "./diagnostico.module.css";

export const metadata: Metadata = {
  title: "Pré-Diagnóstico | Blinko",
  description: "Mostre o que está acontecendo na sua empresa. A Blinko organiza os sinais e prepara a próxima conversa.",
};

export default function DiagnosticoPage() {
  return (
    <main className={styles.page}>
      <header
        className={styles.topbar}
        style={{
          position: "sticky",
          top: 18,
          zIndex: 30,
          maxWidth: 1180,
          margin: "0 auto",
          padding: "10px 14px 10px 18px",
          border: "1px solid rgba(255,255,255,.26)",
          borderRadius: 999,
          background: "rgba(1,48,30,.78)",
          color: "#f3efeb",
          backdropFilter: "blur(18px) saturate(120%)",
          WebkitBackdropFilter: "blur(18px) saturate(120%)",
          boxShadow: "0 18px 48px rgba(1,48,30,.16)",
        }}
      >
        <Link href="/" className={styles.brand} aria-label="Voltar para Blinko">
          <img
            src={BLINKO_LOGO_DARK_DATA_URI}
            alt="Blinko"
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
        <p style={{ marginTop: 16, display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
          <Link href="/diagnostico-blinko">Entender o Diagnóstico Blinko →</Link>
          <Link href="/privacidade">Como tratamos as informações enviadas →</Link>
        </p>
      </section>

      <PreDiagnosticForm />
    </main>
  );
}
