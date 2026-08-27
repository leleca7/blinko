import type { ReviewWorkspace } from "../../lib/blinko/review-workspace";

function display(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export default function PreDiagnosticReviewView({ workspace }: { workspace: ReviewWorkspace }) {
  const raw = workspace.pre_diagnostic.raw_answers as Record<string, unknown> | undefined;
  const blocker = display(raw?.perceived_blocker ?? workspace.pre_diagnostic.perceived_blocker);
  const context = display(raw?.additional_context ?? workspace.pre_diagnostic.additional_context);
  const areas = Array.isArray(workspace.pre_diagnostic.perceived_areas)
    ? workspace.pre_diagnostic.perceived_areas.filter((item): item is string => typeof item === "string")
    : [];

  return (
    <section style={{ display: "grid", gap: 24 }}>
      <header style={{ display: "grid", gap: 8 }}>
        <span style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", opacity: .6 }}>
          Revisão de pré-diagnóstico
        </span>
        <h1 style={{ margin: 0 }}>{workspace.lead.company_name || workspace.lead.name}</h1>
        <p style={{ margin: 0, opacity: .72 }}>
          {workspace.lead.name} · score {workspace.lead.commercial_score}/10 · {workspace.lead.status}
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <article style={{ padding: 18, border: "1px solid rgba(1,48,30,.14)", borderRadius: 16 }}>
          <small>Objetivo</small>
          <p>{workspace.lead.objective}</p>
        </article>
        <article style={{ padding: 18, border: "1px solid rgba(1,48,30,.14)", borderRadius: 16 }}>
          <small>Bloqueio percebido</small>
          <p>{blocker}</p>
        </article>
        <article style={{ padding: 18, border: "1px solid rgba(1,48,30,.14)", borderRadius: 16 }}>
          <small>Status da IA</small>
          <p>{workspace.pre_diagnostic.ai_analysis_status}</p>
        </article>
        <article style={{ padding: 18, border: "1px solid rgba(1,48,30,.14)", borderRadius: 16 }}>
          <small>Revisão humana</small>
          <p>{workspace.pre_diagnostic.human_review_status}</p>
        </article>
      </div>

      <article style={{ padding: 20, border: "1px solid rgba(1,48,30,.14)", borderRadius: 18 }}>
        <h2 style={{ marginTop: 0 }}>Áreas percebidas</h2>
        <p>{areas.length ? areas.join(" · ") : "Nenhuma área marcada."}</p>
      </article>

      <article style={{ padding: 20, border: "1px solid rgba(1,48,30,.14)", borderRadius: 18 }}>
        <h2 style={{ marginTop: 0 }}>Contexto adicional</h2>
        <p>{context}</p>
      </article>

      <article style={{ padding: 20, border: "1px solid rgba(1,48,30,.14)", borderRadius: 18 }}>
        <h2 style={{ marginTop: 0 }}>Análise atual</h2>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: 0 }}>
          {workspace.current_analysis ? JSON.stringify(workspace.current_analysis, null, 2) : "Ainda não existe análise registrada."}
        </pre>
      </article>

      <article style={{ padding: 20, border: "1px solid rgba(1,48,30,.14)", borderRadius: 18 }}>
        <h2 style={{ marginTop: 0 }}>Ações abertas</h2>
        <p>{workspace.open_actions.length} ação(ões) aguardando tratamento.</p>
      </article>
    </section>
  );
}
