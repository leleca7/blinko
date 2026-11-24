// Transparent diagnostic helpers. No external AI or semantic inference.
export type LabEvidence = {id:number;pillar:number;kind:string;source:string;statement:string;verified:boolean};
export type Hypothesis = {id:number;pillar:number;cause:string;effect:string;supportId:number|null;challengeId:number|null;decision:"open"|"supported"|"rejected";rationale:string};
export const eligibleEvidence = (e:LabEvidence) => e.verified && e.kind!=="Hipótese";
const normalized = (s:string) => s.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g," ");
export function pillarCoverage(evidence:LabEvidence[],count:number) {
  return Array.from({length:count},(_,pillar)=>{
    const records=evidence.filter(e=>e.pillar===pillar);
    const reviewed=records.filter(eligibleEvidence);
    const sources=new Set(reviewed.map(e=>normalized(e.source)).filter(Boolean)).size;
    return {pillar,total:records.length,reviewed:reviewed.length,sources,pending:records.filter(e=>!e.verified).length,
      observed:reviewed.filter(e=>e.kind==="Fato observado").length};
  });
}
export function investigationQuestions(evidence:LabEvidence[],pillar:number) {
  const c=pillarCoverage(evidence,pillar+1)[pillar];
  const questions:string[]=[];
  if(!c.reviewed)questions.push("Que situação concreta pode ser observada ou documentada neste pilar?");
  if(c.pending)questions.push("Quais registros ainda precisam ser conferidos e por quem?");
  if(c.reviewed && c.sources<2)questions.push("Que outra perspectiva ou documento pode complementar a fonte atual?");
  if(c.reviewed && !c.observed)questions.push("Há registros observáveis que permitam confrontar os relatos?");
  questions.push("Quando o problema ocorre, com que frequência e quais exceções existem?");
  questions.push("Que explicação alternativa poderia produzir o mesmo efeito?");
  return questions;
}
export function assessHypothesis(h:Hypothesis,evidence:LabEvidence[]) {
  const support=h.supportId===null?undefined:evidence.find(e=>e.id===h.supportId&&eligibleEvidence(e));
  const challenge=h.challengeId===null?undefined:evidence.find(e=>e.id===h.challengeId&&eligibleEvidence(e));
  const invalidLinks=(h.supportId!==null&&!support)||(h.challengeId!==null&&!challenge)||(h.supportId!==null&&h.supportId===h.challengeId);
  const canSupport=!!support&&!invalidLinks&&!!h.rationale.trim();
  const canReject=!!challenge&&!invalidLinks&&!!h.rationale.trim();
  const stale=invalidLinks||(h.decision==="supported"&&!canSupport)||(h.decision==="rejected"&&!canReject);
  return {support,challenge,canSupport,canReject,stale,status:stale?"Revisão necessária":h.decision==="supported"?"Sustentada provisoriamente":h.decision==="rejected"?"Refutada na revisão":"Em investigação"};
}
