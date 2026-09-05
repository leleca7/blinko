import Link from "next/link";
import { requireInternalSession } from "../../../lib/blinko/internal-auth";
import InternalTopbar from "../InternalTopbar";
import CommercialCalculator from "./CommercialCalculator";
import styles from "./comercial.module.css";

const modules = [
  ["01", "Solicitações", "Entrada dos pedidos vindos do site, WhatsApp, OLX, grupos e indicações.", "Formulário + triagem"],
  ["02", "Orçamentos", "Custos, preço de venda, margem, participação Blinko e validade da proposta.", "Cálculo + proposta"],
  ["03", "Pedidos", "Acompanhamento de pagamento, arquivo, produção, entrega e conclusão.", "Operação"],
  ["04", "Produtos", "Catálogo, variações, quantidades, acabamentos, custos e prazos por fornecedor.", "Aguardando tabela"],
  ["05", "Contratos", "Modelos por situação e geração a partir dos dados aprovados do pedido.", "Estrutura preparada"],
  ["06", "Financeiro", "Receita, custos, margem, participação e conferência de pagamentos.", "Conciliação"],
];

const flow = [
  "Nova solicitação",
  "Em análise",
  "Orçamento preparado",
  "Orçamento enviado",
  "Aguardando cliente",
  "Aprovado",
  "Pagamento",
  "Arquivo em conferência",
  "Produção",
  "Entrega",
  "Concluído",
];

export default async function CommercialPage() {
  const session = await requireInternalSession();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <InternalTopbar user={session.user} active="commercial" />

        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>BLINKO OS · COMERCIAL · PRODUÇÃO GRÁFICA</span>
            <h1>Da solicitação à entrega, sem perder o fio.</h1>
            <p>
              Um fluxo único para entender o pedido, formar preço, acompanhar produção, gerar documentos e enxergar a margem real de cada venda.
            </p>
          </div>
          <Link className={styles.publicLink} href="/solucoes-graficas">Ver formulário público ↗</Link>
        </section>

        <section className={styles.metricGrid} aria-label="Resumo comercial">
          <article><span>Solicitações abertas</span><strong>0</strong><small>Banco de teste sem pedidos</small></article>
          <article><span>Orçamentos em aberto</span><strong>0</strong><small>Pronto para receber dados</small></article>
          <article><span>Pedidos em produção</span><strong>0</strong><small>Fluxo ainda não ativado</small></article>
          <article className={styles.metricAttention}><span>Catálogo</span><strong>10</strong><small>Categorias-base cadastradas</small></article>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div><span>01 / ESTRUTURA</span><h2>O comercial como um sistema.</h2></div>
            <p>Os módulos abaixo compartilham os mesmos IDs, cliente, produto, valores e histórico.</p>
          </div>
          <div className={styles.moduleGrid}>
            {modules.map(([n, title, description, state]) => (
              <article className={styles.moduleCard} key={title}>
                <span className={styles.moduleNumber}>{n}</span>
                <div><h3>{title}</h3><p>{description}</p></div>
                <span className={styles.state}>{state}</span>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div><span>02 / FLUXO</span><h2>Um pedido, vários estados.</h2></div>
            <p>O status mostra exatamente onde o trabalho está e qual é o próximo movimento.</p>
          </div>
          <div className={styles.flow}>
            {flow.map((item, index) => <div key={item}><b>{String(index + 1).padStart(2, "0")}</b><span>{item}</span></div>)}
          </div>
        </section>

        <section className={`${styles.section} ${styles.calculatorSection}`}>
          <div className={styles.sectionHead}>
            <div><span>03 / FORMAÇÃO DE PREÇO</span><h2>Calculadora manual primeiro.</h2></div>
            <p>Enquanto o catálogo do fornecedor não chega, você já consegue validar a lógica de custos e margem.</p>
          </div>
          <CommercialCalculator />
        </section>

        <section className={styles.nextSection}>
          <span>PRÓXIMA CAMADA</span>
          <h2>O que entra quando a tabela do fornecedor chegar.</h2>
          <div className={styles.nextGrid}>
            <p><strong>Catálogo técnico</strong>Produto, material, gramatura, medidas, acabamento, quantidade mínima e prazo.</p>
            <p><strong>Preço assistido</strong>O sistema sugere custo e venda, mas você continua podendo corrigir antes de enviar.</p>
            <p><strong>Documentos</strong>Orçamento e contrato recebem os dados aprovados sem redigitação.</p>
            <p><strong>Sheets</strong>Visão operacional espelhada para conferência, filtros e análises.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
