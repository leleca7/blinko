"use client";

import { useState } from "react";
import { syntheticIntake, type LabIntake } from "../../lib/os-lab/synthetic-intake";
import styles from "./os-preview.module.css";
import { PILOT_ID, PILOT_COMPANY, PILOT_SUBMISSION, pilotFixture, pilotCanLoad, withoutProjectKey, mayContract } from "../../lib/os-lab/pilot";
import { buildAssistiveDraft, validateSuggestion, portalProjection, portalApprovalKey, canPreviewPortal, type PortalDraft } from "../../lib/os-lab/assistive";
import { pillarCoverage, investigationQuestions, assessHypothesis, type Hypothesis } from "../../lib/os-lab/intelligence";

const modules = [
  ["Hoje", "Fila operacional de todas as empresas", "Protótipo"],
  ["CRM e triagens", "Oportunidades, WhatsApp e empresas", "Protótipo"],
  ["Clientes e projetos", "Responsáveis, etapas e prazos", "Protótipo"],
  ["Orçamentos", "Custos e precificação personalizada", "Protótipo"],
  ["Diagnósticos", "Entrevistas, hipóteses e evidências", "Protótipo"],
  ["Radar Blinko", "Maturidade por pilar", "Protótipo"],
  ["Criticidade", "Matriz GUT", "Protótipo"],
  ["Documentos", "Rascunho de relatório e exportação", "Protótipo"],
  ["Financeiro", "Fluxo previsto e realizado por projeto", "Protótipo"],
  ["Agenda", "Reuniões, visitas e prazos", "Protótipo"],
  ["Inteligência", "Cruzamento de fontes e hipóteses investigativas", "Protótipo"],
  ["Assistência", "Sugestões rastreáveis e revisão", "Protótipo"],
  ["Portal do cliente", "Prévia controlada das entregas", "Protótipo"],
  ["Segurança", "Permissões e autenticação", "Auditoria pendente"],
];
const stages = ["Triagem", "Contato", "Reunião", "Proposta", "Diagnóstico"];
const initialLeads = [
  { id: 1, company: "Empresa fictícia A", stage: 0 },
  { id: 2, company: "Empresa fictícia B", stage: 1 },
  { id: 3, company: "Empresa fictícia C", stage: 3 },
];
const pillars = ["Estratégia","Administração","Pessoas","Financeiro","Comercial","Marketing","Marca","Relacionamentos","Experiência","Operação"];
const method = ["Escutar","Investigar","Priorizar","Estruturar","Acompanhar"];
const ratings = ["Inexistente","Inicial","Em estruturação","Consistente","Consolidado"];
const views = [["home","Visão geral","01"],["crm","CRM e triagens","02"],["orcamento","Orçamentos","03"],["projects","Projetos","04"],["diagnostic","Diagnóstico","05"],["radar","Radar Blinko","06"],["gut","Criticidade","07"],["plan","Plano de ação","08"],["agenda","Agenda","09"],["report","Documentos","10"],["finance","Financeiro","11"],["review","Revisão humana","12"],["intake","Simular triagem","13"],["intelligence","Inteligência","14"],["assist","Assistência","15"],["portal","Portal do cliente","16"],["pilot","Cliente Zero","17"]] as const;
type View = typeof views[number][0];
type Evidence = {id:number; pillar:number; kind:string; source:string; statement:string; verified:boolean};
type Action = {id:number; title:string; owner:string; due:string; evidenceId:number; gut:number; done:boolean};
type Appointment = {id:number;title:string;date:string;kind:string;done:boolean};
type Ledger = {id:number;label:string;date:string;kind:"income"|"expense";cents:number;settled:boolean};
type Project = {id:number; company:string; stage:number; owner:string; due:string; evidence:Evidence[]; scores:Record<number,{value:number;evidenceId:number}>; actions:Action[]; appointments:Appointment[]; ledger:Ledger[]; hypotheses:Hypothesis[]};
const makeProject = (id:number,company:string):Project => ({id,company,stage:0,owner:"A definir",due:"",evidence:[],scores:{},actions:[],appointments:[],ledger:[],hypotheses:[]});
const currency = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const clean = (n: number) => Number.isFinite(n) ? Math.max(0,n) : 0;

export default function OsPreview() {
  const [view, setView] = useState<View>("home");
  const [leads, setLeads] = useState(initialLeads);
  const [intakeRows,setIntakeRows] = useState<LabIntake[]>([]);
  const [intakeConsent,setIntakeConsent] = useState(false);
  const [intakeChallenge,setIntakeChallenge] = useState("Organização comercial");
  const [intakeStatus,setIntakeStatus] = useState("");
  const runIntake=(action:"start"|"complete")=>{
    const result=syntheticIntake(intakeRows,{action,id:"fixture-100",company:"Empresa fictícia D",consent:intakeConsent,challenge:intakeChallenge});
    setIntakeRows(result.rows);
    const messages={created:"Contato parcial criado no CRM.",updated:"Triagem completada, sem duplicar contato.",duplicate:"Envio repetido: nenhum registro adicional.",consent_required:"Consentimento obrigatório para iniciar.",contact_missing:"Inicie a triagem antes de completar.",conflict:"Envio conflitante: registro anterior preservado.",invalid:"Entrada sintética inválida."};
    setIntakeStatus(messages[result.status]);
    if(result.rows.some(x=>x.id==="fixture-100"))setLeads(old=>old.some(x=>x.id===100)?old:[...old,{id:100,company:"Empresa fictícia D",stage:0}]);
  };
  const [hours, setHours] = useState(40);
  const [rate, setRate] = useState(0);
  const [cost, setCost] = useState(0);
  const [fees, setFees] = useState(0);
  const [margin, setMargin] = useState(20);
  const [gut, setGut] = useState([3,3,3]);
  const [projects,setProjects] = useState<Project[]>([makeProject(0,"Cliente Zero · fictício")]);
  const [selected,setSelected] = useState(0);
  const [draft,setDraft] = useState({pillar:0,kind:"Relato",source:"",statement:""});
  const [actionDraft,setActionDraft] = useState({title:"",owner:"A definir",due:"",evidenceId:""});
  const [seq,setSeq] = useState(1);
  const [focusPillar,setFocusPillar] = useState(0);
  const [hypDraft,setHypDraft] = useState({cause:"",effect:"",supportId:"",challengeId:""});
  const [eventDraft,setEventDraft] = useState({title:"",date:"",kind:"Reunião"});
  const [moneyDraft,setMoneyDraft] = useState({label:"",date:"",kind:"income" as "income"|"expense",amount:""});
  const [reportNote,setReportNote] = useState<Record<number,string>>({});
  const [exportNotice,setExportNotice] = useState("");
  const [reviewSnapshots,setReviewSnapshots] = useState<Record<number,string>>({});
  const [reviewNotes,setReviewNotes] = useState<Record<number,string>>({});
  const [assistDecisions,setAssistDecisions] = useState<Record<string,"accepted"|"dismissed">>({});
  const [portalDrafts,setPortalDrafts] = useState<Record<number,PortalDraft>>({});
  const [portalApprovals,setPortalApprovals] = useState<Record<number,string>>({});
  const project = projects.find(p=>p.id===selected) ?? projects[0];
  const openWork=projects.flatMap(p=>[
    ...p.actions.filter(a=>!a.done).map(a=>({key:p.id+"-action-"+a.id,projectId:p.id,company:p.company,title:a.title,due:a.due,owner:a.owner,view:"plan" as const})),
    ...p.appointments.filter(a=>!a.done).map(a=>({key:p.id+"-event-"+a.id,projectId:p.id,company:p.company,title:a.title,due:a.date,owner:p.owner,view:"agenda" as const})),
    ...p.evidence.filter(e=>!e.verified).map(e=>({key:p.id+"-evidence-"+e.id,projectId:p.id,company:p.company,title:"Revisar registro · "+pillars[e.pillar],due:"",owner:p.owner,view:"diagnostic" as const}))
  ]).sort((a,b)=>(a.due||"9999-12-31").localeCompare(b.due||"9999-12-31")||a.company.localeCompare(b.company));
  const openLeads=leads.filter(l=>!projects.some(p=>p.id===l.id));
  const invalidateReview=(id:number)=>{setReviewSnapshots(old=>withoutProjectKey(old,id));setPortalApprovals(old=>withoutProjectKey(old,id));};
  const updateProject = (fn:(p:Project)=>Project) => {setProjects(old=>old.map(p=>p.id===project.id?fn(p):p));invalidateReview(project.id);};
  const pilotProject=projects.find(p=>p.id===PILOT_ID);
  const pilotLead=leads.find(l=>l.id===PILOT_ID);
  const pilotIntake=intakeRows.find(x=>x.id===PILOT_SUBMISSION);
  const runPilot=(action:"start"|"complete")=>{
    const result=syntheticIntake(intakeRows,{action,id:PILOT_SUBMISSION,company:PILOT_COMPANY,consent:true,challenge:"Organização comercial"});
    setIntakeRows(result.rows);
    if(result.rows.some(x=>x.id===PILOT_SUBMISSION))setLeads(old=>old.some(x=>x.id===PILOT_ID)?old:[...old,{id:PILOT_ID,company:PILOT_COMPANY,stage:0}]);
  };
  const verified = project.evidence.filter(e=>e.verified && e.kind!=="Hipótese");
  const coverage = pillarCoverage(project.evidence,pillars.length);
  const questions = investigationQuestions(project.evidence,focusPillar);
  const addHypothesis=()=>{if(!hypDraft.cause.trim()||!hypDraft.effect.trim())return;const supportId=hypDraft.supportId?Number(hypDraft.supportId):null;const challengeId=hypDraft.challengeId?Number(hypDraft.challengeId):null;if((supportId!==null&&!verified.some(e=>e.id===supportId))||(challengeId!==null&&!verified.some(e=>e.id===challengeId))||(supportId!==null&&supportId===challengeId))return;updateProject(p=>({...p,hypotheses:[...p.hypotheses,{id:seq,pillar:focusPillar,cause:hypDraft.cause.trim(),effect:hypDraft.effect.trim(),supportId,challengeId,decision:"open",rationale:""}]}));setSeq(n=>n+1);setHypDraft({cause:"",effect:"",supportId:"",challengeId:""});};
  const validScores = Object.entries(project.scores).filter(([i,s])=>s.value>=0 && verified.some(e=>e.id===s.evidenceId&&e.pillar===Number(i)));
  const maturity = validScores.length ? Math.round(validScores.reduce((sum,[,s])=>sum+s.value,0)/(4*validScores.length)*100) : null;
  const changeProject = (id:number) => {setSelected(id);setDraft({pillar:0,kind:"Relato",source:"",statement:""});setActionDraft({title:"",owner:"A definir",due:"",evidenceId:""});setEventDraft({title:"",date:"",kind:"Reunião"});setMoneyDraft({label:"",date:"",kind:"income",amount:""});setExportNotice("");setFocusPillar(0);setHypDraft({cause:"",effect:"",supportId:"",challengeId:""});};
  const addProject = (id:number,company:string) => {if(!mayContract(id,leads.find(l=>l.id===id)?.stage??-1,intakeRows))return;setProjects(old=>old.some(p=>p.id===id)?old:[...old,makeProject(id,company)]);changeProject(id);setView("projects");};
  const addEvidence = () => {if(!draft.source.trim()||!draft.statement.trim())return;updateProject(p=>({...p,evidence:[...p.evidence,{...draft,id:seq,verified:false}]}));setSeq(n=>n+1);setDraft({...draft,source:"",statement:""});};
  const addAction = () => {const evidenceId=Number(actionDraft.evidenceId);if(!actionDraft.title.trim()||!verified.some(e=>e.id===evidenceId))return;updateProject(p=>({...p,actions:[...p.actions,{...actionDraft,id:seq,evidenceId,gut:gut.reduce((a,b)=>a*b,1),done:false}]}));setSeq(n=>n+1);setActionDraft({title:"",owner:"A definir",due:"",evidenceId:""});};
  const totalCost = clean(hours)*clean(rate)+clean(cost);
  const valid = fees>=0 && margin>=0 && fees+margin<100;
  const price = valid ? Math.ceil(totalCost/(1-(fees+margin)/100)*100)/100 : null;
  const priority = gut.reduce((a,b)=>a*b,1);
  const financeTotal = (kind:Ledger["kind"], settled?:boolean) => project.ledger.filter(x=>x.kind===kind&&(settled===undefined||x.settled===settled)).reduce((sum,x)=>sum+x.cents,0)/100;
  const amount = Number(moneyDraft.amount);
  const validMoney = !!moneyDraft.label.trim() && !!moneyDraft.date && Number.isFinite(amount) && amount>0 && amount<=100000000 && Math.abs(amount*100-Math.round(amount*100))<0.0001;
  const addMoney = () => {if(!validMoney)return;updateProject(p=>({...p,ledger:[...p.ledger,{id:seq,label:moneyDraft.label.trim(),date:moneyDraft.date,kind:moneyDraft.kind,cents:Math.round(amount*100),settled:false}]}));setSeq(n=>n+1);setMoneyDraft({label:"",date:"",kind:"income",amount:""});};
  const addEvent = () => {if(!eventDraft.title.trim()||!eventDraft.date)return;updateProject(p=>({...p,appointments:[...p.appointments,{...eventDraft,title:eventDraft.title.trim(),id:seq,done:false}]}));setSeq(n=>n+1);setEventDraft({title:"",date:"",kind:"Reunião"});};
  const dateLabel = (date:string) => date ? date.split("-").reverse().join("/") : "Sem prazo";
  const reportText = [
    "BLINKO OS — RASCUNHO EXPERIMENTAL / DADOS FICTÍCIOS",
    "Não constitui diagnóstico validado nem documento pronto para cliente.",
    "Projeto: "+project.company, "Etapa: "+method[project.stage], "Responsável: "+project.owner, "Prazo: "+dateLabel(project.due),
    "", "1. EVIDÊNCIAS REVISADAS (relato não equivale a fato)",
    ...verified.map(e=>pillars[e.pillar]+" | "+e.kind+" | "+e.source+" | "+e.statement),
    ...(verified.length?[]:["Nenhuma evidência elegível."]),
    "", "2. HIPÓTESES — A VALIDAR", ...project.evidence.filter(e=>e.kind==="Hipótese").map(e=>pillars[e.pillar]+" | "+e.statement),
    ...project.hypotheses.map(h=>{const a=assessHypothesis(h,project.evidence);return "Hipótese causal: "+h.cause+" → "+h.effect+" | "+a.status+" | Parecer: "+(h.rationale||"Pendente");}),
    "", "3. MATURIDADE — ESCALA PROVISÓRIA",
    "Cobertura: "+validScores.length+"/10. Média apenas dos pilares avaliados: "+(maturity===null?"Não avaliado":maturity+"%"),
    ...pillars.map((name,i)=>{const s=validScores.find(([key])=>Number(key)===i)?.[1];return name+": "+(s?s.value+"/4 — "+ratings[s.value]:"Não avaliado");}),
    "", "4. PLANO DE AÇÃO", ...[...project.actions].sort((a,b)=>b.gut-a.gut).map(a=>a.title+" | GUT "+a.gut+"/125 | "+a.owner+" | "+dateLabel(a.due)+" | "+(a.done?"Concluída":"Em aberto")+(verified.some(e=>e.id===a.evidenceId)?"":" | ALERTA: evidência requer revisão")),
    "", "5. SÍNTESE HUMANA (RASCUNHO)", reportNote[project.id]||"A preencher.", "", "Revisão e aprovação humanas obrigatórias antes de qualquer uso externo."
  ].join("\n");
  // Approval is tied to the exact report content, never to a mutable flag.
  const blockers = [
    ...(!verified.length?["Registrar ao menos uma evidência revisada."]:[]),
    ...(project.evidence.some(e=>!e.verified)?["Revisar todos os registros pendentes."]:[]),
    ...(validScores.length!==pillars.length?["Completar avaliação dos dez pilares ou manter como rascunho parcial."]:[]),
    ...(!project.actions.length?["Registrar ao menos uma ação vinculada a evidência."]:[]),
    ...(project.actions.some(a=>!verified.some(e=>e.id===a.evidenceId))?["Revalidar evidências de apoio às ações."]:[]),
    ...(project.actions.some(a=>!a.due||a.owner==="A definir")?["Definir responsável e prazo das ações."]:[]),
    ...(project.hypotheses.some(h=>assessHypothesis(h,project.evidence).stale)?["Revalidar os vínculos e pareceres das hipóteses causais."]:[]),
    ...(!reportNote[project.id]?.trim()?["Preencher a síntese humana."]:[]),
    ...(!reviewNotes[project.id]?.trim()?["Registrar o parecer de revisão."]:[])
  ];
  const reviewKey=JSON.stringify([reportText,reviewNotes[project.id]||"",project.evidence,project.scores,project.actions,project.hypotheses]);
  const reviewed=blockers.length===0&&reviewSnapshots[project.id]===reviewKey;
  const assistSuggestions=buildAssistiveDraft(project.evidence,focusPillar).map(s=>validateSuggestion(s,project.evidence,focusPillar)).filter(s=>s!==null);
  const suggestionKey=(s:typeof assistSuggestions[number])=>JSON.stringify([project.id,s,project.evidence.filter(e=>s.sourceIds.includes(e.id))]);
  const portalDraft=portalDrafts[project.id]??{summary:"",nextStep:"",showMaturity:false,showActions:false};
  const patchPortal=(patch:Partial<PortalDraft>)=>{setPortalDrafts(old=>({...old,[project.id]:{...portalDraft,...patch}}));setPortalApprovals(old=>{const next={...old};delete next[project.id];return next;});};
  const portalInput={projectId:project.id,company:project.company,stage:method[project.stage],due:project.due,maturity,coverage:validScores.length,actions:project.actions,draft:portalDraft};
  const portalData=portalProjection(portalInput);
  const portalVisible=canPreviewPortal(portalInput,reviewed,portalApprovals[project.id],reviewKey);
  const reviewStatus=reviewed?"Revisado na simulação":reviewSnapshots[project.id]?"Revisão desatualizada":"Rascunho pendente";
  const downloadReport = () => {const url=URL.createObjectURL(new Blob([reportText+"\n\nStatus interno: "+reviewStatus],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="blinko-relatorio-ficticio-"+project.id+".txt";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setExportNotice("Exportação solicitada ao navegador. Confira seus downloads.");};
  const fields = [
    {label:"Horas totais",value:hours,set:setHours},
    {label:"Remuneração por hora (R$)",value:rate,set:setRate},
    {label:"Despesas e custos (R$)",value:cost,set:setCost},
    {label:"Taxas e tributos (%)",value:fees,set:setFees},
    {label:"Margem desejada (%)",value:margin,set:setMargin},
  ];
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}><strong>blinko<span>*</span></strong><small>OS / Laboratório</small></div>
          <nav className={styles.navigation} aria-label="Navegação do laboratório">
            <small>ESPAÇO DE TRABALHO</small>
            {views.map(([id,label,number])=>
              <button type="button" key={id} aria-current={view===id?"page":undefined} data-active={view===id} onClick={()=>setView(id)}><span>{number}</span>{label}<span aria-hidden="true">↗</span></button>)}
          </nav>
          <div className={styles.sideFoot}><span className={styles.dot}/> Ambiente de teste</div>
        </aside>
        <div className={styles.workspace}>
        <header className={styles.top}>
          <div className={styles.breadcrumb}>Blinko OS <span>/</span> {views.find(v=>v[0]===view)?.[1]}</div>
          <span className={styles.previewTag}>PROTÓTIPO 08</span>
        </header>
        <aside className={styles.notice}>Ambiente experimental · Use somente dados fictícios. Não há conexão ao CRM, envio ou armazenamento. Recarregar restaura a demonstração.</aside>
        {["projects","diagnostic","radar","plan","agenda","report","finance","review","intelligence","assist","portal"].includes(view) && <div className={styles.projectBar}><label>Projeto ativo<select aria-label="Projeto ativo" value={project.id} onChange={e=>changeProject(Number(e.target.value))}>{projects.map(p=><option key={p.id} value={p.id}>{p.company}</option>)}</select></label><span>{method[project.stage]} · {verified.length} evidências revisadas</span></div>}
        {view==="home" && <>
        <section className={styles.hero}>
          <div><small>OPERAÇÃO E INTELIGÊNCIA</small><h1>Clareza para operar.</h1><p>Da triagem ao diagnóstico: uma central para organizar decisões, evidências e entregas.</p></div>
          <div className={styles.heroMark} aria-hidden="true">b<span>*</span></div>
        </section>
        <div className={styles.quickGrid}>
          <button className={styles.quick} type="button" onClick={()=>setView("crm")}><small>CRM E TRIAGENS</small><strong>{leads.length.toString().padStart(2,"0")}</strong><span>Registros fictícios <b aria-hidden="true">↗</b></span></button>
          <button className={styles.quick} type="button" onClick={()=>setView("orcamento")}><small>ORÇAMENTOS</small><strong>{price===null?"—":currency(price)}</strong><span>Estimativa simulada <b aria-hidden="true">↗</b></span></button>
          <button className={styles.quick} type="button" onClick={()=>setView("gut")}><small>CRITICIDADE</small><strong>{priority}<i>/125</i></strong><span>Pontuação GUT <b aria-hidden="true">↗</b></span></button>
        </div>
        <div className={styles.quickGrid}>
          <button className={styles.quick} onClick={()=>setView("projects")}><small>PROJETOS</small><strong>{projects.length.toString().padStart(2,"0")}</strong><span>Projetos simulados <b>↗</b></span></button>
          <button className={styles.quick} onClick={()=>setView("radar")}><small>RADAR DO PROJETO</small><strong>{maturity===null?"—":maturity+"%"}</strong><span>{validScores.length}/10 pilares avaliados <b>↗</b></span></button>
          <button className={styles.quick} onClick={()=>setView("plan")}><small>PLANO DE AÇÃO</small><strong>{project.actions.filter(a=>!a.done).length}</strong><span>Ações em aberto <b>↗</b></span></button>
        </div>
        <div className={styles.reviewBanner}><div><small>CONTROLE DE QUALIDADE · PROJETO ATIVO</small><strong>{reviewStatus}</strong><p>{blockers.length} critérios pendentes · {project.company}</p></div><button className={styles.smallButton} onClick={()=>setView("review")}>Abrir revisão ↗</button></div>
        <section className={styles.dailySection} aria-label="Fila de trabalho">
          <div className={styles.heading}><div><small>ROTINA DA EQUIPE</small><h2>O que precisa de atenção</h2></div><button className={styles.smallButton} onClick={()=>setView("crm")}>CRM ↗</button></div>
          <p>Fila de todos os projetos desta sessão, ordenada por prazo. Itens sem prazo aparecem no final. Não é uma agenda sincronizada.</p>
          <div className={styles.dailyStats}><span><strong>{openLeads.length}</strong> oportunidades sem projeto</span><span><strong>{openWork.length}</strong> pendências de projeto</span></div>
          {openWork.length===0?<p>Nenhuma pendência de projeto registrada. Use o Cliente Zero para ensaiar a operação.</p>:<div className={styles.dailyList}>{openWork.slice(0,12).map(item=><button key={item.key} onClick={()=>{changeProject(item.projectId);setView(item.view);}}><div><small>{item.company} · {item.owner}</small><strong>{item.title}</strong></div><span>{dateLabel(item.due)} ↗</span></button>)}</div>}
          {openWork.length>12&&<p>Mostrando as primeiras 12 de {openWork.length} pendências. As demais estão nos respectivos projetos.</p>}
          <button className={styles.smallButton} onClick={()=>setView("pilot")}>Roteiro Cliente Zero ↗</button>
        </section>
        <section className={styles.moduleSection} aria-label="Roadmap dos módulos">
          <div className={styles.heading}><h2>Módulos da operação</h2><small>ROADMAP</small></div>
          <div className={styles.modules}>{modules.map(([name,desc,status])=><article key={name}><div><h3>{name}</h3><p>{desc}</p></div><small data-status={status==="Protótipo"?"prototype":"planned"}>{status}</small></article>)}</div>
        </section>
        </>}
        {view==="crm" && <section className={styles.panel} id="crm">
          <div className={styles.heading}><div><small>02 / CRM</small><h2>Pipeline de demonstração</h2></div><button onClick={()=>{setLeads([...initialLeads,...(intakeRows.some(x=>x.id==="fixture-100")?[{id:100,company:"Empresa fictícia D",stage:0}]:[]),...(pilotIntake?[{id:PILOT_ID,company:PILOT_COMPANY,stage:0}]:[])]);}}>Restaurar etapas</button></div>
          <p>Experimente mover os registros fictícios entre as etapas. Nenhum dado é persistido.</p><button className={styles.smallButton} onClick={()=>setView("intake")}>Simular entrada pelo site ↗</button>
          <div className={styles.pipeline}>
            {stages.map((stage,i)=><div className={styles.column} key={stage}><h3>{stage} <span>{leads.filter(l=>l.stage===i).length}</span></h3>
              {leads.filter(l=>l.stage===i).map(lead=><article key={lead.id} className={styles.lead}><strong>{lead.company}</strong><label>Etapa<select value={lead.stage} onChange={e=>setLeads(old=>old.map(l=>l.id===lead.id?{...l,stage:Number(e.target.value)}:l))}>{stages.map((s,j)=><option key={s} value={j}>{s}</option>)}</select></label>{lead.stage===4&&!mayContract(lead.id,lead.stage,intakeRows)&&<p>Conclua a triagem antes da contratação.</p>}{mayContract(lead.id,lead.stage,intakeRows)&&<button className={styles.smallButton} onClick={()=>addProject(lead.id,lead.company)}>{projects.some(p=>p.id===lead.id)?"Abrir projeto":"Simular contratação e abrir projeto"}</button>}</article>)}
            </div>)}
          </div>
        </section>}
        {view==="orcamento" && <section className={styles.panel} id="orcamento">
            <small>03 / ORÇAMENTO</small><h2>Estimador de proposta</h2><p>Hipótese de custo, não uma tabela comercial aprovada. Horas são a soma do esforço da equipe.</p>
            <div className={styles.fields}>{fields.map(f=><label key={f.label}>{f.label}<input type="number" min="0" step="any" value={f.value} onChange={e=>f.set(clean(Number(e.target.value)))}/></label>)}</div>
            <div className={styles.result} aria-live="polite"><small>Custo estimado: {currency(totalCost)}</small><strong>{price===null?"Percentuais inválidos":currency(price)}</strong><p>{price===null?"Taxas e margem somadas precisam ser inferiores a 100%.":"Preço simulado, incluindo margem e taxas."}</p></div>
          </section>}
          {view==="gut" && <section className={styles.panel} id="gut">
            <small>04 / CRITICIDADE</small><h2>Matriz GUT</h2><p>Instrumento experimental. Pontuações exigem evidências e revisão humana.</p>
            {["Gravidade","Urgência","Tendência"].map((name,i)=><label className={styles.range} key={name}>{name} <strong>{gut[i]}/5</strong><input type="range" min="1" max="5" step="1" value={gut[i]} onChange={e=>setGut(old=>old.map((v,j)=>j===i?Number(e.target.value):v))}/></label>)}
            <div className={styles.result} aria-live="polite"><small>Pontuação G × U × T</small><strong>{priority}/125</strong><p>{priority>=81?"Crítica":priority>=41?"Alta":priority>=16?"Moderada":"Baixa"} · faixa provisória</p><p>Riscos graves podem exigir ação imediata independentemente da nota.</p></div>
          </section>}
        {view==="projects" && <section className={styles.panel}><small>04 / PROJETOS</small><h2>Projetos e acompanhamento</h2><p>Selecione um projeto fictício ou simule uma contratação a partir do CRM. Cada projeto mantém evidências, avaliações e ações independentes durante esta sessão.</p><div className={styles.fields}><label>Etapa do método<select value={project.stage} onChange={e=>updateProject(p=>({...p,stage:Number(e.target.value)}))}>{method.map((m,i)=><option key={m} value={i}>{m}</option>)}</select></label><label>Responsável<select value={project.owner} onChange={e=>updateProject(p=>({...p,owner:e.target.value}))}>{["A definir","Atendimento","Pesquisa","Produção","Equipe"].map(o=><option key={o}>{o}</option>)}</select></label><label>Prazo previsto<input type="date" value={project.due} onChange={e=>updateProject(p=>({...p,due:e.target.value}))}/></label></div><div className={styles.stepRail}>{method.map((m,i)=><button key={m} data-current={project.stage===i} onClick={()=>updateProject(p=>({...p,stage:i}))}>{i+1}. {m}</button>)}</div><button className={styles.primaryButton} onClick={()=>setView("diagnostic")}>Abrir diagnóstico ↗</button></section>}
        {view==="diagnostic" && <section className={styles.panel}><small>05 / DIAGNÓSTICO</small><h2>Registro de evidências</h2><p>Separe fatos observados, relatos e hipóteses. A revisão confirma o registro, não transforma automaticamente um relato em fato. Use apenas exemplos inventados.</p><div className={styles.fields}><label>Pilar<select value={draft.pillar} onChange={e=>setDraft({...draft,pillar:Number(e.target.value)})}>{pillars.map((p,i)=><option key={p} value={i}>{p}</option>)}</select></label><label>Tipo<select value={draft.kind} onChange={e=>setDraft({...draft,kind:e.target.value})}>{["Fato observado","Relato","Hipótese"].map(k=><option key={k}>{k}</option>)}</select></label><label>Fonte fictícia<input value={draft.source} maxLength={120} onChange={e=>setDraft({...draft,source:e.target.value})} placeholder="Ex.: entrevista simulada"/></label><label>Registro<textarea value={draft.statement} maxLength={500} onChange={e=>setDraft({...draft,statement:e.target.value})} placeholder="Descreva a observação ou hipótese fictícia"/></label></div><button className={styles.primaryButton} disabled={!draft.source.trim()||!draft.statement.trim()} onClick={addEvidence}>Adicionar registro</button><div className={styles.recordList}>{project.evidence.length===0&&<p>Nenhum registro neste projeto.</p>}{project.evidence.map(e=><article key={e.id}><small>{pillars[e.pillar]} · {e.kind} · {e.source}</small><h3>{e.statement}</h3><label className={styles.check}><input type="checkbox" checked={e.verified} onChange={event=>{const checked=event.target.checked;updateProject(p=>({...p,evidence:p.evidence.map(x=>x.id===e.id?{...x,verified:checked}:x),scores:checked?p.scores:Object.fromEntries(Object.entries(p.scores).filter(([,s])=>s.evidenceId!==e.id))}));}}/> Registro revisado por humano (simulação)</label></article>)}</div><button className={styles.smallButton} onClick={()=>setView("radar")}>Abrir Radar Blinko ↗</button></section>}
        {view==="radar" && <section className={styles.panel}><small>06 / RADAR BLINKO</small><h2>Maturidade organizacional</h2><p>Escala experimental de 0 a 4. Cada nota exige uma evidência revisada do mesmo pilar. Dados ausentes não equivalem a zero.</p><div className={styles.result}><small>Média dos pilares avaliados · {validScores.length}/10</small><strong>{maturity===null?"Sem avaliação":maturity+"%"}</strong><p>{validScores.length===10?"Cobertura completa nesta simulação.":"Resultado parcial; não representa a maturidade de toda a organização."}</p></div><div className={styles.radarRows}>{pillars.map((name,i)=>{const options=verified.filter(e=>e.pillar===i);const score=project.scores[i];return <div key={name}><strong>{name}</strong><label>Evidência de apoio<select aria-label={"Evidência de apoio · "+name} value={score?.evidenceId??""} onChange={e=>{const val=Number(e.target.value);updateProject(p=>{const next={...p.scores};if(!e.target.value)delete next[i];else next[i]={value:next[i]?.evidenceId===val?next[i].value:-1,evidenceId:val};return {...p,scores:next};});}}><option value="">Não avaliado</option>{options.map(e=><option key={e.id} value={e.id}>{e.source}: {e.statement.slice(0,60)}</option>)}</select></label><label>Nota<select aria-label={"Nota · "+name} disabled={!score} value={score&&score.value>=0?score.value:""} onChange={e=>updateProject(p=>({...p,scores:{...p.scores,[i]:{...p.scores[i],value:e.target.value===""?-1:Number(e.target.value)}}}))}><option value="">—</option>{ratings.map((v,j)=><option key={v} value={j}>{j} · {v}</option>)}</select></label><div className={styles.meter} aria-label={score&&score.value>=0?String(score.value*25)+"%":"Não avaliado"}><span style={{width:score&&score.value>=0?score.value*25+"%":"0%"}}/></div></div>})}</div></section>}
        {view==="plan" && <section className={styles.panel}><small>08 / DIRECIONAMENTO</small><h2>Plano de ação</h2><p>Relacione a ação a um registro revisado. A prioridade usa a pontuação atual da matriz GUT ({priority}/125), como referência provisória, não como decisão automática.</p><div className={styles.fields}><label>Ação fictícia<input maxLength={160} value={actionDraft.title} onChange={e=>setActionDraft({...actionDraft,title:e.target.value})}/></label><label>Evidência de apoio<select aria-label="Evidência de apoio" value={actionDraft.evidenceId} onChange={e=>setActionDraft({...actionDraft,evidenceId:e.target.value})}><option value="">Selecione</option>{verified.map(e=><option key={e.id} value={e.id}>{pillars[e.pillar]} · {e.statement.slice(0,65)}</option>)}</select></label><label>Responsável<select aria-label="Responsável" value={actionDraft.owner} onChange={e=>setActionDraft({...actionDraft,owner:e.target.value})}>{["A definir","Atendimento","Pesquisa","Produção","Equipe"].map(o=><option key={o}>{o}</option>)}</select></label><label>Prazo<input type="date" value={actionDraft.due} onChange={e=>setActionDraft({...actionDraft,due:e.target.value})}/></label></div><button className={styles.primaryButton} disabled={!actionDraft.title.trim()||!verified.some(e=>e.id===Number(actionDraft.evidenceId))} onClick={addAction}>Adicionar ação</button><div className={styles.recordList}>{project.actions.length===0&&<p>Nenhuma ação registrada.</p>}{[...project.actions].sort((a,b)=>Number(a.done)-Number(b.done)||b.gut-a.gut).map(a=><article key={a.id}><small>GUT {a.gut}/125 · {a.owner} · {a.due||"Sem prazo"}</small><h3>{a.title}</h3>{!verified.some(e=>e.id===a.evidenceId)&&<p>Atenção: evidência de apoio precisa de nova revisão.</p>}<label className={styles.check}><input type="checkbox" checked={a.done} onChange={e=>{const done=e.target.checked;updateProject(p=>({...p,actions:p.actions.map(x=>x.id===a.id?{...x,done}:x)}));}}/> Concluída</label></article>)}</div></section>}
        {view==="agenda" && <section className={styles.panel}><small>09 / AGENDA</small><h2>Compromissos e prazos</h2><p>Agenda do projeto ativo. Inclui reuniões, visitas e prazos do plano de ação. Não envia lembretes nem sincroniza calendários.</p><div className={styles.fields}><label>Compromisso fictício<input maxLength={120} value={eventDraft.title} onChange={e=>setEventDraft({...eventDraft,title:e.target.value})}/></label><label>Tipo<select aria-label="Tipo de compromisso" value={eventDraft.kind} onChange={e=>setEventDraft({...eventDraft,kind:e.target.value})}>{["Reunião","Entrevista","Visita","Entrega","Revisão"].map(k=><option key={k}>{k}</option>)}</select></label><label>Data<input type="date" value={eventDraft.date} onChange={e=>setEventDraft({...eventDraft,date:e.target.value})}/></label></div><button className={styles.primaryButton} disabled={!eventDraft.title.trim()||!eventDraft.date} onClick={addEvent}>Adicionar compromisso</button><div className={styles.recordList}>{project.due&&<article><small>PRAZO DO PROJETO · {dateLabel(project.due)}</small><h3>{project.company}</h3></article>}{[...project.appointments.map(a=>({...a,origin:"event" as const})),...project.actions.filter(a=>a.due).map(a=>({id:a.id,title:a.title,date:a.due,kind:"Plano de ação",done:a.done,origin:"action" as const}))].sort((a,b)=>a.date.localeCompare(b.date)).map(a=><article key={a.origin+a.id}><small>{dateLabel(a.date)} · {a.kind}</small><h3>{a.title}</h3><label className={styles.check}><input type="checkbox" checked={a.done} onChange={e=>{const done=e.target.checked;updateProject(p=>a.origin==="event"?{...p,appointments:p.appointments.map(x=>x.id===a.id?{...x,done}:x)}:{...p,actions:p.actions.map(x=>x.id===a.id?{...x,done}:x)});}}/> Concluído</label></article>)}{!project.due&&!project.appointments.length&&!project.actions.some(a=>a.due)&&<p>Nenhum compromisso ou prazo registrado.</p>}</div></section>}
        {view==="report" && <section className={styles.panel}><small>10 / DOCUMENTOS</small><h2>Relatório diagnóstico</h2><p>Compilação dos registros do projeto, sem IA generativa. A síntese e a aprovação são humanas. Não inclui dados financeiros internos.</p><label>Síntese e recomendações (exemplo fictício)<textarea maxLength={3000} value={reportNote[project.id]||""} onChange={e=>{invalidateReview(project.id);setReportNote(old=>({...old,[project.id]:e.target.value}));}}/></label><div className={styles.reportPreview} id="lab-print-report"><header className={styles.reportCover}><div><small>BLINKO · DIAGNÓSTICO ORGANIZACIONAL</small><h2>{project.company}</h2><p>{reviewStatus} · Material exclusivamente fictício</p></div><span aria-hidden="true">b*</span></header><div className={styles.reportMetrics}><div><small>COBERTURA</small><strong>{validScores.length}/10</strong></div><div><small>MATURIDADE PARCIAL</small><strong>{maturity===null?"—":maturity+"%"}</strong></div><div><small>AÇÕES</small><strong>{project.actions.length}</strong></div></div><div className={styles.reportBody}><pre>{reportText}</pre></div></div><div className={styles.buttonRow}><button className={styles.primaryButton} onClick={()=>window.print()}>Imprimir / salvar PDF</button><button className={styles.smallButton} onClick={downloadReport}>Baixar TXT</button><button className={styles.smallButton} onClick={()=>setView("review")}>Revisar relatório ↗</button></div>{exportNotice&&<p role="status">{exportNotice}</p>}</section>}
        {view==="finance" && <section className={styles.panel}><small>11 / FINANCEIRO</small><h2>Movimentações do projeto</h2><p>Simulação de receitas e despesas. Previsto não é caixa realizado. Não é contabilidade, distribuição de lucro ou cobrança real.</p><div className={styles.financeGrid}>{[["Receitas previstas",financeTotal("income")],["Despesas previstas",financeTotal("expense")],["Saldo realizado",financeTotal("income",true)-financeTotal("expense",true)],["Saldo previsto",financeTotal("income")-financeTotal("expense")]].map(([name,value])=><article key={name}><small>{name}</small><strong>{currency(Number(value))}</strong></article>)}</div><div className={styles.fields}><label>Descrição fictícia<input maxLength={120} value={moneyDraft.label} onChange={e=>setMoneyDraft({...moneyDraft,label:e.target.value})}/></label><label>Natureza<select aria-label="Natureza" value={moneyDraft.kind} onChange={e=>setMoneyDraft({...moneyDraft,kind:e.target.value as Ledger["kind"]})}><option value="income">Receita</option><option value="expense">Despesa</option></select></label><label>Valor (R$)<input type="number" min=".01" max="100000000" step=".01" value={moneyDraft.amount} onChange={e=>setMoneyDraft({...moneyDraft,amount:e.target.value})}/></label><label>Vencimento<input type="date" value={moneyDraft.date} onChange={e=>setMoneyDraft({...moneyDraft,date:e.target.value})}/></label></div><button className={styles.primaryButton} disabled={!validMoney} onClick={addMoney}>Adicionar lançamento previsto</button><div className={styles.recordList}>{!project.ledger.length&&<p>Nenhuma movimentação neste projeto.</p>}{[...project.ledger].sort((a,b)=>a.date.localeCompare(b.date)).map(x=><article key={x.id}><small>{x.kind==="income"?"Receita":"Despesa"} · {dateLabel(x.date)}</small><h3>{x.label} · {currency(x.cents/100)}</h3><label className={styles.check}><input type="checkbox" checked={x.settled} onChange={e=>{const settled=e.target.checked;updateProject(p=>({...p,ledger:p.ledger.map(y=>y.id===x.id?{...y,settled}:y)}));}}/> {x.kind==="income"?"Recebido":"Pago"} (simulação)</label></article>)}</div></section>}
        {view==="review" && <section className={styles.panel}><small>12 / CONTROLE DE QUALIDADE</small><h2>Central de revisão humana</h2><p>Verificações automáticas de consistência, não avaliação profissional nem IA. A revisão é simulada, restrita ao projeto ativo. Alterar registros relevantes invalida a revisão anterior.</p><div className={styles.result}><small>STATUS DA ENTREGA</small><strong>{reviewStatus}</strong><p>{blockers.length?blockers.length+" critérios pendentes":"Critérios mínimos preenchidos. A avaliação do conteúdo continua humana."}</p></div><div className={styles.recordList}>{blockers.map((item,i)=><article key={item}><small>PENDÊNCIA {String(i+1).padStart(2,"0")}</small><h3>{item}</h3></article>)}{!blockers.length&&<article><small>VERIFICAÇÕES CONCLUÍDAS</small><h3>Conferir coerência, fundamentação, limitações e adequação das recomendações antes de registrar o parecer.</h3></article>}</div><div className={styles.buttonRow}>{(["diagnostic","radar","plan","report"] as const).map(v=><button className={styles.smallButton} key={v} onClick={()=>setView(v)}>{views.find(x=>x[0]===v)?.[1]} ↗</button>)}</div><label>Parecer humano fictício<textarea maxLength={1500} value={reviewNotes[project.id]||""} onChange={e=>{invalidateReview(project.id);setReviewNotes(old=>({...old,[project.id]:e.target.value}));}} placeholder="Limitações, correções e conclusão da revisão"/></label><div className={styles.buttonRow}><button className={styles.primaryButton} disabled={blockers.length>0||reviewed} onClick={()=>setReviewSnapshots(old=>({...old,[project.id]:reviewKey}))}>Registrar revisão simulada</button>{reviewSnapshots[project.id]&&<button className={styles.smallButton} onClick={()=>invalidateReview(project.id)}>Revogar revisão</button>}</div></section>}
        {view==="intake" && <section className={styles.panel}><small>13 / INTEGRAÇÃO SIMULADA</small><h2>Da triagem ao CRM</h2><p>Teste local com um único contato fictício fixo. Não utiliza formulário público, dados pessoais, banco ou WhatsApp. A versão real ainda exige sessão de envio segura, consentimento, limites de requisições e testes HTTP.</p><div className={styles.recordList}><article><small>01 / CONTATO</small><h3>Empresa fictícia D</h3><label className={styles.check}><input type="checkbox" checked={intakeConsent} onChange={e=>setIntakeConsent(e.target.checked)}/> Simular consentimento explícito</label><div className={styles.buttonRow}><button className={styles.primaryButton} onClick={()=>runIntake("start")}>Simular início ou reenvio</button></div></article><article><small>02 / NECESSIDADE</small><label>Desafio fictício<select value={intakeChallenge} onChange={e=>setIntakeChallenge(e.target.value)}>{["Organização comercial","Comunicação","Processos internos"].map(x=><option key={x}>{x}</option>)}</select></label><div className={styles.buttonRow}><button className={styles.primaryButton} onClick={()=>runIntake("complete")}>Simular conclusão ou reenvio</button></div></article></div><div className={styles.result} aria-live="polite"><small>RESULTADO DO TESTE</small><strong>{intakeRows.length} registro</strong><p>{intakeStatus||"Aguardando simulação."}</p><p>{intakeRows[0]?.stage==="complete"?"Triagem completa":intakeRows.length?"Contato parcial registrado":"Nenhum contato"}{intakeRows[0]?.challenge?" · "+intakeRows[0].challenge:""}</p></div><button className={styles.smallButton} onClick={()=>setView("crm")}>Conferir no CRM ↗</button></section>}
        {view==="intelligence" && <section className={styles.panel}>
          <small>14 / INTELIGÊNCIA DIAGNÓSTICA</small><h2>Investigar antes de concluir.</h2><p>Assistência por regras transparentes, sem IA generativa. Quantidade de fontes não comprova independência nem causalidade. Use somente registros fictícios.</p>
          <div className={styles.intelGrid}>{coverage.map(row=><button className={styles.intelCard} data-current={focusPillar===row.pillar} key={row.pillar} onClick={()=>{setFocusPillar(row.pillar);setHypDraft({cause:"",effect:"",supportId:"",challengeId:""});}}><small>{pillars[row.pillar]}</small><strong>{row.reviewed}</strong><span>{row.sources} fontes identificadas · {row.pending} pendentes</span></button>)}</div>
          <h3>{pillars[focusPillar]} · perguntas para investigar</h3><div className={styles.recordList}>{questions.map(q=><article key={q}><h3>{q}</h3></article>)}</div>
          <h3>Mapa de hipóteses causais</h3><p>Vincule uma possível causa a um efeito observado. Compare registros favoráveis e contrários, sem presumir uma relação verdadeira.</p>
          <div className={styles.fields}><label>Possível causa<textarea maxLength={300} value={hypDraft.cause} onChange={e=>setHypDraft({...hypDraft,cause:e.target.value})}/></label><label>Possível efeito<textarea maxLength={300} value={hypDraft.effect} onChange={e=>setHypDraft({...hypDraft,effect:e.target.value})}/></label><label>Registro favorável<select value={hypDraft.supportId} onChange={e=>setHypDraft({...hypDraft,supportId:e.target.value})}><option value="">Sem evidência ainda</option>{verified.map(e=><option key={e.id} value={e.id}>{pillars[e.pillar]} · {e.source}: {e.statement.slice(0,65)}</option>)}</select></label><label>Registro contrário<select value={hypDraft.challengeId} onChange={e=>setHypDraft({...hypDraft,challengeId:e.target.value})}><option value="">Sem evidência ainda</option>{verified.filter(e=>String(e.id)!==hypDraft.supportId).map(e=><option key={e.id} value={e.id}>{pillars[e.pillar]} · {e.source}: {e.statement.slice(0,65)}</option>)}</select></label></div>
          <button className={styles.primaryButton} disabled={!hypDraft.cause.trim()||!hypDraft.effect.trim()||!!hypDraft.supportId&&hypDraft.supportId===hypDraft.challengeId} onClick={addHypothesis}>Registrar hipótese</button>
          <div className={styles.recordList}>{project.hypotheses.length===0&&<p>Nenhuma hipótese causal registrada neste projeto.</p>}{project.hypotheses.map(h=>{const a=assessHypothesis(h,project.evidence);const patch=(next:Partial<Hypothesis>)=>updateProject(p=>({...p,hypotheses:p.hypotheses.map(x=>x.id===h.id?{...x,...next}:x)}));return <article key={h.id}><small>{pillars[h.pillar]} · {a.status}</small><div className={styles.causeFlow}><div><small>CAUSA POSSÍVEL</small><h3>{h.cause}</h3></div><span aria-hidden="true">→</span><div><small>EFEITO POSSÍVEL</small><h3>{h.effect}</h3></div></div>
          <div className={styles.fields}><label>Registro favorável<select value={h.supportId??""} onChange={e=>patch({supportId:e.target.value?Number(e.target.value):null,decision:"open"})}><option value="">Sem vínculo</option>{h.supportId!==null&&!a.support&&<option value={h.supportId}>Vínculo requer revisão</option>}{verified.filter(e=>e.id!==h.challengeId).map(e=><option key={e.id} value={e.id}>{e.source}: {e.statement.slice(0,65)}</option>)}</select></label><label>Registro contrário<select value={h.challengeId??""} onChange={e=>patch({challengeId:e.target.value?Number(e.target.value):null,decision:"open"})}><option value="">Sem vínculo</option>{h.challengeId!==null&&!a.challenge&&<option value={h.challengeId}>Vínculo requer revisão</option>}{verified.filter(e=>e.id!==h.supportId).map(e=><option key={e.id} value={e.id}>{e.source}: {e.statement.slice(0,65)}</option>)}</select></label></div>
          <p>Favorável: {a.support?a.support.statement:"Não disponível"}.</p><p>Contrário: {a.challenge?a.challenge.statement:"Não disponível"}.</p><label>Parecer humano fictício<textarea maxLength={1000} value={h.rationale} onChange={e=>patch({rationale:e.target.value,decision:"open"})} placeholder="Explique a relação, limitações e alternativas"/></label><div className={styles.buttonRow}><button className={styles.smallButton} onClick={()=>patch({decision:"open"})}>Em investigação</button><button className={styles.primaryButton} disabled={!a.canSupport} onClick={()=>patch({decision:"supported"})}>Sustentar provisoriamente</button><button className={styles.smallButton} disabled={!a.canReject} onClick={()=>patch({decision:"rejected"})}>Refutar</button></div></article>})}</div>
          <button className={styles.smallButton} onClick={()=>setView("diagnostic")}>Registrar novas evidências ↗</button>
        </section>}
        {view==="assist" && <section className={styles.panel}>
          <small>15 / ASSISTÊNCIA INVESTIGATIVA</small><h2>Uma segunda perspectiva.</h2><p>Simulação determinística do futuro assistente de IA. Não conecta modelos externos, não interpreta textos semanticamente e não executa decisões. Cada sugestão mostra as referências elegíveis do pilar.</p>
          <div className={styles.fields}><label>Pilar investigado<select value={focusPillar} onChange={e=>setFocusPillar(Number(e.target.value))}>{pillars.map((p,i)=><option key={p} value={i}>{p}</option>)}</select></label></div>
          <div className={styles.recordList}>{assistSuggestions.map(s=>{const key=suggestionKey(s);const decision=assistDecisions[key];return <article key={key}><small>{decision==="accepted"?"SELECIONADA PARA INVESTIGAÇÃO":decision==="dismissed"?"DESCARTADA":"SUGESTÃO A REVISAR"}</small><h3>{s.question}</h3><p>{s.limitation}</p><div className={styles.sourceList}>{s.sourceIds.length?s.sourceIds.map(id=>{const e=project.evidence.find(x=>x.id===id);return <div key={id}><small>REGISTRO #{id} · {e?.kind}</small><p>{e?.source}: {e?.statement}</p></div>}):<p>Sem referência elegível. Pergunta de coleta, não uma conclusão.</p>}</div><div className={styles.buttonRow}><button className={styles.primaryButton} disabled={decision==="accepted"} onClick={()=>setAssistDecisions(old=>({...old,[key]:"accepted"}))}>Selecionar pergunta</button><button className={styles.smallButton} disabled={decision==="dismissed"} onClick={()=>setAssistDecisions(old=>({...old,[key]:"dismissed"}))}>Descartar</button></div></article>})}</div>
          <p>Selecionar uma pergunta não altera o diagnóstico, as notas ou o plano de ação. Se as referências mudarem, a decisão anterior não é reutilizada.</p><button className={styles.smallButton} onClick={()=>setView("intelligence")}>Voltar à investigação ↗</button>
        </section>}
        {view==="portal" && <section className={styles.panel}>
          <small>16 / ÁREA DO CLIENTE</small><h2>Uma entrega clara e segura.</h2><p>Prévia interna do que poderá ser apresentado ao cliente. Não há publicação, link de compartilhamento, acesso externo ou autenticação real. Use somente informações fictícias.</p>
          <div className={styles.fields}><label>Resumo destinado ao cliente<textarea maxLength={1200} value={portalDraft.summary} onChange={e=>patchPortal({summary:e.target.value})}/></label><label>Próxima etapa comunicada<textarea maxLength={500} value={portalDraft.nextStep} onChange={e=>patchPortal({nextStep:e.target.value})}/></label></div>
          <div className={styles.recordList}><article><label className={styles.check}><input type="checkbox" checked={portalDraft.showMaturity} onChange={e=>patchPortal({showMaturity:e.target.checked})}/> Incluir indicador de maturidade e cobertura</label><label className={styles.check}><input type="checkbox" checked={portalDraft.showActions} onChange={e=>patchPortal({showActions:e.target.checked})}/> Incluir títulos, prazos e estados das ações (conferir confidencialidade)</label></article></div>
          <p>O resumo é redigido pela equipe. Evidências brutas, pareceres, hipóteses internas, nomes de responsáveis, custos, margens e credenciais não são incluídos automaticamente.</p>
          <div className={styles.buttonRow}><button className={styles.primaryButton} disabled={!reviewed||!portalDraft.summary.trim()||!portalDraft.nextStep.trim()||portalVisible} onClick={()=>setPortalApprovals(old=>({...old,[project.id]:portalApprovalKey(portalInput,reviewKey)}))}>Autorizar prévia simulada</button><button className={styles.smallButton} onClick={()=>setView("review")}>Conferir revisão ↗</button>{portalApprovals[project.id]&&<button className={styles.smallButton} onClick={()=>setPortalApprovals(old=>{const next={...old};delete next[project.id];return next})}>Revogar prévia</button>}</div>
          {!portalVisible?<div className={styles.result}><small>PRÉVIA BLOQUEADA</small><strong>Revisão necessária</strong><p>{!reviewed?"Conclua a revisão interna do projeto antes de autorizar a prévia.":"Preencha, confira e autorize o conteúdo destinado ao cliente."}</p></div>:<div className={styles.portalCard}><header className={styles.reportCover}><div><small>BLINKO · ÁREA DO CLIENTE · SIMULAÇÃO</small><h2>{portalData.company}</h2><p>{portalData.stage} · {dateLabel(portalData.due)}</p></div><span aria-hidden="true">b*</span></header><div className={styles.reportBody}><h3>Seu diagnóstico</h3><p>{portalData.summary}</p><h3>Próximos passos</h3><p>{portalData.nextStep}</p>{portalData.maturity&&<div className={styles.result}><small>MATURIDADE · {portalData.maturity.coverage}/10 pilares</small><strong>{portalData.maturity.value===null?"Não avaliado":portalData.maturity.value+"%"}</strong><p>Indicador experimental; não equivale a certificação.</p></div>}{portalData.actions.length>0&&<div className={styles.recordList}><h3>Plano de ação compartilhável</h3>{portalData.actions.map((a,i)=><article key={i}><small>{dateLabel(a.due)} · {a.done?"Concluída":"Em aberto"}</small><h3>{a.title}</h3></article>)}</div>}</div></div>}
        </section>}
        {view==="pilot" && <section className={styles.panel}>
        <small>17 / CLIENTE ZERO</small><h2>Ensaio da operação completa.</h2><p>Empresa fictícia Z: pequeno negócio de serviços com falhas de acompanhamento comercial. Cenário inventado, sem dados reais. Os botões usam os módulos do laboratório, não a API pública.</p>
        <div className={styles.recordList}>
        <article><small>01 / TRIAGEM · {pilotIntake?.stage==="complete"?"CONCLUÍDA":pilotIntake?"PARCIAL":"PENDENTE"}</small><h3>Simular consentimento e entrada no CRM</h3><div className={styles.buttonRow}><button className={styles.primaryButton} disabled={!!pilotIntake} onClick={()=>runPilot("start")}>Iniciar triagem fictícia com consentimento</button><button className={styles.smallButton} disabled={pilotIntake?.stage!=="partial"} onClick={()=>runPilot("complete")}>Completar triagem</button></div></article>
        <article><small>02 / COMERCIAL · {pilotProject?"PROJETO ABERTO":pilotLead?"EM ANDAMENTO":"PENDENTE"}</small><h3>Conduzir atendimento, estimar proposta e simular contratação</h3><p>Use o estimador com valores fictícios (ex.: 40 horas, R$ 30/h, R$ 300 de custos, 8% de taxas, 20% de margem). São parâmetros de ensaio, não preços aprovados. No CRM avance o lead Z até Diagnóstico e abra o projeto.</p><div className={styles.buttonRow}><button className={styles.smallButton} onClick={()=>setView("orcamento")}>Estimador ↗</button><button className={styles.smallButton} onClick={()=>setView("crm")}>CRM ↗</button></div></article>
        <article><small>03 / INVESTIGAÇÃO · {pilotProject?.evidence.length??0} REGISTROS</small><h3>Carregar material fictício para conferência</h3><p>Dez observações não revisadas, uma visita de acompanhamento e duas movimentações previstas. Nenhuma nota, ação ou aprovação é preenchida automaticamente. O carregamento não substitui registros existentes.</p><div className={styles.buttonRow}><button className={styles.primaryButton} disabled={!pilotProject||!pilotCanLoad(pilotProject)} onClick={()=>{if(!pilotProject||!pilotCanLoad(pilotProject))return;const f=pilotFixture();setProjects(old=>old.map(p=>p.id===PILOT_ID?{...p,evidence:f.evidence,appointments:f.appointments,ledger:f.ledger}:p));invalidateReview(PILOT_ID);changeProject(PILOT_ID);setView("diagnostic");}}>Carregar material de ensaio</button><button className={styles.smallButton} disabled={!pilotProject} onClick={()=>{changeProject(PILOT_ID);setView("diagnostic");}}>Revisar evidências ↗</button></div></article>
        {([{view:"radar",n:"04",title:"Avaliar os dez pilares",description:"Vincule evidências revisadas e escolha as notas."},{view:"intelligence",n:"05",title:"Investigar causas",description:"Confronte registros e formule hipóteses provisórias."},{view:"gut",n:"06",title:"Definir criticidade",description:"Avalie gravidade, urgência e tendência."},{view:"plan",n:"07",title:"Criar ações",description:"Exemplo: definir rotina de retorno de contatos, com evidência comercial, responsável e prazo."},{view:"finance",n:"08",title:"Conferir previsto e realizado",description:"Verifique as duas movimentações fictícias."},{view:"agenda",n:"09",title:"Acompanhar compromissos",description:"Confira prazos e reunião simulada."},{view:"report",n:"10",title:"Consolidar relatório",description:"Escreva a síntese humana e confira a impressão."},{view:"review",n:"11",title:"Revisar a entrega",description:"Resolva pendências e registre parecer fictício."},{view:"portal",n:"12",title:"Conferir a visão do cliente",description:"Redija o resumo, autorize a prévia e verifique a revogação."}] as const).map(step=><article key={step.n}><small>{step.n} / ENSAIO MANUAL</small><h3>{step.title}</h3><p>{step.description}</p><button className={styles.smallButton} disabled={!pilotProject} onClick={()=>{changeProject(PILOT_ID);setView(step.view);}}>Abrir etapa ↗</button></article>)}
        </div><p>O roteiro não certifica a execução de todos os passos. Recarregar restaura o laboratório.</p></section>}
        <footer>BLINKO OS · Protótipo 08 · Sem dados reais · Não liberar em produção.</footer>
        </div>
      </div>
    </main>
  );
}
