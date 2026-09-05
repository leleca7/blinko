import Link from "next/link";
import GraphicRequestForm from "./GraphicRequestForm";
import styles from "./solucoes-graficas.module.css";

export const metadata = {
  title: "Soluções gráficas · Blinko",
  description: "Configure seu material, visualize o pedido e solicite uma cotação de produção gráfica com a Blinko.",
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
        <span className={styles.eyebrow}>CONFIGURE · VISUALIZE · ENVIE PARA COTAÇÃO</span>
        <h1>Seu material começa a tomar forma enquanto você responde.</h1>
        <p>
          Em vez de preencher um formulário técnico e torcer para ter explicado direito, você monta o pedido de forma guiada e acompanha uma prévia conceitual do produto.
        </p>
        <div className={styles.heroMeta}>
          <div><strong>01</strong><span>Você escolhe</span></div>
          <div><strong>02</strong><span>A prévia reage</span></div>
          <div><strong>03</strong><span>A Blinko transforma em cotação</span></div>
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
