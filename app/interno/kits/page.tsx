import Link from "next/link";
import { requireInternalSession } from "../../../lib/blinko/internal-auth";
import { getSolutionKits } from "../../../lib/blinko/solution-kits-server";
import InternalTopbar from "../InternalTopbar";
import styles from "../solucoes/solucoes.module.css";

function statusLabel(status: string) {
  return { ready: "Pronto", beta: "Beta", draft: "Rascunho", retired: "Arquivado" }[status] ?? status;
}

export default async function KitsPage() {
  const session = await requireInternalSession();

  let kits = [] as Awaited<ReturnType<typeof getSolutionKits>>;
  let kitsUnavailable = false;
  try {
    kits = await getSolutionKits();
  } catch {
    kitsUnavailable = true;
  }

  const readyCount = kits.filter((kit) => kit.status === "ready").length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <InternalTopbar user={session.user} active="kits" />

        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>FÁBRICA BLINKO · RECEITAS REUTILIZÁVEIS</span>
            <h1>Combinações que já funcionam não precisam ser reinventadas.</h1>
          </div>
          <div className={styles.heroAside}>
            <strong>{kitsUnavailable ? "–" : kits.length}</strong>
            <span>{kitsUnavailable ? "biblioteca temporariamente indisponível" : `kits catalogados · ${readyCount} prontos para implantação`}</span>
          </div>
        </section>

        <div className={styles.sectionTitle}>
          <h2>Kits de solução</h2>
          <span>cada kit combina blueprints; cada empresa recebe personalização e revisão próprias</span>
        </div>

        {kitsUnavailable ? (
          <div className={styles.empty}>A biblioteca de Kits está temporariamente indisponível. Nenhuma conclusão sobre quantidade de kits foi assumida.</div>
        ) : kits.length === 0 ? (
          <div className={styles.empty}>Nenhum kit cadastrado neste ambiente ainda.</div>
        ) : (
          <section className={styles.grid}>
            {kits.map((kit) => (
              <Link className={styles.card} href={`/interno/kits/${kit.slug}`} key={kit.id}>
                <div className={styles.cardTop}>
                  <span className={styles.category}>{kit.category}</span>
                  <span className={styles.status}>{statusLabel(kit.status)}</span>
                </div>
                <h3>{kit.name}</h3>
                <p>{kit.summary || "Receita Blinko reutilizável."}</p>
                <div className={styles.cardFoot}>
                  <span>{kit.items.length} soluções · v{kit.version}</span>
                  <strong>{kit.selected_companies} empresas →</strong>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
