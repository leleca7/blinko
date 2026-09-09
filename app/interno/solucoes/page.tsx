import { requireInternalSession } from "../../../lib/blinko/internal-auth";
import { listOfficialSolutions } from "../../../lib/blinko/solution-catalog-server";
import InternalTopbar from "../InternalTopbar";
import styles from "../empresas/empresas.module.css";

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }

function statusLabel(value: string) {
  return {
    active: "Ativa",
    pilot: "Piloto",
    structuring: "Em estruturação",
    consultation: "Sob consulta",
    suspended: "Suspensa",
  }[value] ?? value;
}

function routeLabel(value: string) {
  return {
    R1: "R1 · Blinko executa",
    R2: "R2 · Blinko executa + coordena terceiros",
    R3: "R3 · Parceiro coordenado pela Blinko",
    R4: "R4 · Cliente executa com orientação",
    R5: "R5 · Especialista externo / encaminhamento",
    R6: "R6 · Monitoramento",
  }[value] ?? value;
}

export default async function SolutionsCatalogPage() {
  const session = await requireInternalSession();
  const catalog = await listOfficialSolutions();
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const solution of catalog.solutions) {
    const key = `${text(solution.nucleus_code)} · ${text(solution.nucleus_name)}`;
    const current = groups.get(key) ?? [];
    current.push(solution);
    groups.set(key, current);
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <InternalTopbar user={session.user} active="solutions" />
        <section className={styles.hero}>
          <span className={styles.eyebrow}>MÉTODO BLINKO · PORTFÓLIO OFICIAL</span>
          <h1>Catálogo de soluções.</h1>
          <p>
            S01–S40 são respostas possíveis a problemas já diagnosticados. Esta tela não é uma tabela de preços e não autoriza contratação automática: contexto, prioridade, pré-requisitos e rota de execução continuam exigindo validação.
          </p>
        </section>

        {!catalog.schemaReady ? (
          <div className={styles.empty}>O catálogo oficial depende da migração 030 no banco conectado. Nenhuma solução será inferida a partir de cadastros legados.</div>
        ) : (
          <>
            <section className={styles.metricGrid} aria-label="Resumo do catálogo">
              <article className={styles.metricCard}><strong>{catalog.solutions.length}</strong><span>soluções oficiais</span></article>
              <article className={styles.metricCard}><strong>{groups.size}</strong><span>núcleos</span></article>
              <article className={styles.metricCard}><strong>{catalog.solutions.filter((item) => text(item.catalog_status) === "active").length}</strong><span>ativas</span></article>
              <article className={styles.metricCard}><strong>{catalog.solutions.filter((item) => ["pilot", "structuring", "consultation"].includes(text(item.catalog_status))).length}</strong><span>exigem controle/consulta</span></article>
            </section>

            {[...groups.entries()].map(([nucleus, solutions]) => (
              <section key={nucleus} style={{ marginTop: 32 }}>
                <div className={styles.sectionTitle}><h2>{nucleus}</h2><span>{solutions.length} solução(ões)</span></div>
                <div className={styles.systemGrid}>
                  {solutions.map((solution) => {
                    const routes = strings(solution.execution_routes);
                    const triggers = strings(solution.diagnostic_triggers);
                    const prerequisites = strings(solution.prerequisites);
                    const deliverables = strings(solution.base_deliverables);
                    const exclusions = strings(solution.exclusions);
                    return (
                      <article className={styles.systemCard} key={text(solution.id)}>
                        <div className={styles.systemTop}>
                          <div><h3>{text(solution.official_code)} · {text(solution.name)}</h3><p>{text(solution.official_status)}</p></div>
                          <span className={styles.statusPill} data-status={text(solution.catalog_status) === "active" ? "healthy" : undefined}>{statusLabel(text(solution.catalog_status))}</span>
                        </div>
                        <div className={styles.detailList}>
                          <span><strong>Resolve:</strong> {text(solution.problem_statement) || "Escopo definido conforme diagnóstico."}</span>
                          <span><strong>Rotas permitidas:</strong> {routes.map(routeLabel).join(" · ") || "A definir"}</span>
                          {text(solution.applicability) ? <span><strong>Aplicabilidade:</strong> {text(solution.applicability)}</span> : null}
                          {triggers.length ? <span><strong>Gatilhos diagnósticos:</strong> {triggers.join(", ")}</span> : null}
                          {prerequisites.length ? <span><strong>Pré-requisitos:</strong> {prerequisites.join(" · ")}</span> : null}
                          {deliverables.length ? <span><strong>Entregáveis-base:</strong> {deliverables.join(" · ")}</span> : null}
                          {exclusions.length ? <span><strong>Não inclui automaticamente:</strong> {exclusions.join(" · ")}</span> : null}
                          {text(solution.completion_criteria) ? <span><strong>Conclusão:</strong> {text(solution.completion_criteria)}</span> : null}
                        </div>
                        {text(solution.drive_document_url) ? <div className={styles.actions}><a className={styles.secondary} href={text(solution.drive_document_url)} target="_blank" rel="noreferrer">Abrir fonte oficial ↗</a></div> : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
