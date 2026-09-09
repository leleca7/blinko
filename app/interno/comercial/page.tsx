import Link from "next/link";
import { requireInternalSession } from "../../../lib/blinko/internal-auth";
import { getCommercialPipeline } from "../../../lib/blinko/commercial-server";
import InternalTopbar from "../InternalTopbar";
import styles from "../interno.module.css";

const STAGES: Record<string,string> = {
  P00:"Identificado",P01:"Contato pendente",P02:"Contatado",P03:"Em qualificação",P04:"Oportunidade qualificada",
  P05:"Diagnóstico / triagem",P06:"Recomendação definida",P07:"Proposta em preparação",P08:"Proposta enviada",
  P09:"Negociação / ajustes",P10:"Aprovada comercialmente",P11:"Formalização pendente",P12:"Condição de início pendente",
  P13:"Onboarding",P14:"Pronto para operação",
};

function text(value: unknown) { return typeof value === "string" ? value : value == null ? "" : String(value); }
function num(value: unknown) { const n=Number(value); return Number.isFinite(n)?n:0; }
function money(value: unknown) { const n=Number(value); return Number.isFinite(n)?n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):"—"; }
function due(value: unknown) { const raw=text(value); if(!raw)return "sem data"; const d=new Date(raw); return Number.isNaN(d.getTime())?"sem data":d.toLocaleString("pt-BR",{timeZone:"America/Bahia",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}); }

export default async function CommercialPage() {
  const session=await requireInternalSession();
  const pipeline=await getCommercialPipeline();
  const active=pipeline.opportunities.filter((o)=>!text(o.outcome_status));
  const won=pipeline.opportunities.filter((o)=>text(o.outcome_status)==="won");
  const overdue=active.filter((o)=>text(o.health)==="overdue");
  const totalValue=active.reduce((sum,o)=>sum+num(o.estimated_value),0);

  return <main className={styles.page}><div className={styles.shell}>
    <InternalTopbar user={session.user} active="commercial" />
    <section className={styles.hero}>
      <span className={styles.eyebrow}>COMERCIAL · P00–P14</span>
      <h1>Pipeline da Blinko.</h1>
      <p>Lead é a entrada; oportunidade é o negócio comercial. Toda oportunidade ativa entre P01 e P13 precisa ter responsável, próxima ação e data.</p>
    </section>

    {!pipeline.schemaReady ? <div className={styles.notice}>O módulo comercial oficial aguarda a migração 021 no banco conectado. O restante do OS continua funcionando normalmente.</div> : <>
      <section className={styles.counts}>
        <article className={styles.countCard}><strong>{active.length}</strong><span>oportunidades ativas</span></article>
        <article className={styles.countCard}><strong>{overdue.length}</strong><span>próximas ações vencidas</span></article>
        <article className={styles.countCard}><strong>{won.length}</strong><span>ganhas no histórico</span></article>
        <article className={styles.countCard}><strong>{money(totalValue)}</strong><span>valor estimado do pipeline</span></article>
      </section>

      <div style={{display:"grid",gap:18}}>
        {Object.keys(STAGES).map((stage)=>{
          const items=active.filter((o)=>text(o.pipeline_stage)===stage);
          if(!items.length)return null;
          return <section className={styles.reviewCard} key={stage}>
            <div className={styles.sectionTitle}><h2>{stage} · {STAGES[stage]}</h2><span>{items.length} oportunidade(s)</span></div>
            <div style={{display:"grid",gap:10}}>{items.map((o)=><Link className={styles.action} href={`/interno/comercial/${text(o.id)}`} key={text(o.id)} style={{gridTemplateColumns:"minmax(0,1fr) auto auto"}}>
              <span><span className={styles.company}>{text(o.company_name)||text(o.lead_company_name)||"Empresa"}</span><span className={styles.meta}>{text(o.next_action_title)||"Sem próxima ação"} · {text(o.owner_label)||"sem responsável"}</span></span>
              <span className={styles.badge}>{text(o.health)}</span>
              <span className={styles.score}>{due(o.next_action_at)}</span>
            </Link>)}</div>
          </section>;
        })}
      </div>

      {won.length ? <section className={styles.reviewCard} style={{marginTop:18}}><span className={styles.eyebrow}>HISTÓRICO</span><h2>Oportunidades ganhas</h2><div style={{display:"grid",gap:10,marginTop:14}}>{won.map((o)=><Link className={styles.action} href={`/interno/comercial/${text(o.id)}`} key={text(o.id)} style={{gridTemplateColumns:"minmax(0,1fr) auto"}}><span><span className={styles.company}>{text(o.company_name)||text(o.lead_company_name)}</span><span className={styles.meta}>{text(o.pipeline_stage)} · projeto {text(o.project_status)||"—"}</span></span><span className={styles.badge}>{money(o.estimated_value)}</span></Link>)}</div></section>:null}
    </>}
  </div></main>;
}
