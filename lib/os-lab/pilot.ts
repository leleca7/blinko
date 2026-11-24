// Synthetic pilot only. Never use this fixture for a real diagnosis.
export const PILOT_ID=9000;
export const PILOT_COMPANY='Empresa fictícia Z';
export const PILOT_SUBMISSION='fixture-9000';
const statements=[
 'Objetivo trimestral anotado, sem indicador definido.',
 'Rotinas administrativas registradas em checklist parcial.',
 'Reunião semanal da equipe consta no calendário fictício.',
 'Planilha fictícia distingue entradas e saídas, sem projeção mensal.',
 'Em amostra simulada, três de dez contatos ficaram sem retorno.',
 'Calendário de comunicação existe, sem acompanhamento de resultados.',
 'Manual de marca fictício disponível para consulta.',
 'Lista de parceiros existe, sem rotina de acompanhamento.',
 'Pesquisa fictícia de satisfação tem respostas, sem plano de melhoria.',
 'Fluxo de atendimento documentado apenas em duas etapas.'
];
export function pilotFixture(){
 const evidence=statements.map((statement,pillar)=>({id:900001+pillar,pillar,kind:'Fato observado',source:'Documento sintético '+(pillar+1),statement,verified:false}));
 return {evidence,actions:[{id:900020,title:'Definir rotina de retorno dos contatos',owner:'Atendimento',due:'2026-12-10',evidenceId:900005,gut:48,done:false}], appointments:[{id:900021,title:'Reunião de acompanhamento fictícia',date:'2026-12-10',kind:'Reunião',done:false}],ledger:[{id:900022,label:'Receita simulada do diagnóstico',date:'2026-12-10',kind:'income' as const,cents:200000,settled:false},{id:900023,label:'Despesa simulada de pesquisa',date:'2026-12-10',kind:'expense' as const,cents:30000,settled:false}]};
}
export function pilotCanLoad(p:{evidence:unknown[];actions:unknown[];appointments:unknown[];ledger:unknown[];hypotheses:unknown[];scores:object}){return ![p.evidence,p.actions,p.appointments,p.ledger,p.hypotheses].some(x=>x.length)&&Object.keys(p.scores).length===0;}
// A new mutation must invalidate old approvals, even if the content is later restored.
export function withoutProjectKey<T>(state:Record<number,T>,id:number):Record<number,T>{const next={...state};delete next[id];return next;}
export function mayContract(leadId:number,stage:number,rows:{id:string;stage:string}[]){return stage===4&&(![100,PILOT_ID].includes(leadId)||rows.some(r=>r.id===`fixture-${leadId}`&&r.stage==='complete'));}
