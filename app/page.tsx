"use client";

import { useEffect } from "react";
import { BLINKO_LOGO_DARK_DATA_URI } from "../lib/blinko/brand-logo-data";
import { BLINKO_FLOWER_DATA_URI } from "../lib/blinko/brand-flower-data";
import styles from "./home-v2.module.css";

const pillars = ["Marca", "Digital", "Financeiro", "Operação", "Atendimento", "Gestão", "Equipe"];

const interventionExamples = [
  [
    "01",
    "Captação + atendimento",
    "Quando o ponto validado está entre aquisição e resposta",
    "Landing page, formulário, CRM e automação podem trabalhar juntos quando forem a intervenção certa.",
  ],
  [
    "02",
    "Operação + automação",
    "Quando retrabalho e informação espalhada sustentam perdas",
    "Processos, integrações, sistemas e IA podem reduzir atrito com controle humano.",
  ],
  [
    "03",
    "Marca + comunicação",
    "Quando promessa, percepção e entrega não estão coerentes",
    "Posicionamento, identidade, site e comunicação podem ser ajustados a partir do que foi validado.",
  ],
  [
    "04",
    "Gestão + indicadores",
    "Quando falta clareza para decidir e acompanhar",
    "Rotinas, responsabilidades, dashboards e indicadores podem transformar prioridade em acompanhamento.",
  ],
];

const journey = [
  ["01", "Pré-diagnóstico gratuito", "Você mostra objetivo, contexto e os sinais que percebe hoje."],
  ["02", "Leitura interna", "A tecnologia ajuda a organizar informações, mas a leitura passa por revisão humana."],
  ["03", "Conversa", "Completamos o contexto e avaliamos se existe algo que realmente vale aprofundar."],
  ["04", "Diagnóstico Blinko", "A etapa profunda investiga evidências, valida causas quando houver base e define prioridades."],
  ["05", "Execução + acompanhamento", "A intervenção é implantada com motivo claro e acompanhada para entender o que mudou."],
];

const fitSignals = [
  "A empresa cresceu e a operação ficou mais difícil de enxergar.",
  "Existem perdas, retrabalho ou gargalos, mas a causa ainda não está clara.",
  "Marketing, atendimento, gestão ou tecnologia parecem desconectados.",
  "Há uma oportunidade relevante, mas falta clareza sobre o que priorizar primeiro.",
];

const faq = [
  ["O pré-diagnóstico é gratuito?", "Sim. Ele é uma triagem inicial para organizar contexto e sinais. Não confirma causas e não substitui o Diagnóstico Blinko profundo."],
  ["O Diagnóstico Blinko é pago?", "Sim. O diagnóstico profundo é uma etapa separada, feita quando existe motivo para investigar com mais profundidade."],
  ["A Blinko também executa as soluções?", "Pode executar. Depois da validação, a Blinko pode selecionar, adaptar ou construir a intervenção necessária e acompanhar sua implantação."],
  ["Preciso contratar a execução depois do diagnóstico?", "Não. O diagnóstico pode ser contratado como uma etapa própria. A decisão sobre execução acontece depois, com escopo e prioridades claros."],
  ["A análise é feita só por inteligência artificial?", "Não. IA pode apoiar organização e análise interna, mas leituras, conclusões, prioridades e comunicações relevantes passam por revisão humana."],
  ["Vocês trabalham com qualquer segmento?", "A Blinko pode avaliar empresas de diferentes segmentos. O pré-diagnóstico ajuda a entender se o contexto tem aderência ao método antes de aprofundar."],
];

export default function Home() {
  useEffect(() => {
    const root = document.documentElement;
    const rootStory = document.querySelector<HTMLElement>(".root-story");
    let frame = 0;

    const updatePointer = (event: PointerEvent) => {
      root.style.setProperty("--mouse-x", `${event.clientX}px`);
      root.style.setProperty("--mouse-y", `${event.clientY}px`);
      root.style.setProperty("--mx", String(event.clientX / window.innerWidth - 0.5));
      root.style.setProperty("--my", String(event.clientY / window.innerHeight - 0.5));
      root.dataset.pointer = "active";
    };

    const updateScroll = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      root.style.setProperty("--scroll", String(max > 0 ? window.scrollY / max : 0));

      if (!rootStory) return;

      const rect = rootStory.getBoundingClientRect();
      const travel = Math.max(rootStory.offsetHeight - window.innerHeight, 1);
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      const scene = progress < 0.3 ? "surface" : progress < 0.64 ? "layers" : "root";

      rootStory.style.setProperty("--root-progress", String(progress));
      if (rootStory.dataset.scene !== scene) {
        rootStory.dataset.scene = scene;
      }
    };

    const scheduleScrollUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateScroll);
    };

    window.addEventListener("pointermove", updatePointer, { passive: true });
    window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
    window.addEventListener("resize", scheduleScrollUpdate, { passive: true });
    updateScroll();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("scroll", scheduleScrollUpdate);
      window.removeEventListener("resize", scheduleScrollUpdate);
      delete root.dataset.pointer;
    };
  }, []);

  return (
    <main>
      <div className="cursor-glow" aria-hidden="true" />
      <div className="progress" aria-hidden="true" />

      <header
        className="topbar"
        style={{
          background: "rgba(1,48,30,.56)",
          border: "1px solid rgba(255,255,255,.2)",
          backdropFilter: "blur(18px) saturate(120%)",
          WebkitBackdropFilter: "blur(18px) saturate(120%)",
          boxShadow: "0 20px 50px rgba(0,0,0,.12)",
        }}
      >
        <a href="#top" aria-label="Blinko, início" className="logo-wrap">
          <img src={BLINKO_LOGO_DARK_DATA_URI} alt="Blinko" />
        </a>
        <nav aria-label="Navegação principal">
          <a href="#como">Como funciona</a>
          <a href="#para-quem">Para quem</a>
          <a href="#analise">Análise</a>
          <a href="#faq">FAQ</a>
          <a className="nav-cta" href="/diagnostico">Pré-diagnóstico</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-content">
          <p className="eyebrow">PRÉ-DIAGNÓSTICO · INVESTIGAÇÃO · EXECUÇÃO · ACOMPANHAMENTO</p>
          <h1>O sinal <em>nem sempre</em> revela a causa.</h1>
          <p className="hero-lede">
            A Blinko organiza o que está acontecendo, investiga hipóteses e só transforma uma causa em prioridade quando existe base para validá-la. Depois, executa e acompanha as intervenções necessárias.
          </p>
          <div className="actions">
            <a className="button light" href="/diagnostico">Fazer pré-diagnóstico gratuito</a>
            <a className="text-link" href="#como">entender o método ↓</a>
          </div>
        </div>
        <span className="side-note">ROLE PARA ENTRAR NA EMPRESA</span>
      </section>

      <section
        className="enter"
        id="como"
        style={{ gridTemplateColumns: "1fr", minHeight: "100vh" }}
      >
        <div className="enter-copy" style={{ maxWidth: "920px" }}>
          <span className="section-id">01 / ANTES DE PROPOR, INVESTIGAMOS.</span>
          <h2>Você mostra o que está acontecendo. <em>A Blinko organiza os sinais e investiga o que ainda precisa ser validado.</em></h2>
          <p>Não começamos escolhendo um serviço. Começamos entendendo a empresa, o contexto e quais hipóteses merecem investigação antes de definir uma prioridade.</p>
        </div>
        <span className="giant-word">INVESTIGAR</span>
      </section>

      <section className={styles.fit} id="para-quem">
        <div className={styles.fitIntro}>
          <span>02 / PARA QUEM FAZ SENTIDO</span>
          <h2>Quando a empresa sente o problema, mas ainda não enxerga com segurança <em>onde mexer primeiro.</em></h2>
          <p>A Blinko é mais útil quando existe abertura para investigar antes de defender uma solução pronta.</p>
        </div>
        <div className={styles.fitGrid}>
          <article>
            <span>FAZ SENTIDO QUANDO</span>
            {fitSignals.map((item) => <p key={item}>{item}</p>)}
          </article>
          <article className={styles.fitNegative}>
            <span>NÃO É A MELHOR PORTA QUANDO</span>
            <p>A única expectativa é contratar uma entrega fechada sem discutir contexto ou prioridade.</p>
            <p>A empresa procura uma resposta automática que substitua análise, decisão ou responsabilidade humana.</p>
            <p>Não existe disponibilidade para fornecer informações mínimas ou participar da validação.</p>
          </article>
        </div>
      </section>

      <section className="root-story" aria-label="Do sinal até a validação">
        <div className="root-sticky">
          <div className="root-organic" aria-hidden="true">
            <div className="root-orbit root-orbit-a" />
            <div className="root-orbit root-orbit-b" />
            <div className="root-shape root-shape-a" />
            <div className="root-shape root-shape-b" />
            <div className="root-shape root-shape-c" />
            <div className="root-core">
              <span>VALIDAR</span>
              <small>quando a hipótese ganha evidência</small>
            </div>
            <span className="root-caption">sinal → hipótese → validação</span>
          </div>

          <div className="root-scenes">
            <article className="scene s1">
              <span>SINAL</span>
              <h3>“Precisamos postar mais.”</h3>
              <p>Pode ser uma necessidade. Mas primeiro precisamos entender por que esse sinal apareceu e o que ele realmente representa.</p>
            </article>
            <article className="scene s2">
              <span>HIPÓTESES</span>
              <h3>Comunicação. Atendimento. Operação.</h3>
              <p>A leitura muda quando as áreas deixam de ser vistas isoladamente e as hipóteses são confrontadas com contexto.</p>
            </article>
            <article className="scene s3">
              <span>VALIDAÇÃO</span>
              <h3>Quando a evidência sustenta uma causa, ela pode virar prioridade.</h3>
              <p>É só então que escolhemos a intervenção e a ordem certa de execução.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="editorial">
        <div className="editorial-photo"><img src="/photos/notebook-2.webp" alt="Profissional trabalhando em notebook em ambiente Blinko" /></div>
        <div className="editorial-copy">
          <span className="section-id">03 / MÉTODO BLINKO</span>
          <p className="big-quote">“Você não precisa chegar sabendo qual solução contratar.”</p>
          <p className="body-copy">Pré-diagnóstico antes de prescrição. Evidência antes de conclusão. Prioridade antes de volume. Execução com motivo e acompanhamento do que aconteceu depois.</p>
          <div className="method-mini">
            {[["01","Entender"],["02","Investigar"],["03","Validar"],["04","Implantar"],["05","Acompanhar"]].map(([n,t]) => <div key={n}><span>{n}</span><strong>{t}</strong></div>)}
          </div>
        </div>
      </section>

      <section className={styles.journey}>
        <div className={styles.journeyHead}>
          <span>04 / O QUE ACONTECE DEPOIS</span>
          <h2>Do primeiro sinal até uma intervenção que tenha <em>motivo para existir.</em></h2>
          <p>O pré-diagnóstico não abre uma esteira automática de venda. Cada etapa existe para reduzir suposição antes da próxima decisão.</p>
        </div>
        <div className={styles.journeyList}>
          {journey.map(([number, title, description]) => (
            <article key={number}>
              <span>{number}</span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </article>
          ))}
        </div>
        <a className={styles.inlineLink} href="/diagnostico-blinko">Entender o Diagnóstico Blinko em profundidade →</a>
      </section>

      <section className="pillars" id="analise">
        <div className="pillars-head">
          <span className="section-id">05 / UMA EMPRESA É UM SISTEMA VIVO</span>
          <h2>Sete áreas. <em>Uma leitura conectada.</em></h2>
          <p>
            Um sinal pode aparecer em uma ponta e ter origem em outra. Por isso analisamos Marca, Digital, Financeiro, Operação, Atendimento, Gestão e Equipe de forma conectada. Também observamos confiança, reputação, relação com os públicos e coerência entre discurso e prática.
          </p>
        </div>
        <div className="pillar-list">
          {pillars.map((p, i) => <div className="pillar" key={p}><span>{String(i + 1).padStart(2,"0")}</span><strong>{p}</strong><i /></div>)}
        </div>
      </section>

      <section className="cases" id="cases">
        <div className="cases-title">
          <span className="section-id">06 / EXEMPLOS DE INTERVENÇÃO</span>
          <h2>Problemas diferentes pedem <em>combinações diferentes.</em></h2>
          <p>São exemplos do que a biblioteca da Blinko pode combinar depois da validação. Não são pacotes prontos nem uma prescrição automática.</p>
        </div>
        <div className="case-list">
          {interventionExamples.map(([n,name,problem,answer]) => (
            <article key={name}>
              <span>{n}</span>
              <h3>{name}</h3>
              <p className="problem">{problem}</p>
              <p>{answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.trust}>
        <div className={styles.trustCopy}>
          <span>07 / A VISÃO POR TRÁS DA BLINKO</span>
          <h2>Comunicação, tecnologia e operação vistas como partes da mesma organização.</h2>
          <p>A Blinko nasce de uma formação em Relações Públicas aplicada à comunicação organizacional, combinada a experiência prática em marketing, atendimento, processos, tecnologia e automação.</p>
          <p>Esse olhar ajuda a investigar não só o que a empresa comunica, mas a coerência entre promessa, experiência, operação e relação com seus públicos.</p>
          <a className={styles.inlineLink} href="/bio">Conhecer melhor a Blinko →</a>
        </div>
        <div className={styles.trustPrinciples}>
          <article><span>01</span><strong>Hipótese não é causa.</strong><p>Uma percepção só vira conclusão quando existe base suficiente.</p></article>
          <article><span>02</span><strong>IA não substitui decisão.</strong><p>Tecnologia apoia leitura e execução, mas decisões relevantes passam por revisão humana.</p></article>
          <article><span>03</span><strong>Intervenção não é catálogo.</strong><p>A ferramenta entra depois da prioridade, não antes dela.</p></article>
        </div>
      </section>

      <section className={styles.faq} id="faq">
        <div className={styles.faqHead}>
          <span>08 / PERGUNTAS FREQUENTES</span>
          <h2>Antes de começar, vale deixar o processo <em>sem letra miúda.</em></h2>
        </div>
        <div className={styles.faqList}>
          {faq.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}<span>+</span></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="diagnostic" id="diagnostico">
        <div className="diag-orbit" aria-hidden="true">
          <i/><i/>
          <img
            className="diag-flower"
            src={BLINKO_FLOWER_DATA_URI}
            alt=""
            style={{ width: "clamp(88px, 11vw, 150px)", height: "auto", top: "50%" }}
          />
        </div>
        <div className="diag-copy">
          <span className="section-id inverse">09 / COMECE PELO PONTO CERTO</span>
          <h2>Conte o que está acontecendo na sua empresa.</h2>
          <p>O pré-diagnóstico gratuito é uma triagem inicial para organizar contexto, sinais percebidos e entender se existe algo que vale aprofundar com a Blinko.</p>
          <div className={styles.diagActions}>
            <a className="button pink" href="/diagnostico">Fazer pré-diagnóstico gratuito</a>
            <a className={styles.inverseLink} href="/diagnostico-blinko">Conhecer o diagnóstico profundo →</a>
          </div>
          <small>Esta etapa não confirma causas nem substitui o Diagnóstico Blinko profundo, que é separado e pago.</small>
        </div>
      </section>

      <footer>
        <img className="footer-logo" src={BLINKO_LOGO_DARK_DATA_URI} alt="Blinko" />
        <p>Inovação aplicada ao problema real da empresa.</p>
        <div className={styles.footerLinks}>
          <a href="/bio">Conhecer a Blinko →</a>
          <a href="/diagnostico-blinko">Diagnóstico Blinko →</a>
          <a href="/privacidade">Privacidade →</a>
        </div>
      </footer>
    </main>
  );
}