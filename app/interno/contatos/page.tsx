import Link from "next/link";
import { requireInternalSession } from "../../../lib/blinko/internal-auth";
import { listContactsOverview } from "../../../lib/blinko/company-360-server";
import InternalTopbar from "../InternalTopbar";
import styles from "../empresas/empresas.module.css";

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function number(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

function channelLabel(value: string) {
  return { whatsapp: "WhatsApp", email: "E-mail", phone: "Telefone", meeting: "Reunião", other: "Outro" }[value] ?? value;
}

type Props = { searchParams?: Promise<{ status?: string }> };

function notice(status?: string) {
  if (status === "contact_assigned") return "Contato vinculado à empresa. O histórico comercial existente foi preservado.";
  if (status === "contact_assignment_invalid") return "Selecione uma empresa válida antes de confirmar o vínculo.";
  if (status === "contact_assignment_failed") return "O vínculo não foi salvo. Nenhum relacionamento anterior foi alterado.";
  return null;
}

export default async function ContactsPage({ searchParams }: Props) {
  const session = await requireInternalSession();
  const query = searchParams ? await searchParams : {};
  const overview = await listContactsOverview();
  const statusNotice = notice(query.status);
  const unlinked = overview.contacts.filter((contact) => !text(contact.company_id));
  const linked = overview.contacts.filter((contact) => Boolean(text(contact.company_id)));

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <InternalTopbar user={session.user} active="contacts" />

        <section className={styles.hero}>
          <span className={styles.eyebrow}>RELACIONAMENTO · PESSOAS · EMPRESAS</span>
          <h1>Central de contatos.</h1>
          <p>Contato é a pessoa permanente da relação. Leads continuam registrando a origem comercial; empresas, oportunidades e projetos permanecem entidades independentes.</p>
        </section>

        {statusNotice ? <div className={styles.empty} style={{ marginBottom: 20 }}>{statusNotice}</div> : null}

        {!overview.schemaReady ? (
          <div className={styles.empty}>A central de contatos depende das migrações 028–029 no banco conectado. Nenhum vínculo será inferido enquanto o schema não estiver disponível.</div>
        ) : <>
          <div className={styles.sectionTitle}><h2>Sem empresa definida</h2><span>{unlinked.length} contato(s) aguardando vínculo humano</span></div>
          {unlinked.length === 0 ? <div className={styles.empty}>Nenhum contato está sem empresa.</div> : (
            <section className={styles.systemGrid} aria-label="Contatos sem empresa">
              {unlinked.map((contact) => (
                <article className={styles.systemCard} key={text(contact.id)}>
                  <div className={styles.systemTop}>
                    <div><h3>{text(contact.name)}</h3><p>{text(contact.role_title) || "Função não informada"}</p></div>
                    <span className={styles.statusPill}>Revisar vínculo</span>
                  </div>
                  <div className={styles.detailList}>
                    {text(contact.email) ? <span><strong>E-mail:</strong> {text(contact.email)}</span> : null}
                    {text(contact.whatsapp) ? <span><strong>WhatsApp:</strong> {text(contact.whatsapp)}</span> : null}
                    {text(contact.preferred_channel) ? <span><strong>Canal preferido:</strong> {channelLabel(text(contact.preferred_channel))}</span> : null}
                    <span><strong>Oportunidades:</strong> {number(contact.total_opportunities)} · abertas: {number(contact.open_opportunities)}</span>
                  </div>
                  <form action={`/api/interno/contatos/${text(contact.id)}/assign-company`} method="post" style={{ display: "grid", gap: 10, marginTop: 18 }}>
                    <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700 }}>Empresa
                      <select name="company_id" required defaultValue="" style={{ padding: 11, borderRadius: 12, border: "1px solid rgba(18,55,43,.18)", background: "white", color: "inherit" }}>
                        <option value="" disabled>Selecione após conferir a relação</option>
                        {overview.companies.map((company) => <option value={text(company.id)} key={text(company.id)}>{text(company.name)}</option>)}
                      </select>
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12 }}><input type="checkbox" name="is_primary" value="yes" /><span>Definir como contato principal desta empresa</span></label>
                    <button className={styles.primary} type="submit">Confirmar vínculo</button>
                  </form>
                </article>
              ))}
            </section>
          )}

          <div className={styles.sectionTitle}><h2>Contatos vinculados</h2><span>{linked.length} contato(s) em empresas</span></div>
          {linked.length === 0 ? <div className={styles.empty}>Nenhum contato vinculado ainda.</div> : (
            <section className={styles.systemGrid} aria-label="Contatos vinculados">
              {linked.map((contact) => (
                <article className={styles.systemCard} key={text(contact.id)}>
                  <div className={styles.systemTop}>
                    <div><h3>{text(contact.name)}</h3><p>{text(contact.role_title) || "Função não informada"}</p></div>
                    {contact.is_primary ? <span className={styles.statusPill} data-status="healthy">Principal</span> : <span className={styles.statusPill}>Contato</span>}
                  </div>
                  <div className={styles.detailList}>
                    <span><strong>Empresa:</strong> {text(contact.company_name)}</span>
                    {text(contact.email) ? <span><strong>E-mail:</strong> {text(contact.email)}</span> : null}
                    {text(contact.whatsapp) ? <span><strong>WhatsApp:</strong> {text(contact.whatsapp)}</span> : null}
                    <span><strong>Oportunidades:</strong> {number(contact.total_opportunities)} · abertas: {number(contact.open_opportunities)}</span>
                  </div>
                  <div className={styles.actions}><Link className={styles.primary} href={`/interno/empresas/${text(contact.company_id)}`}>Abrir Empresa 360</Link></div>
                </article>
              ))}
            </section>
          )}
        </>}
      </div>
    </main>
  );
}
