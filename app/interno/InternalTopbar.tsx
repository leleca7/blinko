import Link from "next/link";
import InternalBrand from "./InternalBrand";
import styles from "./internal-topbar.module.css";

type InternalNavKey = "today" | "commercial" | "companies" | "contacts";

const navItems: Array<{ key: InternalNavKey; label: string; href: string }> = [
  { key: "today", label: "Hoje", href: "/interno" },
  { key: "commercial", label: "Comercial", href: "/interno/comercial" },
  { key: "companies", label: "Empresas", href: "/interno/empresas" },
  { key: "contacts", label: "Contatos", href: "/interno/contatos" },
];

export default function InternalTopbar({ user, active }: { user: string; active: InternalNavKey }) {
  return (
    <header className={styles.topbar}>
      <div className={styles.brand}><InternalBrand /></div>
      <nav className={styles.nav} aria-label="Navegação do Blinko OS">
        {navItems.map((item) => (
          <Link
            className={styles.navLink}
            data-active={item.key === active ? "true" : "false"}
            aria-current={item.key === active ? "page" : undefined}
            href={item.href}
            key={item.key}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className={styles.account}>
        <span className={styles.user}>{user}</span>
        <form action="/api/interno/logout" method="post">
          <button className={styles.logout} type="submit">Sair</button>
        </form>
      </div>
    </header>
  );
}
