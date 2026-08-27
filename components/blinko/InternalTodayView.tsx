import type { BlinkoTodayQueue } from "../../lib/blinko/internal-queue";

function priorityLabel(priority: string) {
  if (priority === "urgent") return "Urgente";
  if (priority === "high") return "Alta";
  if (priority === "low") return "Baixa";
  return "Normal";
}

export function InternalTodayView({ queue }: { queue: BlinkoTodayQueue }) {
  const cards = [
    ["Revisões pendentes", queue.counts.pending_pre_diagnostic_reviews],
    ["Leituras aguardando aprovação", queue.counts.initial_readings_waiting_approval],
    ["Leads prioritários", queue.counts.priority_leads],
    ["IA pronta / humano pendente", queue.counts.ai_ready_waiting_human],
  ] as const;

  return (
    <main style={{ minHeight: "100vh", background: "#f3efeb", color: "#08271b", padding: "32px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ marginBottom: 28 }}>
          <p style={{ margin: 0, font: "700 12px Arial", letterSpacing: ".14em", textTransform: "uppercase" }}>
            Blinko OS · operação interna
          </p>
          <h1 style={{ margin: "8px 0 0", font: "400 52px Georgia, serif" }}>Hoje na Blinko</h1>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginBottom: 26 }}>
          {cards.map(([label, value]) => (
            <article key={label} style={{ border: "1px solid rgba(1,48,30,.16)", borderRadius: 18, padding: 20, background: "rgba(255,255,255,.5)" }}>
              <strong style={{ display: "block", font: "400 38px Georgia, serif" }}>{value}</strong>
              <span style={{ font: "700 11px Arial", letterSpacing: ".08em", textTransform: "uppercase" }}>{label}</span>
            </article>
          ))}
        </section>

        <section style={{ borderTop: "1px solid rgba(1,48,30,.18)" }}>
          {queue.actions.length === 0 ? (
            <p style={{ padding: "28px 0" }}>Nenhuma ação pendente.</p>
          ) : queue.actions.map((action) => (
            <article key={action.action_id} style={{ display: "grid", gridTemplateColumns: "110px 1fr auto", gap: 20, alignItems: "center", padding: "20px 0", borderBottom: "1px solid rgba(1,48,30,.14)" }}>
              <span style={{ font: "700 11px Arial", textTransform: "uppercase", letterSpacing: ".08em" }}>{priorityLabel(action.priority)}</span>
              <div>
                <h2 style={{ margin: 0, font: "400 25px Georgia, serif" }}>{action.title}</h2>
                <p style={{ margin: "6px 0 0", opacity: .72 }}>{action.lead_name} · {action.company_name}</p>
              </div>
              <div style={{ textAlign: "right", font: "700 11px Arial", textTransform: "uppercase", letterSpacing: ".06em" }}>
                <div>Score {action.commercial_score}/10</div>
                <div style={{ marginTop: 5, opacity: .62 }}>{action.human_review_status ?? "sem revisão"}</div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
