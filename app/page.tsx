"use client";

import { useEffect, useRef } from "react";
import { BLINKO_LOGO_DARK_DATA_URI } from "../lib/blinko/brand-logo-data";
import styles from "./immersive-home.module.css";

const journey = [
  ["01", "Escutar", "O contexto vem antes do serviço."],
  ["02", "Investigar", "A hipótese precisa de evidência."],
  ["03", "Priorizar", "Nem tudo precisa mudar de uma vez."],
  ["04", "Estruturar", "A solução ganha plano, limite e direção."],
  ["05", "Acompanhar", "O que mudou orienta o próximo passo."],
];

export default function Home() {
  const pageRef = useRef<HTMLElement>(null);
  const storyRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const page = pageRef.current;
    const story = storyRef.current;
    if (!page || !story) return;

    let frame = 0;
    const setProgress = () => {
      frame = 0;
      const pageTravel = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const pageProgress = Math.min(1, Math.max(0, window.scrollY / pageTravel));
      page.style.setProperty("--journey-progress", String(pageProgress));

      const rect = story.getBoundingClientRect();
      const storyTravel = Math.max(story.offsetHeight - window.innerHeight, 1);
      const progress = Math.min(1, Math.max(0, -rect.top / storyTravel));
      story.style.setProperty("--story-progress", String(progress));
      story.style.setProperty("--story-rotation", String(progress * 12) + "deg");
      story.style.setProperty("--ring-scale", String(1 + progress * 0.09));
      story.style.setProperty("--node-scale", String(0.88 + progress * 0.23));
      story.dataset.scene = progress < 0.32 ? "0" : progress < 0.67 ? "1" : "2";
    };

    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(setProgress);
    };
    const movePointer = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const fraction = Math.min(1, Math.max(0, event.clientX / window.innerWidth));
      page.style.setProperty("--pointer-x", String(fraction));
      page.style.setProperty("--pointer-rotation", String((fraction - 0.5) * 16) + "deg");
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("pointermove", movePointer, { passive: true });
    setProgress();
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pointermove", movePointer);
    };
  }, []);

  return (
    <main className={styles.page} ref={pageRef}>
      <div aria-hidden="true" className={styles.progress} />

      <header className={styles.header}>
        <a className={styles.logo} href="#inicio" aria-label="Blinko — voltar ao início">
          <img src={BLINKO_LOGO_DARK_DATA_URI} alt="Blinko Studio" />
        </a>
        <nav className={styles.nav} aria-label="Navegação">
          <a href="#metodo">Nosso olhar</a>
          <a href="#como-trabalhamos">O processo</a>
          <a href="#comecar" className={styles.navCta}>Vamos conversar <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <section className={styles.hero} id="inicio" aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Diagnóstico e estruturação de negócios</p>
          <h1 id="hero-title">O problema <em>nem sempre</em> está onde parece.</h1>
          <p className={styles.heroLead}>
            O Diagnóstico Blinko investiga o que acontece na sua empresa e mostra
            o que merece atenção primeiro. Soluções vêm depois, com base
            no que realmente descobrirmos.
          </p>
          <div className={styles.actions}>
            <a className={styles.pill} href="/diagnostico">Iniciar triagem gratuita <span className={styles.arrow} aria-hidden="true">↗</span></a>
            <a className={styles.textAction} href="#metodo">Conheça nosso olhar <span aria-hidden="true">↓</span></a>
          </div>
        </div>

        <div className={styles.heroArt} aria-hidden="true">
          <div className={styles.artHalo} />
          <div className={styles.artOrbit} />
          <div className={[styles.artPetal, styles.petalOne].join(" ")} />
          <div className={[styles.artPetal, styles.petalTwo].join(" ")} />
          <div className={[styles.artPetal, styles.petalThree].join(" ")} />
          <div className={[styles.artPetal, styles.petalFour].join(" ")} />
          <div className={styles.artCore}><span>b.</span></div>
          <span className={styles.artLabel}>clareza · estrutura · movimento</span>
        </div>

        <a className={styles.scrollCue} href="#olhar"><span className={styles.scrollLine} /> Role para descobrir</a>
      </section>

      <section className={styles.bridge} id="olhar" aria-labelledby="olhar-title">
        <span className={styles.kicker}>Um olhar diferente</span>
        <h2 id="olhar-title">Você vê o sintoma. <em>Nós investigamos o contexto.</em></h2>
        <p>
          Nem toda dificuldade de vendas se resolve com propaganda.
          Nem toda falha de atendimento se resolve com tecnologia.
          Primeiro entendemos o que realmente acontece no negócio.
        </p>
      </section>

      <section
        className={styles.story}
        ref={storyRef}
        data-scene="0"
        id="metodo"
        aria-label="Como a Blinko entende um problema"
      >
        <div className={styles.storySticky}>
          <div className={styles.storyGraphic} aria-hidden="true">
            <div className={styles.storyRing} />
            <div className={styles.storyRingTwo} />
            <div className={styles.storyDot} />
            <div className={[styles.storyDot, styles.storyDotTwo].join(" ")} />
            <div className={styles.storyNode}><span>raiz.</span></div>
            <div className={styles.storyMeter}><i /><i /><i /></div>
          </div>

          <div className={styles.storyText}>
            <article className={[styles.scene, styles.sceneOne].join(" ")}>
              <span className={styles.kicker}>01 / O sinal</span>
              <h2>“Precisamos <em>postar mais.</em>”</h2>
              <p>Talvez. Mas a dificuldade está na comunicação ou em outro momento da jornada do cliente?</p>
            </article>
            <article className={[styles.scene, styles.sceneTwo].join(" ")}>
              <span className={styles.kicker}>02 / A investigação</span>
              <h2>E se a causa estiver <em>mais fundo?</em></h2>
              <p>Escutamos pessoas, observamos processos e cruzamos informações antes de tirar conclusões.</p>
            </article>
            <article className={[styles.scene, styles.sceneThree].join(" ")}>
              <span className={styles.kicker}>03 / A direção</span>
              <h2>Clareza para escolher <em>o que fazer.</em></h2>
              <p>Transformamos os achados em prioridades e caminhos possíveis, com escopo e responsabilidades claros.</p>
            </article>
          </div>
          <span className={styles.storyHint}>Role para acompanhar a descoberta</span>
        </div>
      </section>

      <section className={styles.method} id="como-trabalhamos" aria-labelledby="processo-title">
        <div>
          <span className={styles.kicker}>O método Blinko</span>
          <h2 id="processo-title">Menos achismo. Mais direção.</h2>
          <p className={styles.methodSmall}>Pesquisa, comunicação e Relações Públicas ajudam a enxergar o negócio por inteiro. Nosso primeiro serviço é o diagnóstico; só depois avaliamos as soluções apropriadas.</p>
        </div>
        <div aria-label="Etapas do nosso trabalho">
          {journey.map(([number, name, detail]) => (
            <div className={styles.methodLine} key={number} title={detail}>
              <strong>{name}</strong>
              <span>{number} / 05</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.entry} id="comecar" aria-labelledby="comece-title">
        <div className={styles.entryHeader}>
          <div>
            <span className={styles.kicker}>O ponto de partida</span>
            <h2 id="comece-title">Primeiro, <em>entender.</em> Depois, agir.</h2>
          </div>
          <p className={styles.entryIntro}>
            Na Blinko, o diagnóstico é o primeiro serviço contratado.
            Não indicamos uma solução antes de investigar o que o negócio precisa.
          </p>
        </div>
        <div className={styles.diagnosticSteps} aria-label="Como começa um projeto na Blinko">
          <div><span>01</span><strong>Triagem gratuita</strong><p>Uma conversa breve para conhecer sua situação.</p></div>
          <div><span>02</span><strong>Diagnóstico contratado</strong><p>Investigação, evidências e prioridades em um escopo definido.</p></div>
          <div><span>03</span><strong>Soluções depois</strong><p>Se fizer sentido, apresentamos uma proposta de implementação.</p></div>
        </div>
        <div className={styles.entryGrid}>
          <a className={[styles.path, styles.pathStrategic, styles.diagnosticPath].join(" ")}
            href="/diagnostico" aria-label="Começar a triagem gratuita para conversar sobre o Diagnóstico Blinko">
            <div className={styles.pathTop}>
              <span>Diagnóstico Blinko — nosso serviço principal</span>
              <b aria-hidden="true">↗</b>
            </div>
            <div className={styles.pathBody}>
              <h3>Não sabe por onde começar?</h3>
              <p>Conte brevemente o que está acontecendo. Nossa equipe entende seu contexto e explica como funciona a contratação do diagnóstico.</p>
            </div>
            <span className={styles.pathCta}>Começar triagem gratuita <i aria-hidden="true">↗</i></span>
          </a>
        </div>
        <p className={styles.pathNote}>
          A triagem inicial não é um diagnóstico técnico. O Diagnóstico Blinko é pago, com proposta e escopo apresentados antes da contratação.
          Serviços de execução não são vendidos isoladamente: dependem de um diagnóstico prévio e de uma proposta específica.
        </p>
      </section>

      <section className={styles.final} aria-labelledby="final-title">
        <span className={styles.kicker}>Blinko Studio — clareza para evoluir</span>
        <h2 id="final-title">Todo avanço começa com <em>uma boa pergunta.</em></h2>
        <a className={styles.finalLink} href="/diagnostico">Iniciar triagem gratuita <span className={styles.arrow} aria-hidden="true">↗</span></a>
      </section>

      <footer className={styles.footer}>
        <img src={BLINKO_LOGO_DARK_DATA_URI} alt="Blinko Studio" />
        <span>Diagnóstico · estratégia · estruturação</span>
        <a href="#inicio">Voltar ao início ↑</a>
      </footer>
    </main>
  );
}
