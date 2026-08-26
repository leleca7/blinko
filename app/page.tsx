"use client";

import { useEffect } from "react";

const pillars = [
  "Marca",
  "Digital",
  "Financeiro",
  "Operação",
  "Atendimento",
  "Gestão",
  "Equipe",
];

const cases = [
  {
    name: "PintService",
    problem: "Atendimento e operação fragmentados.",
    answer: "Central de atendimento, fluxo de veículos, tarefas, IA e controle humano.",
    index: "01",
  },
  {
    name: "Valtec",
    problem: "Demanda precisava virar serviço de verdade.",
    answer: "Aquisição local, formulário, operação comercial, métricas e gestão de serviços.",
    index: "02",
  },
  {
    name: "Plumareli",
    problem: "Crescimento exigia estrutura para famílias e operação educacional.",
    answer: "Jornada, acompanhamento, evidências, progresso e experiência da família.",
    index: "03",
  },
  {
    name: "Wanelle",
    problem: "Pedidos, agenda, estoque e financeiro precisavam conversar.",
    answer: "Sistema de gestão conectado ao fluxo real da operação.",
    index: "04",
  },
];

export default function Home() {
  useEffect(() => {
    const root = document.documentElement;

    const onPointerMove = (event: PointerEvent) => {
      root.style.setProperty("--mouse-x", `${event.clientX}px`);
      root.style.setProperty("--mouse-y", `${event.clientY}px`);
      root.style.setProperty("--mx", String(event.clientX / window.innerWidth - 0.5));
      root.style.setProperty("--my", String(event.clientY / window.innerHeight - 0.5));
    };

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? window.scrollY / max : 0;
      root.style.setProperty("--scroll-progress", String(progress));
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <main>
      <div className="cursor-glow" aria-hidden="true" />
      <div className="scroll-progress" aria-hidden="true" />

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Blinko, início">
          blinko<span>*</span>
        </a>
        <nav aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#analise">O que analisamos</a>
          <a href="#cases">Cases</a>
          <a href="#diagnostico" className="nav-cta">
            Diagnóstico
          </a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-noise" aria-hidden="true" />
        <p className="eyebrow">SISTEMA OPERACIONAL DE MODERNIZAÇÃO</p>

        <div className="hero-copy">
          <h1>
            O problema
            <span>raramente está</span>
            onde parece.
          </h1>
          <p>
            A Blinko entra na empresa, encontra a raiz do que está travando o negócio
            e implanta a solução certa — da estratégia à tecnologia.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#diagnostico">
              Fazer diagnóstico gratuito
            </a>
            <a className="button button-ghost" href="#como-funciona">
              Ver como funciona
            </a>
          </div>
        </div>

        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="root-core">
            <span>RAIZ</span>
          </div>
          <span className="orbit-label label-a">ATENDIMENTO</span>
          <span className="orbit-label label-b">OPERAÇÃO</span>
          <span className="orbit-label label-c">GESTÃO</span>
          <span className="orbit-label label-d">DIGITAL</span>
        </div>

        <div className="hero-scroll-cue" aria-hidden="true">
          <span>role para investigar</span>
          <i />
        </div>
      </section>

      <section className="manifesto section-paper" id="como-funciona">
        <div className="section-number">01</div>
        <div className="manifesto-grid">
          <p className="kicker">VOCÊ NÃO PRECISA SABER QUAL SERVIÇO CONTRATAR.</p>
          <h2>
            Sua empresa mostra a folha.
            <br />
            <em>A Blinko procura a raiz.</em>
          </h2>
          <p className="manifesto-text">
            Às vezes parece que o problema é Instagram. Às vezes parece que é site.
            Às vezes parece que falta automação. Antes de construir qualquer coisa,
            nós entendemos o que realmente está acontecendo.
          </p>
        </div>
      </section>

      <section className="root-story" aria-label="Da superfície até a raiz">
        <div className="root-sticky">
          <div className="root-visual" aria-hidden="true">
            <div className="leaf leaf-1" />
            <div className="leaf leaf-2" />
            <div className="stem" />
            <div className="root-line root-line-a" />
            <div className="root-line root-line-b" />
            <div className="root-line root-line-c" />
            <div className="root-line root-line-d" />
          </div>

          <div className="root-copy">
            <div className="story-step step-1">
              <span>SUPERFÍCIE</span>
              <h3>“Precisamos postar mais.”</h3>
              <p>Talvez. Mas isso é o sintoma ou a causa?</p>
            </div>
            <div className="story-step step-2">
              <span>CAMADAS</span>
              <h3>Comunicação, atendimento, operação.</h3>
              <p>Cada camada muda a leitura do problema.</p>
            </div>
            <div className="story-step step-3">
              <span>RAIZ</span>
              <h3>Primeiro corrigimos o que sustenta tudo.</h3>
              <p>Depois avançamos para as pontas com muito mais precisão.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="method section-green">
        <div className="section-number light">02</div>
        <div className="method-intro">
          <p className="kicker light-text">MÉTODO BLINKO</p>
          <h2>Diagnosticar. Priorizar. Implantar. Acompanhar.</h2>
          <p>
            Não vendemos uma ferramenta antes de entender o negócio. A solução nasce
            depois da leitura.
          </p>
        </div>

        <div className="method-track">
          {[
            ["01", "Entender", "Coletamos contexto, sinais, dados e objetivo."],
            ["02", "Diagnosticar", "Encontramos gargalos, causas e oportunidades."],
            ["03", "Priorizar", "Organizamos o que vem agora, depois e na evolução."],
            ["04", "Implantar", "Executamos a solução certa com especialistas e tecnologia."],
            ["05", "Acompanhar", "Medimos resultado e abrimos o próximo ciclo quando fizer sentido."],
          ].map(([n, title, text]) => (
            <article className="method-card" key={n}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pillars section-paper" id="analise">
        <div className="section-number">03</div>
        <div className="pillars-heading">
          <p className="kicker">A EMPRESA COMO UM SISTEMA VIVO</p>
          <h2>Sete áreas. Uma leitura conectada.</h2>
          <p>
            A Blinko olha o negócio inteiro para não resolver uma parte e piorar outra.
          </p>
        </div>

        <div className="pillars-list" aria-label="Sete pilares Blinko">
          {pillars.map((pillar, index) => (
            <div className="pillar-row" key={pillar}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{pillar}</strong>
              <i aria-hidden="true" />
            </div>
          ))}
        </div>
      </section>

      <section className="cases section-lilac" id="cases">
        <div className="section-number">04</div>
        <div className="cases-heading">
          <p className="kicker">PROBLEMAS DIFERENTES. SOLUÇÕES DIFERENTES.</p>
          <h2>Não existe pacote pronto para uma empresa real.</h2>
        </div>

        <div className="case-grid">
          {cases.map((item) => (
            <article className="case-card" key={item.name}>
              <span className="case-index">{item.index}</span>
              <h3>{item.name}</h3>
              <p className="case-problem">{item.problem}</p>
              <div className="case-divider" />
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="diagnostic" id="diagnostico">
        <div className="diagnostic-art" aria-hidden="true">
          <div className="diag-ring ring-a" />
          <div className="diag-ring ring-b" />
          <div className="diag-dot dot-a" />
          <div className="diag-dot dot-b" />
          <div className="diag-dot dot-c" />
        </div>

        <div className="diagnostic-copy">
          <p className="kicker light-text">COMECE PELO PONTO CERTO</p>
          <h2>Descubra onde sua empresa pode estar perdendo evolução.</h2>
          <p>
            Responda uma análise inicial. A Blinko organiza os sinais e identifica se
            existe uma oportunidade real para aprofundar.
          </p>
          <a className="button button-pink" href="mailto:contato@blinko.com.br?subject=Diagnóstico%20Blinko">
            Quero começar o diagnóstico
          </a>
          <small>O diagnóstico gratuito é uma triagem inicial, não substitui o Diagnóstico Blinko profundo.</small>
        </div>
      </section>

      <footer>
        <div className="footer-brand">blinko<span>*</span></div>
        <p>Inovação aplicada ao problema real da empresa.</p>
        <div className="footer-meta">
          <span>© {new Date().getFullYear()} Blinko</span>
          <a href="#top">Voltar ao topo</a>
        </div>
      </footer>
    </main>
  );
}
