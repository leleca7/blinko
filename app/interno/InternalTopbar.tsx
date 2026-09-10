import Link from "next/link";
import { getInternalSession, hasInternalPermission } from "../../lib/blinko/internal-auth";
import InternalBrand from "./InternalBrand";
import styles from "./internal-topbar.module.css";

type InternalNavKey = "today" | "commercial" | "companies" | "contacts" | "solutions" | "partners" | "indicators" | "changes" | "recurrence" | "settings" | "users";

const navItems: Array<{ key: InternalNavKey; label: string; href: string; permission: string }> = [
  { key: "today", label: "Hoje", href: "/interno", permission: "dashboard.view" },
  { key: "commercial", label: "Comercial", href: "/interno/comercial", permission: "commercial.view" },
  { key: "companies", label: "Empresas", href: "/interno/empresas", permission: "companies.view" },
  { key: "contacts", label: "Contatos", href: "/interno/contatos", permission: "contacts.view" },
  { key: "solutions", label: "Soluções", href: "/interno/solucoes", permission: "solutions.view" },
  { key: "partners", label: "Parceiros", href: "/interno/parceiros", permission: "partners.view" },
  { key: "indicators", label: "Indicadores", href: "/interno/indicadores", permission: "indicators.view" },
  { key: "changes", label: "Alterações", href: "/interno/alteracoes", permission: "changes.view" },
  { key: "recurrence", label: "Recorrência", href: "/interno/recorrencia", permission: "projects.view" },
  { key: "settings", label: "Configurações", href: "/interno/configuracoes", permission: "settings.view" },
];

export default async function InternalTopbar({ user, active }: { user: string; active: InternalNavKey }) {
  const session = await getInternalSession();
  const visibleItems = session ? navItems.filter((item) => hasInternalPermission(session, item.permission)) : [];
  const displayUser = session?.displayName || user;
  const roleLabel = session?.roleName && session.mode === "individual" ? session.roleName : "";

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}><InternalBrand /></div>
      <nav className={styles.nav} aria-label="Navegação do Blinko OS">
        {visibleItems.map((item) => {
          const isActive = item.key === active || (item.key === "settings" && active === "users");
          return <Link
            className={styles.navLink}
            data-active={isActive ? "true" : "false"}
            aria-current={isActive ? "page" : undefined}
            href={item.href}
            key={item.key}
          >
            {item.label}
          </Link>;
        })}
      </nav>
      <div className={styles.account}>
        <span className={styles.user}>{displayUser}{roleLabel ? ` · ${roleLabel}` : ""}</span>
        <form action="/api/interno/logout" method="post"><button className={styles.logout} type="submit">Sair</button></form>
      </div>
    </header>
  );
}
