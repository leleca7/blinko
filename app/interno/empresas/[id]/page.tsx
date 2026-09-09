import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalSession } from "../../../../lib/blinko/internal-auth";
import { getCompany360 } from "../../../../lib/blinko/company-360-server";
import {
  getCompanyWithSystems,
  getConnectedSystemOperationalSummary,
} from "../../../../lib/blinko/company-systems-server";
import InternalTopbar from "../../InternalTopbar";
import SystemOperationalSummary from "./SystemOperationalSummary";
import styles from "../empresas.module.css";

function text(value: unknown) { return typeof value === "string" ? value : ""; }

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

function channelLabel(value: string) {
  return { whatsapp: "WhatsApp", email: "E-mail", phone: "Telefone", meeting: "Reunião", other: "Outro" }[value] ?? value;
}

function formatDate(value: unknown) {
  const raw = text(value);
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("pt-BR", { timeZone: "America/Bahia" });
}

function notice(status?: string) {
  if (status === "contact_saved") return "Contato salvo na Empresa 360.";
  if (status === "contact_invalid") return "Informe nome e pelo menos e-mail ou WhatsApp para registrar o contato.";
  if (status === "contact_failed") return "O contato não foi salvo. Nenhum relacionamento existente foi alterado.";
  return null;
}

const controlStyle = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(18,55,43,.18)",
  background: "rgba(255,255,255,.82)",
  color: "inherit",
  font: "inherit",
};

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ status?: string }> };

export default async function CompanyDetailPage({ params, searchParams }: Props) {
  const session = await requireInternalSession();
  const { id } = await params;
  const query = searchParams ? await searchParams : {};

  let company = null;
  let company360 = null as Awaited<ReturnType<typeof getCompany360>> | null;
  try {
    [company, company360] = await Promise.all([getCompanyWithSystems(id), getCompany360(id)]);
  } catch {
    company = null;
  }

  if (!company) notFound();

  const summaryEntries = await Promise.all(
    company.systems.map(async (system) => [system.id, await getConnectedSystemOperationalSummary(system)] as const),
  );
  const summaries = new Map(summaryEntries);
  const statusNotice = notice(query.status);
  const contacts = company360?.schemaReady ? company360.contacts : [];
  const opportunities = company360?.schemaReady ? company360.opportunities : [];
  const diagnostics = company360?.schemaReady ? company360.diagnostics : [];
  const projects = company360?.schemaReady ? company360.projects : [];
  const activeOpportunities = opportunities.filter((item) => !text(item.outcome_status)).length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <InternalTopbar user={session.user} active="companies" />

        <Link className={styles.back} href="/interno/empresas">← voltar para empresas</Link>
        {statusNotice ? <div className={styles.empty} style={{ marginBottom: 20 }}>{statusNotice}</div> : null}

        <section className={styles.companyHeader}>
          <div>
            <span className={styles.eyebrow}>EMPRESA 360 · {company.relationship_status.toUpperCase()}</span>
            <h1>{company.name}</h1>
            <p className={styles.companyMeta}>
              {[company.segment, company.city_state, company.responsible_label].filter(Boolean).join(" · ") || "Sem detalhes adicionais"}
            </p>
          </div>
        </section>

        {!company360?.schemaReady ? (
          <div className={styles.empty} style={{ marginBottom: 28 }}>
            A visão 360 depende das migrações 028–029 no banco conectado. Os sistemas existentes continuam disponíveis abaixo, sem perda de compatibilidade.
          </div>
        ) : <>
          <section className={styles.metricGrid} aria-label="Resumo da Empresa 360">
            <article className={styles.metricCard}><strong>{contacts.length}</strong><span>contatos permanentes</span></article>
            <article className={styles.metricCard}><strong>{activeOpportunities}</strong><span>oportunidades abertas</span></article>
            <article className={styles.metricCard}><strong>{diagnostics.length}</strong><span>diagnósticos</span></article>
            <article className={styles.metricCard}><strong>{projects.length}</strong><span>projetos / ciclos</span></article>
          </section>

          <div className={styles.sectionTitle}><h2>Contatos</h2><span>pessoas permanentes ligadas à empresa</span></div>
          {contacts.length === 0 ? <div className={styles.empty}>Nenhum contato vinculado a esta empresa.</div> : (
            <section className={styles.systemGrid} aria-label="Contatos da empresa">
              {contacts.map((contact) => (
                <article className={styles.systemCard} key={text(contact.id)}>
                  <div className={styles.systemTop}>
                    <div><h3>{text(contact.name)}</h3><p>{text(contact.role_title) || "Função não informada"}</p></div>
                    {contact.is_primary ? <span className={styles.statusPill} data-status="healthy">Principal</span> : <span className={styles.statusPill}>Contato</span>}
                  </div>
                  <div className={styles.detailList}>
                    {text(contact.email) ? <span><strong>E-mail:</strong> {text(contact.email)}</span> : null}
                    {text(contact.whatsapp) ? <span><strong>WhatsApp:</strong> {text(contact.whatsapp)}</span> : null}
                    {text(contact.preferred_channel) ? <span><strong>Canal preferido:</strong> {channelLabel(text(contact.preferred_channel))}</span> : null}
                    {text(contact.notes) ? <span><strong>Observação:</strong> {text(contact.notes)}</span> : null}
                  </div>
                </article>
              ))}
            </section>
          )}

          <section className={styles.systemCard} style={{ marginTop: 16 }}>
            <div className={styles.systemTop}><div><h3>Adicionar contato</h3><p>Cadastre outra pessoa da mesma empresa sem criar novo Lead ou duplicar a Empresa.</p></div></div>
            <form action={`/api/interno/empresas/${id}/contacts`} method="post" style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700 }}>Nome<input name="name" required maxLength={240} style={controlStyle} /></label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700 }}>Função / cargo<input name="role_title" maxLength={240} style={controlStyle} /></label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700 }}>E-mail<input name="email" type="email" maxLength={320} style={controlStyle} /></label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700 }}>WhatsApp<input name="whatsapp" maxLength={120} style={controlStyle} /></label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700 }}>Canal preferido<select name="preferred_channel" defaultValue="" style={controlStyle}><option value="">Não definido</option><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="phone">Telefone</option><option value="meeting">Reunião</option><option value="other">Outro</option></select></label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700 }}>Observações<textarea name="notes" rows={4} maxLength={3000} style={controlStyle} /></label>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12 }}><input type="checkbox" name="is_primary" value="yes" /><span>Tornar este o contato principal da empresa</span></label>
              <button className={styles.primary} type="submit" style={{ justifySelf: "start", border: 0 }}>Salvar contato</button>
            </form>
          </section>

          <div className={styles.sectionTitle}><h2>Oportunidades</h2><span>histórico comercial da empresa, não do cadastro da pessoa</span></div>
          {opportunities.length === 0 ? <div className={styles.empty}>Nenhuma oportunidade vinculada.</div> : (
            <section className={styles.systemGrid} aria-label="Oportunidades da empresa">
              {opportunities.map((opportunity) => (
                <article className={styles.systemCard} key={text(opportunity.id)}>
                  <div className={styles.systemTop}>
                    <div><h3>{text(opportunity.pipeline_stage)}</h3><p>{text(opportunity.contact_name) || "Contato não identificado"}</p></div>
                    <span className={styles.statusPill} data-status={text(opportunity.outcome_status) === "won" ? "healthy" : undefined}>{text(opportunity.outcome_status) || "Aberta"}</span>
                  </div>
                  <div className={styles.detailList}>
                    {text(opportunity.stated_need) ? <span><strong>Necessidade:</strong> {text(opportunity.stated_need)}</span> : null}
                    {text(opportunity.owner_label) ? <span><strong>Responsável:</strong> {text(opportunity.owner_label)}</span> : null}
                    {text(opportunity.next_action_title) ? <span><strong>Próxima ação:</strong> {text(opportunity.next_action_title)}</span> : null}
                    {text(opportunity.next_action_at) ? <span><strong>Acompanhamento:</strong> {formatDate(opportunity.next_action_at)}</span> : null}
                  </div>
                  <div className={styles.actions}><Link className={styles.primary} href={`/interno/comercial/${text(opportunity.id)}`}>Abrir oportunidade</Link></div>
                </article>
              ))}
            </section>
          )}

          <div className={styles.sectionTitle}><h2>Diagnósticos</h2><span>leituras estruturadas realizadas para a empresa</span></div>
          {diagnostics.length === 0 ? <div className={styles.empty}>Nenhum diagnóstico vinculado.</div> : (
            <section className={styles.systemGrid} aria-label="Diagnósticos da empresa">
              {diagnostics.map((diagnostic) => (
                <article className={styles.systemCard} key={text(diagnostic.id)}>
                  <div className={styles.systemTop}><div><h3>{text(diagnostic.status)}</h3><p>{text(diagnostic.methodology_version)}</p></div><span className={styles.statusPill}>{formatDate(diagnostic.created_at)}</span></div>
                  <div className={styles.detailList}>
                    {text(diagnostic.offered_by_label) ? <span><strong>Responsável:</strong> {text(diagnostic.offered_by_label)}</span> : null}
                    {text(diagnostic.payment_confirmed_at) ? <span><strong>Condição confirmada:</strong> {formatDate(diagnostic.payment_confirmed_at)}</span> : null}
                  </div>
                  <div className={styles.actions}><Link className={styles.primary} href={`/interno/diagnosticos/${text(diagnostic.id)}`}>Abrir diagnóstico</Link></div>
                </article>
              ))}
            </section>
          )}

          <div className={styles.sectionTitle}><h2>Projetos e ciclos</h2><span>execuções preservadas ao longo da relação</span></div>
          {projects.length === 0 ? <div className={styles.empty}>Nenhum projeto vinculado.</div> : (
            <section className={styles.systemGrid} aria-label="Projetos da empresa">
              {projects.map((project) => (
                <article className={styles.systemCard} key={text(project.id)}>
                  <div className={styles.systemTop}><div><h3>{text(project.status)}</h3><p>{text(project.target_timeframe)}</p></div><span className={styles.statusPill}>{formatDate(project.start_date)}</span></div>
                  <div className={styles.detailList}><span><strong>Objetivo:</strong> {text(project.objective)}</span>{text(project.next_review_at) ? <span><strong>Próxima revisão:</strong> {formatDate(project.next_review_at)}</span> : null}</div>
                  <div className={styles.actions}><Link className={styles.primary} href={`/interno/projetos/${text(project.id)}`}>Abrir projeto</Link></div>
                </article>
              ))}
            </section>
          )}
        </>}

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
                  <div><h3>{system.name}</h3><p>{system.system_type} · {system.environment}</p></div>
                  <span className={styles.statusPill} data-status={system.status}>{statusLabel(system.status)}</span>
                </div>
                <div className={styles.detailList}>
                  <span><strong>Acesso:</strong> {authLabel(system.auth_strategy)}</span>
                  <span><strong>Health:</strong> {system.last_health_checked_at ? new Date(system.last_health_checked_at).toLocaleString("pt-BR") : "ainda não verificado"}</span>
                  {system.last_health_status_code ? <span><strong>Último código:</strong> {system.last_health_status_code}</span> : null}
                </div>
                <SystemOperationalSummary summary={summaries.get(system.id) || { state: "not_configured" }} />
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
