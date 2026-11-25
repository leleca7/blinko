"use client";
import {useEffect,useState} from "react";
import {createLabClient,labErrorMessage,type LabDelivery,type LabQuote,type LabLead} from "../../lib/os-lab/client";
import {clientDeliveryText} from "../../lib/os-lab/delivery-export";
import type {LabOperation} from "../../lib/os-lab/operations";
import styles from "../os-preview/os-preview.module.css";
const api=createLabClient();
type Mutation=(op:LabOperation,success?:()=>void)=>Promise<void>;
const field=(f:FormData,k:string)=>String(f.get(k)??"");
function scaled(v:string,scale:number,max:number){
 const s=v.trim().replace(",",".");if(!/^\d+(\.\d{1,2})?$/.test(s))return null;
 const [a,b=""]=s.split(".");const n=Number(a)*scale+Number(b.padEnd(2,"0"))*scale/100;
 return Number.isSafeInteger(n)&&n>=0&&n<=max?n:null;
}
function currency(cents:string){if(!/^\d+$/.test(cents))return "Indisponível";const n=BigInt(cents);return "R$ "+(n/BigInt(100)).toLocaleString("pt-BR")+","+String(n%BigInt(100)).padStart(2,"0");}
export function QuotePanel({leads,revision,mutate}:{leads:LabLead[];revision:number;mutate:Mutation}){
 const [quotes,setQuotes]=useState<LabQuote[]|null>(null);
 const [error,setError]=useState("");
 useEffect(()=>{const c=new AbortController();setQuotes(null);setError("");api.quotes(c.signal).then(x=>{if(!c.signal.aborted){if(!Array.isArray(x))throw Error("Invalid quotes");setQuotes(x);}}).catch(e=>{if(!c.signal.aborted)setError(labErrorMessage(e));});return ()=>c.abort();},[revision]);
 return <section className={styles.panel}><small>09 · ORÇAMENTOS</small><h2>Estimativas comerciais</h2><p>Valores hipotéticos. O servidor calcula custo e preço; não é proposta aprovada. A gravação exige autorização de administrador.</p>
 {quotes===null?<p role="status">{error||"Consultando estimativas…"}</p>:<>
 <form onSubmit={e=>{e.preventDefault();setError("");const f=new FormData(e.currentTarget);const form=e.currentTarget;const minutes=Number(field(f,"minutes"));const hourlyCents=scaled(field(f,"rate"),100,10000000),expenseCents=scaled(field(f,"expense"),100,10000000000),feeBps=scaled(field(f,"fee"),100,9999),marginBps=scaled(field(f,"margin"),100,9999);
 if(hourlyCents===null||expenseCents===null||feeBps===null||marginBps===null||!Number.isInteger(minutes)||minutes<1||minutes>600000||hourlyCents+expenseCents===0||feeBps+marginBps>=10000){setError("Confira valores, minutos e percentuais; taxas e margem devem somar menos de 100%.");return;}
 mutate({type:"quote_create",id:crypto.randomUUID(),leadId:field(f,"lead"),minutes,hourlyCents,expenseCents,feeBps,marginBps},()=>form.reset());}}>
 <label>Oportunidade<select name="lead" required><option value="">Selecione</option>{leads.map(l=><option key={l.id} value={l.id}>{l.display_name}</option>)}</select></label>
 <label>Tempo de trabalho (minutos)<input name="minutes" type="number" min={1} max={600000} step={1} defaultValue={2400} required/></label><label>Valor por hora (R$)<input name="rate" inputMode="decimal" defaultValue="30" required/></label><label>Despesas (R$)<input name="expense" inputMode="decimal" defaultValue="300" required/></label><label>Taxas (%)<input name="fee" inputMode="decimal" defaultValue="8" required/></label><label>Margem (%)<input name="margin" inputMode="decimal" defaultValue="20" required/></label><button type="submit" disabled={!leads.length}>Salvar estimativa</button></form>
 {error&&<p role="alert">{error}</p>}{quotes.length===0&&<p>Nenhuma estimativa disponível para seu perfil.</p>}
 {quotes.map(q=><article key={q.id} className={styles.lead}><strong>{q.display_name}</strong><p>{q.minutes} minutos · Custo {currency(q.cost_cents)}</p><strong>Estimativa {currency(q.price_cents)}</strong></article>)}</>}
 </section>;
}
export function DeliveryPanel({projectId,revision,mutate}:{projectId:string;revision:number;mutate:Mutation}){
 const [data,setData]=useState<LabDelivery|null>(null);
 const [error,setError]=useState("");
 useEffect(()=>{const c=new AbortController();setData(null);setError("");api.delivery(projectId,c.signal).then(x=>{if(!c.signal.aborted){if(!x||typeof x!=="object"||!("draft" in x)||!("preview" in x))throw Error("Invalid delivery");setData(x);}}).catch(e=>{if(!c.signal.aborted)setError(labErrorMessage(e));});return ()=>c.abort();},[projectId,revision]);
 if(!data)return <section className={styles.panel}><h2>Entregas</h2><p role="status">{error||"Consultando relatório e autorizações…"}</p></section>;
 const d=data.draft,p=data.preview;
 async function exportPreview(format:"txt"|"pdf"="txt"){
  setError("");
  const printWindow=format==="pdf"?window.open("","_blank"):null;
  if(format==="pdf"&&!printWindow){setError("Permita a abertura da janela de impressão.");return;}
  if(printWindow){printWindow.opener=null;printWindow.document.title="Blinko — preparando prévia";printWindow.document.body.textContent="Consultando autorização vigente…";}
  try{
   const fresh=await api.delivery(projectId);
   if(!fresh.preview){printWindow?.close();setData(fresh);setError("A autorização não está mais vigente. Revise novamente antes de exportar.");return;}
   if(printWindow){renderPrintPreview(printWindow,fresh.preview);return;}
   const blob=new Blob([clientDeliveryText(fresh.preview)],{type:"text/plain;charset=utf-8"});
   const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="blinko-previa-"+projectId+".txt";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){printWindow?.close();setError(labErrorMessage(e));}
 }
 return <section className={styles.panel}><small>10 · DOCUMENTOS E ENTREGA</small><h2>Relatório e revisão humana</h2><p>Rascunho interno. Alterações no projeto invalidam revisões e autorizações anteriores.</p>
 <form onSubmit={e=>{e.preventDefault();mutate({type:"report_save",id:projectId,synthesis:field(new FormData(e.currentTarget),"synthesis")});}}><label>Síntese do diagnóstico<textarea name="synthesis" defaultValue={d?.synthesis??""} maxLength={2000} rows={6} required/></label><button type="submit">Salvar relatório</button></form>
 {d&&<><p>Revisão: {d.review_current?"Vigente":"Pendente ou desatualizada"}.</p>
 <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);mutate({type:"report_review",id:projectId,reviewed:field(f,"decision")==="approve",note:field(f,"note")});}}>
 <label>Parecer<textarea name="note" defaultValue={d.review_note??""} maxLength={500} rows={3} required/></label><label>Decisão<select name="decision"><option value="approve">Registrar revisão</option><option value="revoke">Revogar revisão</option></select></label><button type="submit">Confirmar decisão</button></form>
 <h3>Prévia interna do cliente</h3><p>Não é publicação externa. Revise o texto para evitar informações internas.</p>
 <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);mutate({type:"portal_save",id:projectId,summary:field(f,"summary"),nextStep:field(f,"next"),showMaturity:f.has("maturity"),showActions:f.has("actions")});}}>
 <label>Resumo para o cliente<textarea name="summary" defaultValue={d.client_summary} maxLength={1200} rows={4} required/></label><label>Próxima etapa<textarea name="next" defaultValue={d.client_next_step} maxLength={500} rows={3} required/></label>
 <label><input type="checkbox" name="maturity" defaultChecked={d.show_maturity}/>Incluir indicador de maturidade</label><label><input type="checkbox" name="actions" defaultChecked={d.show_actions}/>Incluir títulos das ações</label><button type="submit">Salvar prévia</button></form>
 <button disabled={!d.review_current||!d.client_summary.trim()||!d.client_next_step.trim()} onClick={()=>mutate({type:"portal_approve",id:projectId,approved:true})}>Autorizar prévia interna</button>
 <button onClick={()=>mutate({type:"portal_approve",id:projectId,approved:false})}>Revogar autorização</button>
 {error&&<p role="alert">{error}</p>}
 {p&&<><button onClick={()=>void exportPreview("txt")}>Exportar prévia autorizada (.txt)</button><button onClick={()=>void exportPreview("pdf")}>Imprimir / salvar prévia em PDF</button></>}
 {p?<article className={styles.portalCard}><header className={styles.reportCover}><div><small>PRÉVIA INTERNA · DADOS FICTÍCIOS</small><h2>Entrega do diagnóstico</h2></div><img className={styles.reportLogo} src="/brand/logo-fundo-verde.svg" alt="Blinko Studio"/></header><div className={styles.reportBody}><h3>{p.company}</h3><p>{p.stage} · {p.due??"Sem prazo"}</p><p>{p.summary}</p><h3>Próxima etapa</h3><p>{p.nextStep}</p>{p.maturity&&<p>Maturidade: {p.maturity.value}% · {p.maturity.coverage}/10</p>}{p.actions.map((a,i)=><p key={i}>{a.title} · {a.due} · {a.done?"Concluída":"Em aberto"}</p>)}</div></article>:<p>Prévia bloqueada ou ainda não autorizada.</p>}</>}
 </section>;
}

function renderPrintPreview(target:Window,p:NonNullable<LabDelivery["preview"]>){
 if(target.closed)return;
 const doc=target.document;
 doc.documentElement.lang="pt-BR";
 const style=doc.createElement("style");
 style.textContent="@page{size:A4;margin:30mm 20mm 20mm 30mm;@bottom-left{content:'BLINKO STUDIO | DOCUMENTO EXPERIMENTAL';font:8pt Arial;color:#52685a}@bottom-right{content:counter(page) ' / ' counter(pages);font:8pt Arial;color:#52685a}}*{box-sizing:border-box}body{font:12pt/1.5 Arial,sans-serif;color:#18382a;background:#fff;margin:0;padding:28px}main{max-width:760px;margin:auto}header{position:relative;display:flex;align-items:center;gap:16pt;background:#01301e;color:white;border-radius:10px;border-bottom:5px solid #ef3c7f;padding:18pt;margin-bottom:18pt;break-inside:avoid}header div{min-width:0;flex:1}header img{width:30mm;height:auto;flex-shrink:0}h1{font:700 21pt/1.18 Arial,sans-serif;margin:8pt 0;overflow-wrap:anywhere}h2{font:700 13pt/1.3 Arial,sans-serif;margin:0 0 9pt;break-after:avoid;color:#01301e}p,li{white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 9pt}section{border:1px solid #dce2d8;border-radius:9px;padding:13pt;margin:12pt 0}section.highlight{background:#f5f1e9;border-left:4px solid #ef3c7f}header small{color:#f6ece3;font-size:9pt;letter-spacing:.05em}header p{font-size:10pt;margin:5pt 0 0}li{margin-bottom:6pt;break-inside:avoid}ul{padding-left:20pt;margin:0}button{display:block;max-width:760px;margin:0 auto 20px;font:inherit;padding:10px 18px;border:1px solid #01301e;border-radius:6px;background:#01301e;color:white;cursor:pointer}footer{border-top:1px solid #dce2d8;margin-top:18pt;padding-top:10pt;font-size:9pt;color:#52685a;break-inside:avoid}@media print{body{padding:0}button{display:none}main{max-width:none}header,section{print-color-adjust:exact;-webkit-print-color-adjust:exact}}";
 doc.head.replaceChildren(style);doc.title="Blinko — prévia autorizada";
 const add=(parent:HTMLElement,tag:string,text:string)=>{const el=doc.createElement(tag);el.textContent=text;parent.append(el);return el;};
 const main=doc.createElement("main"),header=doc.createElement("header"),intro=doc.createElement("div");
 add(intro,"small","DIAGNÓSTICO ORGANIZACIONAL | DADOS FICTÍCIOS");
 add(intro,"h1",p.company);add(intro,"p","Prévia interna de entrega");add(intro,"p","Etapa: "+p.stage+" | Prazo: "+(p.due??"Não definido"));
 header.append(intro);
 const logo=doc.createElement("img");logo.src=new URL("/brand/logo-fundo-verde.svg",window.location.origin).href;logo.alt="Blinko Studio — Criatividade que conecta";header.append(logo);main.append(header);
 const section=(title:string,highlight=false)=>{const s=doc.createElement("section");if(highlight)s.className="highlight";add(s,"h2",title);main.append(s);return s;};
 let n=1;
 const heading=(label:string)=>String(n++).padStart(2,"0")+" | "+label;
 add(section(heading("Síntese")),"p",p.summary);
 if(p.maturity)add(section(heading("Maturidade"),true),"p",p.maturity.value+"% · "+p.maturity.coverage+"/10 pilares");
 if(p.actions.length){const s=section(heading("Plano de ação")),list=doc.createElement("ul");for(const action of p.actions)add(list,"li",action.title+" | "+action.due+" | "+(action.done?"Concluída":"Em aberto"));s.append(list);}
 add(section(heading("Próxima etapa"),true),"p",p.nextStep);
 add(main,"footer","Prévia autorizada no momento da consulta. Alterações posteriores podem invalidá-la. Não enviar a clientes reais.");
 const print=doc.createElement("button");print.textContent="Imprimir / salvar como PDF";print.disabled=true;logo.addEventListener("load",()=>{print.disabled=false;},{once:true});logo.addEventListener("error",()=>{print.textContent="Logo indisponível — reabra a prévia";},{once:true});print.addEventListener("click",()=>target.print());doc.body.replaceChildren(print,main);if(logo.complete&&logo.naturalWidth>0)print.disabled=false;
}
