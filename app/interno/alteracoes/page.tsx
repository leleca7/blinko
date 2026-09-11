import Link from "next/link";
import { requireInternalSession } from "../../../lib/blinko/internal-auth";
import { listChangeRequestProjects } from "../../../lib/blinko/change-requests-overview-server";
import InternalTopbar from "../InternalTopbar";
import styles from "../interno.module.css";

function text(value:unknown){return typeof value==="string"?value:"";}
function numeric(value:unknown){const n=Number(value??0);return Number.isFinite(n)?n:0;}
function formatDate(value:unknown){const raw=text(value);if(!raw)return "—";const date=new Date(raw);return Number.isNaN(date.getTime())?raw:date.toLocaleString("pt-BR",{timeZone:"America/Bahia"});}

export default async function ChangesOverviewPage(){
  const session=await requireInternalSession();
  const overview=await listChangeRequestProjects();
  const pending=overview.projects.reduce((sum,item)=>sum+numeric(item.pending_decisions),0);
  const open=overview.projects.reduce((sum,item)=>sum+numeric(item.open_change_requests),0);
  const revisions=overview.projects.reduce((sum,item)=>sum+numeric(item.revision_rounds),0);

  return <main className={styles.page}><div className={styles.shell}>
    <InternalTopbar user={session.user} active="changes"/>
    <section className={styles.hero} style={{paddingBottom:20}}><span className={styles.eyebrow}>OPERAÇÃO E QUALIDADE</span><h1>Alterações</h1><p>Correções, revisões, mudanças de escopo e novas demandas ficam separadas do fluxo normal de tarefas e preservam decisão, impacto e evidência.</p></section>

    {!overview.schemaReady?<div className={styles.notice}>A Central de Alterações depende das migrações 034–035 no banco conectado.</div>:<>
      <section className={styles.counts}><article className={styles.countCard}><strong>{pending}</strong><span>aguardando decisão</span></article><article className={styles.countCard}><strong>{open}</strong><span>alterações abertas</span></article><article className={styles.countCard}><strong>{revisions}</strong><span>rodadas de revisão consumidas</span></article><article className={styles.countCard}><strong>{overview.projects.length}</strong><span>projetos operacionais</span></article></section>

      <div className={styles.reviewShell} style={{marginTop:22}}><section className={styles.reviewCard}><span className={styles.eyebrow}>PROJETOS</span><h2>Onde existe decisão ou possibilidade de alteração</h2>
        {overview.projects.length===0?<div className={styles.notice}>Nenhum projeto operacional disponível.</div>:<div style={{display:"grid",gap:12,marginTop:18}}>{overview.projects.map((item)=>{
          const pendingCount=numeric(item.pending_decisions);const openCount=numeric(item.open_change_requests);
          return <Link key={text(item.project_id)} href={`/interno/projetos/${text(item.project_id)}/alteracoes`} className={styles.action} style={{gridTemplateColumns:"minmax(0,1fr) auto",alignItems:"center"}}><span><strong>{text(item.company_name)}</strong><span className={styles.meta}>{text(item.project_status)} · {text(item.objective)}</span><span className={styles.meta}>Pendentes: {pendingCount} · Abertas: {openCount} · Mudanças de escopo: {numeric(item.scope_changes)} · Revisões: {numeric(item.revision_rounds)}{text(item.latest_request_at)?` · Última: ${formatDate(item.latest_request_at)}`:""}</span></span><span className={styles.badge}>{pendingCount>0?"DECISÃO PENDENTE":"Abrir"}</span></Link>;
        })}</div>}
      </section></div>
    </>}
  </div></main>;
}
