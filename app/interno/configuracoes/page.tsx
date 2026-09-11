import Link from "next/link";
import { hasInternalPermission, requireInternalSession } from "../../../lib/blinko/internal-auth";
import { getSettingsWorkspace } from "../../../lib/blinko/settings-server";
import InternalTopbar from "../InternalTopbar";
import styles from "../empresas/empresas.module.css";

function text(value: unknown) { return typeof value === "string" ? value : value == null ? "" : String(value); }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function array(value: unknown) { return Array.isArray(value) ? value.map(String) : []; }
function lines(value: unknown) { return array(value).join("\n"); }
function json(value: unknown) { try { return JSON.stringify(value ?? null, null, 2); } catch { return "null"; } }
function when(value: unknown) {
  const raw = text(value); if (!raw) return "—";
  const date = new Date(raw); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { timeZone: "America/Bahia" });
}
function notice(status?: string) {
  const messages: Record<string,string> = {
    parameter_saved: "Nova versão do parâmetro registrada com auditoria.",
    parameter_invalid: "Parâmetro inválido. Revise chave, domínio, tipo, valor e evidência.",
    parameter_invalid_json: "O valor do parâmetro precisa ser JSON válido.",
    parameter_blocked: "A nova versão do parâmetro foi bloqueada pelas regras de governança.",
    automation_saved: "Nova versão da regra de automação registrada. Isso não executa nem implanta código por si só.",
    automation_invalid: "Regra incompleta. Informe gatilho, ação, responsável, resultado esperado, política de falha e evidência.",
    automation_blocked: "A versão da automação foi bloqueada pelas regras de governança.",
    template_saved: "Nova versão do template registrada com auditoria.",
    template_invalid: "Template inválido. Template ativo exige referência de conteúdo e revisão datada.",
    template_blocked: "A versão do template foi bloqueada pelas regras de governança.",
  };
  return status ? messages[status] ?? null : null;
}

const control = { border: "1px solid rgba(18,55,43,.18)", background: "rgba(255,255,255,.86)", color: "#12372b", borderRadius: 12, padding: 11, font: "inherit", width: "100%" };
const textarea = { ...control, minHeight: 92, resize: "vertical" as const };
const button = { justifySelf: "start", border: 0, borderRadius: 12, padding: "11px 15px", background: "#12372b", color: "white", fontWeight: 800, cursor: "pointer" };

type Props = { searchParams?: Promise<{ status?: string }> };

export default async function InternalSettingsPage({ searchParams }: Props) {
  const session = await requireInternalSession("settings.view");
  const query = searchParams ? await searchParams : {};
  const data = await getSettingsWorkspace();
  const canManage = hasInternalPermission(session, "settings.manage");
  const statusNotice = notice(query.status);
  const configuredRules = data.rules.filter((rule) => rule.current_version_id).length;
  const configuredTemplates = data.templates.filter((template) => template.current_version_id).length;

  return <main className={styles.page}><div className={styles.shell}>
    <InternalTopbar user={session.user} active="settings" />
    <section className={styles.hero}>
      <span className={styles.eyebrow}>GOVERNANÇA · VERSÃO · EVIDÊNCIA</span>
      <h1>Configurações do Blinko OS.</h1>
      <p>Parâmetros de negócio, regras A01–A25 e templates documentais são versionados. Alterar configuração nunca apaga o histórico e registrar uma regra não executa código arbitrário.</p>
    </section>
    {statusNotice ? <div className={styles.empty} style={{ marginBottom: 22 }}>{statusNotice}</div> : null}

    {!data.schemaReady ? <div className={styles.empty}>Este ambiente ainda não possui a migração 046 de configurações versionadas.</div> : <>
      <section className={styles.metricGrid} aria-label="Resumo de configurações">
        <article className={styles.metricCard}><strong>{data.parameters.length}</strong><span>parâmetros gerais</span></article>
        <article className={styles.metricCard}><strong>{configuredRules}/{data.rules.length}</strong><span>regras com versão governada</span></article>
        <article className={styles.metricCard}><strong>{configuredTemplates}/{data.templates.length}</strong><span>templates com versão</span></article>
        <article className={styles.metricCard}><strong>{data.executions.length}</strong><span>execuções recentes no log</span></article>
      </section>

      <div className={styles.empty} style={{ marginTop: 22 }}>
        <strong>Separação de responsabilidades:</strong> metas e pesos de indicadores continuam em <Link href="/interno/indicadores">Indicadores</Link>. Usuários e papéis continuam em <Link href="/interno/configuracoes/usuarios">Usuários e acessos</Link>. Constantes técnicas de segurança não são parâmetros de negócio.
      </div>

      <div className={styles.sectionTitle} style={{ marginTop: 38 }}><h2>Parâmetros gerais de negócio</h2><span>nenhum valor padrão é inventado</span></div>
      {canManage ? <article className={styles.systemCard}>
        <h3>Registrar nova versão</h3>
        <p>Use a mesma chave para versionar um parâmetro existente. Domínio e tipo ficam imutáveis depois da primeira versão para evitar mudança silenciosa de significado.</p>
        <form action="/api/interno/configuracoes/parameters" method="post" style={{ display: "grid", gap: 11, marginTop: 16 }}>
          <label>Chave estável<input name="parameter_key" required pattern="[a-z][a-z0-9_.-]{2,119}" placeholder="commercial.renewal_notice_days" style={control} /></label>
          <label>Nome<input name="name" required maxLength={240} style={control} /></label>
          <label>Descrição<textarea name="description" required maxLength={2000} style={textarea} /></label>
          <label>Domínio<select name="domain" defaultValue="commercial" style={control}>{["commercial","diagnostic","operation","financial","partners","communications","files","system"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Tipo do valor<select name="value_kind" defaultValue="number" style={control}>{["boolean","number","string","object","array"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Sensibilidade<select name="sensitivity" defaultValue="normal" style={control}>{["normal","sensitive","critical"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Valor em JSON<textarea name="value_json" required style={textarea} placeholder={'30  |  true  |  "texto"  |  {"chave":"valor"}'} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}><label>Válido a partir de<input type="date" name="valid_from" style={control} /></label><label>Válido até<input type="date" name="valid_until" style={control} /></label></div>
          <label>Evidência / decisão que sustenta o valor<input name="evidence_reference" required maxLength={1000} style={control} /></label>
          <label>Documento-fonte<input name="source_document" maxLength={500} style={control} placeholder="Documento oficial, contrato, ata..." /></label>
          <label>Versão da fonte<input name="source_version" maxLength={200} style={control} /></label>
          <label>Observações<textarea name="notes" maxLength={3000} style={textarea} /></label>
          <button type="submit" style={button}>Criar nova versão do parâmetro</button>
        </form>
      </article> : null}

      <div className={styles.systemGrid} style={{ marginTop: 18 }}>
        {data.parameters.map((parameter) => <article className={styles.systemCard} key={text(parameter.parameter_key)}>
          <div className={styles.systemTop}><div><h3>{text(parameter.name)}</h3><p>{text(parameter.parameter_key)}</p></div><span className={styles.statusPill} data-status="healthy">v{number(parameter.version_number)}</span></div>
          <div className={styles.detailList}>
            <span><strong>Domínio:</strong> {text(parameter.domain)}</span><span><strong>Tipo:</strong> {text(parameter.value_kind)}</span>
            <span><strong>Valor vigente:</strong> <code>{json(parameter.value_json)}</code></span><span><strong>Evidência:</strong> {text(parameter.evidence_reference) || "—"}</span>
            <span><strong>Aprovado por:</strong> {text(parameter.approved_by_label) || "—"} · {when(parameter.approved_at)}</span>
          </div>
        </article>)}
        {!data.parameters.length ? <div className={styles.empty}>Nenhum parâmetro geral de negócio foi formalizado. Isso é preferível a inventar defaults.</div> : null}
      </div>

      <div className={styles.sectionTitle} style={{ marginTop: 42 }}><h2>Regras de automação A01–A25</h2><span>catálogo oficial do Documento 08</span></div>
      <div className={styles.empty} style={{ marginBottom: 18 }}><strong>Importante:</strong> “pilot” ou “active” é um estado governado da regra. Para modo determinístico, o banco exige um binding de runtime. Esta tela não publica código nem dispara a regra.</div>
      <div className={styles.systemGrid}>
        {data.rules.map((rule) => {
          const configured = Boolean(rule.current_version_id);
          return <article className={styles.systemCard} key={text(rule.code)}>
            <div className={styles.systemTop}><div><h3>{text(rule.code)} · {text(rule.name)}</h3><p>{text(rule.domain)}</p></div><span className={styles.statusPill} data-status={configured ? "healthy" : "offline"}>{configured ? `${text(rule.status)} · v${number(rule.version_number)}` : "sem versão"}</span></div>
            <p>{text(rule.official_intent)}</p>
            {configured ? <div className={styles.detailList} style={{ marginTop: 12 }}>
              <span><strong>Modo:</strong> {text(rule.execution_mode)}</span><span><strong>Binding:</strong> {text(rule.runtime_binding) || "—"}</span>
              <span><strong>Responsável:</strong> {text(rule.owner_label)}</span><span><strong>Evidência:</strong> {text(rule.evidence_reference)}</span>
              <span><strong>Última execução:</strong> {when(rule.last_execution_at)}</span><span><strong>Falhas registradas:</strong> {number(rule.failure_count)}</span>
            </div> : null}
            {canManage ? <details style={{ marginTop: 16 }}><summary style={{ cursor: "pointer", fontWeight: 800 }}>Criar nova versão governada</summary>
              <form action={`/api/interno/configuracoes/automation/${text(rule.code)}`} method="post" style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <label>Status<select name="status" defaultValue={text(rule.status) || "draft"} style={control}>{["draft","inactive","pilot","active"].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label>Modo<select name="execution_mode" defaultValue={text(rule.execution_mode) || "manual"} style={control}>{["manual","deterministic","external"].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label>Binding de runtime<input name="runtime_binding" defaultValue={text(rule.runtime_binding)} maxLength={500} style={control} placeholder="Obrigatório para deterministic + pilot/active" /></label>
                <label>Gatilho<textarea name="trigger_description" required defaultValue={text(rule.trigger_description)} style={textarea} /></label>
                <label>Condições — uma por linha<textarea name="conditions" defaultValue={lines(rule.conditions_json)} style={textarea} /></label>
                <label>Ações — uma por linha<textarea name="actions" required defaultValue={lines(rule.actions_json) || text(rule.official_intent)} style={textarea} /></label>
                <label>Exceções — uma por linha<textarea name="exceptions" defaultValue={lines(rule.exceptions_json)} style={textarea} /></label>
                <label>Responsável pela regra<input name="owner_label" required defaultValue={text(rule.owner_label)} maxLength={240} style={control} /></label>
                <label>Resultado esperado<textarea name="expected_result" required defaultValue={text(rule.expected_result)} style={textarea} /></label>
                <label>Política de falha/reprocessamento<textarea name="retry_policy" required defaultValue={text(rule.retry_policy)} style={textarea} /></label>
                <label>Evidência / referência<input name="evidence_reference" required defaultValue={text(rule.evidence_reference)} maxLength={1000} style={control} /></label>
                <label>Observações<textarea name="notes" defaultValue={text(rule.notes)} style={textarea} /></label>
                <button type="submit" style={button}>Criar nova versão de {text(rule.code)}</button>
              </form>
            </details> : null}
          </article>;
        })}
      </div>

      <div className={styles.sectionTitle} style={{ marginTop: 42 }}><h2>Templates documentais</h2><span>conteúdo fica no Drive; OS controla a versão</span></div>
      <div className={styles.systemGrid}>
        {data.templates.map((template) => {
          const configured = Boolean(template.current_version_id);
          return <article className={styles.systemCard} key={text(template.code)}>
            <div className={styles.systemTop}><div><h3>{text(template.name)}</h3><p>{text(template.code)} · {text(template.template_type)}</p></div><span className={styles.statusPill} data-status={configured ? "healthy" : "offline"}>{configured ? `${text(template.status)} · v${number(template.version_number)}` : "sem versão"}</span></div>
            <p>{text(template.description)}</p>
            {configured ? <div className={styles.detailList} style={{ marginTop: 12 }}>
              <span><strong>Público:</strong> {text(template.audience)}</span><span><strong>Responsável:</strong> {text(template.owner_label)}</span>
              <span><strong>Conteúdo:</strong> {text(template.content_reference) || "—"}</span><span><strong>Revisado:</strong> {when(template.reviewed_at)}</span>
              <span><strong>Evidência:</strong> {text(template.evidence_reference)}</span>
            </div> : null}
            {canManage ? <details style={{ marginTop: 16 }}><summary style={{ cursor: "pointer", fontWeight: 800 }}>Criar nova versão</summary>
              <form action={`/api/interno/configuracoes/templates/${text(template.code)}`} method="post" style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <label>Status<select name="status" defaultValue={text(template.status) || "draft"} style={control}>{["draft","active","inactive"].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label>Público<select name="audience" defaultValue={text(template.audience) || "internal"} style={control}><option value="internal">Interno</option><option value="client">Cliente</option><option value="team">Equipe</option><option value="client_team">Cliente + Equipe</option></select></label>
                <label>Referência do conteúdo no Drive<input name="content_reference" defaultValue={text(template.content_reference)} maxLength={1500} style={control} placeholder="Obrigatória quando active" /></label>
                <label>Campos reaproveitáveis — um por linha<textarea name="reusable_fields" defaultValue={lines(template.reusable_fields)} style={textarea} /></label>
                <label>Fontes dos dados — uma por linha<textarea name="data_sources" defaultValue={lines(template.data_sources)} style={textarea} /></label>
                <label>Responsável<input name="owner_label" required defaultValue={text(template.owner_label)} maxLength={240} style={control} /></label>
                <label>Data/hora da revisão<input name="reviewed_at" type="datetime-local" required style={control} /></label>
                <label>Evidência / referência<input name="evidence_reference" required defaultValue={text(template.evidence_reference)} maxLength={1000} style={control} /></label>
                <label>Observações<textarea name="notes" defaultValue={text(template.notes)} style={textarea} /></label>
                <button type="submit" style={button}>Criar nova versão do template</button>
              </form>
            </details> : null}
          </article>;
        })}
      </div>

      <div className={styles.sectionTitle} style={{ marginTop: 42 }}><h2>Log recente de automações</h2><span>auditoria + chave de idempotência</span></div>
      <div className={styles.systemGrid}>
        {data.executions.map((execution) => <article className={styles.systemCard} key={text(execution.id)}>
          <div className={styles.systemTop}><div><h3>{text(execution.rule_code)} · {text(execution.rule_name)}</h3><p>v{number(execution.version_number)} · {when(execution.started_at)}</p></div><span className={styles.statusPill} data-status={text(execution.status)==="succeeded" ? "healthy" : text(execution.status)==="failed" ? "offline" : "warning"}>{text(execution.status)}</span></div>
          <div className={styles.detailList}><span><strong>Idempotência:</strong> <code>{text(execution.idempotency_key)}</code></span><span><strong>Alvo:</strong> {text(execution.entity_type) || "—"} {text(execution.entity_id)}</span><span><strong>Finalizada:</strong> {when(execution.completed_at)}</span>{text(execution.error_detail) ? <span><strong>Erro:</strong> {text(execution.error_detail)}</span> : null}</div>
        </article>)}
        {!data.executions.length ? <div className={styles.empty}>Nenhuma execução de regra governada foi registrada ainda.</div> : null}
      </div>
    </>}
  </div></main>;
}
