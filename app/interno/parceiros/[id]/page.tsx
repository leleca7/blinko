import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalSession } from "../../../../lib/blinko/internal-auth";
import { getPartner } from "../../../../lib/blinko/partners-server";
import InternalTopbar from "../../InternalTopbar";
import styles from "../../empresas/empresas.module.css";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function money(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
}
function date(value: unknown) {
  const raw = text(value);
  if (!raw) return "—";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleDateString("pt-BR", { timeZone: "America/Bahia" });
}
function eligibilityLabel(value: string) {
  return { eligible:"Elegível", pilot_requires_project_approval:"Piloto · exige aprovação por projeto", restricted_requires_scope_check:"Restrito · validar escopo", registration_pending:"Cadastro pendente", validation_incomplete:"Validação incompleta", blocked:"Bloqueado" }[value] ?? value;
}
function ruleLabel(value: string) {
  return { to_define:"A definir", PRF01:"PRF01 · custo fixo de fornecedor", PRF02:"PRF02 · percentual sobre venda", PRF03:"PRF03 · percentual sobre margem", PRF04:"PRF04 · comissão fixa", PRF05:"PRF05 · divisão de resultado", PRF06:"PRF06 · repasse integral + fee Blinko", PRF07:"PRF07 · condição específica contratada" }[value] ?? value;
}

export default async function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireInternalSession();
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const result = await getPartner(id);
  if (result.schemaReady && !result.partner) notFound();

  const partner = result.partner;
  const eligibility = text(partner?.operational_eligibility);

  return <main className={styles.page}><div className={styles.shell}>
    <InternalTopbar user={session.user} active="partners" />
    <Link className={styles.back} href="/interno/parceiros">← voltar para Parceiros</Link>

    {!result.schemaReady || !partner ? <div className={styles.empty}>A ficha de parceiros depende das migrações 037–039 no banco conectado.</div> : <>
      <section className={styles.companyHeader}>
        <div><span className={styles.eyebrow}>PARCEIRO · GOVERNANÇA</span><h1>{text(partner.official_code) ? `${text(partner.official_code)} · ` : ""}{text(partner.trade_name)}</h1><p>{text(partner.area)}</p></div>
        <span className={styles.statusPill} data-status={eligibility === "eligible" ? "healthy" : eligibility === "blocked" || eligibility === "registration_pending" ? "offline" : "degraded"}>{eligibilityLabel(eligibility)}</span>
      </section>

      <div className={styles.sectionTitle}><h2>Cadastro e validação</h2><span>uso operacional depende destes estados</span></div>
      <section className={styles.systemGrid}>
        <article className={styles.systemCard}><h3>Estado operacional</h3><div className={styles.detailList}><span><strong>Status:</strong> {text(partner.status)}</span><span><strong>Cadastro:</strong> {text(partner.registration_status)}</span><span><strong>Validação técnica:</strong> {text(partner.technical_validation_status)}</span><span><strong>Validação comercial:</strong> {text(partner.commercial_validation_status)}</span><span><strong>Piloto controlado:</strong> {partner.pilot_controlled === true ? "sim" : "não"}</span><span><strong>Contato direto com cliente:</strong> {text(partner.client_direct_contact_policy) || "a definir"}</span></div></article>
        <article className={styles.systemCard}><h3>Referências operacionais</h3><div className={styles.detailList}><span><strong>Tabela/custos:</strong> {text(partner.cost_table_reference) || "não registrada"}</span><span><strong>Validade da tabela:</strong> {date(partner.cost_table_valid_until)}</span><span><strong>Prazo-base:</strong> {text(partner.base_lead_time) || "a definir"}</span><span><strong>Pagamento:</strong> {text(partner.payment_terms) || "a definir"}</span><span><strong>Responsável interno:</strong> {text(partner.internal_owner_label) || "a definir"}</span><span><strong>Fonte:</strong> {text(partner.source_document)} · {text(partner.source_version)}</span></div></article>
      </section>

      <div className={styles.sectionTitle}><h2>Capacidades por solução</h2><span>{result.capabilities.length} vínculo(s)</span></div>
      <section className={styles.systemGrid}>{result.capabilities.map((cap) => <article className={styles.systemCard} key={text(cap.id)}><div className={styles.systemTop}><div><h3>{text(cap.solution_code)} · {text(cap.solution_name)}</h3><p>{text(cap.capability_notes)}</p></div><span className={styles.statusPill}>{text(cap.status)}</span></div><div className={styles.detailList}><span><strong>Região:</strong> {text(cap.region_scope) || "não limitada"}</span><span><strong>Vigência:</strong> {date(cap.valid_from)} → {date(cap.valid_until)}</span></div></article>)}</section>

      <div className={styles.sectionTitle}><h2>Regras financeiras</h2><span>histórico versionado</span></div>
      <section className={styles.systemGrid}>{result.rules.map((rule) => {
        const auto = rule.auto_calculable === true;
        return <article className={styles.systemCard} key={text(rule.id)}><div className={styles.systemTop}><div><h3>Versão {String(rule.version_number ?? "—")}</h3><p>{ruleLabel(text(rule.remuneration_model))}</p></div><span className={styles.statusPill} data-status={auto ? "healthy" : "degraded"}>{auto ? "CÁLCULO LIBERADO" : "CÁLCULO BLOQUEADO"}</span></div><div className={styles.detailList}><span><strong>Formalização:</strong> {text(rule.formalization_status)}</span><span><strong>Base:</strong> {text(rule.calculation_base_status)} · {text(rule.calculation_base_description) || "sem definição"}</span><span><strong>Percentual:</strong> {rule.percentage_value == null ? "—" : `${String(rule.percentage_value)}%`}</span><span><strong>Valor fixo:</strong> {money(rule.fixed_amount)}</span><span><strong>Referência formal:</strong> {text(rule.formalization_reference) || "não registrada"}</span><span><strong>Vigência:</strong> {date(rule.valid_from)} → {date(rule.valid_until)}</span></div>{rule.percentage_value != null && !auto ? <div className={styles.empty} style={{ marginTop: 16 }}>Percentual registrado não significa repasse calculável. Enquanto base/formalização estiver incompleta, o valor deve vir de cotação ou condição explicitamente validada.</div> : null}</article>;
      })}{!result.rules.length ? <div className={styles.empty}>Nenhuma regra financeira registrada.</div> : null}</section>

      <div className={styles.sectionTitle}><h2>Projetos e compromissos</h2><span>rastreabilidade do terceiro até o custo</span></div>
      <section className={styles.list}>{result.assignments.map((assignment) => <Link className={styles.companyCard} href={`/interno/projetos/${text(assignment.project_id)}`} key={text(assignment.id)}><span><span className={styles.companyName}>{text(assignment.company_name)}</span><span className={styles.companyMeta}>{text(assignment.solution_code)} · rota {text(assignment.execution_route)} · projeto {text(assignment.project_status)}</span><span className={styles.companyMeta}>Cotação: {text(assignment.quote_reference)} · compromisso: {money(assignment.committed_cost_to_blinko)}</span></span><span className={styles.systemSummary}><span className={styles.statusPill}>{text(assignment.status)}</span><span className={styles.systemPill}>Custo: {money(assignment.cost_amount)} · {text(assignment.cost_status) || "sem lançamento"}</span></span><span className={styles.arrow}>→</span></Link>)}{!result.assignments.length ? <div className={styles.empty}>Nenhum compromisso de projeto herdado para este parceiro.</div> : null}</section>
    </>}
  </div></main>;
}
