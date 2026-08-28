import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalSession } from "../../../../lib/blinko/internal-auth";
import { getCompanyWithSystems } from "../../../../lib/blinko/company-systems-server";
import { getCompanySolutions } from "../../../../lib/blinko/solution-catalog-server";
import { getCompanyImplementationPlans, getSolutionKits } from "../../../../lib/blinko/solution-kits-server";
import { getVisualDirections } from "../../../../lib/blinko/visual-directions-server";
import InternalTopbar from "../../InternalTopbar";
import CreateImplementationPlanForm from "./CreateImplementationPlanForm";
import styles from "../empresas.module.css";

function statusLabel(status: string) {
  return {
    healthy: "Saudável",
    degraded: "Atenção",
    offline: "Offline",
    paused: "Pausado",
    unknown: "Não verificado",
  }[status] ?? status;
}

function authLabel(strategy: string) {
  return {
    independent: "Login próprio",
    sso: "SSO",
    api_only: "Somente API",
    none: "Sem autenticação",
    other: "Outro",
  }[strategy] ?? strategy;
}

function solutionStatusLabel(status: string) {
  return {
    planned: "Planejada",
    selected: "Selecionada",
    in_build: "Em implantação",
    live: "Ativa",
    paused: "Pausada",
    retired: "Encerrada",
  }[status] ?? status;
}

function planStatusLabel(status: string) {
  return {
    draft: "Rascunho",
    approved: "Aprovado",
    in_build: "Em implantação",
    review: "Em revisão",
    live: "Ativo",
    paused: "Pausado",
    cancelled: "Cancelado",
  }[status] ?? status;
}

function feedbackLabel(status?: string) {
  return {
    implementation_plan_created: "Plano criado como rascunho. Revise os módulos antes de qualquer aprovação.",
    implementation_plan_invalid: "Não foi possível criar o plano: revise os campos informados.",
    implementation_plan_failed: "O plano não pôde ser criado com segurança. Nenhuma publicação foi feita.",
  }[status || ""] ?? null;
}

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireInternalSession();
  const { id } = await params;
  const { status } = await searchParams;

  let company = null;
  try {
    company = await getCompanyWithSystems(id);
  } catch {
    company = null;
  }

  if (!company) notFound();

  let solutions = [] as Awaited<ReturnType<typeof getCompanySolutions>>;
  let plans = [] as Awaited<ReturnType<typeof getCompanyImplementationPlans>>;
  let kits = [] as Awaited<ReturnType<typeof getSolutionKits>>;
  let directions = [] as Awaited<ReturnType<typeof getVisualDirections>>;

  try { solutions = await getCompanySolutions(id); } catch { solutions = []; }
  try { plans = await getCompanyImplementationPlans(id); } catch { plans = []; }
  try { kits = await getSolutionKits(); } catch { kits = []; }
  try { directions = await getVisualDirections(); } catch { directions = []; }

  const feedback = feedbackLabel(status);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <InternalTopbar user={session.user} active="companies" />

        <Link className={styles.back} href="/interno/empresas">← voltar para empresas</Link>

        <section className={styles.companyHeader}>
          <div>
            <span className={styles.eyebrow}>EMPRESA · {company.relationship_status.toUpperCase()}</span>
            <h1>{company.name}</h1>
            <p className={styles.companyMeta}>
              {[company.segment, company.city_state, company.responsible_label].filter(Boolean).join(" · ") || "Sem detalhes adicionais"}
            </p>
          </div>
        </section>

        {feedback ? <div className={styles.feedback}>{feedback}</div> : null}

        <CreateImplementationPlanForm companyId={id} kits={kits} directions={directions} />

        <div className={styles.sectionTitle} id="implementation-plans">
          <h2>Planos de implantação</h2>
          <span>kit + direção visual + soluções em execução, sempre com aprovação humana</span>
        </div>

        {plans.length === 0 ? (
          <div className={styles.empty}>Nenhum plano de implantação foi criado para esta empresa ainda.</div>
        ) : (
          <section className={styles.solutionGrid} aria-label="Planos de implantação">
            {plans.map((plan) => (
              <article className={styles.solutionCard} key={plan.id}>
                <div className={styles.solutionTop}>
                  <div>
                    <h3>{plan.name}</h3>
                    <p>{plan.kit ? `Kit: ${plan.kit.name} · v${plan.kit.version}` : "Plano personalizado sem kit-base"}</p>
                    <p>{plan.visual_direction ? `Direção visual: ${plan.visual_direction.name}` : "Direção visual ainda não definida"}</p>
                    <p>{plan.items.length} soluções no plano</p>
                    {plan.created_by_label ? <p>Criado por {plan.created_by_label}</p> : null}
                  </div>
                  <span className={styles.solutionStatus}>{planStatusLabel(plan.status)}</span>
                </div>
                <div className={styles.actions}>
                  {plan.kit ? <Link className={styles.secondary} href={`/interno/kits/${plan.kit.slug}`}>Ver kit →</Link> : null}
                  {plan.visual_direction ? <Link className={styles.secondary} href={`/interno/direcoes-visuais/${plan.visual_direction.slug}`}>Ver direção →</Link> : null}
                </div>
              </article>
            ))}
          </section>
        )}

        <div className={styles.sectionTitle}>
          <h2>Soluções Blinko</h2>
          <span>soluções já selecionadas/ativas, separadas dos planos em preparação</span>
        </div>

        {solutions.length === 0 ? (
          <div className={styles.empty}>Nenhuma solução do catálogo foi vinculada a esta empresa ainda.</div>
        ) : (
          <section className={styles.solutionGrid} aria-label="Soluções Blinko">
            {solutions.map((solution) => (
              <article className={styles.solutionCard} key={solution.id}>
                <div className={styles.solutionTop}>
                  <div>
                    <h3>{solution.blueprint.name}</h3>
                    <p>{solution.blueprint.category} · v{solution.selected_version || solution.blueprint.version}</p>
                    {solution.visual_direction ? <p>Direção visual: {solution.visual_direction.name}</p> : <p>Direção visual ainda não definida</p>}
                  </div>
                  <span className={styles.solutionStatus}>{solutionStatusLabel(solution.status)}</span>
                </div>
                <div className={styles.actions}>
                  <Link className={styles.secondary} href={`/interno/solucoes/${solution.blueprint.slug}`}>Ver blueprint →</Link>
                  {solution.visual_direction ? <Link className={styles.secondary} href={`/interno/direcoes-visuais/${solution.visual_direction.slug}`}>Ver direção →</Link> : null}
                </div>
              </article>
            ))}
          </section>
        )}

        <div className={styles.sectionTitle}>
          <h2>Sistemas conectados</h2>
          <span>cada sistema mantém banco e operação próprios</span>
        </div>

        {company.systems.length === 0 ? (
          <div className={styles.empty}>Esta empresa ainda não tem um sistema conectado ao Blinko OS.</div>
        ) : (
          <section className={styles.systemGrid} aria-label="Sistemas conectados">
            {company.systems.map((system) => (
              <article className={styles.systemCard} key={system.id}>
                <div className={styles.systemTop}>
                  <div>
                    <h3>{system.name}</h3>
                    <p>{system.system_type} · {system.environment}</p>
                  </div>
                  <span className={styles.statusPill} data-status={system.status}>{statusLabel(system.status)}</span>
                </div>
                <div className={styles.detailList}>
                  <span><strong>Acesso:</strong> {authLabel(system.auth_strategy)}</span>
                  <span><strong>Health:</strong> {system.last_health_checked_at ? new Date(system.last_health_checked_at).toLocaleString("pt-BR") : "ainda não verificado"}</span>
                  {system.last_health_status_code ? <span><strong>Último código:</strong> {system.last_health_status_code}</span> : null}
                </div>
                <div className={styles.actions}>
                  {system.app_url ? <a className={styles.primary} href={system.app_url} target="_blank" rel="noreferrer">Abrir sistema ↗</a> : null}
                  {system.repository_url ? <a className={styles.secondary} href={system.repository_url} target="_blank" rel="noreferrer">Repositório ↗</a> : null}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
