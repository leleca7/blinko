import type { Metadata } from "next";
import Link from "next/link";
import { BLINKO_LOGO_DARK_DATA_URI } from "../../lib/blinko/brand-logo-data";
import styles from "./bio.module.css";

export const metadata: Metadata = {
  title: "Blinko | Diagnóstico + Execução",
  description: "Pré-diagnóstico gratuito para organizar sinais da empresa, entender o contexto e avaliar o próximo passo com a Blinko.",
};

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
  "presença digital e aquisição",
  "treinamento e documentação",
];

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
        <h1>Você não precisa chegar sabendo <em>qual solução contratar.</em></h1>
        <p>
          A Blinko começa pelos sinais, organiza o contexto e investiga o que pode estar impedindo a evolução da empresa.
          Quando existe base suficiente, aprofunda a validação, define prioridades e executa o que realmente fizer sentido.
        </p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/diagnostico">Fazer pré-diagnóstico gratuito</Link>
          <a className={styles.secondary} href="#como-funciona">Entender o processo ↓</a>
        </div>
        <small>O pré-diagnóstico é uma triagem inicial gratuita. O Diagnóstico Blinko profundo é uma etapa separada e paga.</small>
      </section>

      <section className={styles.statement}>
        <span>BLINKO HOJE</span>
        <h2>Inovação aplicada ao <em>problema real da empresa.</em></h2>
        <p>
          Marketing, comunicação, design, tecnologia, processos, gestão e automação continuam fazendo parte da Blinko.
          A diferença é que entram como ferramentas de intervenção. Não são respostas prontas antes de entender o problema.
        </p>
      </section>

      <section className={styles.process} id="como-funciona">
        <div className={styles.sectionIntro}>
          <span>COMO COMEÇA</span>
          <h2>Investigar antes de prescrever.</h2>
          <p>O processo separa sinal, hipótese e causa validada para que a solução não seja escolhida cedo demais.</p>
        </div>
        <ol className={styles.steps}>
          <li><b>01</b><div><strong>Pré-diagnóstico gratuito</strong><p>Você mostra objetivo, contexto, sinais percebidos e o que está acontecendo hoje.</p></div></li>
          <li><b>02</b><div><strong>Leitura interna + revisão humana</strong><p>A Blinko organiza sinais, lacunas e hipóteses sem transformar hipótese em conclusão.</p></div></li>
          <li><b>03</b><div><strong>Conversa</strong><p>Validamos contexto, fazemos as perguntas que faltam e avaliamos se existe um problema que vale aprofundar.</p></div></li>
          <li><b>04</b><div><strong>Diagnóstico Blinko</strong><p>Etapa profunda e paga para investigar evidências, validar causas, definir prioridades, riscos e indicadores relevantes.</p></div></li>
          <li><b>05</b><div><strong>Execução + acompanhamento</strong><p>A partir do que foi validado, a Blinko seleciona, adapta ou constrói intervenções e acompanha o resultado.</p></div></li>
        </ol>
      </section>

      <section className={styles.pillars}>
        <div className={styles.sectionIntro}>
          <span>LEITURA 360</span>
          <h2>Sete áreas. Uma empresa.</h2>
          <p>
            Um sinal pode aparecer em uma área e ter origem em outra. Por isso a leitura é conectada.
            Em todas elas, também observamos confiança, reputação, relação com os públicos e coerência entre discurso e prática.
          </p>
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
          <h2>A biblioteca não é o produto.</h2>
          <p>
            A Blinko diagnostica o problema e escolhe na biblioteca o que faz sentido usar, adaptar ou construir.
            Uma intervenção pode combinar várias competências e só entra quando houver motivo claro para existir.
          </p>
        </div>
        <div className={styles.chips} aria-label="Exemplos de intervenções possíveis">
          {interventions.map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>

      <section className={styles.fit}>
        <div>
          <span>FAZ SENTIDO PARA QUEM</span>
          <h2>Tem um problema relevante ou uma oportunidade que merece investigação e execução.</h2>
        </div>
        <div className={styles.fitList}>
          <p>Existem sinais, gargalos, riscos ou oportunidades que precisam ser entendidos.</p>
          <p>Há abertura para rever processos, prioridades, comunicação ou ferramentas.</p>
          <p>Existe disposição para implementar mudanças quando elas forem justificadas.</p>
          <p>A empresa quer acompanhar resultado e ajustar o caminho com evidência.</p>
        </div>
      </section>

      <section className={styles.diagnosis}>
        <span>DIAGNÓSTICO BLINKO</span>
        <h2>Mais do que um relatório: uma base para decidir o que mexer primeiro.</h2>
        <p>
          O diagnóstico profundo reúne evidências, hipóteses testadas, causas validadas quando houver base para isso,
          prioridades, riscos, indicadores e caminhos de intervenção. Ele pode existir sozinho ou servir de base para a execução com a Blinko.
        </p>
      </section>

      <section className={styles.finalCta}>
        <span>COMECE PELO PONTO CERTO</span>
        <h2>Conte o que está acontecendo. A Blinko começa pelos sinais.</h2>
        <Link className={styles.primary} href="/diagnostico">Fazer pré-diagnóstico gratuito</Link>
        <a className={styles.instagram} href="https://www.instagram.com/blinko_studio/" target="_blank" rel="noreferrer">Instagram @blinko_studio ↗</a>
      </section>
    </main>
  );
}
