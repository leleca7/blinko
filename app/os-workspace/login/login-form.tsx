"use client";
import {useState,useRef} from "react";
import styles from "../../os-preview/os-preview.module.css";
import connected from "../workspace.module.css";
export default function LoginForm(){
 const [code,setCode]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const lock=useRef(false);
 async function enter(){
  if(lock.current)return;
  if(!/^[a-f0-9]{64}$/.test(code)){setMessage("Confira o código temporário.");return;}
  lock.current=true;setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/os-lab/session",{method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});
   const data=await response.json();
   if(!response.ok||data?.ok!==true){setMessage(response.status===401?"Código inválido, vencido ou já utilizado.":"Acesso indisponível.");return;}
   setCode("");window.location.replace("/os-workspace");
  }catch{setMessage("Não foi possível confirmar o acesso. Solicite um novo código se necessário.");}
  finally{lock.current=false;setBusy(false);setCode("");}
 }
 return <main className={styles.page}><div className={connected.workspace} style={{maxWidth:500,margin:"auto",padding:"32px 20px"}}><section className={styles.panel}><small>BLINKO OS · LABORATÓRIO</small><h2>Acesso individual</h2><p>Use o código temporário fornecido pelo responsável. Apenas dados fictícios.</p><form onSubmit={e=>{e.preventDefault();void enter();}}><label>Código de acesso<input type="password" value={code} onChange={e=>setCode(e.target.value)} autoComplete="off" spellCheck={false} maxLength={64} required disabled={busy}/></label><button type="submit" disabled={busy}>{busy?"Verificando…":"Entrar"}</button></form><p role="status">{message}</p></section></div></main>;
}
