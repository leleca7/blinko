import { redirect } from "next/navigation";
import { getInternalSession, isInternalAccessConfigured } from "../../../lib/blinko/internal-auth";
import InternalBrand from "../InternalBrand";
import styles from "../interno.module.css";

type Props = {
  searchParams?: Promise<{ status?: string; next?: string }>;
};

export default async function InternalLoginPage({ searchParams }: Props) {
  const session = await getInternalSession();
  if (session) redirect("/interno");

  const params = searchParams ? await searchParams : {};
  const configured = isInternalAccessConfigured();
  const next = params.next?.startsWith("/interno") ? params.next : "/interno";

  return (
    <main className={styles.loginWrap}>
      <section className={styles.loginCard}>
        <div style={{ marginBottom: 24 }}>
          <InternalBrand />
        </div>
        <span className={styles.eyebrow}>ACESSO INTERNO</span>
        <h1>Hoje na Blinko.</h1>
        <p>Fila operacional, pré-diagnósticos e revisões humanas em um ambiente separado do site público.</p>

        {!configured ? (
          <div className={styles.notice}>
            O acesso interno ainda não foi ativado neste ambiente. Configure as credenciais server-only no Vercel antes de usar o painel.
          </div>
        ) : (
          <>
            {params.status === "invalid" ? (
              <div className={styles.notice}>Usuário ou senha inválidos.</div>
            ) : null}
            <form action="/api/interno/login" method="post" className={styles.form}>
              <input type="hidden" name="next" value={next} />
              <label>
                Usuário
                <input name="user" autoComplete="username" required />
              </label>
              <label>
                Senha
                <input name="password" type="password" autoComplete="current-password" required />
              </label>
              <button className={styles.button} type="submit">Entrar</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
