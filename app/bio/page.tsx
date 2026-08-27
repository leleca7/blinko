import Link from "next/link";
import { BLINKO_LOGO_DARK_DATA_URI } from "../../lib/blinko/brand-logo-data";
import styles from "./bio.module.css";

const pillars = ["Marca", "Digital", "Financeiro", "Operação", "Atendimento", "Gestão", "Equipe"];
const interventions = [
  "site e landing page",
  "sistema interno",
  "automação e IA",
  "CRM e funil comercial",
  "dashboard e indicadores",
  "atendimento e experiência",
  "processos e operação",
  "marca e comunicação",
  "marketing e presença local",
  "treinamento e documentação",
];

export default function BioPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="Blinko, início">
          <img src={BLINKO_LOGO_DARK_DATA_URI} alt="Blinko" />
        </Link>
        <a className={styles.headerCta} href="/diagnostico">Pré-diagnóstico</a>
      </header>

      <section className={styles.hero}>
        <span className={styles.kicker}>DIAGNÓSTICO · EXECUÇÃO · ACOMPANHAMENTO</span>
        <h1>Você não precisa chegar sabendo <em>qual serviço contratar.</em></h1>
        <p>
          A Blinko entende a realidade da empresa, identifica o que está travando a evolução,
          define prioridades e implanta o que realmente precisa ser feito.
        </p>
        <div className={styles.actions}>
          <a className={styles.primary} href="/diagnostico">Fazer pré-diagnóstico gratuito</a>
          <a className={styles.secondary} href="#como-funciona">Entender o processo ↓</a>
        </div>
        <small>Triagem inicial gratuita. O Diagnóstico Blinko profundo é uma etapa separada.</small>
      </section>

      <section className={styles.statement}>
        <span>BLINKO HOJE</span>
        <h2>Inovação aplicada ao <em>problema real da empresa.</em></h2>
        <p>
          A antiga Blinko Studio começou pela comunicação e pelo design. Essas competências continuam,
          mas hoje entram como ferramentas dentro de uma leitura muito maior da empresa.
        </p>
      </section>

      <section className={styles.process} id="como-funciona">
        <div className={styles.sectionIntro}>
          <span>COMO COMEÇA</span>
          <h2>Diagnóstico antes de solução.</h2>
          <p>O caminho comercial da Blinko foi desenhado para evitar proposta pronta e serviço empurrado.</p>
        </div>
        <ol className={styles.steps}>
          <li><b>01</b><div><strong>Pré-diagnóstico gratuito</strong><p>Você mostra objetivo, sinais, bloqueios e contexto da empresa.</p></div></li>
          <li><b>02</b><div><strong>Leitura interna</strong><p>A Blinko organiza os sinais com tecnologia e revisão humana.</p></div></li>
          <li><b>03</b><div><strong>Conversa simples</strong><p>Se houver encaixe, aprofundamos as perguntas certas sem transformar a triagem em consultoria gratuita.</p></div></li>
          <li><b>04</b><div><strong>Diagnóstico Blinko</strong><p>Etapa profunda e paga para validar causas, prioridades, indicadores e ordem de intervenção.</p></div></li>
          <li><b>05</b><div><strong>Execução + acompanhamento</strong><p>A partir do diagnóstico, a Blinko constrói, organiza, implanta e acompanha o que fizer sentido.</p></div></li>
        </ol>
      </section>

      <section className={styles.pillars}>
        <div className={styles.sectionIntro}>
          <span>LEITURA 360</span>
          <h2>Sete áreas. Uma empresa.</h2>
          <p>O problema pode aparecer em uma ponta e nascer em outra. Por isso a leitura precisa ser conectada.</p>
        </div>
        <div className={styles.pillarGrid}>
          {pillars.map((pillar, index) => (
            <article key={pillar}><span>{String(index + 1).padStart(2, "0")}</span><strong>{pillar}</strong></article>
          ))}
        </div>
      </section>

      <section className={styles.library}>
        <div className={styles.sectionIntro}>
          <span>DEPOIS DO DIAGNÓSTICO</span>
          <h2>Não existe um catálogo fixo de pacotes.</h2>
          <p>
            A Blinko diagnostica o problema e escolhe na biblioteca o que faz sentido usar, adaptar ou construir.
            Uma intervenção pode combinar várias competências.
          </p>
        </div>
        <div className={styles.chips}>
          {interventions.map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>

      <section className={styles.fit}>
        <div>
          <span>FAZ SENTIDO PARA QUEM</span>
          <h2>Tem um problema relevante e quer implementar mudança de verdade.</h2>
        </div>
        <div className={styles.fitList}>
          <p>Existe um gargalo, risco ou oportunidade real.</p>
          <p>Há abertura para rever processos, prioridades ou ferramentas.</p>
          <p>A empresa consegue investir quando percebe valor.</p>
          <p>Existe disposição para implementar, medir e ajustar.</p>
        </div>
      </section>

      <section className={styles.diagnosis}>
        <span>DIAGNÓSTICO BLINKO</span>
        <h2>O produto não é um PDF. É clareza para decidir o que mexer primeiro.</h2>
        <p>
          O diagnóstico profundo organiza evidências, causas validadas, prioridades, indicadores,
          riscos e um plano de intervenção. Ele pode existir sozinho ou virar a base da execução com a Blinko.
        </p>
      </section>

      <section className={styles.finalCta}>
        <span>COMECE PELO PONTO CERTO</span>
        <h2>Você mostra o que está acontecendo. A Blinko procura o que está causando.</h2>
        <a className={styles.primary} href="/diagnostico">Fazer pré-diagnóstico gratuito</a>
        <a className={styles.instagram} href="https://www.instagram.com/blinko_studio/" target="_blank" rel="noreferrer">Instagram @blinko_studio ↗</a>
      </section>
    </main>
  );
}
