"use client";

import { useState } from "react";
import styles from "./os-preview.module.css";

const modules = [
  ["Hoje", "Fila de atenção existente", "Revisar integração"],
  ["CRM e triagens", "Oportunidades, WhatsApp e empresas", "Protótipo"],
  ["Clientes e projetos", "Responsáveis, etapas e prazos", "Planejado"],
  ["Orçamentos", "Custos e precificação personalizada", "Protótipo"],
  ["Diagnósticos", "Entrevistas, hipóteses e evidências", "Planejado"],
  ["Radar Blinko", "Maturidade por pilar", "Planejado"],
  ["Criticidade", "Matriz GUT", "Protótipo"],
  ["Documentos", "Propostas e relatórios", "Planejado"],
  ["Financeiro", "Custos, receitas e reservas", "Planejado"],
  ["Agenda", "Reuniões e prazos", "Planejado"],
  ["Automação", "Assistência e revisão humana", "Planejado"],
  ["Segurança", "Permissões e autenticação", "Auditoria pendente"],
];
const stages = ["Triagem", "Contato", "Reunião", "Proposta", "Diagnóstico"];
const initialLeads = [
  { id: 1, company: "Empresa fictícia A", stage: 0 },
  { id: 2, company: "Empresa fictícia B", stage: 1 },
  { id: 3, company: "Empresa fictícia C", stage: 3 },
];
const currency = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const clean = (n: number) => Number.isFinite(n) ? Math.max(0,n) : 0;

export default function OsPreview() {
  const [leads, setLeads] = useState(initialLeads);
  const [hours, setHours] = useState(40);
  const [rate, setRate] = useState(0);
  const [cost, setCost] = useState(0);
  const [fees, setFees] = useState(0);
  const [margin, setMargin] = useState(20);
  const [gut, setGut] = useState([3,3,3]);
  const totalCost = clean(hours)*clean(rate)+clean(cost);
  const valid = fees>=0 && margin>=0 && fees+margin<100;
  const price = valid ? Math.ceil(totalCost/(1-(fees+margin)/100)*100)/100 : null;
  const priority = gut.reduce((a,b)=>a*b,1);
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
        <header className={styles.top}>
          <div><strong>blinko* OS</strong><small>Laboratório operacional</small></div>
          <nav aria-label="Módulos de demonstração"><a href="#crm">CRM</a><a href="#orcamento">Orçamento</a><a href="#gut">Criticidade</a></nav>
        </header>
        <aside className={styles.notice}>Ambiente experimental · Use somente dados fictícios. Não há conexão ao CRM, envio ou armazenamento. Recarregar restaura a demonstração.</aside>
        <section className={styles.hero}>
          <small>01 / OPERAÇÃO E INTELIGÊNCIA</small>
          <h1>Clareza para operar.</h1>
          <p>Da triagem ao diagnóstico: uma central para organizar decisões, evidências e entregas.</p>
        </section>
        <section className={styles.modules} aria-label="Roadmap dos módulos">
          {modules.map(([name,desc,status])=><article key={name}><small>{status}</small><h2>{name}</h2><p>{desc}</p></article>)}
        </section>
        <section className={styles.panel} id="crm">
          <div className={styles.heading}><div><small>02 / CRM</small><h2>Pipeline de demonstração</h2></div><button onClick={()=>setLeads(initialLeads)}>Restaurar exemplo</button></div>
          <p>Experimente mover os registros fictícios entre as etapas. Nenhum dado é persistido.</p>
          <div className={styles.pipeline}>
            {stages.map((stage,i)=><div className={styles.column} key={stage}><h3>{stage} <span>{leads.filter(l=>l.stage===i).length}</span></h3>
              {leads.filter(l=>l.stage===i).map(lead=><article key={lead.id} className={styles.lead}><strong>{lead.company}</strong><label>Etapa<select value={lead.stage} onChange={e=>setLeads(old=>old.map(l=>l.id===lead.id?{...l,stage:Number(e.target.value)}:l))}>{stages.map((s,j)=><option key={s} value={j}>{s}</option>)}</select></label></article>)}
            </div>)}
          </div>
        </section>
        <div className={styles.tools}>
          <section className={styles.panel} id="orcamento">
            <small>03 / ORÇAMENTO</small><h2>Estimador de proposta</h2><p>Hipótese de custo, não uma tabela comercial aprovada. Horas são a soma do esforço da equipe.</p>
            <div className={styles.fields}>{fields.map(f=><label key={f.label}>{f.label}<input type="number" min="0" step="any" value={f.value} onChange={e=>f.set(clean(Number(e.target.value)))}/></label>)}</div>
            <div className={styles.result} aria-live="polite"><small>Custo estimado: {currency(totalCost)}</small><strong>{price===null?"Percentuais inválidos":currency(price)}</strong><p>{price===null?"Taxas e margem somadas precisam ser inferiores a 100%.":"Preço simulado, incluindo margem e taxas."}</p></div>
          </section>
          <section className={styles.panel} id="gut">
            <small>04 / CRITICIDADE</small><h2>Matriz GUT</h2><p>Instrumento experimental. Pontuações exigem evidências e revisão humana.</p>
            {["Gravidade","Urgência","Tendência"].map((name,i)=><label className={styles.range} key={name}>{name} <strong>{gut[i]}/5</strong><input type="range" min="1" max="5" step="1" value={gut[i]} onChange={e=>setGut(old=>old.map((v,j)=>j===i?Number(e.target.value):v))}/></label>)}
            <div className={styles.result} aria-live="polite"><small>Pontuação G × U × T</small><strong>{priority}/125</strong><p>{priority>=81?"Crítica":priority>=41?"Alta":priority>=16?"Moderada":"Baixa"} · faixa provisória</p><p>Riscos graves podem exigir ação imediata independentemente da nota.</p></div>
          </section>
        </div>
        <footer>BLINKO OS · Protótipo 01 · Sem dados reais · Não liberar em produção.</footer>
      </div>
    </main>
  );
}
