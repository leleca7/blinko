import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalSession } from "../../../../lib/blinko/internal-auth";
import { getVisualDirection } from "../../../../lib/blinko/visual-directions-server";
import InternalTopbar from "../../InternalTopbar";
import styles from "../direcoes.module.css";

function statusLabel(status: string) {
  return { ready: "Pronta", beta: "Beta", draft: "Rascunho", retired: "Arquivada" }[status] ?? status;
}

function list(value: unknown[]) {
  return value.map((item) => typeof item === "string" ? item : JSON.stringify(item));
}

export default async function VisualDirectionDetail({ params }: { params: Promise<{ slug: string }> }) {
  const session = await requireInternalSession();
  const { slug } = await params;
  let direction = null;

  try {
    direction = await getVisualDirection(slug);
  } catch {
    direction = null;
  }

  if (!direction) notFound();

  const sections = [
    ["Tipografia", direction.typography_guidance],
    ["Paleta", direction.palette_guidance],
    ["Composição", direction.composition_guidance],
    ["Imagem", direction.image_guidance],
    ["Motion", direction.motion_guidance],
    ["Componentes", direction.component_guidance],
  ] as const;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <InternalTopbar user={session.user} active="directions" />

        <Link className={styles.back} href="/interno/direcoes-visuais">← voltar para direções visuais</Link>

        <section className={styles.detailHero}>
          <div>
            <span className={styles.eyebrow}>DIREÇÃO VISUAL · BLINKO</span>
            <h1>{direction.name}</h1>
            <p>{direction.description || direction.positioning || "Direção de arte sem descrição cadastrada."}</p>
          </div>
          <div className={styles.facts}>
            <div className={styles.fact}><span>Status</span><strong>{statusLabel(direction.status)}</strong></div>
            <div className={styles.fact}><span>Versão</span><strong>{direction.version}</strong></div>
            <div className={styles.fact}><span>Uso</span><strong>{direction.selected_companies ?? 0} empresas</strong></div>
          </div>
        </section>

        <section className={styles.content}>
          {sections.map(([title, items]) => (
            <article className={styles.panel} key={title}>
              <h2>{title}</h2>
              {list(items || []).length ? (
                <ul className={styles.list}>
                  {list(items || []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : <p>Nenhuma orientação cadastrada.</p>}
            </article>
          ))}

          <article className={styles.panel}>
            <h2>Evitar</h2>
            {list(direction.avoid_patterns || []).length ? (
              <ul className={styles.list}>
                {list(direction.avoid_patterns || []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : <p>Nenhum padrão proibido cadastrado.</p>}
            {direction.reference_notes ? <><h3>Notas de referência</h3><p>{direction.reference_notes}</p></> : null}
          </article>
        </section>
      </div>
    </main>
  );
}
