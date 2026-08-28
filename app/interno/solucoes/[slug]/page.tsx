import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalSession } from "../../../../lib/blinko/internal-auth";
import { getSolutionBlueprint } from "../../../../lib/blinko/solution-catalog-server";
import InternalTopbar from "../../InternalTopbar";
import styles from "../solucoes.module.css";

function statusLabel(status: string) {
  return { ready: "Pronta", beta: "Beta", draft: "Rascunho", retired: "Arquivada" }[status] ?? status;
}

function customizationLabel(level: string) {
  return { low: "Baixa", medium: "Média", high: "Alta", custom: "Sob medida" }[level] ?? level;
}

function normalizeList(value: unknown[]) {
  return value.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      const object = item as Record<string, unknown>;
      return String(object.label ?? object.name ?? object.title ?? JSON.stringify(item));
    }
    return String(item);
  });
}

export default async function SolutionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await requireInternalSession();
  const { slug } = await params;

  let solution = null;
  try {
    solution = await getSolutionBlueprint(slug);
  } catch {
    solution = null;
  }

  if (!solution) notFound();

  const modules = normalizeList(solution.modules || []);
  const integrations = normalizeList(solution.optional_integrations || []);
  const config = normalizeList(solution.required_config || []);
  const checklist = normalizeList(solution.implementation_checklist || []);
  const profiles = normalizeList(solution.ideal_profiles || []);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <InternalTopbar user={session.user} active="solutions" />

        <Link className={styles.back} href="/interno/solucoes">← voltar para o catálogo</Link>

        <section className={styles.detailHero}>
          <div>
            <span className={styles.eyebrow}>{solution.category.toUpperCase()} · BLUEPRINT BLINKO</span>
            <h1>{solution.name}</h1>
            <p>{solution.summary || solution.problem_statement || "Blueprint sem resumo cadastrado."}</p>
          </div>
          <div className={styles.facts}>
            <div className={styles.fact}><span>Status</span><strong>{statusLabel(solution.status)}</strong></div>
            <div className={styles.fact}><span>Versão</span><strong>{solution.version}</strong></div>
            <div className={styles.fact}><span>Customização</span><strong>{customizationLabel(solution.customization_level)}</strong></div>
            <div className={styles.fact}><span>Uso</span><strong>{solution.selected_companies ?? 0} empresas</strong></div>
          </div>
        </section>

        <section className={styles.contentGrid}>
          <article className={styles.panel}>
            <h2>Arquitetura da solução</h2>
            {solution.problem_statement ? <><h3>Problema que resolve</h3><p>{solution.problem_statement}</p></> : null}

            <h3>Módulos inclusos</h3>
            {modules.length ? <div className={styles.tags}>{modules.map((item) => <span className={styles.tag} key={item}>{item}</span>)}</div> : <p>Nenhum módulo detalhado.</p>}

            <h3>Integrações opcionais</h3>
            {integrations.length ? <div className={styles.tags}>{integrations.map((item) => <span className={styles.tag} key={item}>{item}</span>)}</div> : <p>Nenhuma integração opcional cadastrada.</p>}

            <h3>Configuração necessária</h3>
            {config.length ? <ul className={styles.list}>{config.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Nenhum requisito detalhado.</p>}
          </article>

          <aside className={styles.panel}>
            <h2>Implantação</h2>
            <h3>Perfil indicado</h3>
            {profiles.length ? <div className={styles.tags}>{profiles.map((item) => <span className={styles.tag} key={item}>{item}</span>)}</div> : <p>Perfil ainda não documentado.</p>}

            <h3>Checklist base</h3>
            {checklist.length ? <ul className={styles.list}>{checklist.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Checklist ainda não cadastrado.</p>}

            {solution.notes ? <><h3>Notas internas</h3><p>{solution.notes}</p></> : null}

            <div className={styles.links}>
              {solution.source_repository_url ? <a href={solution.source_repository_url} target="_blank" rel="noreferrer">Código-base ↗</a> : null}
              {solution.drive_document_url ? <a href={solution.drive_document_url} target="_blank" rel="noreferrer">Documentação ↗</a> : null}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
