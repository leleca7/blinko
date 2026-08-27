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
    const pointer = (event: PointerEvent) => {
      root.style.setProperty("--mx", String(event.clientX / innerWidth - 0.5));
      root.style.setProperty("--my", String(event.clientY / innerHeight - 0.5));
    };
    const scroll = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      root.style.setProperty("--scroll", String(max > 0 ? scrollY / max : 0));
    };
    addEventListener("pointermove", pointer, { passive: true });
    addEventListener("scroll", scroll, { passive: true });
    scroll();
    return () => {
      removeEventListener("pointermove", pointer);
      removeEventListener("scroll", scroll);
    };
  }, []);

  return (
    <main>
      <div className="progress" aria-hidden="true" />
      <header className="topbar">
        <a href="#top" aria-label="Blinko, início" className="logo-wrap">
          <img src="/brand/logo-claro.webp" alt="Blinko" />
        </a>
        <nav>
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
        <div className="hero-wash" />
        <div className="hero-grid" />
        <div className="hero-content">
          <p className="eyebrow">DIAGNÓSTICO · ESTRATÉGIA · EXECUÇÃO · EVOLUÇÃO</p>
          <h1>O problema <em>raramente</em> está onde parece.</h1>
          <p className="hero-lede">A Blinko entra na empresa, encontra a raiz do que está travando o negócio e implanta a solução certa — da estratégia à tecnologia.</p>
          <div className="actions">
            <a className="button light" href="/diagnostico">Fazer diagnóstico</a>
            <a className="text-link" href="#como">investigar ↓</a>
          </div>
        </div>
        <img className="hero-stamp" src="/brand/flor-centro.webp" alt="" aria-hidden="true" />
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

      <section className="root-story">
        <div className="root-sticky">
          <div className="botanical" aria-hidden="true">
            <i className="leaf one" /><i className="leaf two" /><i className="stem" />
            <i className="root r1" /><i className="root r2" /><i className="root r3" /><i className="root r4" />
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
        <img className="floating-stamp" src="/brand/flor-centro.webp" alt="" aria-hidden="true" />
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
        <div className="diag-orbit" aria-hidden="true"><i/><i/><b>*</b></div>
        <div className="diag-copy">
          <span className="section-id inverse">05 / COMECE PELO PONTO CERTO</span>
          <h2>Descubra onde sua empresa pode estar perdendo evolução.</h2>
          <p>Uma análise inicial para organizar sinais e entender se existe uma oportunidade real para aprofundar.</p>
          <a className="button pink" href="/diagnostico">Quero começar</a>
          <small>O diagnóstico gratuito é uma triagem inicial. O Diagnóstico Blinko profundo é uma etapa separada.</small>
        </div>
      </section>

      <footer><img src="/brand/logo-claro.webp" alt="Blinko" /><p>Inovação aplicada ao problema real da empresa.</p><a href="#top">Voltar ao topo ↑</a></footer>
    </main>
  );
}
