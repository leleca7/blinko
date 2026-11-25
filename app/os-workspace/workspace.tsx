"use client";
import {useEffect,useRef,useState} from "react";
import {createLabClient,labErrorMessage,type LabLead,type LabProject,type LabEvidence} from "../../lib/os-lab/client";
import type {LabOperation} from "../../lib/os-lab/operations";
import styles from "../os-preview/os-preview.module.css";
import OperationalPanels from "./operational-panels";
const api=createLabClient();
const stages=["triagem","contato","reuniao","proposta","diagnostico"];
const stageLabels=["Triagem","Contato","Reunião","Proposta","Diagnóstico"];
const pillars=["Estratégia","Administração","Pessoas","Financeiro","Comercial","Marketing","Marca","Relacionamentos","Experiência","Operação"];
const kinds={fact:"Fato observado",report:"Relato",hypothesis:"Hipótese"};
export default function ConnectedWorkspace(){
 const [leads,setLeads]=useState<LabLead[]>([]);
 const [projects,setProjects]=useState<LabProject[]>([]);
 const [selected,setSelected]=useState("");
 const [evidence,setEvidence]=useState<LabEvidence[]>([]);
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [consent,setConsent]=useState(false);
 const [company,setCompany]=useState("Empresa fictícia ");
 const [challenge,setChallenge]=useState("Organização comercial");
 const [confirmed,setConfirmed]=useState(false);
 const [pillar,setPillar]=useState(0);
 const [kind,setKind]=useState<LabEvidence["kind"]>("fact");
 const [summary,setSummary]=useState("");
 const [reason,setReason]=useState("");
 const [leadId,setLeadId]=useState("");
 const [revision,setRevision]=useState(0);
 const lock=useRef(false);
 const leadKey=useRef<{id:string;submissionId:string}|null>(null);
 const active=leads.find(x=>x.id===leadId);
 const project=projects.find(x=>x.id===selected);
 useEffect(()=>{
  const controller=new AbortController();
  setLoaded(false);setLeads([]);setProjects([]);setEvidence([]);
  Promise.all([api.leads(controller.signal),api.projects(controller.signal)]).then(([l,p])=>{
   if(controller.signal.aborted)return;
   if(!Array.isArray(l)||!Array.isArray(p))throw Error("Invalid lists");
   setLeads(l);setProjects(p);setLoaded(true);
   setLeadId(old=>l.some(x=>x.id===old)?old:"");
   setSelected(old=>p.some(x=>x.id===old)?old:"");
  }).catch(e=>{if(!controller.signal.aborted)setMessage(labErrorMessage(e));});
  return ()=>controller.abort();
 },[revision]);
 useEffect(()=>{
  const controller=new AbortController();
  setEvidence([]);
  if(selected&&loaded)api.evidence(selected,controller.signal).then(rows=>{
   if(controller.signal.aborted)return;
   if(!Array.isArray(rows))throw Error("Invalid evidence list");
   setEvidence(rows);
  }).catch(e=>{if(!controller.signal.aborted)setMessage(labErrorMessage(e));});
  return ()=>controller.abort();
 },[selected,loaded,revision]);
 async function run(fn:()=>Promise<unknown>,success?:()=>void){
  if(lock.current)return;
  lock.current=true;setBusy(true);setMessage("");
  try{await fn();success?.();setMessage("Operação confirmada. Atualizando registros.");}
  catch(e){setMessage(labErrorMessage(e));}
  finally{setRevision(x=>x+1);setBusy(false);lock.current=false;}
 }
 const mutate=(op:LabOperation,success?:()=>void)=>run(()=>api.mutate(op),success);
 return <main className={styles.page}><div className={styles.shell}><aside className={styles.sidebar}><div className={styles.brand}><strong>blinko<span>*</span></strong><small>OS · LABORATÓRIO PROTEGIDO</small></div><div className={styles.sideFoot}>Apenas dados fictícios</div></aside><div className={styles.workspace}>
 <header className={styles.top}><strong>Integração · Operação de projetos</strong><button disabled={busy} onClick={()=>{setMessage("");setRevision(x=>x+1);}}>Atualizar registros</button></header>
 <p className={styles.notice}>Interface persistente em desenvolvimento. Não recebe clientes reais. Acesso e gravações dependem da sessão e da autorização do servidor.</p>
 <p role="status">{message||(!loaded?"Consultando registros autorizados…":"Registros consultados.")}</p>
 <fieldset disabled={busy||!loaded} style={{border:0,padding:0,margin:0,minWidth:0}}>
 <section className={styles.panel}><small>01 · CRM</small><h2>Oportunidades</h2>
 <form onSubmit={e=>{e.preventDefault();if(!consent||!company.trim().startsWith("Empresa fictícia "))return;leadKey.current??={id:crypto.randomUUID(),submissionId:crypto.randomUUID()};mutate({type:"lead_create",...leadKey.current,company,consent:true},()=>{setCompany("Empresa fictícia ");setConsent(false);leadKey.current=null;});}}>
 <label>Nome fictício<input value={company} maxLength={120} onChange={e=>{setCompany(e.target.value);leadKey.current=null;}} required/></label>
 <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Consentimento simulado</label>
 <button type="submit" disabled={!consent}>Registrar oportunidade</button></form>
 <label>Lead ativo<select value={leadId} onChange={e=>{setLeadId(e.target.value);setConfirmed(false);}}><option value="">Selecionar lead</option>{leads.map(l=><option key={l.id} value={l.id}>{l.display_name} · {stageLabels[stages.indexOf(l.stage)]??l.stage}</option>)}</select></label>
 {active&&<><p>Triagem: {active.intake_complete?"completa":"incompleta"} · Etapa: {stageLabels[stages.indexOf(active.stage)]}</p>
 {!active.intake_complete&&<form onSubmit={e=>{e.preventDefault();mutate({type:"lead_complete",id:active.id,challenge});}}><label>Desafio identificado<input value={challenge} maxLength={500} onChange={e=>setChallenge(e.target.value)} required/></label><button type="submit">Concluir triagem</button></form>}
 {stages.indexOf(active.stage)>=0&&stages.indexOf(active.stage)<4&&<button onClick={()=>mutate({type:"lead_move",id:active.id,expectedStage:active.stage,nextStage:stages[stages.indexOf(active.stage)+1]})}>Avançar para {stageLabels[stages.indexOf(active.stage)+1]}</button>}
 {active.stage==="diagnostico"&&active.intake_complete&&!active.project_id&&<><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Confirmar contratação fictícia</label><button disabled={!confirmed} onClick={()=>mutate({type:"lead_contract",id:active.id,projectId:crypto.randomUUID(),confirmed:true},()=>setConfirmed(false))}>Criar projeto</button></>}
 {active.project_id&&<button onClick={()=>{setSelected(active.project_id??"");setEvidence([]);setReason("");setSummary("");}}>Abrir projeto vinculado</button>}</>}
 </section>
 <section className={styles.panel}><small>02 · PROJETOS</small><h2>Projeto ativo</h2><label>Projeto<select value={selected} onChange={e=>{setSelected(e.target.value);setEvidence([]);setReason("");setSummary("");}}><option value="">Selecionar projeto</option>{projects.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
 {project&&<><p>{project.method_stage} · {project.owner_label} · {project.due_on||"Sem prazo"}</p><form key={project.id} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);mutate({type:"project_details",id:project.id,stage:String(f.get("stage")),owner:String(f.get("owner")),due:String(f.get("due")||"")||null});}}>
 <label>Etapa<select name="stage" defaultValue={project.method_stage}>{["Escutar","Investigar","Priorizar","Estruturar","Acompanhar"].map(s=><option key={s}>{s}</option>)}</select></label><label>Responsável<select name="owner" defaultValue={project.owner_label}>{["A definir","Atendimento","Pesquisa","Produção","Equipe"].map(s=><option key={s}>{s}</option>)}</select></label><label>Prazo<input name="due" type="date" defaultValue={project.due_on||""}/></label><button type="submit">Salvar detalhes</button></form></>}
 </section>
 {project&&<section className={styles.panel}><small>03 · DIAGNÓSTICO</small><h2>Evidências</h2><form onSubmit={e=>{e.preventDefault();run(()=>api.createEvidence({projectId:project.id,pillar,kind,summary}),()=>setSummary(""));}}>
 <label>Pilar<select value={pillar} onChange={e=>setPillar(Number(e.target.value))}>{pillars.map((p,i)=><option key={p} value={i}>{p}</option>)}</select></label><label>Tipo<select value={kind} onChange={e=>setKind(e.target.value as LabEvidence["kind"])}>{Object.entries(kinds).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Registro<input value={summary} maxLength={500} onChange={e=>setSummary(e.target.value)} required/></label><button type="submit">Registrar evidência</button></form>
 <label>Justificativa para revisão<input value={reason} maxLength={500} onChange={e=>setReason(e.target.value)}/></label>
 {evidence.map(item=><article key={item.id} className={styles.lead}><strong>{pillars[item.pillar]} · {kinds[item.kind]}</strong><p>{item.summary}</p><p>{item.reviewed?"Revisada":"Pendente"}</p><button disabled={!reason.trim()} onClick={()=>run(()=>api.reviewEvidence({evidenceId:item.id,reviewed:!item.reviewed,reason}),()=>setReason(""))}>{item.reviewed?"Revogar revisão":"Revisar evidência"}</button></article>)}
 </section>}
 {project&&<OperationalPanels key={project.id+":"+revision} projectId={project.id} evidence={evidence} revision={revision} mutate={mutate}/>}
 </fieldset></div></div></main>;
}
