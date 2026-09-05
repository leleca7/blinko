import Link from "next/link";
import GraphicRequestForm from "./GraphicRequestForm";
import styles from "./solucoes-graficas.module.css";

export const metadata = {
  title: "Soluções gráficas · Blinko",
  description: "Solicite uma cotação de produção gráfica com briefing organizado pela Blinko.",
};

export default function GraphicSolutionsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/">BLINKO</Link>
        <span>SOLUÇÕES GRÁFICAS</span>
        <Link href="/">Voltar ao site ↗</Link>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>PRODUÇÃO · PERSONALIZAÇÃO · CRIAÇÃO QUANDO NECESSÁRIO</span>
        <h1>Conte o que você precisa. A gente organiza o resto.</h1>
        <p>
          Em vez de trocar várias mensagens para descobrir quantidade, medida, arte e entrega, você já deixa o pedido estruturado para uma cotação mais objetiva.
        </p>
        <div className={styles.heroMeta}>
          <div><strong>01</strong><span>Você descreve</span></div>
          <div><strong>02</strong><span>A Blinko confere</span></div>
          <div><strong>03</strong><span>Você recebe a cotação</span></div>
        </div>
      </section>

      <GraphicRequestForm />

      <footer className={styles.footer}>
        <strong>BLINKO</strong>
        <p>Comunicação e soluções aplicadas ao problema real da empresa.</p>
      </footer>
    </main>
  );
}
