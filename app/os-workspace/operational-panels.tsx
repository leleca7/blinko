"use client";
import {useEffect,useState} from "react";
import {createLabClient,labErrorMessage,type LabEvidence,type LabOperations} from "../../lib/os-lab/client";
import type {LabOperation} from "../../lib/os-lab/operations";
import styles from "../os-preview/os-preview.module.css";
const api=createLabClient();
const pillars=["Estratégia","Administração","Pessoas","Financeiro","Comercial","Marketing","Marca","Relacionamentos","Experiência","Operação"];
const owners=["Atendimento","Pesquisa","Produção","Equipe"];
type Props={projectId:string;evidence:LabEvidence[];revision:number;mutate:(op:LabOperation,success?:()=>void)=>Promise<void>};
const date=(v:string)=>v?v.slice(0,10).split("-").reverse().join("/"):"Sem prazo";
const field=(f:FormData,k:string)=>String(f.get(k)??"");
const amount=(cents:string)=>{if(!/^\d+$/.test(cents))return "Indisponível";const n=BigInt(cents);return "R$ "+(n/BigInt(100)).toLocaleString("pt-BR")+","+String(n%BigInt(100)).padStart(2,"0");};
export default function OperationalPanels({projectId,evidence,revision,mutate}:Props){
 const [data,setData]=useState<LabOperations|null>(null);
 const [error,setError]=useState("");
 const [focus,setFocus]=useState(0);
 const [gravity,setGravity]=useState(3),[urgency,setUrgency]=useState(3),[tendency,setTendency]=useState(3);
 const [editing,setEditing]=useState("");
 useEffect(()=>{
  const controller=new AbortController();
  setData(null);setError("");
  api.operations(projectId,controller.signal).then(d=>{
   if(controller.signal.aborted)return;
   if(!d||!Array.isArray(d.scores)||!Array.isArray(d.actions)||!Array.isArray(d.appointments)||!Array.isArray(d.hypotheses)||!(d.finance===null||d.finance&&Array.isArray(d.finance.entries)&&d.finance.totals))throw Error("Invalid operations");
   setData(d);
  }).catch(e=>{if(!controller.signal.aborted)setError(labErrorMessage(e));});
  return ()=>controller.abort();
 },[projectId,revision]);
 if(!data)return <section className={styles.panel}><h2>Operação do projeto</h2><p role="status">{error||"Consultando avaliações e atividades…"}</p></section>;
 const eligible=evidence.filter(e=>e.reviewed&&e.kind!=="hypothesis");
 const valid=data.scores.filter(s=>s.eligible);
 const maturity=valid.length?Math.round(valid.reduce((a,b)=>a+b.value,0)/(4*valid.length)*100):null;
 const current=data.scores.find(s=>s.pillar===focus);
 const hypothesis=data.hypotheses.find(h=>h.id===editing);
 return <>
 <section className={styles.panel}><small>04 · RADAR</small><h2>Maturidade</h2>
 <p>{valid.length}/10 pilares avaliados · {maturity===null?"Sem indicador":maturity+"% de maturidade nos pilares válidos"}.</p>
 <div className={styles.intelGrid}>{pillars.map((name,i)=>{const s=data.scores.find(x=>x.pillar===i);return <button type="button" key={i} className={styles.intelCard} data-current={focus===i} onClick={()=>setFocus(i)}><small>{name}</small><strong>{s?.eligible?s.value+"/4":"—"}</strong><span>{s?(s.eligible?"Avaliado":"Revalidação necessária"):"Não avaliado"}</span></button>;})}</div>
 <form key={focus+":"+revision} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);mutate({type:"score",projectId,pillar:focus,value:Number(f.get("value")),evidenceId:field(f,"evidence")});}}>
 <p>Selecionado: <strong>{pillars[focus]}</strong>. Uma nota zero é uma avaliação explícita, não ausência de dados.</p>
 <label>Evidência de apoio<select name="evidence" required defaultValue={current?.eligible?current.evidence_id:""}><option value="">Selecione</option>{eligible.filter(e=>e.pillar===focus).map(e=><option key={e.id} value={e.id}>{e.summary}</option>)}</select></label>
 <label>Nota<select name="value" defaultValue={current?.eligible?current.value:2}>{["Inexistente","Inicial","Em estruturação","Consistente","Consolidado"].map((n,i)=><option key={i} value={i}>{i} · {n}</option>)}</select></label>
 <button type="submit" disabled={!eligible.some(e=>e.pillar===focus)}>Salvar avaliação</button></form>
 </section>
 <section className={styles.panel}><small>05 · PLANO DE AÇÃO</small><h2>Prioridades e execução</h2><p>Gravidade × urgência × tendência = {gravity*urgency*tendency}/125.</p>
 <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const form=e.currentTarget;mutate({type:"action",id:crypto.randomUUID(),projectId,evidenceId:field(f,"evidence"),title:field(f,"title"),owner:field(f,"owner"),due:field(f,"due"),gravity,urgency,tendency},()=>form.reset());}}>
 <label>Ação<input name="title" maxLength={160} required/></label><label>Evidência<select name="evidence" required><option value="">Selecione</option>{eligible.map(e=><option key={e.id} value={e.id}>{e.summary}</option>)}</select></label>
 <div className={styles.fields}>{([["Gravidade",gravity,setGravity],["Urgência",urgency,setUrgency],["Tendência",tendency,setTendency]] as const).map(([name,value,set])=><label key={String(name)}>{String(name)} · {Number(value)}<input type="range" min={1} max={5} value={Number(value)} onChange={e=>(set as (v:number)=>void)(Number(e.target.value))}/></label>)}</div>
 <label>Responsável<select name="owner" required><option value="">Selecione</option>{owners.map(o=><option key={o}>{o}</option>)}</select></label><label>Prazo<input name="due" type="date" required/></label><button type="submit" disabled={!eligible.length}>Criar ação</button></form>
 {data.actions.map(a=><article className={styles.lead} key={a.id}><strong>{a.title}</strong><p>{a.owner_label} · {date(a.due_on)} · GUT {a.gut}/125 · {a.done?"Concluída":"Em aberto"}</p>{!a.eligible&&<><p>Evidência desatualizada. Revalidação necessária. A ação será reaberta.</p><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);mutate({type:"action_revalidate",id:a.id,evidenceId:field(f,"evidence"),reason:field(f,"reason")});}}><label>Evidência atual<select name="evidence" required><option value="">Selecione</option>{eligible.map(e=><option key={e.id} value={e.id}>{e.summary}</option>)}</select></label><label>Motivo da revalidação<input name="reason" required maxLength={500}/></label><button type="submit" disabled={!eligible.length}>Revalidar e reabrir ação</button></form></>}<button disabled={!a.eligible&&!a.done} onClick={()=>mutate({type:"completion",id:a.id,done:!a.done})}>{a.done?"Reabrir ação":"Concluir ação"}</button></article>)}
 </section>
 <section className={styles.panel}><small>06 · AGENDA</small><h2>Compromissos e prazos</h2><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const form=e.currentTarget;mutate({type:"appointment",id:crypto.randomUUID(),projectId,title:field(f,"title"),kind:field(f,"kind"),due:field(f,"due")},()=>form.reset());}}>
 <label>Compromisso<input name="title" required maxLength={120}/></label><label>Tipo<select name="kind">{["Reunião","Entrevista","Visita","Entrega","Revisão"].map(k=><option key={k}>{k}</option>)}</select></label><label>Data<input type="date" name="due" required/></label><button type="submit">Registrar compromisso</button></form>
 {[...data.appointments.map(a=>({...a,source:"appointment" as const,eligible:true})),...data.actions.map(a=>({...a,kind:"Plano de ação",source:"action" as const}))].sort((a,b)=>a.due_on.localeCompare(b.due_on)).map(a=><article key={a.source+a.id} className={styles.lead}><strong>{a.title}</strong><p>{a.kind} · {date(a.due_on)} · {a.done?"Concluído":"Em aberto"}</p><button disabled={!a.eligible&&!a.done} onClick={()=>mutate(a.source==="action"?{type:"completion",id:a.id,done:!a.done}:{type:"appointment_done",id:a.id,done:!a.done})}>{a.done?"Reabrir":"Concluir"}</button></article>)}
 </section>
 <section className={styles.panel}><small>07 · INTELIGÊNCIA</small><h2>Hipóteses investigativas</h2><p>O parecer humano não constitui prova de causalidade. Referências desatualizadas exigem nova análise.</p>
 <form key={editing+":"+revision} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const form=e.currentTarget;mutate({type:"hypothesis_save",id:hypothesis?.id??crypto.randomUUID(),projectId,pillar:Number(f.get("pillar")),cause:field(f,"cause"),effect:field(f,"effect"),supportId:field(f,"support")||null,challengeId:field(f,"challenge")||null,decision:field(f,"decision") as "open"|"supported"|"rejected",rationale:field(f,"rationale")},()=>{form.reset();setEditing("");});}}>
 <label>Pilar<select name="pillar" defaultValue={hypothesis?.pillar??0}>{pillars.map((p,i)=><option key={i} value={i}>{p}</option>)}</select></label>
 <label>Possível causa<input name="cause" defaultValue={hypothesis?.cause??""} maxLength={500} required/></label><label>Efeito observado<input name="effect" defaultValue={hypothesis?.effect??""} maxLength={500} required/></label>
 <label>Evidência favorável<select name="support" defaultValue={hypothesis?.support_id??""}><option value="">Nenhuma</option>{eligible.map(e=><option key={e.id} value={e.id}>{e.summary}</option>)}</select></label><label>Evidência contrária<select name="challenge" defaultValue={hypothesis?.challenge_id??""}><option value="">Nenhuma</option>{eligible.map(e=><option key={e.id} value={e.id}>{e.summary}</option>)}</select></label>
 <label>Parecer<select name="decision" defaultValue="open"><option value="open">Em investigação</option><option value="supported">Sustentada provisoriamente</option><option value="rejected">Refutada na revisão</option></select></label><label>Justificativa<input name="rationale" maxLength={500} defaultValue={hypothesis?.rationale??""}/></label><button type="submit">Salvar hipótese</button>{editing&&<button type="button" onClick={()=>setEditing("")}>Cancelar edição</button>}</form>
 {data.hypotheses.map(h=><article key={h.id} className={styles.lead}><strong>{h.cause} → {h.effect}</strong><p>{h.stale?"Revisão necessária":h.decision==="supported"?"Sustentada provisoriamente":h.decision==="rejected"?"Refutada":"Em investigação"} · {h.rationale}</p><button onClick={()=>setEditing(h.id)}>Revisar hipótese</button></article>)}
 </section>
 <section className={styles.panel}><small>08 · FINANCEIRO</small><h2>Previsto e realizado</h2>{data.finance===null?<p>Seu perfil não possui acesso financeiro a este projeto.</p>:<>
 <div className={styles.quickGrid}>{[["Receitas previstas",data.finance.totals.planned_income],["Despesas previstas",data.finance.totals.planned_expense],["Receitas realizadas",data.finance.totals.realized_income],["Despesas realizadas",data.finance.totals.realized_expense]].map(([label,value])=><div key={label} className={styles.quick}><small>{label}</small><strong>{amount(value)}</strong></div>)}</div>
 <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const form=e.currentTarget;const raw=field(f,"amount").replace(",",".");if(!/^\d+(\.\d{1,2})?$/.test(raw))return;const [whole,fraction=""]=raw.split(".");const cents=Number(whole)*100+Number(fraction.padEnd(2,"0"));if(!Number.isSafeInteger(cents)||cents<=0||cents>10000000000)return;mutate({type:"ledger",id:crypto.randomUUID(),projectId,label:field(f,"label"),kind:field(f,"kind") as "income"|"expense",cents,due:field(f,"due")},()=>form.reset());}}>
 <label>Descrição<input name="label" required maxLength={120}/></label><label>Natureza<select name="kind"><option value="income">Receita</option><option value="expense">Despesa</option></select></label><label>Valor em reais<input name="amount" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" required/></label><label>Vencimento<input name="due" type="date" required/></label><button type="submit">Registrar lançamento</button></form>
 {data.finance.entries.map(l=><article key={l.id} className={styles.lead}><strong>{l.label} · {amount(l.cents)}</strong><p>{l.kind==="income"?"Receita":"Despesa"} · {date(l.due_on)} · {l.settled_at?"Realizado":"Previsto"}</p><button onClick={()=>mutate({type:"ledger_settled",id:l.id,settled:!l.settled_at})}>{l.settled_at?"Reverter baixa":"Registrar baixa"}</button></article>)}</>}
 </section>
 </>;
}
