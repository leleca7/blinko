"use client";

import { useState } from "react";
import styles from "./os-preview.module.css";

const modules = [
  ["Hoje", "Fila de atenção existente", "Revisar integração"],
  ["CRM e triagens", "Oportunidades, WhatsApp e empresas", "Protótipo"],
  ["Clientes e projetos", "Responsáveis, etapas e prazos", "Protótipo"],
  ["Orçamentos", "Custos e precificação personalizada", "Protótipo"],
  ["Diagnósticos", "Entrevistas, hipóteses e evidências", "Protótipo"],
  ["Radar Blinko", "Maturidade por pilar", "Protótipo"],
  ["Criticidade", "Matriz GUT", "Protótipo"],
  ["Documentos", "Rascunho de relatório e exportação", "Protótipo"],
  ["Financeiro", "Fluxo previsto e realizado por projeto", "Protótipo"],
  ["Agenda", "Reuniões, visitas e prazos", "Protótipo"],
  ["Automação", "Assistência e revisão humana", "Planejado"],
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
const views = [["home","Visão geral","01"],["crm","CRM e triagens","02"],["orcamento","Orçamentos","03"],["projects","Projetos","04"],["diagnostic","Diagnóstico","05"],["radar","Radar Blinko","06"],["gut","Criticidade","07"],["plan","Plano de ação","08"],["agenda","Agenda","09"],["report","Documentos","10"],["finance","Financeiro","11"]] as const;
type View = typeof views[number][0];
type Evidence = {id:number; pillar:number; kind:string; source:string; statement:string; verified:boolean};
type Action = {id:number; title:string; owner:string; due:string; evidenceId:number; gut:number; done:boolean};
type Appointment = {id:number;title:string;date:string;kind:string;done:boolean};
type Ledger = {id:number;label:string;date:string;kind:"income"|"expense";cents:number;settled:boolean};
type Project = {id:number; company:string; stage:number; owner:string; due:string; evidence:Evidence[]; scores:Record<number,{value:number;evidenceId:number}>; actions:Action[]; appointments:Appointment[]; ledger:Ledger[]};
const makeProject = (id:number,company:string):Project => ({id,company,stage:0,owner:"A definir",due:"",evidence:[],scores:{},actions:[],appointments:[],ledger:[]});
const currency = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const clean = (n: number) => Number.isFinite(n) ? Math.max(0,n) : 0;

export default function OsPreview() {
  const [view, setView] = useState<View>("home");
  const [leads, setLeads] = useState(initialLeads);
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
  const [eventDraft,setEventDraft] = useState({title:"",date:"",kind:"Reunião"});
  const [moneyDraft,setMoneyDraft] = useState({label:"",date:"",kind:"income" as "income"|"expense",amount:""});
  const [reportNote,setReportNote] = useState<Record<number,string>>({});
  const [exportNotice,setExportNotice] = useState("");
  const project = projects.find(p=>p.id===selected) ?? projects[0];
  const updateProject = (fn:(p:Project)=>Project) => setProjects(old=>old.map(p=>p.id===project.id?fn(p):p));
  const verified = project.evidence.filter(e=>e.verified && e.kind!=="Hipótese");
  const validScores = Object.entries(project.scores).filter(([i,s])=>s.value>=0 && verified.some(e=>e.id===s.evidenceId&&e.pillar===Number(i)));
  const maturity = validScores.length ? Math.round(validScores.reduce((sum,[,s])=>sum+s.value,0)/(4*validScores.length)*100) : null;
  const changeProject = (id:number) => {setSelected(id);setDraft({pillar:0,kind:"Relato",source:"",statement:""});setActionDraft({title:"",owner:"A definir",due:"",evidenceId:""});setEventDraft({title:"",date:"",kind:"Reunião"});setMoneyDraft({label:"",date:"",kind:"income",amount:""});setExportNotice("");};
  const addProject = (id:number,company:string) => {setProjects(old=>old.some(p=>p.id===id)?old:[...old,makeProject(id,company)]);changeProject(id);setView("projects");};
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
    "", "3. MATURIDADE — ESCALA PROVISÓRIA",
    "Cobertura: "+validScores.length+"/10. Média apenas dos pilares avaliados: "+(maturity===null?"Não avaliado":maturity+"%"),
    ...pillars.map((name,i)=>{const s=validScores.find(([key])=>Number(key)===i)?.[1];return name+": "+(s?s.value+"/4 — "+ratings[s.value]:"Não avaliado");}),
    "", "4. PLANO DE AÇÃO", ...[...project.actions].sort((a,b)=>b.gut-a.gut).map(a=>a.title+" | GUT "+a.gut+"/125 | "+a.owner+" | "+dateLabel(a.due)+" | "+(a.done?"Concluída":"Em aberto")+(verified.some(e=>e.id===a.evidenceId)?"":" | ALERTA: evidência requer revisão")),
    "", "5. SÍNTESE HUMANA (RASCUNHO)", reportNote[project.id]||"A preencher.", "", "Revisão e aprovação humanas obrigatórias antes de qualquer uso externo."
  ].join("\n");
  const downloadReport = () => {const url=URL.createObjectURL(new Blob([reportText],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="blinko-relatorio-ficticio-"+project.id+".txt";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setExportNotice("Exportação solicitada ao navegador. Confira seus downloads.");};
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
          <span className={styles.previewTag}>PROTÓTIPO 03</span>
        </header>
        <aside className={styles.notice}>Ambiente experimental · Use somente dados fictícios. Não há conexão ao CRM, envio ou armazenamento. Recarregar restaura a demonstração.</aside>
        {["projects","diagnostic","radar","plan","agenda","report","finance"].includes(view) && <div className={styles.projectBar}><label>Projeto ativo<select value={project.id} onChange={e=>changeProject(Number(e.target.value))}>{projects.map(p=><option key={p.id} value={p.id}>{p.company}</option>)}</select></label><span>{method[project.stage]} · {verified.length} evidências revisadas</span></div>}
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
        <section className={styles.moduleSection} aria-label="Roadmap dos módulos">
          <div className={styles.heading}><h2>Módulos da operação</h2><small>ROADMAP</small></div>
          <div className={styles.modules}>{modules.map(([name,desc,status])=><article key={name}><div><h3>{name}</h3><p>{desc}</p></div><small data-status={status==="Protótipo"?"prototype":"planned"}>{status}</small></article>)}</div>
        </section>
        </>}
        {view==="crm" && <section className={styles.panel} id="crm">
          <div className={styles.heading}><div><small>02 / CRM</small><h2>Pipeline de demonstração</h2></div><button onClick={()=>setLeads(initialLeads)}>Restaurar exemplo</button></div>
          <p>Experimente mover os registros fictícios entre as etapas. Nenhum dado é persistido.</p>
          <div className={styles.pipeline}>
            {stages.map((stage,i)=><div className={styles.column} key={stage}><h3>{stage} <span>{leads.filter(l=>l.stage===i).length}</span></h3>
              {leads.filter(l=>l.stage===i).map(lead=><article key={lead.id} className={styles.lead}><strong>{lead.company}</strong><label>Etapa<select value={lead.stage} onChange={e=>setLeads(old=>old.map(l=>l.id===lead.id?{...l,stage:Number(e.target.value)}:l))}>{stages.map((s,j)=><option key={s} value={j}>{s}</option>)}</select></label>{lead.stage===4&&<button className={styles.smallButton} onClick={()=>addProject(lead.id,lead.company)}>{projects.some(p=>p.id===lead.id)?"Abrir projeto":"Simular contratação e abrir projeto"}</button>}</article>)}
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
        {view==="radar" && <section className={styles.panel}><small>06 / RADAR BLINKO</small><h2>Maturidade organizacional</h2><p>Escala experimental de 0 a 4. Cada nota exige uma evidência revisada do mesmo pilar. Dados ausentes não equivalem a zero.</p><div className={styles.result}><small>Média dos pilares avaliados · {validScores.length}/10</small><strong>{maturity===null?"Sem avaliação":maturity+"%"}</strong><p>{validScores.length===10?"Cobertura completa nesta simulação.":"Resultado parcial; não representa a maturidade de toda a organização."}</p></div><div className={styles.radarRows}>{pillars.map((name,i)=>{const options=verified.filter(e=>e.pillar===i);const score=project.scores[i];return <div key={name}><strong>{name}</strong><label>Evidência de apoio<select value={score?.evidenceId??""} onChange={e=>{const val=Number(e.target.value);updateProject(p=>{const next={...p.scores};if(!e.target.value)delete next[i];else next[i]={value:next[i]?.evidenceId===val?next[i].value:-1,evidenceId:val};return {...p,scores:next};});}}><option value="">Não avaliado</option>{options.map(e=><option key={e.id} value={e.id}>{e.source}: {e.statement.slice(0,60)}</option>)}</select></label><label>Nota<select disabled={!score} value={score&&score.value>=0?score.value:""} onChange={e=>updateProject(p=>({...p,scores:{...p.scores,[i]:{...p.scores[i],value:e.target.value===""?-1:Number(e.target.value)}}}))}><option value="">—</option>{ratings.map((v,j)=><option key={v} value={j}>{j} · {v}</option>)}</select></label><div className={styles.meter} aria-label={score&&score.value>=0?String(score.value*25)+"%":"Não avaliado"}><span style={{width:score&&score.value>=0?score.value*25+"%":"0%"}}/></div></div>})}</div></section>}
        {view==="plan" && <section className={styles.panel}><small>08 / DIRECIONAMENTO</small><h2>Plano de ação</h2><p>Relacione a ação a um registro revisado. A prioridade usa a pontuação atual da matriz GUT ({priority}/125), como referência provisória, não como decisão automática.</p><div className={styles.fields}><label>Ação fictícia<input maxLength={160} value={actionDraft.title} onChange={e=>setActionDraft({...actionDraft,title:e.target.value})}/></label><label>Evidência de apoio<select value={actionDraft.evidenceId} onChange={e=>setActionDraft({...actionDraft,evidenceId:e.target.value})}><option value="">Selecione</option>{verified.map(e=><option key={e.id} value={e.id}>{pillars[e.pillar]} · {e.statement.slice(0,65)}</option>)}</select></label><label>Responsável<select value={actionDraft.owner} onChange={e=>setActionDraft({...actionDraft,owner:e.target.value})}>{["A definir","Atendimento","Pesquisa","Produção","Equipe"].map(o=><option key={o}>{o}</option>)}</select></label><label>Prazo<input type="date" value={actionDraft.due} onChange={e=>setActionDraft({...actionDraft,due:e.target.value})}/></label></div><button className={styles.primaryButton} disabled={!actionDraft.title.trim()||!verified.some(e=>e.id===Number(actionDraft.evidenceId))} onClick={addAction}>Adicionar ação</button><div className={styles.recordList}>{project.actions.length===0&&<p>Nenhuma ação registrada.</p>}{[...project.actions].sort((a,b)=>Number(a.done)-Number(b.done)||b.gut-a.gut).map(a=><article key={a.id}><small>GUT {a.gut}/125 · {a.owner} · {a.due||"Sem prazo"}</small><h3>{a.title}</h3>{!verified.some(e=>e.id===a.evidenceId)&&<p>Atenção: evidência de apoio precisa de nova revisão.</p>}<label className={styles.check}><input type="checkbox" checked={a.done} onChange={e=>{const done=e.target.checked;updateProject(p=>({...p,actions:p.actions.map(x=>x.id===a.id?{...x,done}:x)}));}}/> Concluída</label></article>)}</div></section>}
        {view==="agenda" && <section className={styles.panel}><small>09 / AGENDA</small><h2>Compromissos e prazos</h2><p>Agenda do projeto ativo. Inclui reuniões, visitas e prazos do plano de ação. Não envia lembretes nem sincroniza calendários.</p><div className={styles.fields}><label>Compromisso fictício<input maxLength={120} value={eventDraft.title} onChange={e=>setEventDraft({...eventDraft,title:e.target.value})}/></label><label>Tipo<select value={eventDraft.kind} onChange={e=>setEventDraft({...eventDraft,kind:e.target.value})}>{["Reunião","Entrevista","Visita","Entrega","Revisão"].map(k=><option key={k}>{k}</option>)}</select></label><label>Data<input type="date" value={eventDraft.date} onChange={e=>setEventDraft({...eventDraft,date:e.target.value})}/></label></div><button className={styles.primaryButton} disabled={!eventDraft.title.trim()||!eventDraft.date} onClick={addEvent}>Adicionar compromisso</button><div className={styles.recordList}>{project.due&&<article><small>PRAZO DO PROJETO · {dateLabel(project.due)}</small><h3>{project.company}</h3></article>}{[...project.appointments.map(a=>({...a,origin:"event" as const})),...project.actions.filter(a=>a.due).map(a=>({id:a.id,title:a.title,date:a.due,kind:"Plano de ação",done:a.done,origin:"action" as const}))].sort((a,b)=>a.date.localeCompare(b.date)).map(a=><article key={a.origin+a.id}><small>{dateLabel(a.date)} · {a.kind}</small><h3>{a.title}</h3><label className={styles.check}><input type="checkbox" checked={a.done} onChange={e=>{const done=e.target.checked;updateProject(p=>a.origin==="event"?{...p,appointments:p.appointments.map(x=>x.id===a.id?{...x,done}:x)}:{...p,actions:p.actions.map(x=>x.id===a.id?{...x,done}:x)});}}/> Concluído</label></article>)}{!project.due&&!project.appointments.length&&!project.actions.some(a=>a.due)&&<p>Nenhum compromisso ou prazo registrado.</p>}</div></section>}
        {view==="report" && <section className={styles.panel}><small>10 / DOCUMENTOS</small><h2>Rascunho do relatório</h2><p>Compilação automática dos registros do projeto, sem IA generativa. A síntese e a aprovação são humanas. Não inclui dados financeiros internos.</p><label>Síntese e recomendações (exemplo fictício)<textarea maxLength={3000} value={reportNote[project.id]||""} onChange={e=>setReportNote(old=>({...old,[project.id]:e.target.value}))}/></label><div className={styles.reportPreview}><pre>{reportText}</pre></div><button className={styles.primaryButton} onClick={downloadReport}>Baixar rascunho TXT ↗</button>{exportNotice&&<p role="status">{exportNotice}</p>}</section>}
        {view==="finance" && <section className={styles.panel}><small>11 / FINANCEIRO</small><h2>Movimentações do projeto</h2><p>Simulação de receitas e despesas. Previsto não é caixa realizado. Não é contabilidade, distribuição de lucro ou cobrança real.</p><div className={styles.financeGrid}>{[["Receitas previstas",financeTotal("income")],["Despesas previstas",financeTotal("expense")],["Saldo realizado",financeTotal("income",true)-financeTotal("expense",true)],["Saldo previsto",financeTotal("income")-financeTotal("expense")]].map(([name,value])=><article key={name}><small>{name}</small><strong>{currency(Number(value))}</strong></article>)}</div><div className={styles.fields}><label>Descrição fictícia<input maxLength={120} value={moneyDraft.label} onChange={e=>setMoneyDraft({...moneyDraft,label:e.target.value})}/></label><label>Natureza<select value={moneyDraft.kind} onChange={e=>setMoneyDraft({...moneyDraft,kind:e.target.value as Ledger["kind"]})}><option value="income">Receita</option><option value="expense">Despesa</option></select></label><label>Valor (R$)<input type="number" min=".01" max="100000000" step=".01" value={moneyDraft.amount} onChange={e=>setMoneyDraft({...moneyDraft,amount:e.target.value})}/></label><label>Vencimento<input type="date" value={moneyDraft.date} onChange={e=>setMoneyDraft({...moneyDraft,date:e.target.value})}/></label></div><button className={styles.primaryButton} disabled={!validMoney} onClick={addMoney}>Adicionar lançamento previsto</button><div className={styles.recordList}>{!project.ledger.length&&<p>Nenhuma movimentação neste projeto.</p>}{[...project.ledger].sort((a,b)=>a.date.localeCompare(b.date)).map(x=><article key={x.id}><small>{x.kind==="income"?"Receita":"Despesa"} · {dateLabel(x.date)}</small><h3>{x.label} · {currency(x.cents/100)}</h3><label className={styles.check}><input type="checkbox" checked={x.settled} onChange={e=>{const settled=e.target.checked;updateProject(p=>({...p,ledger:p.ledger.map(y=>y.id===x.id?{...y,settled}:y)}));}}/> {x.kind==="income"?"Recebido":"Pago"} (simulação)</label></article>)}</div></section>}
        <footer>BLINKO OS · Protótipo 03 · Sem dados reais · Não liberar em produção.</footer>
        </div>
      </div>
    </main>
  );
}
