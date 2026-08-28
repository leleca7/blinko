import Link from "next/link";
import { requireInternalSession } from "../../../lib/blinko/internal-auth";
import { listCompaniesWithSystems } from "../../../lib/blinko/company-systems-server";
import InternalBrand from "../InternalBrand";
import styles from "./empresas.module.css";

function systemStatusLabel(status: string) {
  return {
    healthy: "Saudável",
    degraded: "Atenção",
    offline: "Offline",
    paused: "Pausado",
    unknown: "Não verificado",
  }[status] ?? status;
}

export default async function CompaniesPage() {
  await requireInternalSession();

  let companies = [] as Awaited<ReturnType<typeof listCompaniesWithSystems>>;
  let loadFailed = false;

  try {
    companies = await listCompaniesWithSystems();
  } catch {
    loadFailed = true;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <InternalBrand />
          <nav className={styles.nav}>
            <Link href="/interno">Hoje</Link>
            <Link href="/interno/projetos">Projetos</Link>
          </nav>
        </header>

        <section className={styles.hero}>
          <span className={styles.eyebrow}>PORTFÓLIO · EMPRESAS · SISTEMAS</span>
          <h1>Central de empresas.</h1>
          <p>
            A Blinko acompanha a relação, os projetos e os sistemas de cada empresa sem misturar
            operações ou bancos. Cada negócio preserva seu próprio ambiente de trabalho.
          </p>
        </section>

        {loadFailed ? (
          <div className={styles.empty}>
            A central ainda não está disponível neste ambiente. A estrutura precisa estar conectada ao banco correspondente.
          </div>
        ) : companies.length === 0 ? (
          <div className={styles.empty}>Nenhuma empresa cadastrada ainda.</div>
        ) : (
          <section className={styles.list} aria-label="Empresas">
            {companies.map((company) => (
              <Link className={styles.companyCard} href={`/interno/empresas/${company.id}`} key={company.id}>
                <span>
                  <span className={styles.companyName}>{company.name}</span>
                  <span className={styles.companyMeta}>
                    {[company.segment, company.city_state, company.responsible_label].filter(Boolean).join(" · ") || "Sem detalhes adicionais"}
                  </span>
                </span>

                <span className={styles.systemSummary}>
                  {company.systems.length === 0 ? (
                    <span className={styles.systemPill}>Nenhum sistema conectado</span>
                  ) : (
                    company.systems.slice(0, 3).map((system) => (
                      <span className={styles.statusPill} data-status={system.status} key={system.id}>
                        {system.name} · {systemStatusLabel(system.status)}
                      </span>
                    ))
                  )}
                </span>

                <span className={styles.arrow}>→</span>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
