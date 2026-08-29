"use client";

import { useEffect } from "react";
import { BLINKO_LOGO_DARK_DATA_URI } from "../lib/blinko/brand-logo-data";
import { BLINKO_FLOWER_DATA_URI } from "../lib/blinko/brand-flower-data";
import styles from "./home-v2.module.css";

const pillars = ["Marca", "Digital", "Financeiro", "Operação", "Atendimento", "Gestão", "Equipe"];

const fitSignals = [
  ["01", "Cresceu.", "A operação ficou difícil de enxergar."],
  ["02", "Retrabalho.", "Algo consome energia mais de uma vez."],
  ["03", "Desconexão.", "Áreas importantes não funcionam como um sistema."],
  ["04", "Prioridade incerta.", "Existem caminhos, mas falta saber por onde começar."],
];

const methodWords = ["ENTENDER", "INVESTIGAR", "VALIDAR", "IMPLANTAR", "ACOMPANHAR"];

const interventionExamples = [
  ["01", "Captação + atendimento", "Aquisição sem resposta consistente", "Landing page + CRM + automação"],
  ["02", "Operação + automação", "Retrabalho sustentando perdas", "Processos + integração + IA"],
  ["03", "Marca + comunicação", "Promessa e entrega desalinhadas", "Posicionamento + identidade + experiência"],
];

const faq = [
  ["O pré-diagnóstico é gratuito?", "Sim. É uma triagem inicial, não um diagnóstico completo."],
  ["O Diagnóstico Blinko é pago?", "Sim. É uma etapa profunda e separada do pré-diagnóstico."],
  ["A Blinko também executa?", "Quando fizer sentido, sim. A execução é decidida depois da validação."],
  ["Preciso contratar a execução?", "Não. O diagnóstico pode existir como uma etapa própria."],
  ["A IA decide sozinha?", "Não. IA apoia a leitura; decisões relevantes passam por revisão humana."],
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
      if (rootStory.dataset.scene !== scene) rootStory.dataset.scene = scene;
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
          <a href="#como">Método</a>
          <a href="#para-quem">Para quem</a>
          <a href="#analise">Análise</a>
          <a href="#faq">FAQ</a>
          <a className="nav-cta" href="/diagnostico">Pré-diagnóstico</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-content">
          <p className="eyebrow">DIAGNÓSTICO · EXECUÇÃO · ACOMPANHAMENTO</p>
          <h1>O sinal <em>nem sempre</em> revela a causa.</h1>
          <p className="hero-lede">Organizamos sinais, investigamos hipóteses e priorizamos o que encontra evidência.</p>
          <div className="actions">
            <a className="button light" href="/diagnostico">Fazer pré-diagnóstico gratuito</a>
            <a className="text-link" href="#como">entrar no método ↓</a>
          </div>
        </div>
        <span className="side-note">ROLE PARA ENTRAR NA EMPRESA</span>
      </section>

      <section className="enter" id="como" style={{ gridTemplateColumns: "1fr", minHeight: "100vh" }}>
        <div className="enter-copy" style={{ maxWidth: "920px" }}>
          <span className="section-id">01 / ANTES DE PROPOR</span>
          <h2>O que parece óbvio <em>quase nunca é o ponto de partida.</em></h2>
          <p>Primeiro entendemos. Depois investigamos. Só então escolhemos onde mexer.</p>
        </div>
        <span className="giant-word">INVESTIGAR</span>
      </section>

      <section className={styles.fit} id="para-quem">
        <div className={styles.fitIntro}>
          <span>02 / QUANDO A BLINKO ENTRA</span>
          <h2>Você sente que algo trava. <em>A causa ainda não está clara.</em></h2>
        </div>
        <div className={styles.signalGrid}>
          {fitSignals.map(([number, title, text]) => (
            <article key={number}>
              <span>{number}</span>
              <strong>{title}</strong>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <p className={styles.fitNote}>Se a única necessidade é uma entrega fechada, sem investigação, talvez a Blinko não seja o melhor ponto de partida.</p>
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
              <p>Talvez. Mas isso ainda é só o que apareceu na superfície.</p>
            </article>
            <article className="scene s2">
              <span>HIPÓTESES</span>
              <h3>Comunicação. Atendimento. Operação.</h3>
              <p>O mesmo sinal pode nascer em lugares diferentes.</p>
            </article>
            <article className="scene s3">
              <span>VALIDAÇÃO</span>
              <h3>Evidência muda a prioridade.</h3>
              <p>É aqui que a intervenção deixa de ser palpite.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="editorial">
        <div className="editorial-photo"><img src="/photos/notebook-2.webp" alt="Profissional trabalhando em notebook em ambiente Blinko" /></div>
        <div className="editorial-copy">
          <span className="section-id">03 / MÉTODO BLINKO</span>
          <p className="big-quote">“Você não precisa chegar sabendo qual solução contratar.”</p>
          <p className="body-copy">A solução entra depois da prioridade, não antes dela.</p>
          <a className={styles.inlineLink} href="/diagnostico-blinko">Entender o diagnóstico profundo →</a>
        </div>
      </section>

      <section className={styles.flow} aria-label="Fluxo do método Blinko">
        <span className={styles.flowLabel}>04 / O CAMINHO</span>
        <div className={styles.flowWords}>
          {methodWords.map((word, index) => (
            <div key={word}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{word}</strong>
              {index < methodWords.length - 1 ? <i>→</i> : null}
            </div>
          ))}
        </div>
        <p>Pré-diagnóstico → conversa → diagnóstico → intervenção → acompanhamento.</p>
      </section>

      <section className="pillars" id="analise">
        <div className="pillars-head">
          <span className="section-id">05 / UMA EMPRESA É UM SISTEMA</span>
          <h2>Sete áreas. <em>Uma leitura conectada.</em></h2>
          <p>O problema pode aparecer em uma área e começar em outra.</p>
        </div>
        <div className="pillar-list">
          {pillars.map((p, i) => <div className="pillar" key={p}><span>{String(i + 1).padStart(2,"0")}</span><strong>{p}</strong><i /></div>)}
        </div>
      </section>

      <section className="cases" id="cases">
        <div className="cases-title">
          <span className="section-id">06 / DEPOIS DA VALIDAÇÃO</span>
          <h2>A intervenção pode combinar <em>competências diferentes.</em></h2>
          <p>Não são pacotes. São exemplos de composição.</p>
        </div>
        <div className="case-list">
          {interventionExamples.map(([number, name, signal, answer]) => (
            <article key={name}>
              <span>{number}</span>
              <h3>{name}</h3>
              <p className="problem">{signal}</p>
              <p>{answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.trust}>
        <div className={styles.trustStatement}>
          <span>07 / A LENTE</span>
          <h2>Relações Públicas orientam a leitura. <em>Tecnologia e operação viabilizam a intervenção.</em></h2>
          <a className={styles.inlineLink} href="/bio">Conhecer a Blinko →</a>
        </div>
        <div className={styles.trustPrinciples}>
          <article><span>01</span><strong>Hipótese não é causa.</strong></article>
          <article><span>02</span><strong>IA não substitui decisão.</strong></article>
          <article><span>03</span><strong>Intervenção não é catálogo.</strong></article>
        </div>
      </section>

      <section className={styles.faq} id="faq">
        <div className={styles.faqHead}>
          <span>08 / SEM LETRA MIÚDA</span>
          <h2>Perguntas antes de <em>começar.</em></h2>
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
          <span className="section-id inverse">09 / COMECE PELO SINAL</span>
          <h2>O que está acontecendo na sua empresa?</h2>
          <p>Conte o contexto. A Blinko organiza a primeira leitura.</p>
          <div className={styles.diagActions}>
            <a className="button pink" href="/diagnostico">Fazer pré-diagnóstico gratuito</a>
            <a className={styles.inverseLink} href="/diagnostico-blinko">Conhecer o diagnóstico profundo →</a>
          </div>
        </div>
      </section>

      <footer>
        <img className="footer-logo" src={BLINKO_LOGO_DARK_DATA_URI} alt="Blinko" />
        <p>Inovação aplicada ao problema real da empresa.</p>
        <div className={styles.footerLinks}>
          <a href="/bio">Blinko →</a>
          <a href="/diagnostico-blinko">Diagnóstico →</a>
          <a href="/privacidade">Privacidade →</a>
        </div>
      </footer>
    </main>
  );
}
