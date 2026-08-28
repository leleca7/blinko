import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalSession } from "../../../../lib/blinko/internal-auth";
import { getCompanyWithSystems } from "../../../../lib/blinko/company-systems-server";
import InternalTopbar from "../../InternalTopbar";
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

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireInternalSession();
  const { id } = await params;

  let company = null;
  try {
    company = await getCompanyWithSystems(id);
  } catch {
    company = null;
  }

  if (!company) notFound();

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

        <div className={styles.sectionTitle}>
          <h2>Sistemas conectados</h2>
          <span>cada sistema mantém banco e operação próprios</span>
        </div>

        {company.systems.length === 0 ? (
          <div className={styles.empty}>
            Esta empresa ainda não tem um sistema conectado ao Blinko OS.
          </div>
        ) : (
          <section className={styles.systemGrid} aria-label="Sistemas conectados">
            {company.systems.map((system) => (
              <article className={styles.systemCard} key={system.id}>
                <div className={styles.systemTop}>
                  <div>
                    <h3>{system.name}</h3>
                    <p>{system.system_type} · {system.environment}</p>
                  </div>
                  <span className={styles.statusPill} data-status={system.status}>
                    {statusLabel(system.status)}
                  </span>
                </div>

                <div className={styles.detailList}>
                  <span><strong>Acesso:</strong> {authLabel(system.auth_strategy)}</span>
                  <span><strong>Health:</strong> {system.last_health_checked_at ? new Date(system.last_health_checked_at).toLocaleString("pt-BR") : "ainda não verificado"}</span>
                  {system.last_health_status_code ? <span><strong>Último código:</strong> {system.last_health_status_code}</span> : null}
                </div>

                <div className={styles.actions}>
                  {system.app_url ? (
                    <a className={styles.primary} href={system.app_url} target="_blank" rel="noreferrer">
                      Abrir sistema ↗
                    </a>
                  ) : null}
                  {system.repository_url ? (
                    <a className={styles.secondary} href={system.repository_url} target="_blank" rel="noreferrer">
                      Repositório ↗
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
