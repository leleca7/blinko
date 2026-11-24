import type { Metadata } from "next";
import Link from "next/link";
import styles from "./diagnostico.module.css";

export const metadata: Metadata = {
  title: "Triagem Blinko — demonstração",
  description: "Conheça o primeiro contato da Blinko. A triagem estará disponível depois dos testes de privacidade e segurança.",
  robots: { index: false, follow: false },
};

export default function DiagnosticoPage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="Voltar à Blinko">
          <img src="/brand/logo-fundo-claro.svg" alt="Blinko Studio" width={720} height={423}
            style={{ display: "block", width: 175, maxWidth: "42vw", height: "auto" }} />
        </Link>
        <Link href="/" className={styles.back}>← voltar ao site</Link>
      </header>
      <section className={styles.intro} style={{ minHeight: "65vh" }}>
        <p className={styles.eyebrow}>BLINKO · APRESENTAÇÃO DO SITE</p>
        <h1>Primeiro, <em>entender.</em></h1>
        <p className={styles.lede}>A triagem gratuita é uma conversa breve para conhecer sua empresa e explicar como funciona a contratação do Diagnóstico Blinko.</p>
        <div className={styles.notice}>
          <strong>Estamos preparando este atendimento.</strong>
          {" "}Nesta demonstração o formulário está desativado. Não envie dados pessoais. A coleta será disponibilizada depois de concluirmos os testes de segurança e privacidade.
        </div>
        <p><Link href="/" className={styles.back}>← Conhecer a Blinko</Link></p>
      </section>
    </main>
  );
}
