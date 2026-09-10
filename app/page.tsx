import { BLINKO_LOGO_DARK_DATA_URI } from "../lib/blinko/brand-logo-data";
import styles from "./home-v2.module.css";

const areas = ["Marca", "Digital", "Financeiro", "Operação", "Atendimento", "Gestão", "Equipe"];

const steps = [
  ["01", "Pré-diagnóstico", "Você mostra o objetivo, o contexto e os sinais que percebe hoje. A triagem inicial é gratuita."],
  ["02", "Investigar", "A Blinko organiza informações, lacunas e hipóteses sem tratar percepção como causa confirmada."],
  ["03", "Validar e priorizar", "Quando há evidência suficiente, o problema ganha prioridade e fica mais claro o que precisa mudar primeiro."],
  ["04", "Executar", "A solução pode envolver marca, marketing, atendimento, operação, gestão, tecnologia, sistemas ou automação."],
  ["05", "Acompanhar", "A implementação é acompanhada para entender o que mudou, o que precisa de ajuste e qual é o próximo passo."],
];

const solutions = [
  ["01", "Marca + comunicação", "Posicionamento, identidade, site e comunicação quando o problema validado passa por percepção e coerência."],
  ["02", "Captação + atendimento", "Landing pages, formulários, CRM e fluxos de atendimento quando aquisição e resposta precisam trabalhar juntas."],
  ["03", "Operação + processos", "Rotinas, responsabilidades e documentação quando retrabalho e informação espalhada sustentam perdas."],
  ["04", "Tecnologia + automação", "Sistemas, integrações e IA quando a tecnologia consegue reduzir atrito com controle humano."],
  ["05", "Gestão + indicadores", "Dashboards, indicadores e cadências quando falta clareza para decidir e acompanhar."],
  ["06", "Experiência + relacionamento", "Jornada, comunicação e pontos de contato quando confiança e experiência precisam ser fortalecidas."],
];

const projects = [
  { name: "Valtec", type: "Marca · site · conteúdo", text: "Presença técnica organizada em identidade, materiais, conteúdo e experiência digital.", url: "https://valtec-solucoes.vercel.app" },
  { name: "Pint Services", type: "Sistema · operação · interface", text: "Estrutura digital para organizar informação operacional, prioridades e pontos de decisão.", url: "https://oficina-ia-demo.vercel.app" },
  { name: "Plumareli", type: "Educação · plataforma · experiência", text: "Organização de uma proposta educacional em uma experiência digital clara, humana e navegável.", url: "https://plumarelieducacao.vercel.app/apresentacao" },
];

const faqs = [
  ["O que é a Blinko?", "A Blinko é um estúdio estratégico de diagnóstico e execução. Começa entendendo o que está acontecendo na empresa, investiga hipóteses, define prioridades e só então estrutura as soluções que fizerem sentido."],
  ["Para quem a Blinko faz sentido?", "Para empresas e negócios que percebem gargalos, riscos ou oportunidades, mas precisam entender melhor a causa, a prioridade e o caminho de execução antes de investir em soluções isoladas."],
  ["Preciso saber qual serviço contratar?", "Não. A lógica da Blinko é justamente evitar começar pela solução. O processo começa pelos sinais e pelo contexto para descobrir o que realmente precisa ser tratado e em qual ordem."],
  ["O pré-diagnóstico é gratuito?", "Sim. O pré-diagnóstico é uma triagem inicial gratuita. Ele ajuda a organizar o contexto e avaliar se existe algo que vale aprofundar. O Diagnóstico Blinko completo é uma etapa separada e paga."],
  ["O que a Blinko analisa?", "A leitura conecta sete áreas: Marca, Digital, Financeiro, Operação, Atendimento, Gestão e Equipe. Também considera confiança, reputação, relação com públicos e coerência entre discurso e prática."],
  ["A Blinko também executa as soluções?", "Sim. Depois da validação, a Blinko pode selecionar, adaptar ou construir intervenções e acompanhar a implementação. A solução pode combinar diferentes competências, dependendo do problema validado."],
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://blinko-wine.vercel.app/#organization",
      name: "Blinko",
      url: "https://blinko-wine.vercel.app/",
      description: "Estúdio estratégico de diagnóstico e execução para empresas, conectando marca, marketing, atendimento, operação, gestão e tecnologia.",
      sameAs: ["https://www.instagram.com/blinko_studio/"],
    },
    {
      "@type": "WebSite",
      "@id": "https://blinko-wine.vercel.app/#website",
      url: "https://blinko-wine.vercel.app/",
      name: "Blinko",
      publisher: { "@id": "https://blinko-wine.vercel.app/#organization" },
      inLanguage: "pt-BR",
    },
    {
      "@type": "Service",
      name: "Diagnóstico empresarial e execução de soluções",
      provider: { "@id": "https://blinko-wine.vercel.app/#organization" },
      description: "Investigação de gargalos, validação de prioridades e execução de soluções sob medida em áreas conectadas da empresa.",
      audience: { "@type": "Audience", audienceType: "Empresas e negócios com gargalos, riscos ou oportunidades a investigar" },
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

export default function Home() {
  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <header className={styles.topbar}>
        <a href="#top" aria-label="Blinko, início" className={styles.logo}>
          <img src={BLINKO_LOGO_DARK_DATA_URI} alt="Blinko" />
        </a>
        <nav className={styles.nav} aria-label="Navegação principal">
          <a href="#metodo">Como funciona</a>
          <a href="#analise">O que analisamos</a>
          <a href="#solucoes">Intervenções</a>
          <a href="#projetos">Projetos</a>
          <a href="#faq">FAQ</a>
          <a className={styles.primaryNav} href="/diagnostico">Pré-diagnóstico</a>
        </nav>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>DIAGNÓSTICO EMPRESARIAL · ESTRATÉGIA · EXECUÇÃO</p>
          <h1>Descubra o que mexer <em>primeiro.</em></h1>
          <p className={styles.heroLede}>
            A Blinko investiga os sinais da empresa, valida prioridades e executa soluções sob medida em marca, marketing, atendimento, operação, gestão e tecnologia — com acompanhamento do que acontece depois.
          </p>
          <div className={styles.actions}>
            <a className={`${styles.button} ${styles.buttonLight}`} href="/diagnostico">Fazer pré-diagnóstico gratuito</a>
            <a className={styles.secondaryLink} href="#metodo">Entender o método ↓</a>
          </div>
        </div>
        <div className={styles.heroVisual} aria-label="Direção visual editorial Blinko">
          <div className={styles.photoFrame}><img src="/photos/notebook-2.webp" alt="Trabalho estratégico em notebook" /></div>
          <div className={styles.photoCaption}><span>BLINKO / EM PROCESSO</span><span>Diagnosticar antes de prescrever</span></div>
        </div>
      </section>

      <section className={styles.signalStrip} aria-label="Como a Blinko trabalha">
        <div><strong>Entender</strong><span>o contexto</span></div>
        <div><strong>Investigar</strong><span>as hipóteses</span></div>
        <div><strong>Executar</strong><span>com prioridade</span></div>
        <div><strong>Acompanhar</strong><span>o que mudou</span></div>
      </section>

      <section className={styles.definition} id="sobre">
        <span className={styles.sectionLabel}>01 / O QUE É A BLINKO</span>
        <div>
          <h2>Um estúdio estratégico que começa pelo <em>problema real.</em></h2>
          <div className={styles.definitionText}>
            <p>Você não precisa chegar sabendo se precisa de marketing, um sistema, um novo processo ou uma mudança de posicionamento.</p>
            <p>A Blinko conecta diagnóstico e execução para transformar sinais dispersos em prioridades mais claras. Em vez de empilhar serviços, entende a empresa como um sistema e escolhe a intervenção a partir do que foi validado.</p>
          </div>
          <h3 className={styles.sectionLabel}>PARA QUEM A BLINKO FAZ SENTIDO</h3>
          <div className={styles.fitGrid}>
            <div className={styles.fitItem}><strong>Existem sinais, mas pouca clareza</strong><span>Algo não está funcionando como deveria, mas a causa ainda não está bem definida.</span></div>
            <div className={styles.fitItem}><strong>Há decisões demais sem prioridade</strong><span>Marketing, operação, atendimento e tecnologia competem pela atenção e pelo investimento.</span></div>
            <div className={styles.fitItem}><strong>Existe uma oportunidade relevante</strong><span>A empresa quer crescer ou mudar sem construir uma solução antes de entender o contexto.</span></div>
            <div className={styles.fitItem}><strong>Existe disposição para implementar</strong><span>O diagnóstico vira valor quando a empresa está aberta a executar, medir e ajustar.</span></div>
          </div>
        </div>
      </section>

      <section className={styles.method} id="metodo">
        <div className={styles.introBlock}>
          <div><span className={styles.sectionLabel}>02 / MÉTODO BLINKO</span><h2>Investigar antes de prescrever.</h2></div>
          <p>O método separa sinal, hipótese e causa validada. A solução entra depois — com motivo claro, prioridade e acompanhamento.</p>
        </div>
        <ol className={styles.steps}>
          {steps.map(([number, title, text]) => <li className={styles.step} key={number}><span className={styles.stepNum}>{number}</span><h3>{title}</h3><p>{text}</p></li>)}
        </ol>
      </section>

      <section className={styles.analysis} id="analise">
        <div className={styles.analysisIntro}>
          <span className={styles.sectionLabel}>03 / LEITURA CONECTADA</span>
          <h2>Sete áreas. Uma empresa.</h2>
          <p>Um sintoma pode aparecer em uma ponta e ter origem em outra. Por isso a leitura não separa áreas que, na prática, funcionam juntas.</p>
        </div>
        <div className={styles.areaList}>{areas.map((area, index) => <div className={styles.area} key={area}><span>{String(index + 1).padStart(2,"0")}</span><strong>{area}</strong></div>)}</div>
      </section>

      <section className={styles.solutions} id="solucoes">
        <div className={styles.solutionsHead}>
          <div><span className={styles.sectionLabel}>04 / INTERVENÇÕES</span><h2>A solução depende do que foi validado.</h2></div>
          <p>A Blinko não vende um pacote pronto antes de entender o problema. Depois do diagnóstico, diferentes competências podem ser combinadas, adaptadas ou construídas para o contexto da empresa.</p>
        </div>
        <div className={styles.solutionGrid}>{solutions.map(([number,title,text]) => <article className={styles.solutionCard} key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
      </section>

      <section className={styles.proof} id="projetos">
        <div className={styles.proofHeader}>
          <div><span className={styles.sectionLabel}>05 / PROVA DE EXECUÇÃO</span><h2>Trabalho que já ganhou forma.</h2></div>
          <p>Projetos em frentes diferentes mostram como estratégia e execução podem assumir formatos distintos quando partem do contexto certo — de marca e conteúdo a sistemas e experiência digital.</p>
        </div>
        <div className={styles.projectGrid}>{projects.map(project => <a className={styles.projectCard} key={project.name} href={project.url} target="_blank" rel="noreferrer"><small>{project.type}</small><h3>{project.name}</h3><p>{project.text}</p><b>Ver projeto ↗</b></a>)}</div>
      </section>

      <section className={styles.benefits} id="beneficios">
        <div className={styles.benefitsTop}><span className={styles.sectionLabel}>06 / O QUE VOCÊ GANHA</span><h2>Menos solução solta. Mais clareza para decidir.</h2></div>
        <div className={styles.benefitGrid}>
          <article className={styles.benefit}><span>01</span><h3>Clareza</h3><p>Separar percepção, hipótese e evidência antes de investir energia e dinheiro.</p></article>
          <article className={styles.benefit}><span>02</span><h3>Prioridade</h3><p>Entender o que merece atenção primeiro e o que pode esperar.</p></article>
          <article className={styles.benefit}><span>03</span><h3>Integração</h3><p>Conectar marca, processos, atendimento, gestão e tecnologia quando o problema atravessa áreas.</p></article>
          <article className={styles.benefit}><span>04</span><h3>Acompanhamento</h3><p>Observar o que aconteceu depois da execução e ajustar o caminho quando necessário.</p></article>
        </div>
      </section>

      <section className={styles.faq} id="faq">
        <div><span className={styles.sectionLabel}>07 / PERGUNTAS FREQUENTES</span><h2>Sem complicar o que pode ser claro.</h2></div>
        <div className={styles.faqList}>{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
      </section>

      <section className={styles.finalCta} id="contato" style={{ background: "#01301e", color: "#f3efeb" }}>
        <div><span className={styles.microLabel}>08 / PRÓXIMO PASSO</span><h2>Conte o que está acontecendo. A gente começa pelos sinais.</h2></div>
        <div className={styles.finalCopy}>
          <p>O pré-diagnóstico gratuito organiza o contexto inicial e ajuda a entender se existe algo que vale aprofundar com a Blinko.</p>
          <div className={styles.actions}><a className={`${styles.button} ${styles.buttonPink}`} href="/diagnostico">Começar pré-diagnóstico</a></div>
          <div className={styles.contactLinks}><a href="https://www.instagram.com/blinko_studio/" target="_blank" rel="noreferrer">Instagram @blinko_studio ↗</a><a href="/bio">Conhecer a Blinko</a></div>
        </div>
      </section>

      <footer className={styles.footer}>
        <img src={BLINKO_LOGO_DARK_DATA_URI} alt="Blinko" />
        <p>Diagnóstico · estratégia · execução · acompanhamento</p>
        <a href="/diagnostico">Pré-diagnóstico →</a>
      </footer>
    </main>
  );
}
