import styles from "../empresas.module.css";
import type { ConnectedSystemOperationalSummary } from "../../../../lib/blinko/company-systems-server";

// A UI recebe somente o resumo já sanitizado no servidor, nunca a resposta externa bruta.
function metricLabel(key: string) {
  const known: Record<string, string> = {
    vehiclesTracked: "Veículos acompanhados",
    pendingTasks: "Tarefas pendentes",
    criticalTasks: "Tarefas críticas",
    humanSupportPending: "Atendimentos humanos",
    openPendingItems: "Pendências abertas",
  };

  return known[key] ?? key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (value) => value.toUpperCase());
}

function statusLabel(status?: string) {
  if (!status) return "Atualizado";
  const known: Record<string, string> = {
    healthy: "Operação estável",
    attention: "Requer atenção",
    degraded: "Requer atenção",
    offline: "Indisponível",
  };
  return known[status] ?? status;
}

export default function SystemOperationalSummary({ summary }: { summary: ConnectedSystemOperationalSummary }) {
  if (summary.state !== "ready") {
    return (
      <div className={styles.operationalSummary}>
        <div className={styles.operationalHeader}><strong>Resumo operacional</strong></div>
        <p>{summary.message || "Resumo operacional ainda não configurado."}</p>
      </div>
    );
  }

  const metrics = summary.metrics ? Object.entries(summary.metrics).slice(0, 5) : [];
  const integrations = summary.integrations ? Object.values(summary.integrations) : [];
  const connectedIntegrations = integrations.filter(Boolean).length;

  return (
    <div className={styles.operationalSummary}>
      <div className={styles.operationalHeader}>
        <strong>Resumo operacional</strong>
        <span data-state={summary.status || "ready"}>{statusLabel(summary.status)}</span>
      </div>

      {metrics.length ? (
        <div className={styles.metricGrid}>
          {metrics.map(([key, value]) => (
            <div className={styles.metricCard} key={key}>
              <strong>{String(value)}</strong>
              <span>{metricLabel(key)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p>O sistema respondeu, mas não enviou métricas operacionais.</p>
      )}

      {integrations.length ? (
        <p className={styles.integrationLine}>{connectedIntegrations} de {integrations.length} integrações conectadas</p>
      ) : null}

      {summary.generatedAt ? (
        <p className={styles.summaryTimestamp}>Atualizado em {new Date(summary.generatedAt).toLocaleString("pt-BR")}</p>
      ) : null}
    </div>
  );
}
