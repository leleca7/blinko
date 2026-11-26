"use client";

import { useEffect, useRef } from "react";
import { BLINKO_LOGO_DARK_DATA_URI } from "../lib/blinko/brand-logo-data";
import styles from "./immersive-home.module.css";
import QuickTriageForm from "./diagnostico/QuickTriageForm";

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
      page.style.setProperty("--earth-tilt", String((fraction - 0.5) * 13) + "deg");
    };

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const videos = page.querySelectorAll("video");
    const mobile = window.matchMedia("(max-width: 760px)");
    const videoVisibility = new Map<HTMLVideoElement, boolean>();
    const updatePlayback = () => {
      videos.forEach((video) => {
        if (motionPreference.matches || mobile.matches || !videoVisibility.get(video)) video.pause();
        else void video.play().catch(() => undefined);
      });
    };
    const videoObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => videoVisibility.set(entry.target as HTMLVideoElement, entry.isIntersecting));
      updatePlayback();
    }, { threshold: 0.05 });
    videos.forEach(video => videoObserver.observe(video));
    motionPreference.addEventListener("change", updatePlayback);
    mobile.addEventListener("change", updatePlayback);
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
      mobile.removeEventListener("change", updatePlayback);
      videoObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    let disposed = false;
    let cleanup = () => {};
    async function setupMotion() {
      try {
        const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
          import("gsap"), import("gsap/ScrollTrigger"), import("lenis")
        ]);
        if (disposed || !page) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();
        media.add("(min-width: 761px) and (prefers-reduced-motion: no-preference)", () => {
          const lenis = new Lenis({ autoRaf: false, anchors: true, smoothWheel: true, duration: 0.95 });
          const tick = (time: number) => lenis.raf(time * 1000);
          lenis.on("scroll", ScrollTrigger.update);
          gsap.ticker.add(tick);
          const method = page.querySelector<HTMLElement>("." + styles.method);
          const lines = Array.from(page.querySelectorAll<HTMLElement>("." + styles.methodLine));
          const orb = page.querySelector<HTMLElement>("." + styles.methodOrb);
          let active = 0;
          let stepTween: ReturnType<typeof gsap.to> | undefined;
          if (method && lines.length) {
            method.dataset.motion = "on";
            gsap.set(lines, {autoAlpha: 0, y: 24});
            gsap.set(lines[0], {autoAlpha: 1, y: 0});
            const showStep = (index: number) => {
              if (index === active) return;
              stepTween?.kill();
              gsap.killTweensOf(lines);
              gsap.set(lines, {autoAlpha: 0, y: 24});
              stepTween = gsap.to(lines[index], {autoAlpha: 1, y: 0, duration: .34, ease: "power2.out"});
              if (orb) gsap.to(orb, { rotation: index * 73 - 26, scale: .84 + index * .08, borderRadius: index % 2 ? "42% 58% 58% 42%" : "50%", duration: .55, overwrite: true });
              active = index;
            };
            ScrollTrigger.create({ trigger: method, start: "top top", end: () => "+=" + Math.round(innerHeight * 2.4), pin: true, anticipatePin: 1, invalidateOnRefresh: true,
              onUpdate: self => showStep(Math.min(lines.length - 1, Math.floor(self.progress * lines.length))) });
          }
          const evidence = page.querySelector<HTMLElement>("." + styles.editorialShowcase);
          const report = page.querySelector<HTMLElement>("." + styles.reportVisual);
          const person = page.querySelector<HTMLElement>("." + styles.handsVisual);
          if (evidence && report && person) {
            gsap.fromTo(report, {y: 85, rotation: -9}, {y: -45, rotation: -3, ease: "none", scrollTrigger: {trigger: evidence, start: "top bottom", end: "bottom top", scrub: .65}});
            gsap.fromTo(person, {y: 125, rotation: 10}, {y: -75, rotation: 3, ease: "none", scrollTrigger: {trigger: evidence, start: "top bottom", end: "bottom top", scrub: .8}});
          }
          for (const group of page.querySelectorAll<HTMLElement>("." + styles.outcomeItems + ", ." + styles.diagnosticSteps)) {
            gsap.fromTo(Array.from(group.children), {clipPath: "inset(0 0 85% 0)", y: 24}, {clipPath: "inset(0 0 0% 0)", y: 0, duration: .7, stagger: .14, ease: "power2.out", scrollTrigger: {trigger: group, start: "top 88%", once: true}});
          }
          const cursor = page.querySelector<HTMLElement>("." + styles.cursorRing);
          const magnet = Array.from(page.querySelectorAll<HTMLElement>("." + styles.pill + ", ." + styles.navCta));
          const removers: Array<() => void> = [];
          if (matchMedia("(pointer: fine)").matches) {
            const follow = (e: PointerEvent) => {
              if (cursor && e.pointerType === "mouse") gsap.to(cursor, {x: e.clientX, y: e.clientY, autoAlpha: 1, duration: .18, overwrite: true});
            };
            const hide = () => { if (cursor) gsap.set(cursor, {autoAlpha: 0}); };
            window.addEventListener("pointermove", follow, {passive:true});
            document.documentElement.addEventListener("pointerleave", hide);
            removers.push(() => {window.removeEventListener("pointermove", follow); document.documentElement.removeEventListener("pointerleave", hide);});
            for (const button of magnet) {
              const move = (e: PointerEvent) => {
                const rect = button.getBoundingClientRect();
                gsap.to(button, {x:(e.clientX-rect.left-rect.width/2)*.16, y:(e.clientY-rect.top-rect.height/2)*.18, duration:.25, overwrite:true});
              };
              const reset = () => {gsap.to(button,{x:0,y:0,duration:.35,overwrite:true});};
              button.addEventListener("pointermove",move); button.addEventListener("pointerleave",reset);
              removers.push(()=>{button.removeEventListener("pointermove",move);button.removeEventListener("pointerleave",reset);gsap.set(button,{clearProps:"transform"});});
            }
          }
          ScrollTrigger.refresh();
          return () => {
            removers.forEach(fn=>fn()); stepTween?.kill(); gsap.killTweensOf(lines); if(orb) gsap.killTweensOf(orb);
            if (cursor) {gsap.killTweensOf(cursor);gsap.set(cursor,{autoAlpha:0});}
            if(method) delete method.dataset.motion;
            gsap.ticker.remove(tick); lenis.destroy();
          };
        });
        cleanup = () => media.revert();
      } catch { /* layout remains readable without motion dependencies */ }
    }
    void setupMotion();
    return () => { disposed = true; cleanup(); };
  }, []);

  return (
    <main className={styles.page} ref={pageRef}>
      <div aria-hidden="true" className={styles.progress} />
      <div aria-hidden="true" className={styles.cursorRing} />

      <header className={styles.header}>
        <a className={styles.logo} href="#inicio" aria-label="Blinko — voltar ao início">
          <img src="/brand/logo-fundo-verde.svg" alt="Blinko Studio — Criatividade que conecta" loading="lazy" />
        </a>
        <nav className={styles.nav} aria-label="Navegação">
          <a href="#sobre">A Blinko</a>
          <a href="#metodo">Nosso olhar</a>
          <a href="#perguntas">Dúvidas</a>
          <a href="#comecar" className={styles.navCta}>Começar <span aria-hidden="true">↗︎</span></a>
        </nav>
      </header>

      <section className={styles.hero} id="inicio" aria-labelledby="hero-title">
        <div className={styles.ambientTint} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Pesquisa, estratégia e criação</p>
          <h1 id="hero-title"><span className={styles.heroBehind}>O problema</span>{" "}<em>nem sempre</em>{" "}<span className={styles.heroFront}>está onde parece.</span></h1>
          <p className={styles.heroLead}>
            Somos a Blinko, uma agência de pesquisa, estratégia e criação. Investigamos os desafios do seu negócio, organizamos prioridades e desenvolvemos caminhos para solucioná-los.
          </p>
          <div className={styles.actions}>
            <a className={styles.pill} href="#triagem">Iniciar triagem gratuita <span className={styles.arrow} aria-hidden="true">↗︎</span></a>
            <a className={styles.textAction} href="#metodo">Conheça nosso olhar <span aria-hidden="true">↓</span></a>
          </div>
        </div>

        <div className={styles.heroArt} aria-hidden="true">
          {/* Ativo visual do hero: monograma oficial da marca, substituível aqui. */}
          <img className={styles.botanicalHero} src="/brand/monograma-b-rosa.svg" alt="" decoding="async" />
        </div>

        <span className={styles.heroSide} aria-hidden="true">clareza · estrutura · movimento</span>
        
      </section>

      
      <section className={styles.bridge} id="sobre" aria-labelledby="sobre-title">
        <span className={styles.kicker}>Quem é a Blinko</span>
        <h2 id="sobre-title">Uma visão <em>360°</em> do seu negócio.</h2>
        <p>
          Somos uma agência de pesquisa e comunicação estratégica, com foco inicial em e-commerces e pequenos negócios em operação. Investigamos desafios, analisamos o contexto e identificamos oportunidades para recomendar soluções adequadas à realidade de cada empresa.
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
          <div className={styles.soilLandscape} aria-hidden="true">
            <i className={styles.soilSurface} />
            <i className={styles.soilFirst} />
            <i className={styles.soilSecond} />
            <i className={styles.soilDeep} />
          </div>
          <div className={styles.storyText}>
            <article className={[styles.scene, styles.sceneOne].join(" ")}>
              <span className={styles.kicker}>01 / O sinal</span>
              <h2><span className={styles.sceneWord}>“Precisamos</span>{" "}<em><span className={styles.sceneWord}>postar</span>{" "}<span className={styles.sceneWord}>mais.”</span></em></h2>
              <p>Publicar mais pode ajudar, mas não resolve, por si só, dificuldades na oferta, no atendimento ou na jornada do cliente. Antes de agir, é preciso entender onde está o problema.</p>
            </article>
            <article className={[styles.scene, styles.sceneTwo].join(" ")}>
              <span className={styles.kicker}>02 / A investigação</span>
              <h2><span className={styles.sceneWord}>E</span>{" "}<span className={styles.sceneWord}>se</span>{" "}<span className={styles.sceneWord}>a</span>{" "}<span className={styles.sceneWord}>causa</span>{" "}<span className={styles.sceneWord}>estiver</span>{" "}<em><span className={styles.sceneWord}>mais</span>{" "}<span className={styles.sceneWord}>fundo?</span></em></h2>
              <p>Escutamos as pessoas envolvidas, analisamos processos e cruzamos informações para identificar onde estão os gargalos e quais causas são sustentadas por evidências.</p>
            </article>
            <article className={[styles.scene, styles.sceneThree].join(" ")}>
              <span className={styles.kicker}>03 / A direção · as raízes</span>
              <h2><span className={styles.sceneWord}>Clareza</span>{" "}<span className={styles.sceneWord}>para</span>{" "}<span className={styles.sceneWord}>escolher</span>{" "}<em><span className={styles.sceneWord}>o</span>{" "}<span className={styles.sceneWord}>que</span>{" "}<span className={styles.sceneWord}>fazer.</span></em></h2>
              <p>A partir da investigação, identificamos prioridades e recomendamos caminhos de ação adequados ao seu negócio.</p>
            </article>
          </div>
          <span className={styles.storyHint}>Role para acompanhar a descoberta</span>
        </div>
      </section>

      <section className={styles.method} id="como-trabalhamos" aria-labelledby="processo-title">
        <div>
          <span className={styles.kicker}>O método Blinko</span>
          <h2 id="processo-title">Menos achismo. Mais direção.</h2>
          <p className={styles.methodSmall}>Pesquisa e comunicação estratégica ajudam a compreender o negócio de forma integrada. Nosso primeiro passo é o diagnóstico; a partir dele, avaliamos as soluções adequadas.</p>
        </div>
        <div className={styles.methodVisual}>
          <div className={styles.methodOrb} aria-hidden="true" />
          <div className={styles.methodSteps} aria-label="Etapas do nosso trabalho">
          {journey.map(([number, name, detail]) => (
            <div className={styles.methodLine} key={number} title={detail}>
              <strong>{name}</strong>
              <span>Passo {number} / 05</span>
            </div>
          ))}
          </div>
        </div>
      </section>

      <section className={styles.editorialShowcase} aria-labelledby="investigacao-title">
        <div className={styles.editorialCopy}>
          <span className={styles.kicker}>O que muda quando investigamos</span>
          <h2 id="investigacao-title">Uma ideia vira <em>hipótese.</em> Uma hipótese pede <em>evidência.</em></h2>
          <p>O diagnóstico organiza informações dispersas e permite uma leitura mais clara do seu negócio, diferenciando percepções de causas sustentadas por evidências.</p>
          <span className={styles.editorialUnderline} aria-hidden="true" />
        </div>
        <figure className={styles.editorialCollage}>
          {/* Ativos da evidência: mockup de relatório e recorte humano, substituíveis abaixo. */}
          <img className={styles.reportVisual} src="/imersao/mockup-relatorio.webp" alt="Composição ilustrativa de páginas de relatório com gráficos e esquemas" loading="lazy" />
          <img className={styles.handsVisual} src="/imersao/recorte-pessoa.webp" alt="" loading="lazy" />
          <figcaption>Referências visuais ilustrativas. Não são dados, métricas ou resultados de clientes.</figcaption>
        </figure>
      </section>

      <section className={styles.audience} id="para-quem" aria-labelledby="audience-title">
        <div className={styles.audienceIntro}>
          <span className={styles.kicker}>Para quem existimos</span>
          <h2 id="audience-title">Seu negócio já deu esses <em>sinais?</em></h2>
          <p>Nosso foco inicial são pequenos negócios em operação, especialmente e-commerces, que querem organizar e desenvolver a empresa com decisões fundamentadas.</p>
        </div>
        <div className={styles.audienceList}>
          <div><p>“Tudo depende de mim.”</p></div>
          <div><p>“Não sei onde estamos perdendo clientes.”</p></div>
          <div><p>“Minha empresa cresceu, mas a organização não acompanhou.”</p></div>
          <div><p>“Temos várias ideias, mas não sabemos o que priorizar.”</p></div>
          <p className={styles.audienceNote}>Reconheceu algum desses sinais? A investigação ajuda a compreender o que está por trás deles.</p>
        </div>
      </section>

      <section className={styles.outcome} aria-label="O que o Diagnóstico Blinko entrega">
        <p className={styles.kicker}>O que o diagnóstico entrega</p>
        <h2>Da investigação à <em>direção.</em></h2>
        <div className={styles.outcomeItems}>
          <div><span>01</span><strong>Relatório de diagnóstico</strong><p>Uma análise dos desafios, pontos fortes e oportunidades, sustentada pelas informações investigadas.</p></div>
          <div><span>02</span><strong>Prioridades de ação</strong><p>Identificação do que merece atenção primeiro e dos motivos para essa escolha.</p></div>
          <div><span>03</span><strong>Plano de ação</strong><p>Recomendações, encaminhamentos e próximos passos de acordo com o escopo contratado.</p></div>
        </div>
      </section>

      <section className={styles.entry} id="comecar" aria-labelledby="comece-title">
        <div className={styles.entryHeader}>
          <div>
            <span className={styles.kicker}>O ponto de partida</span>
            <h2 id="comece-title">Como começa <em>nosso trabalho.</em></h2>
          </div>
          <p className={styles.entryIntro}>
            Na Blinko, o diagnóstico é o primeiro serviço contratado.
            Não indicamos uma solução antes de investigar o que o negócio precisa.
          </p>
        </div>
        <div className={styles.diagnosticSteps} aria-label="Como começa um projeto na Blinko">
          <div><span>01</span><strong>Triagem gratuita</strong><p>Uma conversa inicial para conhecer seu negócio e entender suas necessidades.</p></div>
          <div><span>02</span><strong>Diagnóstico contratado</strong><p>Investigação, evidências e prioridades em um escopo definido.</p></div>
          <div><span>03</span><strong>Soluções complementares</strong><p>Quando necessário, apresentamos uma proposta específica ou indicamos especialistas.</p></div>
        </div>
        <div className={styles.entryGrid}>
          <a className={[styles.path, styles.pathStrategic, styles.diagnosticPath].join(" ")}
            href="#triagem" aria-label="Começar a triagem gratuita para conversar sobre o Diagnóstico Blinko">
            <div className={styles.pathTop}>
              <span>Diagnóstico Blinko · nossa especialidade</span>
              <b aria-hidden="true">↗︎</b>
            </div>
            <div className={styles.pathBody}>
              <h3>Não sabe por onde começar?</h3>
              <p>Conte-nos brevemente o que está acontecendo no seu negócio. Vamos entender seu contexto e explicar como funciona a contratação do diagnóstico.</p>
            </div>
            <span className={styles.pathCta}>Começar triagem gratuita <i aria-hidden="true">↗︎</i></span>
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
            <p>Sim. É um contato breve para conhecer seu negócio e suas necessidades e explicar o processo. A triagem não identifica causas nem substitui o diagnóstico técnico.</p>
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
          <a className={styles.faqLink} href="#triagem">Comece pela triagem gratuita <span aria-hidden="true">↗︎</span></a>
        </div>
      </section>

      <section className={styles.final} id="triagem" aria-labelledby="final-title">
        <div className={styles.finalBackdrop} aria-hidden="true" />
        <div className={styles.finalCopy}>
          <span className={styles.kicker}>Blinko Studio — clareza para evoluir</span>
          <h2 id="final-title">Todo avanço começa com <em>uma boa pergunta.</em></h2>
          <p>Antes de propor uma solução, queremos conhecer a realidade do seu negócio.</p>
          <img className={styles.closingMark} src="/brand/monograma-b-rosa.svg" alt="" aria-hidden="true" loading="lazy" />
        </div>
        <div className={styles.triageGlass}>
          <QuickTriageForm demo />
        </div>
      </section>

      <footer className={styles.footer}>
        <img src={BLINKO_LOGO_DARK_DATA_URI} alt="Blinko Studio" />
        <span>Pesquisa · estratégia · criação</span>
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
