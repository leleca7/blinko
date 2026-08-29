import type { SolutionKit } from "../../../../lib/blinko/solution-kits-server";
import type { VisualDirection } from "../../../../lib/blinko/visual-directions-server";
import styles from "../empresas.module.css";

export default function CreateImplementationPlanForm({
  companyId,
  kits,
  directions,
}: {
  companyId: string;
  kits: SolutionKit[];
  directions: VisualDirection[];
}) {
  const availableKits = kits.filter((kit) => kit.status !== "retired" && kit.items.length > 0);
  const availableDirections = directions.filter((direction) => direction.status !== "retired");

  if (!availableKits.length) {
    return <div className={styles.empty}>Nenhum kit está disponível para iniciar um plano neste ambiente.</div>;
  }

  return (
    <form className={styles.planForm} action={`/api/interno/empresas/${companyId}/implementation-plans`} method="post">
      <div className={styles.planFormIntro}>
        <div>
          <span className={styles.eyebrow}>NOVO RASCUNHO</span>
          <h3>Criar plano a partir de um kit</h3>
        </div>
        <p>O kit só monta a estrutura inicial. Nada é aprovado, publicado ou ativado automaticamente.</p>
      </div>

      <div className={styles.formGrid}>
        <label className={styles.formField}>
          <span>Kit de solução</span>
          <select name="kit_id" required defaultValue="">
            <option value="" disabled>Escolha um kit</option>
            {availableKits.map((kit) => (
              <option value={kit.id} key={kit.id}>{kit.name} · {kit.items.length} soluções</option>
            ))}
          </select>
        </label>

        <label className={styles.formField}>
          <span>Direção visual</span>
          <select name="visual_direction_id" defaultValue="">
            <option value="">Definir depois</option>
            {availableDirections.map((direction) => (
              <option value={direction.id} key={direction.id}>{direction.name}</option>
            ))}
          </select>
        </label>

        <label className={styles.formField}>
          <span>Nome do plano</span>
          <input name="name" required minLength={3} maxLength={140} placeholder="Ex.: Nova experiência digital 2026" />
        </label>

        <label className={`${styles.formField} ${styles.formFieldWide}`}>
          <span>Objetivo</span>
          <textarea name="objective" maxLength={1000} rows={3} placeholder="O que essa implantação precisa resolver para a empresa?" />
        </label>
      </div>

      <div className={styles.planFormFooter}>
        <span>Depois de criar, a equipe revisa módulos, versões e customizações antes de aprovar.</span>
        <button className={styles.primary} type="submit">Criar rascunho</button>
      </div>
    </form>
  );
}
