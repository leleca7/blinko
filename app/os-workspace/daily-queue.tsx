"use client";
import {useEffect,useState} from "react";
import {createLabClient,labErrorMessage,type LabQueue,type LabQueueItem} from "../../lib/os-lab/client";
import styles from "../os-preview/os-preview.module.css";
const api=createLabClient();
const names={lead:"Comercial",evidence:"Diagnóstico",action:"Plano de ação",appointment:"Agenda",delivery:"Documentos"};
const format=(value:string|null)=>value?value.split("-").reverse().join("/"):"Sem prazo";
export default function DailyQueue({revision,onOpen}:{revision:number;onOpen:(item:LabQueueItem)=>void}){
 const [data,setData]=useState<LabQueue|null>(null),[error,setError]=useState("");
 useEffect(()=>{
  const c=new AbortController();setData(null);setError("");
  api.queue(c.signal).then(d=>{if(!c.signal.aborted){if(!d||!Array.isArray(d.items)||!/^\d+$/.test(d.total))throw Error("Invalid queue");setData(d);}}).catch(e=>{if(!c.signal.aborted)setError(labErrorMessage(e));});
  return ()=>c.abort();
 },[revision]);
 return <section className={styles.dailySection}><small>00 · HOJE</small><h2>O que precisa de atenção</h2><p>Registros pendentes nos projetos e oportunidades que seu perfil pode consultar. A fila não substitui as permissões de execução.</p>
 {!data?<p role="status">{error||"Consultando fila diária…"}</p>:<>
 <div className={styles.dailyStats}><span><strong>{data.total}</strong> pendências</span></div>
 {data.items.length===0?<p>Nenhuma pendência disponível.</p>:<div className={styles.dailyList}>{data.items.map(item=><button key={item.kind+":"+item.id} onClick={()=>onOpen(item)}><div><small>{names[item.kind]} · {item.company}</small><strong>{item.title}</strong></div><span>{format(item.due_on)}</span></button>)}</div>}
 {Number(data.total)>data.items.length&&<p>Exibindo as primeiras {data.items.length} de {data.total} pendências. Outros registros devem ser consultados nos módulos.</p>}
 </>}
 </section>;
}
