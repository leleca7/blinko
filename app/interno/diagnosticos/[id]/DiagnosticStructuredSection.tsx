import styles from "../../interno.module.css";

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function list(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function scoreValue(item: Record<string, unknown>) {
  const state = text(item.response_state);
  if (state === "na") return "na";
  if (state === "score") return text(item.score);
  return "nv";
}

function bandLabel(value: unknown) {
  return ({ fragile: "Frágil", basic: "Básica", structuring: "Em estruturação", structured: "Estruturada", optimized: "Otimizada" } as Record<string, string>)[text(value)] ?? "—";
}

function pillarStatus(value: unknown) {
  return ({ valid: "Válido", inconclusive: "Inconclusivo", not_applicable: "Não aplicável" } as Record<string, string>)[text(value)] ?? "—";
}

const fieldStyle = {
  width: "100%",
  border: "1px solid rgba(1,48,30,.16)",
  background: "rgba(255,255,255,.82)",
  color: "#08271b",
  borderRadius: 12,
  padding: 11,
  font: "inherit",
};

type Props = {
  diagnosticId: string;
  canEdit: boolean;
  structured: {
    schemaReady: boolean;
    collectionVersionId: string | null;
    methodologyVersion: string | null;
    overall: Record<string, unknown> | null;
    pillars: Record<string, unknown>[];
    items: Record<string, unknown>[];
    findings: Record<string, unknown>[];
  };
};

export default function DiagnosticStructuredSection({ diagnosticId, canEdit, structured }: Props) {
  if (!structured.schemaReady) {
    return (
      <section className={styles.reviewCard}>
        <span className={styles.eyebrow}>DIAGNÓSTICO OFICIAL · 114 ITENS</span>
        <h2>Estrutura aguardando migrações 019–020</h2>
        <div className={styles.notice}>O ambiente conectado ainda não possui o catálogo estruturado. A coleta narrativa continua funcionando como fallback.</div>
      </section>
    );
  }

  if (!structured.collectionVersionId) {
    return (
      <section className={styles.reviewCard}>
        <span className={styles.eyebrow}>DIAGNÓSTICO OFICIAL · 114 ITENS</span>
        <h2>Crie primeiro uma versão da coleta</h2>
        <div className={styles.notice}>Os 114 itens são vinculados a uma versão preservada da coleta. Salve o contexto inicial antes de iniciar a pontuação estruturada.</div>
      </section>
    );
  }

  if (!structured.items.length) {
    return (
      <section className={styles.reviewCard}>
        <span className={styles.eyebrow}>DIAGNÓSTICO OFICIAL · 114 ITENS</span>
        <h2>Inicializar coleta estruturada</h2>
        <p style={{ opacity: .7 }}>A versão atual ainda não possui os 114 registros. A inicialização cria todos como NV, sem alterar a coleta narrativa.</p>
        <form action={`/api/interno/diagnosticos/${diagnosticId}/structured-init`} method="post">
          <input type="hidden" name="collection_version_id" value={structured.collectionVersionId} />
          <button className={styles.button} type="submit" disabled={!canEdit}>Inicializar 114 itens</button>
        </form>
      </section>
    );
  }

  const overall = structured.overall;
  const itemsByPillar = new Map<string, Record<string, unknown>[]>();
  for (const item of structured.items) {
    const key = text(item.pillar_code);
    itemsByPillar.set(key, [...(itemsByPillar.get(key) ?? []), item]);
  }

  return (
    <section className={styles.reviewCard} style={{ borderColor: "rgba(239,59,127,.24)", background: "rgba(239,59,127,.02)" }}>
      <span className={styles.eyebrow}>DIAGNÓSTICO OFICIAL · DOCUMENTO 03</span>
      <h2>114 itens · 10 pilares · maturidade 0–4</h2>
      <p style={{ opacity: .72, lineHeight: 1.55 }}>Esta é a camada oficial de pontuação. NV reduz completude; N/A sai do denominador; notas 3–4 sem evidência geram alerta de qualidade.</p>

      <div className={styles.counts} style={{ marginTop: 18 }}>
        <article className={styles.countCard}><strong>{overall ? `${text(overall.completeness_pct)}%` : "—"}</strong><span>completude geral</span></article>
        <article className={styles.countCard}><strong>{overall?.maturity_index == null ? "—" : `${text(overall.maturity_index)}%`}</strong><span>maturidade geral</span></article>
        <article className={styles.countCard}><strong>{number(overall?.valid_pillars)}</strong><span>pilares válidos</span></article>
        <article className={styles.countCard}><strong>{number(overall?.inconclusive_pillars)}</strong><span>pilares inconclusivos</span></article>
        <article className={styles.countCard}><strong>{structured.findings.filter((item) => text(item.criticality_band) === "critical").length}</strong><span>achados críticos</span></article>
      </div>

      <div style={{ display: "grid", gap: 14, marginTop: 22 }}>
        {structured.pillars.map((pillar) => {
          const code = text(pillar.pillar_code);
          const items = itemsByPillar.get(code) ?? [];
          return (
            <details key={code} style={{ border: "1px solid rgba(1,48,30,.14)", borderRadius: 18, background: "rgba(255,255,255,.58)", padding: 16 }}>
              <summary style={{ cursor: "pointer", listStyle: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                  <span><strong>{code} · {text(pillar.name)}</strong><small style={{ display: "block", opacity: .65, marginTop: 4 }}>{number(pillar.evaluated_items)}/{number(pillar.applicable_items)} avaliados · {number(pillar.nv_items)} NV · {number(pillar.na_items)} N/A</small></span>
                  <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><span className={styles.badge}>{text(pillar.completeness_pct)}% completo</span><span className={styles.badge}>{pillar.maturity_index == null ? "sem índice" : `${text(pillar.maturity_index)}% · ${bandLabel(pillar.maturity_band)}`}</span><span className={styles.badge}>{pillarStatus(pillar.pillar_status)}</span></span>
                </div>
              </summary>

              <div style={{ display: "grid", gap: 16, marginTop: 18 }}>
                {items.map((item) => {
                  const evidence = list(item.evidence) as Record<string, unknown>[];
                  const flags = list(item.quality_flags).map(text).filter(Boolean);
                  return (
                    <form key={text(item.item_code)} action={`/api/interno/diagnosticos/${diagnosticId}/structured-item`} method="post" style={{ padding: 16, border: "1px solid rgba(1,48,30,.1)", borderRadius: 16, background: "rgba(255,255,255,.7)", display: "grid", gap: 12 }}>
                      <input type="hidden" name="collection_version_id" value={structured.collectionVersionId ?? ""} />
                      <input type="hidden" name="item_code" value={text(item.item_code)} />
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><strong>{text(item.item_code)} — {text(item.question)}</strong><span className={styles.badge}>{text(item.response_state) === "score" ? `Nota ${text(item.score)}` : text(item.response_state).toUpperCase()}</span></div>

                      <label>Estado / nota<select name="score_state" defaultValue={scoreValue(item)} style={fieldStyle} disabled={!canEdit}><option value="nv">NV — Não verificado</option><option value="na">N/A — Não se aplica</option><option value="0">0 — Inexistente</option><option value="1">1 — Improvisado</option><option value="2">2 — Básico</option><option value="3">3 — Estruturado</option><option value="4">4 — Otimizado</option></select></label>
                      <label>Resposta / contexto<textarea name="response_context" rows={3} defaultValue={text(item.response_context)} style={fieldStyle} disabled={!canEdit} /></label>
                      <label>Justificativa de N/A<textarea name="applicability_note" rows={2} defaultValue={text(item.applicability_note)} style={fieldStyle} disabled={!canEdit} placeholder="Obrigatória somente quando o item não se aplica." /></label>
                      <label>Observação do consultor<textarea name="consultant_note" rows={2} defaultValue={text(item.consultant_note)} style={fieldStyle} disabled={!canEdit} /></label>
                      <label>Pilares relacionados<input name="related_pillars" defaultValue={list(item.related_pillars).join(", ")} style={fieldStyle} disabled={!canEdit} placeholder="Ex.: P04, P07, P09" /></label>

                      <details>
                        <summary style={{ cursor: "pointer" }}>Adicionar nova evidência {evidence.length ? `· ${evidence.length} registrada(s)` : ""}</summary>
                        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                          <label>Tipo<select name="evidence_type" defaultValue="B" style={fieldStyle} disabled={!canEdit}><option value="A">A — Dado ou sistema</option><option value="B">B — Documento</option><option value="C">C — Observação direta</option><option value="D">D — Evidência pública</option><option value="E">E — Entrevista / relato</option></select></label>
                          <label>Confiança<select name="evidence_confidence" defaultValue="medium" style={fieldStyle} disabled={!canEdit}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></label>
                          <label>Resumo<textarea name="evidence_summary" rows={2} style={fieldStyle} disabled={!canEdit} placeholder="Deixe vazio para não criar evidência nesta atualização." /></label>
                          <label>Referência<input name="evidence_reference" style={fieldStyle} disabled={!canEdit} placeholder="Arquivo, link, registro, ID ou outra referência." /></label>
                          {evidence.slice(0, 3).map((entry) => <small key={text(entry.id)} style={{ opacity: .72 }}>{text(entry.evidence_type)} · {text(entry.confidence)} · {text(entry.evidence_summary)}</small>)}
                        </div>
                      </details>

                      {flags.length ? <div className={styles.notice}>Qualidade: {flags.join(", ")}</div> : null}
                      <button className={styles.button} type="submit" disabled={!canEdit} style={{ justifySelf: "start" }}>Salvar item</button>
                    </form>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>

      {structured.findings.length ? (
        <div style={{ marginTop: 24 }}>
          <span className={styles.eyebrow}>ACHADOS E ICB</span>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {structured.findings.map((finding) => <article key={text(finding.id)} style={{ padding: 14, border: "1px solid rgba(1,48,30,.12)", borderRadius: 14 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>{text(finding.title)}</strong><span className={styles.badge}>{finding.icb_score == null ? text(finding.finding_type) : `ICB ${text(finding.icb_score)} · ${text(finding.criticality_band)}`}</span></div><small style={{ opacity: .68 }}>{text(finding.primary_pillar)} · {text(finding.dependency_class)} · {text(finding.effort_class)} · {text(finding.status)}</small></article>)}
          </div>
        </div>
      ) : null}
    </section>
  );
}
