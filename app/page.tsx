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

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePlayback = () => {
      const videos = page.querySelectorAll("video");
      videos.forEach((video) => {
        if (motionPreference.matches) video.pause();
        else void video.play().catch(() => undefined);
      });
    };
    motionPreference.addEventListener("change", updatePlayback);
    updatePlayback();

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("pointermove", movePointer, { passive: true });
    setProgress();
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pointermove", movePointer);
      motionPreference.removeEventListener("change", updatePlayback);
    };
  }, []);

  return (
    <main className={styles.page} ref={pageRef}>
      <div aria-hidden="true" className={styles.progress} />

      <header className={styles.header}>
        <a className={styles.logo} href="#inicio" aria-label="Blinko — voltar ao início">
          <img src="/brand/logo-fundo-verde.svg" alt="Blinko Studio — Criatividade que conecta" loading="lazy" />
        </a>
        <nav className={styles.nav} aria-label="Navegação">
          <a href="#sobre">A Blinko</a>
          <a href="#metodo">Nosso olhar</a>
          <a href="#perguntas">Dúvidas</a>
          <a href="#comecar" className={styles.navCta}>Começar <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <section className={styles.hero} id="inicio" aria-labelledby="hero-title">
        <video className={styles.ambientVideo} aria-hidden="true" autoPlay muted loop playsInline preload="none">
          <source src="/imersao/ambiente.mp4" type="video/mp4" />
        </video>
        <div className={styles.ambientTint} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Diagnóstico e estruturação de negócios</p>
          <h1 id="hero-title">O problema <em>nem sempre</em> está onde parece.</h1>
          <p className={styles.heroLead}>
            Somos a Blinko, uma empresa de diagnóstico e estruturação de negócios.
            Investigamos desafios, organizamos prioridades e só então propomos
            soluções, integrando pesquisa, comunicação e Relações Públicas.
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
          <div className={styles.artCore}><img src="/brand/monograma-b-rosa.svg" alt="" aria-hidden="true" /></div>
          <span className={styles.artLabel}>clareza · estrutura · movimento</span>
        </div>

        <a className={styles.scrollCue} href="#sobre"><span className={styles.scrollLine} /> Role para descobrir</a>
      </section>

      <section className={styles.bridge} id="sobre" aria-labelledby="sobre-title">
        <span className={styles.kicker}>Quem é a Blinko</span>
        <h2 id="sobre-title">Uma visão <em>inteira</em> do seu negócio.</h2>
        <p>
          Somos uma empresa de diagnóstico, estruturação e desenvolvimento de negócios.
          Reunimos pesquisa, comunicação estratégica e Relações Públicas para investigar
          desafios, compreender relações e organizar prioridades — antes de recomendar soluções.
        </p>
        <div className={styles.aboutTagline} aria-label="Nossa forma de atuação">
          <span>Pesquisa e escuta</span><span>Visão integrada</span><span>Decisões fundamentadas</span>
        </div>
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
            <div className={styles.earthPerspective}>
              <div className={styles.earthAtmosphere} />
              <div className={styles.earthPlateStack}>
                <div className={[styles.earthPlate, styles.plateSurface].join(" ")}>
                  <span>O que aparece</span>
                </div>
                <div className={[styles.earthPlate, styles.plateSignals].join(" ")}>
                  <span>Os sinais</span>
                </div>
                <div className={[styles.earthPlate, styles.plateContext].join(" ")}>
                  <span>As relações</span>
                </div>
                <div className={[styles.earthPlate, styles.plateCauses].join(" ")}>
                  <span>O que sustenta</span>
                </div>
              </div>
            </div>
            <p className={styles.earthCaption}>O diagnóstico atravessa as camadas do problema.</p>
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

      <section className={styles.editorialShowcase} aria-labelledby="investigacao-title">
        <div className={styles.editorialCopy}>
          <span className={styles.kicker}>O que muda quando investigamos</span>
          <h2 id="investigacao-title">Uma ideia vira <em>hipótese.</em> Uma hipótese pede <em>evidência.</em></h2>
          <p>O diagnóstico transforma informações dispersas em uma leitura mais clara do negócio — sem confundir impressões com causas confirmadas.</p>
          <span className={styles.editorialUnderline} aria-hidden="true" />
        </div>
        <figure className={styles.editorialCollage}>
          <img className={styles.reportVisual} src="/imersao/mockup-relatorio.webp" alt="Composição ilustrativa de páginas de relatório com gráficos e esquemas" loading="lazy" />
          <img className={styles.handsVisual} src="/imersao/recorte-pessoa.webp" alt="" loading="lazy" />
          <figcaption>Referências visuais ilustrativas. Não são dados, métricas ou resultados de clientes.</figcaption>
        </figure>
      </section>

      <section className={styles.audience} id="para-quem" aria-labelledby="audience-title">
        <div className={styles.audienceIntro}>
          <span className={styles.kicker}>Para quem existimos</span>
          <h2 id="audience-title">Seu negócio já deu esses <em>sinais?</em></h2>
          <p>Atendemos micro, pequenas e médias empresas que querem organizar ou desenvolver o negócio sem depender de decisões improvisadas.</p>
        </div>
        <div className={styles.audienceList}>
          <div><span>01</span><p>“Tudo depende de mim.”</p></div>
          <div><span>02</span><p>“Não sei onde estamos perdendo clientes.”</p></div>
          <div><span>03</span><p>“A gente faz, mas não tem processo.”</p></div>
          <div><span>04</span><p>“Temos várias ideias, mas não sabemos o que priorizar.”</p></div>
          <p className={styles.audienceNote}>Esses são exemplos de situações que podem motivar uma investigação, não diagnósticos antecipados.</p>
        </div>
      </section>

      <section className={styles.outcome} aria-label="O que o Diagnóstico Blinko entrega">
        <p className={styles.kicker}>O que você ganha com clareza</p>
        <h2>Entender, priorizar, <em>decidir.</em></h2>
        <div className={styles.outcomeItems}>
          <div><span>01</span><strong>Uma visão do problema</strong><p>Achados fundamentados, com limites e evidências.</p></div>
          <div><span>02</span><strong>Prioridades claras</strong><p>O que merece atenção e por quê.</p></div>
          <div><span>03</span><strong>Próximos passos</strong><p>Recomendações proporcionais ao escopo do diagnóstico.</p></div>
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


      <section className={styles.faq} id="perguntas" aria-labelledby="faq-title">
        <div className={styles.faqIntro}>
          <span className={styles.kicker}>Perguntas frequentes</span>
          <h2 id="faq-title">Ainda tem <em>dúvidas?</em></h2>
          <p>Entenda como funciona o primeiro contato e o Diagnóstico Blinko.</p>
        </div>
        <div className={styles.faqQuestions}>
          <details className={styles.faqItem}>
            <summary>O que é o Diagnóstico Blinko?<span aria-hidden="true">+</span></summary>
            <p>É uma investigação estruturada do seu negócio. Com escuta, pesquisa e análise de informações, buscamos compreender desafios, identificar prioridades e apresentar recomendações fundamentadas dentro do escopo contratado.</p>
          </details>
          <details className={styles.faqItem}>
            <summary>A triagem inicial é gratuita?<span aria-hidden="true">+</span></summary>
            <p>Sim. É um contato breve para conhecer sua situação e explicar o processo. A triagem não identifica causas nem substitui o diagnóstico técnico.</p>
          </details>
          <details className={styles.faqItem}>
            <summary>O diagnóstico é pago?<span aria-hidden="true">+</span></summary>
            <p>Sim. Antes de contratar, você recebe uma proposta com escopo, entregas, condições e preço. A profundidade da investigação depende das necessidades do negócio.</p>
          </details>
          <details className={styles.faqItem}>
            <summary>Posso contratar só uma arte, site ou gestão de redes?<span aria-hidden="true">+</span></summary>
            <p>Não como serviço avulso de entrada. Na Blinko, o diagnóstico vem primeiro. Só recomendamos ou oferecemos soluções depois de investigar o que faz sentido para o negócio.</p>
          </details>
          <details className={styles.faqItem}>
            <summary>Sou obrigado a contratar a execução depois?<span aria-hidden="true">+</span></summary>
            <p>Não. O diagnóstico tem valor por si só. Depois dele, você pode decidir se deseja contratar a Blinko para executar ou coordenar alguma solução, trabalhar com outros profissionais ou seguir as recomendações internamente.</p>
          </details>
          <details className={styles.faqItem}>
            <summary>Quanto tempo leva o diagnóstico?<span aria-hidden="true">+</span></summary>
            <p>Depende do tamanho do desafio, das informações disponíveis e do escopo da pesquisa. Etapas, prazo e entregas serão combinados na proposta, antes da contratação.</p>
          </details>
          <a className={styles.faqLink} href="/diagnostico">Comece pela triagem gratuita <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <section className={styles.final} aria-labelledby="final-title">
        <span className={styles.kicker}>Blinko Studio — clareza para evoluir</span>
        <h2 id="final-title">Todo avanço começa com <em>uma boa pergunta.</em></h2>
        <a className={styles.finalLink} href="/diagnostico">Iniciar triagem gratuita <span className={styles.arrow} aria-hidden="true">↗</span></a>
      </section>

      <footer className={styles.footer}>
        <img src={BLINKO_LOGO_DARK_DATA_URI} alt="Blinko Studio" />
        <span>Diagnóstico · estratégia · estruturação</span>
        <nav className={styles.footerLegal} aria-label="Privacidade e termos">
          <a href="/privacidade">Privacidade</a>
          <a href="/termos-de-uso">Termos de uso</a>
          <a href="/solicitacoes-de-dados">Seus dados</a>
        </nav>
        <a href="#inicio">Voltar ao início ↑</a>
      </footer>
    </main>
  );
}
