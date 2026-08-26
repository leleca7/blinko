"use client";

import { useEffect } from "react";

const pillars = ["Marca", "Digital", "Financeiro", "Operação", "Atendimento", "Gestão", "Equipe"];

const cases = [
  ["01", "PintService", "Atendimento e operação", "Uma central conectando atendimento, veículos, tarefas e IA com controle humano."],
  ["02", "Valtec", "Demanda que precisava virar serviço", "Aquisição local, formulário, métricas e organização comercial em um fluxo só."],
  ["03", "Plumareli", "Crescer sem perder o acompanhamento", "Jornada das famílias, progresso e operação educacional organizados em sistema."],
  ["04", "Wanelle", "Uma operação que precisava conversar", "Pedidos, agenda, estoque e financeiro conectados ao trabalho real."],
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
      <style>{`
        .topbar{
          top:0!important;left:0!important;right:0!important;
          min-height:64px;padding:8px 16px!important;border:0!important;
          border-bottom:1px solid rgba(255,255,255,.18)!important;
          border-radius:0 0 22px 22px!important;
          background:linear-gradient(90deg,rgba(1,48,30,.88),rgba(15,70,52,.72) 52%,rgba(1,48,30,.84))!important;
          -webkit-backdrop-filter:blur(18px) saturate(135%)!important;
          backdrop-filter:blur(18px) saturate(135%)!important;
          box-shadow:0 10px 32px rgba(1,48,30,.18)!important;
        }
        .logo-wrap{width:118px!important;height:42px!important;overflow:visible!important}
        .logo-wrap img{height:34px!important;width:auto!important;max-width:116px!important;object-fit:contain!important;margin:0!important}
        .hero-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;transform:scale(1.015);filter:saturate(.88) contrast(1.03) brightness(.88)}
        .hero-wash{position:absolute;inset:0;background:linear-gradient(90deg,rgba(1,48,30,.82) 0%,rgba(1,48,30,.60) 40%,rgba(1,48,30,.24) 72%,rgba(1,48,30,.12) 100%),linear-gradient(180deg,rgba(1,48,30,.06),rgba(1,48,30,.08) 58%,rgba(1,48,30,.58));pointer-events:none}
        .walk-photo{width:min(100%,600px)!important}
        .walk-photo img{width:100%!important;height:auto!important;max-height:none!important;object-fit:contain!important;filter:none!important}
        .editorial-photo{width:min(100%,720px)!important}
        .editorial-photo img{width:100%!important;height:auto!important;object-fit:contain!important;filter:none!important}
        .diag-flower{position:absolute!important;z-index:4!important;left:50%!important;top:50%!important;width:clamp(8rem,14vw,13rem)!important;height:auto!important;display:block!important;transform:translate(-50%,-50%)!important;transform-origin:center!important;animation:diagPulse 4s ease-in-out infinite!important;filter:drop-shadow(0 0 42px rgba(239,59,127,.18))}
        footer .footer-logo{height:38px!important;max-width:150px!important}
        @keyframes diagPulse{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.055)}}
        @media(max-width:620px){
          .topbar{border-radius:0 0 18px 18px!important;padding:7px 12px!important}
          .logo-wrap{width:105px!important;height:38px!important}
          .logo-wrap img{height:29px!important;max-width:103px!important}
          .hero-video{object-position:58% center}
        }
        @media(prefers-reduced-motion:reduce){.hero-video{display:none!important}.diag-flower{animation:none!important}}
      `}</style>

      <div className="cursor-glow" aria-hidden="true" />
      <div className="progress" aria-hidden="true" />

      <header className="topbar">
        <a href="#top" aria-label="Blinko, início" className="logo-wrap">
          <img src="/brand/logo-claro.webp" alt="Blinko" />
        </a>
        <nav aria-label="Navegação principal">
          <a href="#como">Como funciona</a>
          <a href="#analise">Análise</a>
          <a href="#cases">Cases</a>
          <a className="nav-cta" href="#diagnostico">Diagnóstico</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <video className="hero-video" autoPlay muted loop playsInline poster="/media/hero-poster.webp" aria-hidden="true">
          <source src="/media/hero.mp4" type="video/mp4" />
        </video>
        <div className="hero-wash" aria-hidden="true" />
        <div className="hero-content">
          <p className="eyebrow">DIAGNÓSTICO · ESTRATÉGIA · EXECUÇÃO · EVOLUÇÃO</p>
          <h1>O problema <em>raramente</em> está onde parece.</h1>
          <p className="hero-lede">A Blinko entra na empresa, encontra a raiz do que está travando o negócio e implanta a solução certa — da estratégia à tecnologia.</p>
          <div className="actions">
            <a className="button light" href="#diagnostico">Fazer diagnóstico</a>
            <a className="text-link" href="#como">investigar ↓</a>
          </div>
        </div>
        <span className="side-note">ROLE PARA ENTRAR NA EMPRESA</span>
      </section>

      <section className="enter" id="como">
        <div className="enter-copy">
          <span className="section-id">01 / ANTES DE PROPOR, ENTRAMOS.</span>
          <h2>Você mostra o que está acontecendo. <em>A Blinko procura o que está causando.</em></h2>
          <p>Não começamos escolhendo um serviço. Começamos entendendo a empresa, o contexto e a ordem certa de mexer nas coisas.</p>
        </div>
        <figure className="walk-photo">
          <img src="/photos/caminhando.webp" alt="Profissional caminhando em direção a um espaço Blinko" />
          <figcaption>entrar · observar · perguntar · conectar</figcaption>
        </figure>
        <span className="giant-word">ENTRAR</span>
      </section>

      <section className="root-story" aria-label="Da superfície até a raiz">
        <div className="root-sticky">
          <div className="root-organic" aria-hidden="true">
            <div className="root-orbit root-orbit-a" />
            <div className="root-orbit root-orbit-b" />
            <div className="root-shape root-shape-a" />
            <div className="root-shape root-shape-b" />
            <div className="root-shape root-shape-c" />
            <div className="root-core"><span>RAIZ</span><small>o ponto que sustenta o resto</small></div>
            <span className="root-caption">sintoma → contexto → causa</span>
          </div>
          <div className="root-scenes">
            <article className="scene s1"><span>SUPERFÍCIE</span><h3>“Precisamos postar mais.”</h3><p>Talvez. Mas isso é a causa ou só o lugar onde o problema aparece?</p></article>
            <article className="scene s2"><span>CAMADAS</span><h3>Comunicação. Atendimento. Operação.</h3><p>A leitura muda quando as áreas deixam de ser vistas isoladamente.</p></article>
            <article className="scene s3"><span>RAIZ</span><h3>Primeiro corrigimos o que sustenta tudo.</h3><p>Depois avançamos para as pontas com muito mais precisão.</p></article>
          </div>
        </div>
      </section>

      <section className="editorial">
        <div className="editorial-photo"><img src="/photos/notebook-2.webp" alt="Profissional trabalhando em notebook em ambiente Blinko" /></div>
        <div className="editorial-copy">
          <span className="section-id">02 / MÉTODO BLINKO</span>
          <p className="big-quote">“Você não precisa chegar sabendo qual serviço contratar.”</p>
          <p className="body-copy">Diagnóstico antes de solução. Prioridade antes de volume. Especialistas e tecnologia trabalhando para que cada intervenção tenha motivo.</p>
          <div className="method-mini">
            {[["01","Entender"],["02","Diagnosticar"],["03","Priorizar"],["04","Implantar"],["05","Acompanhar"]].map(([n,t]) => <div key={n}><span>{n}</span><strong>{t}</strong></div>)}
          </div>
        </div>
      </section>

      <section className="pillars" id="analise">
        <div className="pillars-head">
          <span className="section-id">03 / UMA EMPRESA É UM SISTEMA VIVO</span>
          <h2>Sete áreas. <em>Uma leitura conectada.</em></h2>
          <p>A solução pode terminar em site, sistema, automação, processo, atendimento, marketing ou gestão. O diagnóstico vem antes do nome da ferramenta.</p>
        </div>
        <div className="pillar-list">
          {pillars.map((p, i) => <div className="pillar" key={p}><span>{String(i + 1).padStart(2,"0")}</span><strong>{p}</strong><i /></div>)}
        </div>
      </section>

      <section className="cases" id="cases">
        <div className="cases-title"><span className="section-id">04 / PROBLEMAS REAIS</span><h2>Soluções diferentes porque empresas reais <em>não cabem em pacote pronto.</em></h2></div>
        <div className="case-list">
          {cases.map(([n,name,problem,answer]) => <article key={name}><span>{n}</span><h3>{name}</h3><p className="problem">{problem}</p><p>{answer}</p></article>)}
        </div>
      </section>

      <section className="diagnostic" id="diagnostico">
        <div className="diag-orbit" aria-hidden="true"><i/><i/><img className="diag-flower" src="/brand/flor-centro.webp" alt="" /></div>
        <div className="diag-copy">
          <span className="section-id inverse">05 / COMECE PELO PONTO CERTO</span>
          <h2>Descubra onde sua empresa pode estar perdendo evolução.</h2>
          <p>Uma análise inicial para organizar sinais e entender se existe uma oportunidade real para aprofundar.</p>
          <a className="button pink" href="mailto:contato@blinko.com.br?subject=Diagnóstico%20Blinko">Quero começar</a>
          <small>O diagnóstico gratuito é uma triagem inicial. O Diagnóstico Blinko profundo é uma etapa separada.</small>
        </div>
      </section>

      <footer><img className="footer-logo" src="/brand/logo-claro.webp" alt="Blinko" /><p>Inovação aplicada ao problema real da empresa.</p><a href="#top">Voltar ao topo ↑</a></footer>
    </main>
  );
}
