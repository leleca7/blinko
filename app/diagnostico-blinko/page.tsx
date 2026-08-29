import type { Metadata } from "next";
import Link from "next/link";
import { BLINKO_LOGO_DARK_DATA_URI } from "../../lib/blinko/brand-logo-data";
import styles from "./diagnostico-blinko.module.css";

export const metadata: Metadata = {
  title: "Diagnóstico Blinko | Investigação + Prioridade",
  description: "Entenda como funciona o Diagnóstico Blinko profundo: investigação de evidências, validação de causas, definição de prioridades e caminhos de intervenção.",
};

const pillars = ["Marca", "Digital", "Financeiro", "Operação", "Atendimento", "Gestão", "Equipe"];

const process = [
  ["01", "Coleta", "Reunimos informações dos sete pilares, contexto, evidências disponíveis, lacunas e perguntas que ainda precisam de resposta."],
  ["02", "Análise", "Sinais são cruzados entre áreas para formar hipóteses, contradições, padrões e problemas candidatos."],
  ["03", "Validação", "Problemas e causas só avançam quando existe base suficiente. O que ainda é hipótese continua identificado como hipótese."],
  ["04", "Priorização", "Definimos o que merece atenção primeiro considerando impacto, dependências, risco, esforço e contexto da empresa."],
  ["05", "Intervenção", "A partir da prioridade validada, estruturamos caminhos de ação. A execução pode ou não ser contratada com a Blinko."],
];

export default function DiagnosticoBlinkoPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="Blinko, início"><img src={BLINKO_LOGO_DARK_DATA_URI} alt="Blinko" /></Link>
        <div className={styles.headerLinks}>
          <Link href="/">Site</Link>
          <Link className={styles.headerCta} href="/diagnostico">Pré-diagnóstico gratuito</Link>
        </div>
      </header>

      <section className={styles.hero}>
        <span>DIAGNÓSTICO BLINKO · ETAPA PROFUNDA E PAGA</span>
        <h1>Antes de decidir <em>o que fazer,</em> precisamos entender o que sustenta o problema.</h1>
        <p>O Diagnóstico Blinko aprofunda a investigação iniciada pelos sinais. Ele organiza evidências, testa hipóteses, identifica lacunas e define prioridades com revisão humana antes de qualquer prescrição.</p>
        <div className={styles.heroActions}>
          <Link className={styles.primary} href="/diagnostico">Começar pelo pré-diagnóstico</Link>
          <a className={styles.secondary} href="#diferenca">Ver a diferença entre as etapas ↓</a>
        </div>
      </section>

      <section className={styles.compare} id="diferenca">
        <div className={styles.sectionIntro}>
          <span>PRÉ-DIAGNÓSTICO X DIAGNÓSTICO</span>
          <h2>Duas etapas com profundidades diferentes.</h2>
        </div>
        <div className={styles.compareGrid}>
          <article>
            <span>PRÉ-DIAGNÓSTICO GRATUITO</span>
            <h3>Organiza os sinais.</h3>
            <p>É uma triagem inicial para entender contexto, objetivo, percepção da empresa e se existe algo que vale aprofundar.</p>
            <ul><li>não confirma causa;</li><li>não prescreve solução final;</li><li>não substitui coleta profunda;</li><li>prepara a próxima conversa.</li></ul>
          </article>
          <article className={styles.deep}>
            <span>DIAGNÓSTICO BLINKO</span>
            <h3>Investiga o que está por trás.</h3>
            <p>É uma etapa contratada para aprofundar evidências, confrontar hipóteses e construir uma base mais segura para decidir.</p>
            <ul><li>cruza os sete pilares;</li><li>registra lacunas e contradições;</li><li>valida causas quando houver evidência;</li><li>define prioridades e intervenções candidatas.</li></ul>
          </article>
        </div>
      </section>

      <section className={styles.pillars}>
        <div className={styles.sectionIntro}>
          <span>LEITURA CONECTADA</span>
          <h2>Sete pilares, sem tratar a empresa como sete empresas diferentes.</h2>
          <p>Também observamos reputação, confiança, públicos e coerência entre discurso e prática como uma lente transversal, não como uma área isolada.</p>
        </div>
        <div className={styles.pillarGrid}>{pillars.map((pillar, index) => <article key={pillar}><span>{String(index + 1).padStart(2, "0")}</span><strong>{pillar}</strong></article>)}</div>
      </section>

      <section className={styles.process}>
        <div className={styles.sectionIntro}>
          <span>COMO O TRABALHO AVANÇA</span>
          <h2>Sinal → hipótese → causa validada → prioridade → intervenção.</h2>
          <p>O método protege uma distinção importante: uma hipótese plausível ainda não é uma causa comprovada.</p>
        </div>
        <div className={styles.steps}>{process.map(([number, title, description]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
      </section>

      <section className={styles.output}>
        <div>
          <span>O QUE O DIAGNÓSTICO ENTREGA</span>
          <h2>Uma base de decisão, não um volume de páginas.</h2>
        </div>
        <div className={styles.outputGrid}>
          <article><strong>Leitura estruturada</strong><p>Sinais, forças, padrões, lacunas e contradições relevantes.</p></article>
          <article><strong>Problemas confirmados</strong><p>Somente quando existe evidência suficiente para tratá-los como confirmados.</p></article>
          <article><strong>Causas e hipóteses</strong><p>Separadas por nível de validação para não esconder incerteza.</p></article>
          <article><strong>Prioridades</strong><p>O que deve ser tratado primeiro e o que pode esperar.</p></article>
          <article><strong>Caminhos de intervenção</strong><p>Possibilidades coerentes com o que foi validado, sem pacote automático.</p></article>
          <article><strong>Próximos passos</strong><p>Uma base clara para decidir se a empresa executa internamente, com a Blinko ou com outro parceiro.</p></article>
        </div>
      </section>

      <section className={styles.ai}>
        <div className={styles.aiCopy}>
          <span>TECNOLOGIA COM CONTROLE HUMANO</span>
          <h2>A IA ajuda a encontrar relações. Ela não assina a conclusão.</h2>
          <p>Ferramentas de IA podem apoiar organização, análise de padrões e geração de perguntas. Conclusões, prioridades, recomendações sensíveis e comunicações relevantes permanecem sujeitas a revisão humana.</p>
        </div>
        <div className={styles.aiRules}>
          <p><strong>Não fazemos:</strong> transformar resposta de formulário em causa comprovada automaticamente.</p>
          <p><strong>Não fazemos:</strong> gerar preço, proposta ou compromisso comercial sem decisão humana.</p>
          <p><strong>Fazemos:</strong> usar tecnologia para aumentar consistência, rastreabilidade e qualidade da investigação.</p>
        </div>
      </section>

      <section className={styles.finalCta}>
        <span>O PRIMEIRO PASSO CONTINUA SENDO GRATUITO</span>
        <h2>Conte o que está acontecendo. A profundidade vem depois, se fizer sentido.</h2>
        <Link className={styles.primary} href="/diagnostico">Fazer pré-diagnóstico gratuito</Link>
        <small>O preenchimento não cria obrigação de contratar o Diagnóstico Blinko ou qualquer execução posterior.</small>
      </section>

      <footer className={styles.footer}><Link href="/">← Blinko</Link><Link href="/privacidade">Privacidade</Link></footer>
    </main>
  );
}