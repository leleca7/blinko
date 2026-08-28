import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalSession } from "../../../../lib/blinko/internal-auth";
import { getSolutionKit } from "../../../../lib/blinko/solution-kits-server";
import InternalTopbar from "../../InternalTopbar";
import styles from "../../solucoes/solucoes.module.css";

function statusLabel(status: string) {
  return { ready: "Pronto", beta: "Beta", draft: "Rascunho", retired: "Arquivado" }[status] ?? status;
}

function textList(value: unknown[]) {
  return value.map((item) => typeof item === "string" ? item : JSON.stringify(item));
}

export default async function KitDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await requireInternalSession();
  const { slug } = await params;

  let kit = null;
  try {
    kit = await getSolutionKit(slug);
  } catch {
    kit = null;
  }

  if (!kit) notFound();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <InternalTopbar user={session.user} active="kits" />

        <Link className={styles.back} href="/interno/kits">← voltar para kits</Link>

        <section className={styles.detailHero}>
          <div>
            <span className={styles.eyebrow}>KIT BLINKO · {kit.category.toUpperCase()}</span>
            <h1>{kit.name}</h1>
            <p>{kit.summary || "Receita reutilizável de soluções Blinko."}</p>
          </div>
          <div className={styles.facts}>
            <div className={styles.fact}><span>Status</span><strong>{statusLabel(kit.status)}</strong></div>
            <div className={styles.fact}><span>Versão</span><strong>{kit.version}</strong></div>
            <div className={styles.fact}><span>Soluções</span><strong>{kit.items.length}</strong></div>
            <div className={styles.fact}><span>Empresas</span><strong>{kit.selected_companies}</strong></div>
          </div>
        </section>

        <section className={styles.contentGrid}>
          <article className={styles.panel}>
            <h2>Soluções incluídas</h2>
            <ul className={styles.list}>
              {kit.items.map((item) => (
                <li key={item.id}>
                  <Link href={`/interno/solucoes/${item.blueprint.slug}`}>{item.blueprint.name}</Link>
                  {item.required ? " · essencial" : " · opcional"}
                  {` · v${item.blueprint.version}`}
                </li>
              ))}
            </ul>

            <h3>Entregáveis esperados</h3>
            <ul className={styles.list}>
              {textList(kit.deliverables).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>

          <aside className={styles.panel}>
            <h2>Quando usar</h2>
            <div className={styles.tags}>
              {textList(kit.ideal_profiles).map((item) => <span className={styles.tag} key={item}>{item}</span>)}
            </div>

            <h3>Checklist de implantação</h3>
            <ul className={styles.list}>
              {textList(kit.setup_checklist).map((item) => <li key={item}>{item}</li>)}
            </ul>

            {kit.notes ? <><h3>Notas</h3><p>{kit.notes}</p></> : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
