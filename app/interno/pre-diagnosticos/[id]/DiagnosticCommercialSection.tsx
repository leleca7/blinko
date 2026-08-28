import { getBlinkoDiagnosticContext } from "../../../../lib/blinko/diagnostic-commercial";
import styles from "../../interno.module.css";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export default async function DiagnosticCommercialSection({
  preDiagnosticId,
  leadStatus,
}: {
  preDiagnosticId: string;
  leadStatus: string;
}) {
  const context = await getBlinkoDiagnosticContext(preDiagnosticId);

  const diagnostic = context.currentDiagnostic;
  const diagnosticId = text(diagnostic?.id);
  const diagnosticStatus = text(diagnostic?.status);
  const companyName = text(context.company?.name);
  const offeredAt = text(diagnostic?.offered_at);
  const paymentConfirmedAt = text(diagnostic?.payment_confirmed_at);

  const canOffer = !diagnostic && leadStatus === "meeting";
  const canConfirmPayment = Boolean(diagnosticId && diagnosticStatus === "awaiting_payment");

  return (
    <section className={styles.reviewCard} style={{ borderColor: "rgba(239,59,127,.24)", background: "rgba(239,59,127,.035)" }}>
      <span className={styles.eyebrow}>DIAGNÓSTICO BLINKO · ETAPA 5</span>
      <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, fontWeight: 500, marginBottom: 8 }}>
        Oferta e início do diagnóstico pago
      </h2>
      <p style={{ opacity: .68, lineHeight: 1.55, maxWidth: 860 }}>
        Esta etapa apenas registra decisões que aconteceram fora do sistema. O Blinko OS não define preço, não gera cobrança e não confirma pagamento sozinho.
      </p>

      {!context.schemaReady ? (
        <div className={styles.notice} style={{ marginTop: 18, maxWidth: 860 }}>
          A interface deste bloco já está preparada, mas a migração correspondente ainda não foi aplicada ao banco principal. Até lá, nenhuma ação comercial desta etapa será gravada.
        </div>
      ) : null}

      {context.schemaReady && !diagnostic ? (
        <div style={{ marginTop: 20 }}>
          {canOffer ? (
            <form action={`/api/interno/pre-diagnosticos/${preDiagnosticId}/diagnostic/offer`} method="post" className={styles.form} style={{ maxWidth: 760 }}>
              <label>
                Observação interna sobre a oferta
                <textarea
                  name="notes"
                  maxLength={2000}
                  rows={5}
                  placeholder="Ex.: após a reunião, o Diagnóstico Blinko foi apresentado como próxima etapa para aprofundar os sinais levantados."
                  style={{ border: "1px solid rgba(1,48,30,.18)", background: "rgba(255,255,255,.78)", color: "#08271b", borderRadius: 14, padding: 14, font: "inherit", resize: "vertical" }}
                />
              </label>
              <div className={styles.notice}>
                Este registro não envia proposta, preço ou mensagem ao cliente. Ele apenas marca que a oferta foi feita por uma pessoa da Blinko.
              </div>
              <button className={styles.button} type="submit">Registrar Diagnóstico Blinko como oferecido</button>
            </form>
          ) : (
            <div className={styles.notice} style={{ maxWidth: 860 }}>
              Registre a reunião no CRM antes de marcar o Diagnóstico Blinko como oferecido. Isso mantém a sequência comercial auditável.
            </div>
          )}
        </div>
      ) : null}

      {context.schemaReady && diagnostic ? (
        <div style={{ display: "grid", gap: 18, marginTop: 20 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span className={styles.badge}>Lead: {leadStatus}</span>
            <span className={styles.badge}>Diagnóstico: {diagnosticStatus}</span>
            {companyName ? <span className={styles.badge}>Empresa: {companyName}</span> : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <article style={{ padding: 16, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16, background: "rgba(255,255,255,.5)" }}>
              <small style={{ opacity: .58 }}>Oferta registrada</small>
              <strong style={{ display: "block", marginTop: 6 }}>{offeredAt ? "Sim" : "Não informado"}</strong>
            </article>
            <article style={{ padding: 16, border: "1px solid rgba(1,48,30,.12)", borderRadius: 16, background: "rgba(255,255,255,.5)" }}>
              <small style={{ opacity: .58 }}>Pagamento confirmado</small>
              <strong style={{ display: "block", marginTop: 6 }}>{paymentConfirmedAt ? "Sim" : "Ainda não"}</strong>
            </article>
          </div>

          {canConfirmPayment ? (
            <form action={`/api/interno/pre-diagnosticos/${preDiagnosticId}/diagnostic/payment`} method="post" className={styles.form} style={{ maxWidth: 760, padding: 18, border: "1px solid rgba(1,48,30,.12)", borderRadius: 18, background: "rgba(255,255,255,.5)" }}>
              <input type="hidden" name="diagnostic_id" value={diagnosticId} />
              <strong>Confirmar pagamento já recebido</strong>
              <p style={{ opacity: .66, lineHeight: 1.5, marginTop: 0 }}>
                Use somente depois de conferir o recebimento fora do Blinko OS. O sistema não processa pagamentos.
              </p>
              <label>
                Referência interna, se houver
                <input
                  name="payment_reference"
                  maxLength={180}
                  placeholder="Ex.: comprovante conferido em 27/08"
                  style={{ borderColor: "rgba(1,48,30,.18)", background: "rgba(255,255,255,.8)", color: "#08271b" }}
                />
              </label>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.45 }}>
                <input type="checkbox" name="payment_confirmed" value="yes" required style={{ marginTop: 4 }} />
                <span>Confirmo que uma pessoa da Blinko verificou que o pagamento foi recebido.</span>
              </label>
              <button className={styles.button} type="submit">Confirmar pagamento e iniciar coleta</button>
            </form>
          ) : null}

          {diagnosticStatus === "collection" ? (
            <div className={styles.notice} style={{ maxWidth: 860 }}>
              Pagamento registrado por decisão humana. A próxima etapa operacional é a coleta do Diagnóstico Blinko. A Empresa já pode ser tratada como entidade própria no OS sem perder o histórico do lead.
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
