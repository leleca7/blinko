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
  };
  return labels[value] || value;
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
        <div className={styles.notice}>Esta etapa depende das migrações 003 a 008 no Neon. Nenhuma comunicação externa ou contratação será presumida.</div>
      </section>
    );
  }

  const proposalId = text(context.proposal?.id);
  const proposalStatus = text(context.proposal?.status);
  const projectId = text(context.project?.id);
  const projectStatus = text(context.project?.status);
  const canRecordExternal = ["approved_internal", "sent", "negotiation"].includes(proposalStatus);
  const canCreateProject = proposalStatus === "accepted" && !projectId;

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
        Do aceite real ao projeto
      </h2>
      <p style={{ opacity: .7, lineHeight: 1.55, maxWidth: 900 }}>
        Esta etapa só registra fatos que já aconteceram fora do Blinko OS. O sistema não envia a proposta, não responde pelo cliente e não considera uma execução contratada sem confirmação humana.
      </p>

      {proposalId ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <span className={styles.badge}>Proposta: {statusLabel(proposalStatus)}</span>
          {projectId ? <span className={styles.badge}>Projeto: {projectStatus}</span> : null}
        </div>
      ) : (
        <div className={styles.notice} style={{ marginTop: 18 }}>Ainda não existe proposta para avançar nesta etapa.</div>
      )}

      {canRecordExternal ? (
        <form action={`/api/interno/diagnosticos/${diagnosticId}/proposal/external-event`} method="post" className={styles.form} style={{ marginTop: 24, maxWidth: 820 }}>
          <strong>Registrar fato externo</strong>
          <div className={styles.notice}>Este formulário não executa a ação. Use somente depois que o fato realmente ocorreu fora do sistema.</div>
          <label>O que aconteceu<select name="event_type" required defaultValue="" style={controlStyle}><option value="" disabled>Selecione</option>{eventOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>Data e horário<input name="occurred_at" type="datetime-local" required style={controlStyle} /></label>
          <label>Canal<select name="channel" defaultValue="whatsapp" style={controlStyle}><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="meeting">Reunião</option><option value="phone">Telefone</option><option value="other">Outro</option></select></label>
          <label>Referência verificável<input name="external_reference" required maxLength={500} style={controlStyle} placeholder="Ex.: mensagem no WhatsApp, e-mail, aceite formal ou registro de reunião." /></label>
          <label>Observação interna<textarea name="notes" rows={5} maxLength={3000} style={controlStyle} /></label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.45 }}>
            <input type="checkbox" name="external_fact_confirmed" value="yes" required style={{ marginTop: 4 }} />
            <span>Confirmo que este fato ocorreu fora do Blinko OS e estou apenas registrando o histórico.</span>
          </label>
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

      {canCreateProject ? (
        <form action={`/api/interno/diagnosticos/${diagnosticId}/proposal/create-project`} method="post" className={styles.form} style={{ marginTop: 26, maxWidth: 820 }}>
          <strong>Confirmar contratação da execução</strong>
          <div className={styles.notice}>Aceite da proposta e contratação da execução são registros diferentes. Crie o projeto somente depois de existir uma confirmação real de contratação.</div>
          <label>Objetivo do ciclo<textarea name="objective" rows={5} required maxLength={5000} style={controlStyle} /></label>
          <label>Data inicial<input name="start_date" type="date" required style={controlStyle} /></label>
          <label>Prazo ou janela prevista<input name="target_timeframe" required maxLength={1000} style={controlStyle} /></label>
          <label>Referência da contratação<input name="contract_reference" required maxLength={1000} style={controlStyle} placeholder="Ex.: aceite formal, contrato, pedido ou outra evidência conferida." /></label>
          <label>Próxima revisão, se definida<input name="next_review_at" type="datetime-local" style={controlStyle} /></label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.45 }}>
            <input type="checkbox" name="execution_contracted" value="yes" required style={{ marginTop: 4 }} />
            <span>Confirmo que a execução foi realmente contratada e que existe referência verificável para este registro.</span>
          </label>
          <button className={styles.button} type="submit">Criar projeto em onboarding</button>
        </form>
      ) : null}

      {proposalStatus === "accepted" && projectId ? (
        <div className={styles.notice} style={{ marginTop: 22 }}>
          <strong>Execução contratada e projeto criado.</strong>
          <p>O projeto está em {projectStatus}. As primeiras tarefas e o início operacional ficam no workspace próprio.</p>
          <Link className={styles.button} href={`/interno/projetos/${projectId}`} style={{ display: "inline-flex", width: "fit-content", textDecoration: "none" }}>Abrir projeto</Link>
        </div>
      ) : null}

      {["refused", "expired"].includes(proposalStatus) ? (
        <div className={styles.notice} style={{ marginTop: 22 }}>Esta proposta foi registrada como {statusLabel(proposalStatus)}. Nenhum projeto foi criado automaticamente.</div>
      ) : null}
    </section>
  );
}
