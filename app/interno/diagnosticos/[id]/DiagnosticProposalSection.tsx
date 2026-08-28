import { getProposalContext } from "../../../../lib/blinko/proposal-server";
import styles from "../../interno.module.css";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function list(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: "rascunho",
    internal_review: "revisão interna",
    approved_internal: "aprovada internamente",
    sent: "enviada",
    negotiation: "negociação",
    accepted: "aceita",
    refused: "recusada",
    expired: "expirada",
  };
  return labels[value] || value || "ainda não criada";
}

const controlStyle = {
  border: "1px solid rgba(1,48,30,.18)",
  background: "rgba(255,255,255,.78)",
  color: "#08271b",
  borderRadius: 14,
  padding: 13,
  font: "inherit",
};

export default async function DiagnosticProposalSection({ diagnosticId }: { diagnosticId: string }) {
  const context = await getProposalContext(diagnosticId);

  if (!context.schemaReady) {
    return (
      <section className={styles.reviewCard}>
        <span className={styles.eyebrow}>APRESENTAÇÃO E PROPOSTA</span>
        <h2>Do diagnóstico validado ao escopo comercial</h2>
        <div className={styles.notice}>
          Este bloco já está preparado no código, mas depende das migrações 003 a 007 no Neon. Nenhum investimento, condição ou compromisso comercial será preenchido automaticamente.
        </div>
      </section>
    );
  }

  const diagnosticStatus = text(context.diagnostic?.status);
  const proposalId = text(context.proposal?.id);
  const proposalStatus = text(context.proposal?.status);
  const currentVersion = context.currentVersion;
  const currentVersionNumber = Number(currentVersion?.version_number ?? 0);
  const selectedIds = new Set(list(currentVersion?.intervention_ids));

  const canRecordPresentation = diagnosticStatus === "ready_for_presentation";
  const canEditProposal = diagnosticStatus === "presented" && (!proposalStatus || proposalStatus === "draft" || proposalStatus === "approved_internal");
  const canSubmitReview = proposalStatus === "draft" && Boolean(currentVersion?.id);
  const canApprove = proposalStatus === "internal_review";

  return (
    <section className={styles.reviewCard} style={{ borderColor: "rgba(239,59,127,.22)", background: "rgba(239,59,127,.025)" }}>
      <span className={styles.eyebrow}>APRESENTAÇÃO E PROPOSTA</span>
      <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, fontWeight: 500, marginBottom: 8 }}>
        Transformar prioridade em proposta real
      </h2>
      <p style={{ opacity: .7, lineHeight: 1.55, maxWidth: 900 }}>
        A proposta usa somente intervenções já selecionadas no diagnóstico. Investimento, condições, validade, responsabilidades e prazo são preenchidos por uma pessoa da Blinko. Este bloco não envia nada ao cliente.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <span className={styles.badge}>Diagnóstico: {diagnosticStatus}</span>
        <span className={styles.badge}>Proposta: {statusLabel(proposalStatus)}</span>
        {currentVersionNumber ? <span className={styles.badge}>Versão: {currentVersionNumber}</span> : null}
        {context.company?.name ? <span className={styles.badge}>Empresa: {text(context.company.name)}</span> : null}
      </div>

      {canRecordPresentation ? (
        <form action={`/api/interno/diagnosticos/${diagnosticId}/presentation`} method="post" className={styles.form} style={{ marginTop: 24, maxWidth: 760 }}>
          <strong>Registrar apresentação do Diagnóstico Blinko</strong>
          <p style={{ margin: 0, opacity: .68, lineHeight: 1.5 }}>Use somente depois que a apresentação realmente acontecer. O registro muda o diagnóstico para apresentado e libera a preparação da proposta.</p>
          <label>Data e horário da apresentação<input name="presented_at" type="datetime-local" required style={controlStyle} /></label>
          <label>Notas internas<textarea name="notes" maxLength={3000} rows={5} style={controlStyle} /></label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.45 }}>
            <input type="checkbox" name="presentation_confirmed" value="yes" required style={{ marginTop: 4 }} />
            <span>Confirmo que a apresentação do Diagnóstico Blinko foi realizada.</span>
          </label>
          <button className={styles.button} type="submit">Registrar apresentação realizada</button>
        </form>
      ) : null}

      {diagnosticStatus === "review" ? (
        <div className={styles.notice} style={{ marginTop: 18 }}>Finalize primeiro a estrutura de problema, causa, prioridade e intervenção. A proposta não abre antes dessa validação.</div>
      ) : null}

      {diagnosticStatus === "presented" && !context.availableInterventions.length ? (
        <div className={styles.notice} style={{ marginTop: 18 }}>Não há intervenção selecionada disponível para compor uma proposta. Volte à estrutura estratégica antes de avançar.</div>
      ) : null}

      {canEditProposal && context.availableInterventions.length ? (
        <form action={`/api/interno/diagnosticos/${diagnosticId}/proposal/version`} method="post" className={styles.form} style={{ marginTop: 26 }}>
          <strong>{currentVersion ? "Criar nova versão da proposta" : "Criar primeira versão da proposta"}</strong>
          <div className={styles.notice}>Salvar cria uma nova versão e, se uma versão já estava aprovada internamente, ela volta para rascunho. Nenhum valor é sugerido pela IA.</div>

          <div style={{ display: "grid", gap: 10 }}>
            <strong>Intervenções incluídas</strong>
            {context.availableInterventions.map((item) => {
              const itemId = text(item.id);
              return (
                <label key={itemId} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "start", padding: 14, border: "1px solid rgba(1,48,30,.12)", borderRadius: 14, background: "rgba(255,255,255,.5)" }}>
                  <input type="checkbox" name="intervention_ids" value={itemId} defaultChecked={!currentVersion || selectedIds.has(itemId)} style={{ marginTop: 4 }} />
                  <span><b>{text(item.title)}</b><small style={{ display: "block", marginTop: 5, opacity: .68 }}>Prioridade #{String(item.priority_position ?? "?")} · {text(item.problem_title)}</small></span>
                </label>
              );
            })}
          </div>

          <label>Escopo<textarea name="scope" rows={7} maxLength={7000} defaultValue={text(currentVersion?.scope)} style={controlStyle} /></label>
          <label>Responsabilidades da Blinko<textarea name="blinko_responsibilities" rows={6} maxLength={7000} defaultValue={text(currentVersion?.blinko_responsibilities)} style={controlStyle} /></label>
          <label>Responsabilidades do cliente<textarea name="client_responsibilities" rows={6} maxLength={7000} defaultValue={text(currentVersion?.client_responsibilities)} style={controlStyle} /></label>
          <label>Prazo ou janela de execução<textarea name="timeframe" rows={4} maxLength={1200} defaultValue={text(currentVersion?.timeframe)} style={controlStyle} /></label>
          <label>Investimento<textarea name="investment" rows={4} maxLength={1200} defaultValue={text(currentVersion?.investment)} style={controlStyle} placeholder="Preenchimento humano. Não é calculado pelo Blinko OS." /></label>
          <label>Condições<textarea name="conditions" rows={5} maxLength={3000} defaultValue={text(currentVersion?.conditions)} style={controlStyle} /></label>
          <label>Validade da proposta<textarea name="validity" rows={3} maxLength={1000} defaultValue={text(currentVersion?.validity)} style={controlStyle} /></label>
          <label>Riscos, limites e premissas<textarea name="risks_limits" rows={6} maxLength={5000} defaultValue={text(currentVersion?.risks_limits)} style={controlStyle} /></label>
          <button className={styles.button} type="submit">Salvar nova versão da proposta</button>
        </form>
      ) : null}

      {currentVersion ? (
        <div style={{ display: "grid", gap: 12, marginTop: 24, padding: 18, border: "1px solid rgba(1,48,30,.12)", borderRadius: 18, background: "rgba(255,255,255,.48)" }}>
          <strong>Versão atual</strong>
          <span className={styles.badge}>v{currentVersionNumber} · {statusLabel(proposalStatus)}</span>
          <div><small style={{ opacity: .58 }}>Escopo</small><p style={{ whiteSpace: "pre-wrap" }}>{text(currentVersion.scope) || "Ainda não preenchido"}</p></div>
          <div><small style={{ opacity: .58 }}>Investimento</small><p style={{ whiteSpace: "pre-wrap" }}>{text(currentVersion.investment) || "Ainda não preenchido"}</p></div>
          <div><small style={{ opacity: .58 }}>Condições</small><p style={{ whiteSpace: "pre-wrap" }}>{text(currentVersion.conditions) || "Ainda não preenchidas"}</p></div>
        </div>
      ) : null}

      {canSubmitReview ? (
        <form action={`/api/interno/diagnosticos/${diagnosticId}/proposal/submit-review`} method="post" style={{ display: "grid", gap: 12, marginTop: 22, maxWidth: 760 }}>
          <input type="hidden" name="proposal_id" value={proposalId} />
          <div className={styles.notice}>A revisão interna só aceita a versão quando escopo, responsabilidades, prazo, investimento, condições e validade estiverem preenchidos.</div>
          <button className={styles.button} type="submit">Enviar para revisão interna</button>
        </form>
      ) : null}

      {canApprove ? (
        <form action={`/api/interno/diagnosticos/${diagnosticId}/proposal/approve`} method="post" style={{ display: "grid", gap: 12, marginTop: 22, maxWidth: 760 }}>
          <input type="hidden" name="proposal_id" value={proposalId} />
          <strong>Aprovação interna</strong>
          <div className={styles.notice}>Aprovar internamente não envia a proposta. O envio externo continuará bloqueado e exigirá uma decisão humana separada.</div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.45 }}>
            <input type="checkbox" name="internal_approval_confirmed" value="yes" required style={{ marginTop: 4 }} />
            <span>Confirmo que revisei escopo, responsabilidades, prazo, investimento, condições, validade e riscos desta versão.</span>
          </label>
          <button className={styles.button} type="submit">Aprovar proposta internamente</button>
        </form>
      ) : null}

      {proposalStatus === "approved_internal" ? (
        <div className={styles.notice} style={{ marginTop: 22 }}>
          <strong>Proposta aprovada internamente.</strong>
          <p style={{ marginBottom: 0 }}>O Blinko OS não enviará esta proposta automaticamente. A próxima etapa exige uma decisão humana específica sobre comunicação externa.</p>
        </div>
      ) : null}
    </section>
  );
}
