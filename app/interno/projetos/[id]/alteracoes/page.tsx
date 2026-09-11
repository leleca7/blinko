import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalSession } from "../../../../../lib/blinko/internal-auth";
import { getProjectChangeRequestWorkspace } from "../../../../../lib/blinko/change-requests-server";
import InternalBrand from "../../../InternalBrand";
import styles from "../../../interno.module.css";

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Props={params:Promise<{id:string}>;searchParams?:Promise<{status?:string}>};
function text(value:unknown){return typeof value==="string"?value:"";}
function list(value:unknown){return Array.isArray(value)?value.filter((item)=>item&&typeof item==="object") as Record<string,unknown>[]:[];}
function formatDate(value:unknown){const raw=text(value);if(!raw)return "—";const date=new Date(raw);return Number.isNaN(date.getTime())?raw:date.toLocaleString("pt-BR",{timeZone:"America/Bahia"});}
function classificationLabel(value:string){return ({error_correction:"Correção de erro",in_scope_revision:"Revisão dentro do escopo",scope_change:"Mudança de escopo",new_demand:"Nova demanda"} as Record<string,string>)[value]||value;}
function impactLabel(value:string){return ({none:"sem impacto",possible:"impacto possível",confirmed:"impacto confirmado"} as Record<string,string>)[value]||value;}
function decisionLabel(value:string){return ({pending:"aguardando decisão",approved:"aprovada",rejected:"rejeitada",routed:"roteada",cancelled:"cancelada"} as Record<string,string>)[value]||value;}
function notice(status?:string){
  if(status==="change_request_created")return "Solicitação registrada. Classificação e impactos ficaram preservados para decisão.";
  if(status==="change_request_analysis_saved")return "Análise de impacto atualizada com trilha de auditoria.";
  if(status==="change_request_decided")return "Decisão registrada. A execução só é liberada quando a solicitação foi aprovada.";
  if(status==="change_request_task_created")return "Tarefa de execução criada e vinculada à solicitação.";
  if(status==="change_request_closed")return "Solicitação concluída com evidência de implementação.";
  if(status==="change_request_invalid")return "Revise os campos obrigatórios da solicitação.";
  if(status==="change_request_blocked")return "A ação foi bloqueada por uma regra operacional. Revise classificação, análise, decisão e evidências.";
  if(status==="change_request_schema_pending")return "A Central de Alterações depende das migrações 034–035 no banco conectado.";
  return null;
}
const controlStyle={border:"1px solid rgba(1,48,30,.18)",background:"rgba(255,255,255,.78)",color:"#08271b",borderRadius:14,padding:13,font:"inherit"};
const cardStyle={padding:18,border:"1px solid rgba(1,48,30,.12)",borderRadius:18,background:"rgba(255,255,255,.5)"};

export default async function ProjectChangesPage({params,searchParams}:Props){
  const session=await requireInternalSession();
  const {id}=await params;
  const query=searchParams?await searchParams:{};
  if(!uuidPattern.test(id))notFound();
  const workspace=await getProjectChangeRequestWorkspace(id);
  const statusNotice=notice(query.status);
  if(!workspace.schemaReady){
    return <main className={styles.page}><div className={styles.shell}><header className={styles.topbar}><InternalBrand/><nav className={styles.nav}><span className={styles.link}>{session.user}</span></nav></header><div className={styles.reviewShell}><section className={styles.reviewCard}><span className={styles.eyebrow}>ALTERAÇÕES</span><h1>Central protegida</h1><div className={styles.notice}>A interface está pronta, mas depende das migrações 034–035.</div></section></div></div></main>;
  }
  if(!workspace.project||!workspace.company)notFound();
  const projectStatus=text(workspace.project.status);
  const canCreate=["active","waiting_client","at_risk","paused"].includes(projectStatus);
  const pending=workspace.changeRequests.filter((item)=>text(item.decision_status)==="pending").length;
  const scopeChanges=workspace.changeRequests.filter((item)=>text(item.classification)==="scope_change").length;
  const revisions=workspace.changeRequests.filter((item)=>item.consumes_revision===true).length;

  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.topbar}><InternalBrand/><nav className={styles.nav}><span className={styles.link}>{session.user}</span><form action="/api/interno/logout" method="post"><button className={styles.logout} type="submit">Sair</button></form></nav></header>
    <div className={styles.hero} style={{paddingBottom:14}}><Link className={styles.back} href={`/interno/projetos/${id}`}>← voltar ao projeto</Link>{statusNotice?<div className={styles.notice} style={{marginTop:14,maxWidth:900}}>{statusNotice}</div>:null}</div>

    <div className={styles.reviewShell}>
      <section className={styles.reviewCard} style={{borderColor:"rgba(239,59,127,.24)",background:"rgba(239,59,127,.025)"}}>
        <span className={styles.eyebrow}>OPERAÇÃO · CHANGE REQUEST</span><h1 style={{fontFamily:"Georgia, 'Times New Roman', serif",fontSize:42,fontWeight:500,marginBottom:8}}>{text(workspace.company.name)}</h1>
        <p style={{opacity:.72,lineHeight:1.6,maxWidth:920}}>Classifique qualquer alteração relevante antes de executar. Correção de erro não consome revisão; revisão válida conta rodada; mudança de escopo exige análise e decisão; nova demanda sai deste projeto e volta ao Comercial.</p>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}><span className={styles.badge}>Projeto: {projectStatus}</span><span className={styles.badge}>Solicitações: {workspace.changeRequests.length}</span><span className={styles.badge}>Aguardando decisão: {pending}</span><span className={styles.badge}>Mudanças de escopo: {scopeChanges}</span><span className={styles.badge}>Revisões consumidas: {revisions}</span></div>
      </section>

      <section className={styles.reviewCard}>
        <span className={styles.eyebrow}>NOVA SOLICITAÇÃO</span><h2>Classificar antes de executar</h2>
        {!canCreate?<div className={styles.notice}>Novas alterações só podem ser abertas em projeto operacional ativo, aguardando cliente, em risco ou pausado.</div>:
        <form action="/api/interno/change-requests" method="post" className={styles.form}>
          <input type="hidden" name="action" value="create"/><input type="hidden" name="project_id" value={id}/>
          <label>Classificação<select name="classification" required defaultValue="" style={controlStyle}><option value="" disabled>Selecione</option><option value="error_correction">Correção de erro — não consome revisão</option><option value="in_scope_revision">Revisão dentro do escopo — conta conforme contratação</option><option value="scope_change">Mudança de escopo — exige análise/decisão</option><option value="new_demand">Nova demanda — deve sair deste projeto</option></select></label>
          <label>Solicitante<input name="requester_label" required maxLength={300} style={controlStyle}/></label>
          <label>Origem<select name="requester_type" defaultValue="client" style={controlStyle}><option value="client">Cliente</option><option value="blinko">Blinko</option><option value="partner">Parceiro</option><option value="internal">Interno</option><option value="other">Outro</option></select></label>
          <label>Solução relacionada<select name="project_solution_id" defaultValue="" style={controlStyle}><option value="">Alteração transversal</option>{workspace.solutions.map((solution)=><option key={text(solution.id)} value={text(solution.id)}>{text(solution.solution_code)} — {text(solution.name)}</option>)}</select></label>
          <label>Descrição<textarea name="description" rows={5} required maxLength={8000} style={controlStyle} placeholder="Descreva factual e objetivamente o que foi solicitado ou identificado."/></label>
          <label>Entregável afetado<input name="affected_deliverable_key" maxLength={500} style={controlStyle}/></label>
          <label>Versão afetada<input name="affected_version_label" maxLength={300} style={controlStyle}/></label>
          <label>Referência de escopo<input name="scope_reference" maxLength={1000} style={controlStyle} placeholder="Proposta, contrato, item de escopo ou outra referência rastreável."/></label>
          <label>Análise inicial de impacto<textarea name="impact_analysis" rows={4} maxLength={8000} style={controlStyle}/></label>
          <label>Impacto em prazo<select name="deadline_impact_status" defaultValue="none" style={controlStyle}><option value="none">Nenhum identificado</option><option value="possible">Possível</option><option value="confirmed">Confirmado</option></select></label>
          <label>Descrição do impacto em prazo<textarea name="deadline_impact_description" rows={3} style={controlStyle}/></label>
          <label>Nova data proposta, se impacto confirmado<input name="proposed_new_due_at" type="datetime-local" style={controlStyle}/></label>
          <label>Impacto financeiro<select name="financial_impact_status" defaultValue="none" style={controlStyle}><option value="none">Nenhum identificado</option><option value="possible">Possível</option><option value="confirmed">Confirmado</option></select></label>
          <label>Descrição do impacto financeiro<textarea name="financial_impact_description" rows={3} style={controlStyle}/></label>
          <label>Referência financeira, se confirmada<input name="financial_reference" maxLength={1000} style={controlStyle} placeholder="Orçamento/aditivo/registro financeiro. Não informe regra inventada."/></label>
          <label>Responsável pela decisão<input name="decision_owner_label" required maxLength={300} style={controlStyle}/></label>
          <button className={styles.button} type="submit">Registrar solicitação</button>
        </form>}
      </section>

      <section className={styles.reviewCard}><span className={styles.eyebrow}>HISTÓRICO</span><h2>Solicitações classificadas</h2>
        {workspace.changeRequests.length===0?<div className={styles.notice}>Nenhuma alteração registrada neste projeto.</div>:<div style={{display:"grid",gap:16,marginTop:18}}>{workspace.changeRequests.map((cr)=>{
          const classification=text(cr.classification);const decision=text(cr.decision_status);const crStatus=text(cr.status);const tasks=list(cr.tasks);const decisions=list(cr.decisions);const pendingDecision=decision==="pending";const isNewDemand=classification==="new_demand";const approved=decision==="approved";const canClose=approved&&tasks.some((task)=>text(task.status)==="done")&&!tasks.some((task)=>!["done","cancelled"].includes(text(task.status)));
          return <article key={text(cr.id)} style={cardStyle}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><strong style={{fontSize:18}}>{classificationLabel(classification)}</strong><p style={{margin:"6px 0 0",opacity:.72}}>{text(cr.description)}</p></div><span className={styles.badge}>{decisionLabel(decision)}</span></div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:14}}><span className={styles.badge}>{text(cr.operational_label)}</span>{text(cr.solution_code)?<span className={styles.badge}>{text(cr.solution_code)} · {text(cr.solution_name)}</span>:null}{cr.consumes_revision===true?<span className={styles.badge}>Revisão #{String(cr.revision_sequence??"—")}</span>:null}</div>
            <div style={{display:"grid",gap:6,marginTop:14,fontSize:13,opacity:.78}}><span><strong>Solicitante:</strong> {text(cr.requester_label)} · {formatDate(cr.requested_at)}</span><span><strong>Decisor:</strong> {text(cr.decision_owner_label)}</span><span><strong>Prazo:</strong> {impactLabel(text(cr.deadline_impact_status))}{text(cr.deadline_impact_description)?` · ${text(cr.deadline_impact_description)}`:""}</span><span><strong>Financeiro:</strong> {impactLabel(text(cr.financial_impact_status))}{text(cr.financial_impact_description)?` · ${text(cr.financial_impact_description)}`:""}</span>{text(cr.impact_analysis)?<span><strong>Análise:</strong> {text(cr.impact_analysis)}</span>:null}{text(cr.approval_evidence)?<span><strong>Evidência de decisão:</strong> {text(cr.approval_evidence)}</span>:null}{text(cr.routed_opportunity_id)?<span><strong>Nova oportunidade:</strong> <Link href={`/interno/comercial/${text(cr.routed_opportunity_id)}`}>{text(cr.routed_opportunity_id)}</Link></span>:null}</div>

            {pendingDecision&&!isNewDemand?<details style={{marginTop:16}}><summary style={{cursor:"pointer",fontWeight:800}}>Revisar análise e decidir</summary><div style={{display:"grid",gap:14,marginTop:14}}>
              <form action="/api/interno/change-requests" method="post" className={styles.form}><input type="hidden" name="action" value="analysis"/><input type="hidden" name="project_id" value={id}/><input type="hidden" name="change_request_id" value={text(cr.id)}/><strong>Análise de impacto</strong><label>Análise<textarea name="impact_analysis" rows={4} defaultValue={text(cr.impact_analysis)} style={controlStyle}/></label><label>Impacto em prazo<select name="deadline_impact_status" defaultValue={text(cr.deadline_impact_status)||"none"} style={controlStyle}><option value="none">Nenhum</option><option value="possible">Possível</option><option value="confirmed">Confirmado</option></select></label><label>Detalhe de prazo<textarea name="deadline_impact_description" rows={3} defaultValue={text(cr.deadline_impact_description)} style={controlStyle}/></label><label>Nova data proposta<input name="proposed_new_due_at" type="datetime-local" style={controlStyle}/></label><label>Impacto financeiro<select name="financial_impact_status" defaultValue={text(cr.financial_impact_status)||"none"} style={controlStyle}><option value="none">Nenhum</option><option value="possible">Possível</option><option value="confirmed">Confirmado</option></select></label><label>Detalhe financeiro<textarea name="financial_impact_description" rows={3} defaultValue={text(cr.financial_impact_description)} style={controlStyle}/></label><label>Referência financeira<input name="financial_reference" defaultValue={text(cr.financial_reference)} style={controlStyle}/></label><label>Responsável pela decisão<input name="decision_owner_label" required defaultValue={text(cr.decision_owner_label)} style={controlStyle}/></label><button className={styles.button} type="submit">Atualizar análise</button></form>
              <form action="/api/interno/change-requests" method="post" className={styles.form}><input type="hidden" name="action" value="decision"/><input type="hidden" name="project_id" value={id}/><input type="hidden" name="change_request_id" value={text(cr.id)}/><strong>Decisão humana</strong><label>Decisão<select name="decision" required defaultValue="" style={controlStyle}><option value="" disabled>Selecione</option><option value="approved">Aprovar para execução</option><option value="rejected">Rejeitar</option><option value="cancelled">Cancelar</option></select></label><label>Aprovação registrada<select name="approval_id" defaultValue="" style={controlStyle}><option value="">Usar evidência textual</option>{workspace.approvals.filter((approval)=>text(approval.status)==="approved").map((approval)=><option key={text(approval.id)} value={text(approval.id)}>{text(approval.title)} · {text(approval.version_label)}</option>)}</select></label><label>Evidência/aceite<textarea name="approval_evidence" rows={3} style={controlStyle} placeholder={classification==="scope_change"?"Obrigatória para mudança de escopo se não houver aprovação vinculada.":"Referência rastreável quando aplicável."}/></label><label>Notas da decisão<textarea name="decision_notes" rows={3} style={controlStyle}/></label><button className={styles.button} type="submit">Registrar decisão</button></form>
            </div></details>:null}

            {pendingDecision&&isNewDemand?<form action="/api/interno/change-requests" method="post" className={styles.form} style={{marginTop:16}}><input type="hidden" name="action" value="route_new_demand"/><input type="hidden" name="project_id" value={id}/><input type="hidden" name="change_request_id" value={text(cr.id)}/><strong>Encaminhar para o Comercial</strong><p style={{opacity:.7,margin:0}}>Nova demanda não pode ser executada dentro deste projeto. O roteamento cria uma nova oportunidade P01 vinculada à mesma Empresa/Contato.</p><label>Rota comercial<select name="commercial_route" defaultValue="strategic" style={controlStyle}><option value="strategic">Estratégica</option><option value="transactional">Transacional</option></select></label><label>Próxima ação<input name="next_action_at" type="datetime-local" required style={controlStyle}/></label><button className={styles.button} type="submit">Criar nova oportunidade</button></form>:null}

            {approved&&!["closed","cancelled","rejected"].includes(crStatus)?<form action="/api/interno/change-requests" method="post" className={styles.form} style={{marginTop:16}}><input type="hidden" name="action" value="task"/><input type="hidden" name="project_id" value={id}/><input type="hidden" name="change_request_id" value={text(cr.id)}/><strong>Criar tarefa da alteração</strong><label>Título<input name="title" required maxLength={300} style={controlStyle}/></label><label>Responsável<input name="responsible_label" maxLength={300} style={controlStyle}/></label><label>Prazo<input name="due_at" type="datetime-local" style={controlStyle}/></label><label>Prioridade<select name="priority" defaultValue="normal" style={controlStyle}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label><label>Estimativa<input name="estimate" maxLength={500} style={controlStyle}/></label><label style={{display:"flex",gap:8,alignItems:"flex-start"}}><input type="checkbox" name="approval_required" value="yes"/><span>Tarefa exige aprovação para conclusão.</span></label><button className={styles.button} type="submit">Criar tarefa vinculada</button></form>:null}

            {tasks.length?<div style={{marginTop:16}}><strong>Tarefas vinculadas</strong><div style={{display:"grid",gap:8,marginTop:8}}>{tasks.map((task)=><div key={text(task.id)} style={{padding:10,border:"1px solid rgba(1,48,30,.1)",borderRadius:12}}><span>{text(task.title)}</span> <span className={styles.badge}>{text(task.status)}</span>{text(task.completion_evidence)?<small style={{display:"block",marginTop:5}}>Evidência: {text(task.completion_evidence)}</small>:null}</div>)}</div></div>:null}

            {canClose?<form action="/api/interno/change-requests" method="post" className={styles.form} style={{marginTop:16}}><input type="hidden" name="action" value="close"/><input type="hidden" name="project_id" value={id}/><input type="hidden" name="change_request_id" value={text(cr.id)}/><label>Evidência final da implementação<textarea name="implementation_evidence" rows={3} required style={controlStyle}/></label><button className={styles.button} type="submit">Concluir solicitação</button></form>:null}

            {decisions.length?<details style={{marginTop:14}}><summary style={{cursor:"pointer",fontWeight:700}}>Histórico de decisões ({decisions.length})</summary><div style={{display:"grid",gap:6,marginTop:8,fontSize:12}}>{decisions.map((decisionItem)=><span key={text(decisionItem.id)}>{formatDate(decisionItem.decided_at)} · {text(decisionItem.actor_label)} · {decisionLabel(text(decisionItem.to_decision_status))}{text(decisionItem.decision_notes)?` · ${text(decisionItem.decision_notes)}`:""}</span>)}</div></details>:null}
          </article>;
        })}</div>}
      </section>
    </div>
  </div></main>;
}
