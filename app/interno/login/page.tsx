import { redirect } from "next/navigation";
import { getInternalAccessMode, getInternalSession } from "../../../lib/blinko/internal-auth";
import InternalBrand from "../InternalBrand";
import styles from "../interno.module.css";

type Props = {
  searchParams?: Promise<{ status?: string; next?: string }>;
};

export default async function InternalLoginPage({ searchParams }: Props) {
  const session = await getInternalSession();
  if (session) redirect("/interno");

  const params = searchParams ? await searchParams : {};
  const mode = await getInternalAccessMode();
  const configured = mode !== "unconfigured";
  const next = params.next?.startsWith("/interno") ? params.next : "/interno";

  return (
    <main className={styles.loginWrap}>
      <section className={styles.loginCard}>
        <div style={{ marginBottom: 24 }}><InternalBrand /></div>
        <span className={styles.eyebrow}>{mode === "bootstrap" ? "CONFIGURAÇÃO INICIAL" : "ACESSO INTERNO"}</span>
        <h1>Hoje na Blinko.</h1>
        <p>{mode === "individual" ? "Entre com seu usuário individual. Papel, permissões e status são revalidados a cada acesso." : "Acesso provisório de bootstrap para criar o primeiro administrador individual do Blinko OS."}</p>

        {!configured ? (
          <div className={styles.notice}>
            O acesso interno ainda não está configurado neste ambiente. É necessário manter o segredo de sessão e, antes do primeiro usuário individual, as credenciais provisórias server-only.
          </div>
        ) : (
          <>
            {params.status === "invalid" ? <div className={styles.notice}>Usuário ou senha inválidos, desativados ou sem permissão de login.</div> : null}
            {params.status === "individual_ready" ? <div className={styles.notice}>Usuário individual criado. O acesso compartilhado de bootstrap foi encerrado; entre com sua nova conta.</div> : null}
            {mode === "bootstrap" ? <div className={styles.notice}>Depois de entrar, abra Configurações → Usuários e crie o primeiro Admin. A credencial compartilhada deixa de funcionar imediatamente após essa criação.</div> : null}
            <form action="/api/interno/login" method="post" className={styles.form}>
              <input type="hidden" name="next" value={next} />
              <label>Usuário<input name="user" autoComplete="username" required /></label>
              <label>Senha<input name="password" type="password" autoComplete="current-password" required /></label>
              <button className={styles.button} type="submit">Entrar</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
