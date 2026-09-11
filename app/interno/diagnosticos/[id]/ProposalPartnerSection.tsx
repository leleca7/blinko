import { getProposalContext } from "../../../../lib/blinko/proposal-server";
import { getProposalPartnerContext } from "../../../../lib/blinko/partner-commercial-server";
import styles from "../../interno.module.css";

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function records(value: unknown) { return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : []; }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function money(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
}
function when(value: unknown) {
  const raw = text(value);
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { timeZone: "America/Bahia" });
}

const routeLabels: Record<string, string> = {
  R1: "R1 · Blinko executa",
  R2: "R2 · Blinko executa e coordena terceiros",
  R3: "R3 · Parceiro coordenado pela Blinko",
  R4: "R4 · Cliente executa com orientação Blinko",
  R5: "R5 · Especialista externo / encaminhamento",
  R6: "R6 · Monitoramento",
};

const eligibilityLabels: Record<string, string> = {
  eligible: "elegível",
  pilot_requires_project_approval: "piloto · exige exceção explícita",
  restricted_requires_scope_check: "restrito · exige validação de escopo",
  registration_pending: "cadastro pendente · bloqueado",
  validation_incomplete: "validação incompleta · bloqueado",
  blocked: "bloqueado",
};

const controlStyle = { border: "1px solid rgba(1,48,30,.18)", background: "rgba(255,255,255,.78)", color: "#08271b", borderRadius: 14, padding: 13, font: "inherit" };

export default async function ProposalPartnerSection({ diagnosticId }: { diagnosticId: string }) {
  const proposalContext = await getProposalContext(diagnosticId);
  const proposalId = text(proposalContext.proposal?.id);
  const proposalStatus = text(proposalContext.proposal?.status);
  if (!proposalId || !proposalContext.currentVersion) return null;

  const context = await getProposalPartnerContext(proposalId);
  if (!context.schemaReady) {
    return <section className={styles.reviewCard}><span className={styles.eyebrow}>ROTAS E PARCEIROS</span><h2>Governança pré-projeto</h2><div className={styles.notice}>A interface está preparada, mas o banco ainda não possui as migrações 037–039. A aprovação interna não deve avançar até essa estrutura ser promovida.</div></section>;
  }

  const editable = ["draft", "internal_review"].includes(proposalStatus);
  const canRevalidate = ["approved_internal", "sent", "negotiation", "accepted"].includes(proposalStatus);

  return (
    <section className={styles.reviewCard} style={{ borderColor: "rgba(239,59,127,.22)", background: "rgba(239,59,127,.018)" }}>
      <span className={styles.eyebrow}>ROTAS, TERCEIROS E CUSTO PRÉ-PROJETO</span>
      <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 32, fontWeight: 500, marginBottom: 8 }}>Definir quem executa antes de contratar</h2>
      <p style={{ opacity: .72, lineHeight: 1.55, maxWidth: 920 }}>Cada intervenção precisa ter uma rota oficial R1–R6. R2, R3 e R5 exigem terceiro identificado, capacidade compatível, cotação vigente e validação humana antes da aprovação interna. Percentuais pendentes podem ser registrados, mas nunca viram cálculo automático.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <span className={styles.badge}>Proposta: {proposalStatus}</span>
        <span className={styles.badge}>{context.requirementsReady ? "ROTAS/PARCEIROS PRONTOS" : "BLOQUEADO PARA APROVAÇÃO INTERNA"}</span>
      </div>

      <div style={{ display: "grid", gap: 18, marginTop: 22 }}>
        {context.interventions.map((item) => {
          const interventionId = text(item.id);
          const selectedRoute = text(item.selected_route);
          const allowedRoutes = strings(item.allowed_routes);
          const commitment = item.commitment && typeof item.commitment === "object" && !Array.isArray(item.commitment) ? item.commitment as Record<string, unknown> : null;
          const partnerOptions = records(item.partner_options);
          const requiresPartner = ["R2", "R3", "R5"].includes(selectedRoute);
          return (
            <article key={interventionId} style={{ padding: 18, border: "1px solid rgba(1,48,30,.13)", borderRadius: 18, background: "rgba(255,255,255,.55)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div><strong>{text(item.solution_code)} · {text(item.solution_name) || text(item.title)}</strong><small style={{ display: "block", marginTop: 5, opacity: .66 }}>{text(item.title)}</small></div>
                <span className={styles.badge}>{selectedRoute ? routeLabels[selectedRoute] || selectedRoute : "ROTA A DEFINIR"}</span>
              </div>

              {editable ? <form action={`/api/interno/diagnosticos/${diagnosticId}/proposal/partner`} method="post" style={{ display: "grid", gap: 10, marginTop: 15, maxWidth: 760 }}>
                <input type="hidden" name="action" value="set_route" /><input type="hidden" name="proposal_id" value={proposalId} /><input type="hidden" name="intervention_id" value={interventionId} />
                <label>Rota de execução<select name="execution_route" required defaultValue={selectedRoute} style={controlStyle}><option value="" disabled>Selecione a rota</option>{allowedRoutes.map((route) => <option key={route} value={route}>{routeLabels[route] || route}</option>)}</select></label>
                <label style={{ display: "flex", gap: 9, alignItems: "flex-start" }}><input type="checkbox" name="route_confirmed" value="yes" required style={{ marginTop: 4 }} /><span>Confirmo que a rota escolhida corresponde à forma real prevista de execução.</span></label>
                <button className={styles.button} type="submit" style={{ justifySelf: "start" }}>Salvar rota</button>
              </form> : null}

              {requiresPartner && !commitment ? <div style={{ marginTop: 18 }}>
                <div className={styles.notice}><strong>Terceiro obrigatório para esta rota.</strong><p style={{ marginBottom: 0 }}>Selecione um parceiro registrado para a solução. Cadastro pendente ou validação incompleta continuará bloqueando a aprovação, mesmo que exista cotação.</p></div>
                {editable && partnerOptions.length ? <div style={{ display: "grid", gap: 14, marginTop: 14 }}>{partnerOptions.map((partner) => {
                  const eligibility = text(partner.eligibility);
                  const financialRuleId = text(partner.financial_rule_id);
                  const percentage = partner.financial_rule_percentage == null ? "" : String(partner.financial_rule_percentage);
                  const auto = partner.financial_rule_auto_calculable === true;
                  const defaultScope = eligibility === "pilot_requires_project_approval" ? "pilot_exception" : eligibility === "restricted_requires_scope_check" ? "restricted_exception" : "standard";
                  return <form key={text(partner.partner_id)} action={`/api/interno/diagnosticos/${diagnosticId}/proposal/partner`} method="post" className={styles.form} style={{ padding: 16, border: "1px solid rgba(1,48,30,.1)", borderRadius: 16 }}>
                    <input type="hidden" name="action" value="record_commitment" /><input type="hidden" name="proposal_id" value={proposalId} /><input type="hidden" name="intervention_id" value={interventionId} /><input type="hidden" name="partner_id" value={text(partner.partner_id)} /><input type="hidden" name="execution_route" value={selectedRoute} /><input type="hidden" name="financial_rule_id" value={financialRuleId} />
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>{text(partner.partner_code)} · {text(partner.partner_name)}</strong><span className={styles.badge}>{eligibilityLabels[eligibility] || eligibility}</span></div>
                    {financialRuleId ? <div className={styles.notice}>Regra financeira: {text(partner.financial_rule_model)} · status {text(partner.financial_rule_status)}{percentage ? ` · percentual registrado ${percentage}%` : ""}. Cálculo automático: <strong>{auto ? "liberado" : "BLOQUEADO"}</strong>{text(partner.financial_rule_base_status) === "to_define" ? " · base A DEFINIR" : ""}.</div> : <div className={styles.notice}>Sem regra financeira padronizada vigente. A cotação específica ainda pode ser registrada, mas não autoriza cálculo automático de repasse.</div>}
                    <label>Papel da Blinko neste arranjo<textarea name="blinko_role" rows={3} required maxLength={4000} style={controlStyle} /></label>
                    <label>Referência da cotação<input name="quote_reference" required maxLength={1000} style={controlStyle} /></label>
                    <label>Data/hora da cotação<input name="quoted_at" type="datetime-local" required style={controlStyle} /></label>
                    <label>Validade da cotação<input name="quote_valid_until" type="datetime-local" style={controlStyle} /></label>
                    <label>Custo do parceiro para a Blinko<input name="quoted_cost_to_blinko" type="number" min="0" step="0.01" style={controlStyle} placeholder="Preencha se houver obrigação da Blinko" /></label>
                    <label style={{ display: "flex", gap: 9, alignItems: "flex-start" }}><input type="checkbox" name="blinko_payment_obligation" value="yes" style={{ marginTop: 4 }} /><span>A Blinko assumirá obrigação financeira com este parceiro neste projeto.</span></label>
                    <label>Condição de pagamento da cotação<textarea name="payment_terms_snapshot" rows={3} maxLength={4000} style={controlStyle} /></label>
                    <label>Tipo de validação<select name="approval_scope" defaultValue={defaultScope} style={controlStyle}><option value="standard">Padrão</option><option value="pilot_exception">Exceção de piloto controlado</option><option value="restricted_exception">Exceção de escopo restrito</option></select></label>
                    <label>Evidência/condição da cotação<textarea name="condition_evidence" rows={3} maxLength={4000} style={controlStyle} /></label>
                    <label>Notas internas<textarea name="notes" rows={3} maxLength={4000} style={controlStyle} /></label>
                    <label style={{ display: "flex", gap: 9, alignItems: "flex-start" }}><input type="checkbox" name="commitment_confirmed" value="yes" required style={{ marginTop: 4 }} /><span>Confirmo que estou registrando uma cotação/condição real verificada para esta proposta.</span></label>
                    <button className={styles.button} type="submit">Registrar compromisso com este parceiro</button>
                  </form>;
                })}</div> : null}
                {editable && !partnerOptions.length ? <div className={styles.notice} style={{ marginTop: 12 }}><strong>BLOQUEADO.</strong> Nenhum parceiro está cadastrado para esta solução.</div> : null}
              </div> : null}

              {commitment ? <div style={{ marginTop: 18, display: "grid", gap: 10, padding: 16, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>{text(commitment.partner_code)} · {text(commitment.partner_name)}</strong><span className={styles.badge}>{text(commitment.validation_status)} · {commitment.ready === true ? "válido" : "bloqueado"}</span></div>
                <small>Elegibilidade: {eligibilityLabels[text(commitment.partner_eligibility)] || text(commitment.partner_eligibility)}</small>
                <small>Rota: {routeLabels[text(commitment.execution_route)] || text(commitment.execution_route)}</small>
                <small>Cotação: {text(commitment.quote_reference)} · emitida {when(commitment.quoted_at)} · válida até {when(commitment.quote_valid_until)}</small>
                <small>Obrigação Blinko: {commitment.blinko_payment_obligation === true ? `sim · ${money(commitment.quoted_cost_to_blinko)}` : "não"}</small>
                <p style={{ margin: 0 }}>{text(commitment.blinko_role)}</p>
                {commitment.financial_rule_id ? <div className={styles.notice}>Regra financeira vinculada. Cálculo automático: <strong>{commitment.financial_rule_auto_calculable === true ? "liberado" : "BLOQUEADO"}</strong>.</div> : null}

                {editable && text(commitment.validation_status) === "pending" ? <form action={`/api/interno/diagnosticos/${diagnosticId}/proposal/partner`} method="post" className={styles.form}>
                  <input type="hidden" name="action" value="approve_commitment" /><input type="hidden" name="proposal_id" value={proposalId} /><input type="hidden" name="commitment_id" value={text(commitment.id)} />
                  <label>Evidência da validação humana<textarea name="validation_evidence" rows={4} required maxLength={5000} style={controlStyle} /></label>
                  <label style={{ display: "flex", gap: 9, alignItems: "flex-start" }}><input type="checkbox" name="partner_approval_confirmed" value="yes" required style={{ marginTop: 4 }} /><span>Confirmo que revisei capacidade, status do parceiro, cotação, papel da Blinko e exceção aplicável.</span></label>
                  <button className={styles.button} type="submit">Aprovar compromisso do parceiro</button>
                </form> : null}

                {canRevalidate && text(commitment.validation_status) === "approved" ? <form action={`/api/interno/diagnosticos/${diagnosticId}/proposal/partner`} method="post" className={styles.form}>
                  <input type="hidden" name="action" value="refresh_quote" /><input type="hidden" name="proposal_id" value={proposalId} /><input type="hidden" name="commitment_id" value={text(commitment.id)} />
                  <strong>Revalidar a mesma condição/custo</strong><small>Use apenas quando o parceiro renovar a validade sem mudar parceiro, escopo ou custo. Alteração de custo deve voltar para revisão da proposta.</small>
                  <label>Nova referência da cotação<input name="quote_reference" required maxLength={1000} style={controlStyle} /></label>
                  <label>Data/hora da revalidação<input name="quoted_at" type="datetime-local" required style={controlStyle} /></label>
                  <label>Nova validade<input name="quote_valid_until" type="datetime-local" style={controlStyle} /></label>
                  <label>Evidência<textarea name="revalidation_evidence" rows={3} required maxLength={5000} style={controlStyle} /></label>
                  <label style={{ display: "flex", gap: 9, alignItems: "flex-start" }}><input type="checkbox" name="quote_revalidation_confirmed" value="yes" required style={{ marginTop: 4 }} /><span>Confirmo que o mesmo custo/escopo foi revalidado e não estou alterando a proposta comercial.</span></label>
                  <button className={styles.button} type="submit">Registrar revalidação</button>
                </form> : null}
              </div> : null}
            </article>
          );
        })}
      </div>

      {!context.requirementsReady ? <div className={styles.notice} style={{ marginTop: 20 }}><strong>A aprovação interna está bloqueada no banco.</strong><p style={{ marginBottom: 0 }}>Conclua todas as rotas e, quando R2/R3/R5 for usada, valide o terceiro e sua cotação. O botão antigo de aprovação pode permanecer visível, mas a API não ultrapassa este gate.</p></div> : <div className={styles.notice} style={{ marginTop: 20 }}><strong>Rotas e compromissos externos validados.</strong><p style={{ marginBottom: 0 }}>A proposta pode seguir para a aprovação interna, sujeita aos demais controles comerciais.</p></div>}
    </section>
  );
}
