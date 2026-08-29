import Link from "next/link";
import { requireInternalSession } from "../../../lib/blinko/internal-auth";
import { getVisualDirections } from "../../../lib/blinko/visual-directions-server";
import InternalTopbar from "../InternalTopbar";
import styles from "./direcoes.module.css";

function statusLabel(status: string) {
  return { ready: "Pronta", beta: "Beta", draft: "Rascunho", retired: "Arquivada" }[status] ?? status;
}

function list(value: unknown[]) {
  return value.filter((item): item is string => typeof item === "string");
}

export default async function VisualDirectionsPage() {
  const session = await requireInternalSession();
  let directions = [] as Awaited<ReturnType<typeof getVisualDirections>>;
  let directionsUnavailable = false;

  try {
    directions = await getVisualDirections();
  } catch {
    directionsUnavailable = true;
  }

  const ready = directions.filter((item) => item.status === "ready").length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <InternalTopbar user={session.user} active="directions" />

        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>DIREÇÃO DE ARTE · BIBLIOTECA BLINKO</span>
            <h1>Reutilizar engenharia sem repetir estética.</h1>
          </div>
          <div className={styles.aside}>
            <strong>{directionsUnavailable ? "–" : directions.length}</strong>
            <span>{directionsUnavailable ? "biblioteca temporariamente indisponível" : `direções cadastradas · ${ready} prontas`}</span>
          </div>
        </section>

        <div className={styles.sectionTitle}>
          <h2>Direções visuais</h2>
          <span>a escolha depende do posicionamento, público e personalidade da empresa</span>
        </div>

        {directionsUnavailable ? (
          <div className={styles.empty}>A biblioteca de Direções está temporariamente indisponível. Nenhuma conclusão sobre quantidade de direções foi assumida.</div>
        ) : directions.length === 0 ? (
          <div className={styles.empty}>Nenhuma direção visual cadastrada neste ambiente.</div>
        ) : (
          <section className={styles.grid}>
            {directions.map((direction) => (
              <Link className={styles.card} href={`/interno/direcoes-visuais/${direction.slug}`} key={direction.id}>
                <div className={styles.cardTop}>
                  <span className={styles.version}>v{direction.version}</span>
                  <span className={styles.status}>{statusLabel(direction.status)}</span>
                </div>
                <h3>{direction.name}</h3>
                <p>{direction.positioning || direction.description || "Direção de arte Blinko."}</p>
                <div className={styles.keywords}>
                  {list(direction.mood_keywords).slice(0, 4).map((keyword) => (
                    <span className={styles.keyword} key={keyword}>{keyword}</span>
                  ))}
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
