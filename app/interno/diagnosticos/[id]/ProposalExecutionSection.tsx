import Link from "next/link";
import { getProposalExecutionContext } from "../../../../lib/blinko/execution-server";
import styles from "../../interno.module.css";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    approved_internal: "aprovada internamente",
    sent: "enviada fora do OS",
    negotiation: "em negociação",
    accepted: "aceita pelo cliente",
    refused: "recusada",
    expired: "expirada",
    signed: "assinado",
    pending: "pendente",
    satisfied: "atendida",
    waived: "dispensada com justificativa",
    not_applicable: "não aplicável",
    required: "obrigatória",
    not_required: "não necessária",
    to_define: "aplicabilidade a definir",
  };
  return labels[value] || value;
}

function automaticGateMessage(code: string) {
  if (code === "contract_valid") return "Este item é controlado automaticamente pelo contrato/aceite válido.";
  if (code === "execution_routes") return "Este item é controlado automaticamente pelas rotas R1–R6 registradas nas intervenções da proposta.";
  if (code === "partner_validation") return "Este item é controlado automaticamente pelos compromissos de parceiro, elegibilidade e cotações vigentes da proposta.";
  return "Este item é controlado automaticamente pela fonte oficial correspondente.";
}

const controlStyle = {
  border: "1px solid rgba(1,48,30,.18)",
  background: "rgba(255,255,255,.78)",
  color: "#08271b",
  borderRadius: 14,
  padding: 13,
  font: "inherit",
};

export default async function ProposalExecutionSection({ diagnosticId }: { diagnosticId: string }) {
  const context = await getProposalExecutionContext(diagnosticId);

  if (!context.schemaReady) {
    return (
      <section className={styles.reviewCard}>
        <span className={styles.eyebrow}>CONTRATAÇÃO E EXECUÇÃO</span>
        <h2>Registrar o que aconteceu fora do OS</h2>
        <div className={styles.notice}>Esta etapa depende das migrações-base da execução no Neon. Nenhuma comunicação externa ou contratação será presumida.</div>
      </section>
    );
  }

  const proposalId = text(context.proposal?.id);
  const proposalStatus = text(context.proposal?.status);
  const projectId = text(context.project?.id);
  const projectStatus = text(context.project?.status);
  const canRecordExternal = ["approved_internal", "sent", "negotiation"].includes(proposalStatus);
  const currentContract = context.contracts.find((contract) => contract.is_current === true) ?? context.contracts[0] ?? null;
  const startGateReady = context.startReadiness?.ready_for_onboarding === true;
  const startGateStatus = text(context.startReadiness?.gate_status);
  const blockingCount = Number(context.startReadiness?.blocking_count ?? 0);
  const unresolvedCount = Number(context.startReadiness?.unresolved_applicability_count ?? 0);

  const eventOptions = proposalStatus === "approved_internal"
    ? [{ value: "sent", label: "Proposta enviada manualmente" }, { value: "expired", label: "Proposta expirou sem envio" }]
    : [
        { value: "negotiation", label: "Negociação registrada" },
        { value: "accepted", label: "Cliente aceitou a proposta" },
        { value: "refused", label: "Cliente recusou a proposta" },
        { value: "expired", label: "Proposta expirou" },
      ];

  return (
    <section className={styles.reviewCard} style={{ borderColor: "rgba(1,48,30,.24)" }}>
      <span className={styles.eyebrow}>CONTRATAÇÃO E EXECUÇÃO INICIAL</span>
      <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, fontWeight: 500, marginBottom: 8 }}>
        Do aceite comercial ao início real
      </h2>
      <p style={{ opacity: .7, lineHeight: 1.55, maxWidth: 900 }}>
        Proposta aceita não significa projeto liberado. O fluxo separa aceite comercial, formalização, condições de início e onboarding antes da operação.
      </p>

      {proposalId ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <span className={styles.badge}>Proposta: {statusLabel(proposalStatus)}</span>
          {context.formalizationSchemaReady && proposalStatus === "accepted" ? (
            <span className={styles.badge}>Gate de início: {startGateReady ? "pronto" : startGateStatus || "bloqueado"}</span>
          ) : null}
          {projectId ? <span className={styles.badge}>Projeto: {projectStatus}</span> : null}
        </div>
      ) : (
        <div className={styles.notice} style={{ marginTop: 18 }}>Ainda não existe proposta para avançar nesta etapa.</div>
      )}

      {canRecordExternal ? (
        <form action={`/api/interno/diagnosticos/${diagnosticId}/proposal/external-event`} method="post" className={styles.form} style={{ marginTop: 24, maxWidth: 820 }}>
          <strong>Registrar fato externo da proposta</strong>
          <div className={styles.notice}>Este formulário não executa a ação. Use somente depois que o fato realmente ocorreu fora do sistema.</div>
          <label>O que aconteceu<select name="event_type" required defaultValue="" style={controlStyle}><option value="" disabled>Selecione</option>{eventOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>Data e horário<input name="occurred_at" type="datetime-local" required style={controlStyle} /></label>
          <label>Canal<select name="channel" defaultValue="whatsapp" style={controlStyle}><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="meeting">Reunião</option><option value="phone">Telefone</option><option value="other">Outro</option></select></label>
          <label>Referência verificável<input name="external_reference" required maxLength={500} style={controlStyle} placeholder="Ex.: mensagem, e-mail, aceite ou registro de reunião." /></label>
          <label>Observação interna<textarea name="notes" rows={5} maxLength={3000} style={controlStyle} /></label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.45 }}><input type="checkbox" name="external_fact_confirmed" value="yes" required style={{ marginTop: 4 }} /><span>Confirmo que este fato ocorreu fora do Blinko OS e estou apenas registrando o histórico.</span></label>
          <button className={styles.button} type="submit">Registrar fato externo</button>
        </form>
      ) : null}

      {context.externalEvents.length ? (
        <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
          <strong>Histórico externo registrado</strong>
          {context.externalEvents.map((event) => (
            <article key={text(event.id)} style={{ padding: 14, border: "1px solid rgba(1,48,30,.12)", borderRadius: 14, background: "rgba(255,255,255,.48)" }}>
              <b>{statusLabel(text(event.event_type))}</b>
              <small style={{ display: "block", marginTop: 5, opacity: .68 }}>{text(event.external_reference)}</small>
            </article>
          ))}
        </div>
      ) : null}

      {proposalStatus === "accepted" && !context.formalizationSchemaReady ? (
        <div className={styles.notice} style={{ marginTop: 24 }}>
          <strong>Formalização bloqueada por schema.</strong>
          <p>Contrato e condições de início exigem as migrações de formalização e governança aplicáveis. O sistema não volta ao modelo antigo de confirmação por texto livre.</p>
        </div>
      ) : null}

      {proposalStatus === "accepted" && context.formalizationSchemaReady && !projectId ? (
        <>
          <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid rgba(1,48,30,.12)" }}>
            <span className={styles.eyebrow}>P11 · FORMALIZAÇÃO</span>
            <h3 style={{ fontSize: 24, marginBottom: 8 }}>Contrato / aceite</h3>
            {currentContract ? (
              <div className={styles.notice}>
                <strong>Contrato atual: {statusLabel(text(currentContract.status))}</strong>
                <p>Referência: {text(currentContract.external_reference) || text(currentContract.document_reference) || "sem referência válida"}</p>
              </div>
            ) : <div className={styles.notice}>Nenhum contrato registrado para esta proposta.</div>}

            <form action={`/api/interno/diagnosticos/${diagnosticId}/proposal/contract`} method="post" className={styles.form} style={{ marginTop: 18, maxWidth: 820 }}>
              <label>Estado do contrato<select name="status" required defaultValue="sent" style={controlStyle}><option value="sent">Enviado / aguardando aceite</option><option value="accepted">Aceite válido registrado</option><option value="signed">Assinado</option></select></label>
              <label>Método de aceite<select name="acceptance_method" defaultValue="" style={controlStyle}><option value="">Ainda sem aceite</option><option value="signature">Assinatura</option><option value="digital_acceptance">Aceite digital</option><option value="email">E-mail</option><option value="platform">Plataforma</option><option value="manual_record">Registro manual conferido</option></select></label>
              <label>Referência externa<input name="external_reference" maxLength={1000} style={controlStyle} placeholder="ID, protocolo, e-mail ou outra referência verificável" /></label>
              <label>Referência do documento<input name="document_reference" maxLength={1000} style={controlStyle} placeholder="Link/ID do contrato no repositório" /></label>
              <label>Data/hora do aceite<input name="accepted_at" type="datetime-local" style={controlStyle} /></label>
              <label>Quem aceitou<input name="accepted_by_label" maxLength={300} style={controlStyle} /></label>
              <label>Observações<textarea name="notes" rows={4} maxLength={5000} style={controlStyle} /></label>
              <div className={styles.notice}>Para marcar como aceito/assinado, informe data do aceite e ao menos uma referência verificável.</div>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.45 }}><input type="checkbox" name="contract_fact_confirmed" value="yes" required style={{ marginTop: 4 }} /><span>Confirmo que estou registrando o estado real da formalização.</span></label>
              <button className={styles.button} type="submit">Registrar contrato / aceite</button>
            </form>
          </div>

          {context.startConditions.length ? (
            <div style={{ marginTop: 30, paddingTop: 24, borderTop: "1px solid rgba(1,48,30,.12)" }}>
              <span className={styles.eyebrow}>P12 · CONDIÇÕES DE INÍCIO</span>
              <h3 style={{ fontSize: 24, marginBottom: 8 }}>Gate de prontidão</h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
                <span className={styles.badge}>Bloqueios: {blockingCount}</span>
                <span className={styles.badge}>Aplicabilidade a definir: {unresolvedCount}</span>
                <span className={styles.badge}>{startGateReady ? "PRONTO PARA ONBOARDING" : "BLOQUEADO PARA INÍCIO"}</span>
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                {context.startConditions.map((condition) => {
                  const code = text(condition.condition_code);
                  const automatic = ["contract_valid", "execution_routes", "partner_validation"].includes(code);
                  return (
                    <article key={text(condition.id)} style={{ padding: 16, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16, background: "rgba(255,255,255,.48)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <strong>{text(condition.label)}</strong>
                        <span className={styles.badge}>{statusLabel(text(condition.requirement))} · {statusLabel(text(condition.status))}</span>
                      </div>
                      {text(condition.evidence) ? <small style={{ display: "block", marginTop: 7, opacity: .7 }}>Evidência: {text(condition.evidence)}</small> : null}
                      {automatic ? <div className={styles.notice} style={{ marginTop: 12 }}>{automaticGateMessage(code)}</div> : (
                        <form action={`/api/interno/diagnosticos/${diagnosticId}/proposal/start-condition`} method="post" className={styles.form} style={{ marginTop: 14 }}>
                          <input type="hidden" name="condition_code" value={code} />
                          <label>Aplicabilidade<select name="requirement" defaultValue={text(condition.requirement) || "to_define"} style={controlStyle}><option value="required">Obrigatória</option><option value="not_required">Não necessária</option><option value="to_define">A definir</option></select></label>
                          <label>Estado<select name="condition_status" defaultValue={text(condition.status) || "pending"} style={controlStyle}><option value="pending">Pendente</option><option value="satisfied">Atendida</option><option value="waived">Dispensada com justificativa</option><option value="not_applicable">Não aplicável</option></select></label>
                          <label>Evidência<textarea name="evidence" rows={3} defaultValue={text(condition.evidence)} style={controlStyle} /></label>
                          <label>Responsável<input name="owner_label" defaultValue={text(condition.owner_label)} maxLength={300} style={controlStyle} /></label>
                          <label>Prazo<input name="due_at" type="datetime-local" style={controlStyle} /></label>
                          <label>Observação / justificativa<textarea name="notes" rows={3} defaultValue={text(condition.notes)} style={controlStyle} /></label>
                          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.45 }}><input type="checkbox" name="condition_confirmed" value="yes" required style={{ marginTop: 4 }} /><span>Confirmo esta decisão de aplicabilidade/estado.</span></label>
                          <button className={styles.button} type="submit">Atualizar condição</button>
                        </form>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          {startGateReady ? (
            <form action={`/api/interno/diagnosticos/${diagnosticId}/proposal/create-project`} method="post" className={styles.form} style={{ marginTop: 28, maxWidth: 820 }}>
              <strong>Criar projeto e iniciar onboarding</strong>
              <div className={styles.notice}>Contrato válido, rotas, parceiros aplicáveis e demais condições de início estão resolvidos. O projeto nascerá em P13 e ainda precisará concluir o onboarding antes da operação.</div>
              <label>Objetivo do ciclo<textarea name="objective" rows={5} required maxLength={5000} style={controlStyle} /></label>
              <label>Data inicial<input name="start_date" type="date" required style={controlStyle} /></label>
              <label>Prazo ou janela prevista<input name="target_timeframe" required maxLength={1000} style={controlStyle} /></label>
              <label>Próxima revisão, se definida<input name="next_review_at" type="datetime-local" style={controlStyle} /></label>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.45 }}><input type="checkbox" name="start_gate_confirmed" value="yes" required style={{ marginTop: 4 }} /><span>Confirmo que revisei o gate de início e que o projeto pode entrar em onboarding.</span></label>
              <button className={styles.button} type="submit">Criar projeto em onboarding</button>
            </form>
          ) : (
            <div className={styles.notice} style={{ marginTop: 24 }}><strong>BLOQUEADO PARA INÍCIO.</strong><p>Resolva contrato, rotas, parceiros/cotações aplicáveis e demais condições obrigatórias antes de criar o projeto.</p></div>
          )}
        </>
      ) : null}

      {proposalStatus === "accepted" && projectId ? (
        <div className={styles.notice} style={{ marginTop: 22 }}>
          <strong>Projeto criado após gate de início.</strong>
          <p>O projeto está em {projectStatus}. A liberação para operação depende do onboarding modular.</p>
          <Link className={styles.button} href={`/interno/projetos/${projectId}`} style={{ display: "inline-flex", width: "fit-content", textDecoration: "none" }}>Abrir projeto</Link>
        </div>
      ) : null}

      {["refused", "expired"].includes(proposalStatus) ? (
        <div className={styles.notice} style={{ marginTop: 22 }}>Esta proposta foi registrada como {statusLabel(proposalStatus)}. Nenhum projeto foi criado automaticamente.</div>
      ) : null}
    </section>
  );
}