import { requireInternalSession } from "../../../lib/blinko/internal-auth";
import { getIndicatorsDashboard } from "../../../lib/blinko/indicators-server";
import InternalTopbar from "../InternalTopbar";
import styles from "../empresas/empresas.module.css";

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function number(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function formatValue(value: unknown, unit: string) {
  const numeric = number(value);
  if (numeric === null) return "—";
  if (unit === "currency") return numeric.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (unit === "percentage") return `${numeric.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  if (unit === "hours") return `${numeric.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} h`;
  if (unit === "days") return `${numeric.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} d`;
  return numeric.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
function calcLabel(value: string) {
  return {
    calculated: "Calculado",
    insufficient_data: "Dados insuficientes",
    parameter_not_configured: "PARÂMETRO NÃO CONFIGURADO",
    source_not_available: "FONTE NÃO NORMALIZADA",
  }[value] ?? value;
}
function performanceLabel(value: string) {
  return { on_target: "Na meta", off_target: "Fora da meta", unknown: "Sem comparação" }[value] ?? value;
}
function targetText(item: Record<string, unknown>) {
  if (text(item.target_status) !== "configured") return "META NÃO CONFIGURADA";
  const operator = { gte: "≥", lte: "≤", eq: "=", between: "entre" }[text(item.target_operator)] ?? text(item.target_operator);
  const first = formatValue(item.target_value, text(item.unit));
  const second = formatValue(item.target_value_max, text(item.unit));
  return text(item.target_operator) === "between" ? `${operator} ${first} e ${second}` : `${operator} ${first}`;
}
function notice(status?: string) {
  if (status === "target_saved") return "Meta registrada como nova versão, com evidência e auditoria.";
  if (status === "target_invalid") return "Revise operador, valores, validade, referência e confirmação da meta.";
  if (status === "target_blocked") return "A meta não foi registrada. Nenhuma configuração anterior foi apagada.";
  if (status === "weights_saved") return "Pesos do forecast registrados como nova versão. O forecast pode ser calculado com os valores estimados existentes.";
  if (status === "weights_invalid") return "Informe pesos de P01 a P13 entre 0% e 100%, referência e confirmação.";
  if (status === "weights_blocked") return "Os pesos do forecast não foram registrados. A versão anterior foi preservada.";
  if (status === "indicators_schema_pending") return "O banco conectado ainda não possui a migração de Indicadores e Metas.";
  return null;
}

const controlStyle = { border: "1px solid rgba(18,55,43,.18)", background: "rgba(255,255,255,.82)", color: "#12372b", borderRadius: 12, padding: 11, font: "inherit", width: "100%" };
const domainNames: Record<string, string> = { commercial: "Comercial", operation: "Operação", financial: "Financeiro", diagnostic: "Diagnóstico" };
const stages = Array.from({ length: 13 }, (_, index) => `P${String(index + 1).padStart(2, "0")}`);

type Props = { searchParams?: Promise<{ status?: string }> };

export default async function IndicatorsPage({ searchParams }: Props) {
  const session = await requireInternalSession();
  const query = searchParams ? await searchParams : {};
  const dashboard = await getIndicatorsDashboard();
  const statusNotice = notice(query.status);
  const calculated = dashboard.indicators.filter((item) => text(item.calculation_status) === "calculated").length;
  const unavailable = dashboard.indicators.filter((item) => text(item.calculation_status) !== "calculated").length;
  const targetsConfigured = dashboard.indicators.filter((item) => text(item.target_status) === "configured").length;
  const targetsMissing = dashboard.indicators.filter((item) => text(item.target_status) === "not_configured").length;
  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const item of dashboard.indicators) {
    const domain = text(item.domain);
    grouped.set(domain, [...(grouped.get(domain) ?? []), item]);
  }

  return (
    <main className={styles.page}><div className={styles.shell}>
      <InternalTopbar user={session.user} active="indicators" />
      <section className={styles.hero}>
        <span className={styles.eyebrow}>MEDIR → MELHORAR · FONTE OPERACIONAL</span>
        <h1>Indicadores.</h1>
        <p>Valores vêm das entidades operacionais do Blinko OS. Meta é configuração versionada e separada. Quando a fonte, os dados ou um parâmetro não são suficientes, o sistema não completa o número por aproximação.</p>
      </section>
      {statusNotice ? <div className={styles.empty} style={{ marginBottom: 22 }}>{statusNotice}</div> : null}

      {!dashboard.schemaReady ? <div className={styles.empty}>Esta tela depende das migrações 041–043 no banco conectado. Nenhum indicador será inferido a partir de números soltos.</div> : <>
        <section className={styles.metricGrid} aria-label="Resumo dos indicadores">
          <article className={styles.metricCard}><strong>{dashboard.indicators.length}</strong><span>indicadores catalogados</span></article>
          <article className={styles.metricCard}><strong>{calculated}</strong><span>com cálculo confiável agora</span></article>
          <article className={styles.metricCard}><strong>{unavailable}</strong><span>sem cálculo confiável agora</span></article>
          <article className={styles.metricCard}><strong>{targetsConfigured}</strong><span>metas configuradas</span></article>
          <article className={styles.metricCard}><strong>{targetsMissing}</strong><span>metas ainda não configuradas</span></article>
        </section>

        {["commercial", "operation", "financial", "diagnostic"].map((domain) => {
          const items = grouped.get(domain) ?? [];
          return <section key={domain} style={{ marginTop: 34 }}>
            <div className={styles.sectionTitle}><h2>{domainNames[domain]}</h2><span>{items.length} indicador(es)</span></div>
            <div className={styles.systemGrid}>
              {items.map((item) => {
                const calculationStatus = text(item.calculation_status);
                const performanceStatus = text(item.performance_status);
                const canConfigureTarget = calculationStatus !== "source_not_available";
                return <article className={styles.systemCard} key={text(item.indicator_code)}>
                  <div className={styles.systemTop}>
                    <div><h3>{text(item.name)}</h3><p>{text(item.indicator_code)}</p></div>
                    <span className={styles.statusPill} data-status={calculationStatus === "calculated" ? "healthy" : calculationStatus === "source_not_available" ? "offline" : "degraded"}>{calcLabel(calculationStatus)}</span>
                  </div>
                  <strong style={{ display: "block", fontSize: 30, letterSpacing: "-.03em" }}>{formatValue(item.value_numeric, text(item.unit))}</strong>
                  <div className={styles.detailList}>
                    <span><strong>Fórmula:</strong> {text(item.formula_description)}</span>
                    <span><strong>Fonte:</strong> {text(item.source_description)}</span>
                    {text(item.status_reason) ? <span><strong>Por que não calcula:</strong> {text(item.status_reason)}</span> : null}
                    <span><strong>Meta:</strong> {targetText(item)}</span>
                    <span><strong>Leitura:</strong> {performanceLabel(performanceStatus)}</span>
                    {text(item.target_evidence_reference) ? <span><strong>Referência da meta:</strong> {text(item.target_evidence_reference)} · v{text(item.target_version)}</span> : null}
                  </div>

                  {canConfigureTarget ? <details style={{ marginTop: 18 }}>
                    <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 800 }}>Configurar nova versão de meta</summary>
                    <form action="/api/interno/indicadores/target" method="post" style={{ display: "grid", gap: 10, marginTop: 13 }}>
                      <input type="hidden" name="indicator_code" value={text(item.indicator_code)} />
                      <label style={{ fontSize: 12 }}>Operador<select name="target_operator" defaultValue="gte" required style={controlStyle}><option value="gte">Maior ou igual</option><option value="lte">Menor ou igual</option><option value="eq">Igual</option><option value="between">Entre dois valores</option></select></label>
                      <label style={{ fontSize: 12 }}>Valor da meta<input name="target_value" type="number" step="0.0001" required style={controlStyle} /></label>
                      <label style={{ fontSize: 12 }}>Valor máximo, somente para “entre”<input name="target_value_max" type="number" step="0.0001" style={controlStyle} /></label>
                      <label style={{ fontSize: 12 }}>Válida a partir de<input name="valid_from" type="date" style={controlStyle} /></label>
                      <label style={{ fontSize: 12 }}>Válida até<input name="valid_until" type="date" style={controlStyle} /></label>
                      <label style={{ fontSize: 12 }}>Referência/evidência da decisão<input name="evidence_reference" required maxLength={1000} style={controlStyle} /></label>
                      <label style={{ fontSize: 12 }}>Observação<textarea name="notes" rows={3} maxLength={4000} style={controlStyle} /></label>
                      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12 }}><input type="checkbox" name="target_confirmed" value="yes" required /><span>Confirmo que esta meta foi definida deliberadamente; ela não é uma sugestão automática do sistema.</span></label>
                      <button type="submit" style={{ border: 0, borderRadius: 12, padding: "11px 14px", background: "#12372b", color: "white", fontWeight: 800, cursor: "pointer" }}>Registrar nova versão</button>
                    </form>
                  </details> : null}
                </article>;
              })}
            </div>
          </section>;
        })}

        <section style={{ marginTop: 38 }}>
          <div className={styles.sectionTitle}><h2>Configuração do forecast</h2><span>parâmetro explícito · sem pesos padrão</span></div>
          <article className={styles.systemCard}>
            <p style={{ lineHeight: 1.55 }}>O forecast ponderado só calcula após P01–P13 receberem probabilidades aprovadas. Os campos ficam vazios quando não há configuração; valores existentes são mostrados apenas porque já foram formalmente registrados no banco.</p>
            <form action="/api/interno/indicadores/forecast-weights" method="post" style={{ display: "grid", gap: 12, marginTop: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
                {stages.map((stage) => {
                  const current = number(dashboard.forecastWeights?.[stage]);
                  return <label key={stage} style={{ fontSize: 12 }}>{stage} · %<input name={stage} type="number" min="0" max="100" step="0.01" required defaultValue={current === null ? undefined : current * 100} style={controlStyle} /></label>;
                })}
              </div>
              <label style={{ fontSize: 12 }}>Referência/evidência da regra<input name="evidence_reference" required maxLength={1000} style={controlStyle} /></label>
              <label style={{ fontSize: 12 }}>Observação<textarea name="notes" rows={3} maxLength={4000} style={controlStyle} /></label>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12 }}><input type="checkbox" name="weights_confirmed" value="yes" required /><span>Confirmo que os pesos foram deliberadamente aprovados para uso no forecast e não foram sugeridos automaticamente pelo OS.</span></label>
              <button type="submit" style={{ justifySelf: "start", border: 0, borderRadius: 12, padding: "11px 14px", background: "#12372b", color: "white", fontWeight: 800, cursor: "pointer" }}>Registrar pesos como nova versão</button>
            </form>
          </article>
        </section>

        <section style={{ marginTop: 38 }}>
          <div className={styles.sectionTitle}><h2>Detalhamento operacional</h2><span>fontes que explicam os totais</span></div>
          <div className={styles.systemGrid}>
            <article className={styles.systemCard}><h3>Leads por origem</h3><div className={styles.detailList}>{dashboard.leadsBySource.map((row) => <span key={text(row.source)}><strong>{text(row.source)}:</strong> {number(row.lead_count)?.toLocaleString("pt-BR") ?? "0"}</span>)}{!dashboard.leadsBySource.length ? <span>Sem leads.</span> : null}</div></article>
            <article className={styles.systemCard}><h3>Perdas por motivo</h3><div className={styles.detailList}>{dashboard.lossesByReason.map((row) => <span key={text(row.loss_reason)}><strong>{text(row.loss_reason)}:</strong> {number(row.opportunity_count)?.toLocaleString("pt-BR") ?? "0"}</span>)}{!dashboard.lossesByReason.length ? <span>Nenhuma oportunidade perdida registrada.</span> : null}</div></article>
            <article className={styles.systemCard}><h3>Bloqueios por fonte</h3><div className={styles.detailList}>{dashboard.blocksBySource.map((row) => <span key={text(row.blocking_source)}><strong>{text(row.blocking_source)}:</strong> {number(row.task_count)?.toLocaleString("pt-BR") ?? "0"}</span>)}{!dashboard.blocksBySource.length ? <span>Nenhuma tarefa atualmente bloqueada.</span> : null}</div></article>
          </div>
        </section>

        <section style={{ marginTop: 38 }}>
          <div className={styles.sectionTitle}><h2>Rentabilidade por cliente</h2><span>receita e custo só quando registrados</span></div>
          <div className={styles.systemGrid}>{dashboard.financeByCompany.map((row) => <article className={styles.systemCard} key={text(row.company_id)}><div className={styles.systemTop}><h3>{text(row.company_name)}</h3><span className={styles.statusPill} data-status={text(row.financial_coverage_status) === "covered" ? "healthy" : "degraded"}>{text(row.financial_coverage_status) === "covered" ? "Cobertura financeira completa" : "Cobertura financeira incompleta"}</span></div><div className={styles.detailList}><span><strong>Receita líquida:</strong> {formatValue(row.net_revenue,"currency")}</span><span><strong>Custo realizado:</strong> {formatValue(row.realized_cost,"currency")}</span><span><strong>Contribuição:</strong> {formatValue(row.realized_contribution,"currency")}</span><span><strong>Margem:</strong> {formatValue(row.realized_margin_pct,"percentage")}</span><span><strong>Caixa líquido:</strong> {formatValue(row.net_cash,"currency")}</span><span><strong>Recebíveis abertos:</strong> {formatValue(row.open_receivables,"currency")}</span>{text(row.financial_coverage_status) === "incomplete" ? <span><strong>Por que contribuição/margem estão bloqueadas:</strong> {number(row.cost_projects_without_financial_plan)?.toLocaleString("pt-BR") ?? "0"} projeto(s) possuem custo realizado sem plano financeiro correspondente.</span> : null}</div></article>)}{!dashboard.financeByCompany.length ? <div className={styles.empty}>Nenhum cliente possui dados financeiros normalizados.</div> : null}</div>
        </section>

        <section style={{ marginTop: 38 }}>
          <div className={styles.sectionTitle}><h2>Diagnóstico por pilar</h2><span>somente coleções atuais</span></div>
          <div className={styles.systemGrid}>{dashboard.diagnosticByPillar.map((row) => <article className={styles.systemCard} key={text(row.pillar_code)}><h3>{text(row.pillar_code)} · {text(row.name)}</h3><div className={styles.detailList}><span><strong>Maturidade média:</strong> {formatValue(row.avg_maturity,"percentage")}</span><span><strong>Completude média:</strong> {formatValue(row.avg_completeness,"percentage")}</span><span><strong>Diagnósticos:</strong> {number(row.diagnostic_count)?.toLocaleString("pt-BR") ?? "0"}</span><span><strong>Inconclusivos:</strong> {number(row.inconclusive_count)?.toLocaleString("pt-BR") ?? "0"}</span></div></article>)}{!dashboard.diagnosticByPillar.length ? <div className={styles.empty}>Ainda não há scores atuais por pilar.</div> : null}</div>
        </section>
      </>}
    </div></main>
  );
}
