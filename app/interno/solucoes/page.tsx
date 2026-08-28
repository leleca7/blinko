import Link from "next/link";
import { requireInternalSession } from "../../../lib/blinko/internal-auth";
import { getSolutionCatalog } from "../../../lib/blinko/solution-catalog-server";
import InternalTopbar from "../InternalTopbar";
import styles from "./solucoes.module.css";

function statusLabel(status: string) {
  return { ready: "Pronta", beta: "Beta", draft: "Rascunho", retired: "Arquivada" }[status] ?? status;
}

function customizationLabel(level: string) {
  return { low: "Baixa customização", medium: "Customização média", high: "Alta customização", custom: "Sob medida" }[level] ?? level;
}

export default async function SolutionsPage() {
  const session = await requireInternalSession();

  let solutions = [] as Awaited<ReturnType<typeof getSolutionCatalog>>;
  let catalogUnavailable = false;
  try {
    solutions = await getSolutionCatalog();
  } catch {
    catalogUnavailable = true;
  }

  const readyCount = solutions.filter((item) => item.status === "ready").length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <InternalTopbar user={session.user} active="solutions" />

        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>BIBLIOTECA BLINKO · CAPACIDADES REUTILIZÁVEIS</span>
            <h1>O que já sabemos construir não começa do zero.</h1>
          </div>
          <div className={styles.heroAside}>
            <strong>{catalogUnavailable ? "–" : solutions.length}</strong>
            <span>{catalogUnavailable ? "catálogo temporariamente indisponível" : `soluções catalogadas · ${readyCount} prontas para uso`}</span>
          </div>
        </section>

        <div className={styles.sectionTitle}>
          <h2>Catálogo de soluções</h2>
          <span>blueprint funcional primeiro; identidade e direção de arte depois</span>
        </div>

        {catalogUnavailable ? (
          <div className={styles.empty}>
            O catálogo está temporariamente indisponível. Nenhuma conclusão sobre quantidade de soluções foi assumida.
          </div>
        ) : solutions.length === 0 ? (
          <div className={styles.empty}>
            O catálogo ainda não possui blueprints cadastrados neste ambiente. A estrutura está pronta para receber as primeiras soluções oficiais da Blinko.
          </div>
        ) : (
          <section className={styles.grid}>
            {solutions.map((solution) => (
              <Link className={styles.card} href={`/interno/solucoes/${solution.slug}`} key={solution.id}>
                <div className={styles.cardTop}>
                  <span className={styles.category}>{solution.category}</span>
                  <span className={styles.status}>{statusLabel(solution.status)}</span>
                </div>
                <h3>{solution.name}</h3>
                <p>{solution.summary || solution.problem_statement || "Blueprint Blinko sem descrição cadastrada."}</p>
                <div className={styles.cardFoot}>
                  <span>{customizationLabel(solution.customization_level)} · v{solution.version}</span>
                  <strong>{solution.selected_companies ?? 0} empresas →</strong>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
