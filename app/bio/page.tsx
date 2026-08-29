import type { Metadata } from "next";
import Link from "next/link";
import { BLINKO_LOGO_DARK_DATA_URI } from "../../lib/blinko/brand-logo-data";
import styles from "./bio.module.css";

export const metadata: Metadata = {
  title: "Blinko | Comece pelos sinais",
  description: "A Blinko investiga sinais da empresa, valida prioridades e executa intervenções quando existe motivo claro para agir.",
};

const pillars = ["Marca", "Digital", "Financeiro", "Operação", "Atendimento", "Gestão", "Equipe"];
const flow = ["SINAL", "HIPÓTESE", "VALIDAÇÃO", "PRIORIDADE", "INTERVENÇÃO"];

export default function BioPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="Blinko, início">
          <img src={BLINKO_LOGO_DARK_DATA_URI} alt="Blinko" />
        </Link>
        <Link className={styles.headerCta} href="/diagnostico">Pré-diagnóstico</Link>
      </header>

      <section className={styles.hero}>
        <span className={styles.kicker}>DIAGNÓSTICO + EXECUÇÃO + ACOMPANHAMENTO</span>
        <h1>Se algo trava a empresa, <em>começar pela solução pode ser cedo demais.</em></h1>
        <p>A Blinko investiga o que está acontecendo, valida o que merece prioridade e executa o que realmente fizer sentido.</p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/diagnostico">Fazer pré-diagnóstico gratuito</Link>
          <a className={styles.secondary} href="#movimentos">ver como funciona ↓</a>
        </div>
        <small>Você não precisa chegar sabendo qual serviço contratar.</small>
      </section>

      <section className={styles.moves} id="movimentos">
        <div className={styles.sectionHead}>
          <span>O QUE A BLINKO FAZ</span>
          <h2>Três movimentos. <em>Na ordem certa.</em></h2>
        </div>
        <div className={styles.moveGrid}>
          <article><span>01</span><strong>INVESTIGA</strong><p>Separa o que apareceu do que ainda precisa ser provado.</p></article>
          <article><span>02</span><strong>PRIORIZA</strong><p>Transforma evidência em uma decisão clara sobre onde mexer.</p></article>
          <article><span>03</span><strong>EXECUTA</strong><p>Implanta a intervenção e acompanha o que acontece depois.</p></article>
        </div>
      </section>

      <section className={styles.method}>
        <span>O MÉTODO</span>
        <div className={styles.flow}>
          {flow.map((item, index) => (
            <div key={item}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <strong>{item}</strong>
              {index < flow.length - 1 ? <i>→</i> : null}
            </div>
          ))}
        </div>
        <Link href="/diagnostico-blinko">Entender o Diagnóstico Blinko →</Link>
      </section>

      <section className={styles.pillars}>
        <div className={styles.sectionHead}>
          <span>UMA EMPRESA É UM SISTEMA</span>
          <h2>Sete áreas. <em>Uma leitura conectada.</em></h2>
          <p>O problema pode aparecer em uma área e começar em outra.</p>
        </div>
        <div className={styles.pillarGrid}>
          {pillars.map((pillar, index) => (
            <article key={pillar}><span>{String(index + 1).padStart(2, "0")}</span><strong>{pillar}</strong></article>
          ))}
        </div>
      </section>

      <section className={styles.lens}>
        <span>A LENTE</span>
        <h2>Relações Públicas ajudam a enxergar a organização inteira. <em>Tecnologia, comunicação e operação entram como intervenção.</em></h2>
        <p>Confiança, reputação, públicos, experiência e coerência entre o que a empresa promete e o que entrega fazem parte da leitura.</p>
        <Link href="/">Explorar o site completo →</Link>
      </section>

      <section className={styles.finalCta}>
        <span>COMECE PELO SINAL</span>
        <h2>O que está acontecendo na sua empresa?</h2>
        <p>Conte o contexto. A primeira triagem é gratuita.</p>
        <Link className={styles.primary} href="/diagnostico">Fazer pré-diagnóstico gratuito</Link>
      </section>
    </main>
  );
}
