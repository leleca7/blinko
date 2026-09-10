import { requireInternalSession } from "../../../../lib/blinko/internal-auth";
import { getInternalUsersAdminContext } from "../../../../lib/blinko/internal-users-server";
import InternalTopbar from "../../InternalTopbar";
import styles from "../../empresas/empresas.module.css";

function text(value: unknown) { return typeof value === "string" ? value : value == null ? "" : String(value); }
function when(value: unknown) {
  const raw = text(value);
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { timeZone: "America/Bahia" });
}
function notice(status?: string) {
  if (status === "created") return "Usuário individual criado. Se este foi o primeiro Admin, o login compartilhado de bootstrap foi encerrado.";
  if (status === "updated") return "Usuário atualizado com auditoria.";
  if (status === "password_reset") return "Nova senha registrada. O hash anterior foi substituído sem expor a senha no banco.";
  if (status === "invalid") return "Revise os campos: usuário, papel, senha mínima de 12 caracteres e confirmação.";
  if (status === "blocked") return "A operação foi bloqueada pela política de permissões. Nenhuma regra de segurança foi contornada.";
  return null;
}

const control = { border: "1px solid rgba(18,55,43,.18)", background: "rgba(255,255,255,.82)", color: "#12372b", borderRadius: 12, padding: 11, font: "inherit", width: "100%" };
type Props = { searchParams?: Promise<{ status?: string }> };

export default async function InternalUsersPage({ searchParams }: Props) {
  const session = await requireInternalSession("settings.users.manage");
  const query = searchParams ? await searchParams : {};
  const data = await getInternalUsersAdminContext();
  const statusNotice = notice(query.status);
  const internalLoginRoles = data.roles.filter((role) => role.login_enabled === true && !["partner","client"].includes(text(role.code)));
  const activeUsers = data.users.filter((user) => text(user.status) === "active").length;

  return <main className={styles.page}><div className={styles.shell}>
    <InternalTopbar user={session.user} active="users" />
    <section className={styles.hero}>
      <span className={styles.eyebrow}>SEGURANÇA · MENOR PRIVILÉGIO · AUDITORIA</span>
      <h1>Usuários e acessos.</h1>
      <p>Contas individuais substituem o login compartilhado. Papéis usam uma matriz fixa nesta V1; financeiro e configurações não são liberados automaticamente a toda a equipe.</p>
    </section>
    {statusNotice ? <div className={styles.empty} style={{ marginBottom: 22 }}>{statusNotice}</div> : null}

    {!data.schemaReady ? <div className={styles.empty}>Este ambiente ainda não possui a migração 044 de usuários e permissões.</div> : <>
      <section className={styles.metricGrid} aria-label="Resumo de acessos">
        <article className={styles.metricCard}><strong>{data.users.length}</strong><span>usuários cadastrados</span></article>
        <article className={styles.metricCard}><strong>{activeUsers}</strong><span>usuários ativos</span></article>
        <article className={styles.metricCard}><strong>{internalLoginRoles.length}</strong><span>papéis com login interno</span></article>
        <article className={styles.metricCard}><strong>{session.mode === "legacy" ? "BOOTSTRAP" : "INDIVIDUAL"}</strong><span>modo da sessão atual</span></article>
      </section>

      {session.mode === "legacy" ? <div className={styles.empty} style={{ marginTop: 22 }}><strong>Configuração inicial.</strong> Crie o primeiro usuário como Admin. Assim que ele for criado, esta sessão compartilhada deixa de ser aceita e será necessário entrar novamente com a conta individual.</div> : null}

      <div className={styles.sectionTitle} style={{ marginTop: 34 }}><h2>Criar usuário individual</h2><span>somente papéis internos habilitados</span></div>
      <article className={styles.systemCard}>
        <form action="/api/interno/configuracoes/usuarios" method="post" style={{ display: "grid", gap: 12 }}>
          <input type="hidden" name="action" value="create" />
          <label>Usuário único<input name="username" required minLength={3} maxLength={64} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}" autoComplete="off" style={control} placeholder="nome.sobrenome" /></label>
          <label>Nome de exibição<input name="display_name" required maxLength={160} style={control} /></label>
          <label>E-mail, se aplicável<input name="email" type="email" maxLength={320} autoComplete="off" style={control} /></label>
          <label>Papel<select name="role_code" defaultValue={session.mode === "legacy" ? "admin" : "operations"} style={control}>{internalLoginRoles.map((role) => <option key={text(role.code)} value={text(role.code)}>{text(role.name)}</option>)}</select></label>
          <label>Senha inicial<input name="password" type="password" required minLength={12} autoComplete="new-password" style={control} /></label>
          <label style={{ display: "flex", gap: 9, alignItems: "flex-start" }}><input type="checkbox" name="confirmed" value="yes" required /><span>Confirmo a identidade, o papel e o nível de acesso deste usuário.</span></label>
          <button type="submit" style={{ justifySelf: "start", border: 0, borderRadius: 12, padding: "11px 15px", background: "#12372b", color: "white", fontWeight: 800, cursor: "pointer" }}>Criar usuário</button>
        </form>
      </article>

      <div className={styles.sectionTitle} style={{ marginTop: 38 }}><h2>Contas cadastradas</h2><span>senha nunca é exibida</span></div>
      <div className={styles.systemGrid}>
        {data.users.map((user) => {
          const userId = text(user.id);
          const isSelf = session.userId === userId;
          return <article className={styles.systemCard} key={userId}>
            <div className={styles.systemTop}><div><h3>{text(user.display_name)}</h3><p>@{text(user.username)}{text(user.email) ? ` · ${text(user.email)}` : ""}</p></div><span className={styles.statusPill} data-status={text(user.status) === "active" ? "healthy" : "offline"}>{text(user.status)}</span></div>
            <div className={styles.detailList}>
              <span><strong>Papel:</strong> {text(user.role_name)}</span>
              <span><strong>Escopo:</strong> {text(user.access_scope)}</span>
              <span><strong>Último login:</strong> {when(user.last_login_at)}</span>
              <span><strong>Senha alterada:</strong> {when(user.password_changed_at)}</span>
            </div>

            <form action={`/api/interno/configuracoes/usuarios/${userId}`} method="post" style={{ display: "grid", gap: 9, marginTop: 16 }}>
              <input type="hidden" name="action" value="role" />
              <select name="role_code" defaultValue={text(user.role_code)} disabled={isSelf} style={control}>{internalLoginRoles.map((role) => <option key={text(role.code)} value={text(role.code)}>{text(role.name)}</option>)}</select>
              <button type="submit" disabled={isSelf} style={{ justifySelf: "start" }}>Alterar papel</button>
            </form>

            <form action={`/api/interno/configuracoes/usuarios/${userId}`} method="post" style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <input type="hidden" name="action" value="status" />
              <input type="hidden" name="status" value={text(user.status) === "active" ? "disabled" : "active"} />
              <button type="submit" disabled={isSelf}>{text(user.status) === "active" ? "Desativar" : "Reativar"}</button>
            </form>

            <details style={{ marginTop: 15 }}><summary style={{ cursor: "pointer", fontWeight: 700 }}>Redefinir senha</summary>
              <form action={`/api/interno/configuracoes/usuarios/${userId}`} method="post" style={{ display: "grid", gap: 9, marginTop: 10 }}>
                <input type="hidden" name="action" value="password" />
                <input name="password" type="password" required minLength={12} autoComplete="new-password" placeholder="Nova senha (mín. 12 caracteres)" style={control} />
                <label style={{ display: "flex", gap: 8 }}><input type="checkbox" name="confirmed" value="yes" required /><span>Confirmo a redefinição.</span></label>
                <button type="submit" style={{ justifySelf: "start" }}>Redefinir senha</button>
              </form>
            </details>
          </article>;
        })}
        {!data.users.length ? <div className={styles.empty}>Nenhum usuário individual existe ainda. O primeiro precisa ser Admin.</div> : null}
      </div>

      <div className={styles.empty} style={{ marginTop: 28 }}><strong>Parceiro e Cliente:</strong> os papéis existem na matriz oficial, mas o login interno está desabilitado. Parceiro exige escopo explícito por projeto; Cliente será tratado em portal próprio quando essa necessidade entrar no escopo.</div>
    </>}
  </div></main>;
}
