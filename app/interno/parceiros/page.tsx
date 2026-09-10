import Link from "next/link";
import { requireInternalSession } from "../../../lib/blinko/internal-auth";
import { listPartners } from "../../../lib/blinko/partners-server";
import InternalTopbar from "../InternalTopbar";
import styles from "../empresas/empresas.module.css";

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function records(value: unknown) { return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : []; }
function money(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
}

function eligibilityLabel(value: string) {
  return {
    eligible: "Elegível",
    pilot_requires_project_approval: "Piloto · exige aprovação",
    restricted_requires_scope_check: "Restrito · validar escopo",
    registration_pending: "Cadastro pendente",
    validation_incomplete: "Validação incompleta",
    blocked: "Bloqueado",
  }[value] ?? value;
}

function ruleLabel(value: string) {
  return {
    to_define: "A definir",
    PRF01: "PRF01 · custo fixo de fornecedor",
    PRF02: "PRF02 · percentual sobre venda",
    PRF03: "PRF03 · percentual sobre margem",
    PRF04: "PRF04 · comissão fixa",
    PRF05: "PRF05 · divisão de resultado",
    PRF06: "PRF06 · repasse integral + fee Blinko",
    PRF07: "PRF07 · condição específica contratada",
  }[value] ?? value;
}

export default async function PartnersPage() {
  const session = await requireInternalSession();
  const result = await listPartners();
  const partners = result.partners;
  const eligible = partners.filter((item) => text(item.operational_eligibility) === "eligible").length;
  const controlled = partners.filter((item) => ["pilot_requires_project_approval", "restricted_requires_scope_check"].includes(text(item.operational_eligibility))).length;
  const blocked = partners.filter((item) => ["registration_pending", "validation_incomplete", "blocked"].includes(text(item.operational_eligibility))).length;
  const autoRules = partners.filter((item) => {
    const rule = item.current_rule;
    return Boolean(rule && typeof rule === "object" && !Array.isArray(rule) && (rule as Record<string, unknown>).auto_calculable === true);
  }).length;

  return (
    <main className={styles.page}><div className={styles.shell}>
      <InternalTopbar user={session.user} active="partners" />
      <section className={styles.hero}>
        <span className={styles.eyebrow}>OPERAÇÃO · TERCEIROS · FINANCEIRO</span>
        <h1>Parceiros.</h1>
        <p>Cadastro, elegibilidade, soluções atendidas, regras financeiras e compromissos em projetos. Percentual registrado não autoriza cálculo automático: base, formalização e vigência precisam estar válidas.</p>
      </section>

      {!result.schemaReady ? <div className={styles.empty}>A Central de Parceiros depende das migrações 037–039 no banco conectado.</div> : <>
        <section className={styles.metricGrid} aria-label="Resumo de parceiros">
          <article className={styles.metricCard}><strong>{partners.length}</strong><span>parceiros cadastrados</span></article>
          <article className={styles.metricCard}><strong>{eligible}</strong><span>elegíveis sem exceção</span></article>
          <article className={styles.metricCard}><strong>{controlled}</strong><span>piloto/restrito com controle</span></article>
          <article className={styles.metricCard}><strong>{blocked}</strong><span>cadastro/validação bloqueando uso</span></article>
          <article className={styles.metricCard}><strong>{autoRules}</strong><span>regras com cálculo automático liberado</span></article>
        </section>

        <div className={styles.sectionTitle}><h2>Cadastro operacional</h2><span>fonte oficial para seleção de terceiros</span></div>
        <div className={styles.list}>
          {partners.map((partner) => {
            const capabilities = records(partner.capabilities);
            const rule = partner.current_rule && typeof partner.current_rule === "object" && !Array.isArray(partner.current_rule) ? partner.current_rule as Record<string, unknown> : null;
            const percentage = rule?.percentage_value == null ? "" : String(rule.percentage_value);
            const fixed = rule?.fixed_amount == null ? "" : money(rule.fixed_amount);
            const auto = rule?.auto_calculable === true;
            return <Link className={styles.companyCard} href={`/interno/parceiros/${text(partner.id)}`} key={text(partner.id)}>
              <span>
                <span className={styles.companyName}>{text(partner.official_code) ? `${text(partner.official_code)} · ` : ""}{text(partner.trade_name)}</span>
                <span className={styles.companyMeta}>{text(partner.area)} · {text(partner.official_status_label) || text(partner.status)}</span>
                <span className={styles.companyMeta}>Projetos/compromissos ativos: {Number(partner.active_assignments ?? 0)} · custo comprometido/realizado: {money(partner.committed_cost)}</span>
              </span>
              <span className={styles.systemSummary}>
                <span className={styles.statusPill} data-status={text(partner.operational_eligibility) === "eligible" ? "healthy" : undefined}>{eligibilityLabel(text(partner.operational_eligibility))}</span>
                {capabilities.slice(0, 4).map((cap) => <span className={styles.systemPill} key={`${text(partner.id)}-${text(cap.solution_code)}`}>{text(cap.solution_code)} · {text(cap.status)}</span>)}
                {rule ? <span className={styles.systemPill}>{ruleLabel(text(rule.remuneration_model))}{percentage ? ` · ${percentage}%` : fixed ? ` · ${fixed}` : ""}</span> : <span className={styles.systemPill}>Regra financeira não cadastrada</span>}
                {rule ? <span className={styles.statusPill} data-status={auto ? "healthy" : "degraded"}>Cálculo automático: {auto ? "LIBERADO" : "BLOQUEADO"}</span> : null}
              </span>
              <span className={styles.arrow}>→</span>
            </Link>;
          })}
          {!partners.length ? <div className={styles.empty}>Nenhum parceiro cadastrado.</div> : null}
        </div>
      </>}
    </div></main>
  );
}
