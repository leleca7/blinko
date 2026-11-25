const isLabUuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

type ScoreCommand = {type:"score";projectId:string;pillar:number;value:number;evidenceId:string};
type ActionCommand = {type:"action";id:string;projectId:string;evidenceId:string;title:string;owner:string;due:string;gravity:number;urgency:number;tendency:number};
type CompletionCommand = {type:"completion";id:string;done:boolean};
type AppointmentCommand = {type:"appointment";id:string;projectId:string;title:string;kind:string;due:string};
type AppointmentDoneCommand = {type:"appointment_done";id:string;done:boolean};
type LedgerCommand = {type:"ledger";id:string;projectId:string;label:string;kind:"income"|"expense";cents:number;due:string};
type LedgerSettledCommand = {type:"ledger_settled";id:string;settled:boolean};
type LeadCreate = {type:"lead_create";id:string;submissionId:string;company:string;consent:true};
type LeadComplete = {type:"lead_complete";id:string;challenge:string};
type LeadMove = {type:"lead_move";id:string;expectedStage:string;nextStage:string};
type LeadContract = {type:"lead_contract";id:string;projectId:string;confirmed:true};
type ProjectDetails = {type:"project_details";id:string;stage:string;owner:string;due:string|null};
type ReportSave = {type:"report_save";id:string;synthesis:string};
type ReportReview = {type:"report_review";id:string;reviewed:boolean;note:string};
type PortalSave = {type:"portal_save";id:string;summary:string;nextStep:string;showMaturity:boolean;showActions:boolean};
type PortalApprove = {type:"portal_approve";id:string;approved:boolean};
type HypothesisSave = {type:"hypothesis_save";id:string;projectId:string;pillar:number;cause:string;effect:string;supportId:string|null;challengeId:string|null;decision:"open"|"supported"|"rejected";rationale:string};
type QuoteCreate = {type:"quote_create";id:string;leadId:string;minutes:number;hourlyCents:number;expenseCents:number;feeBps:number;marginBps:number};
export type LabOperation = HypothesisSave|QuoteCreate|ReportSave|ReportReview|PortalSave|PortalApprove|ScoreCommand|ActionCommand|CompletionCommand|AppointmentCommand|AppointmentDoneCommand|LedgerCommand|LedgerSettledCommand|LeadCreate|LeadComplete|LeadMove|LeadContract|ProjectDetails;
const intIn=(value:unknown,min:number,max:number):value is number=>typeof value==="number"&&Number.isInteger(value)&&value>=min&&value<=max;
const allowed=(p:Record<string,unknown>,keys:string[])=>Object.keys(p).every(k=>keys.includes(k));
function validDate(v:unknown):v is string {
 if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v)||v.startsWith("0000"))return false;
 const t=Date.parse(v+"T00:00:00Z");
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===v;
}
export function validateOperation(value:unknown):LabOperation|null {
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const p=value as Record<string,unknown>;
 if(p.type==="score"){
  if(!allowed(p,["type","projectId","pillar","value","evidenceId"])||!isLabUuid(p.projectId)||!isLabUuid(p.evidenceId)||!intIn(p.pillar,0,9)||!intIn(p.value,0,4))return null;
  return {type:"score",projectId:p.projectId.toLowerCase(),evidenceId:p.evidenceId.toLowerCase(),pillar:p.pillar,value:p.value};
 }
 if(p.type==="action"){
  if(!allowed(p,["type","id","projectId","evidenceId","title","owner","due","gravity","urgency","tendency"])||!isLabUuid(p.id)||!isLabUuid(p.projectId)||!isLabUuid(p.evidenceId)||typeof p.title!=="string"||!p.title.trim()||p.title.trim().length>160||typeof p.owner!=="string"||!["Atendimento","Pesquisa","Produção","Equipe"].includes(p.owner)||!validDate(p.due)||!intIn(p.gravity,1,5)||!intIn(p.urgency,1,5)||!intIn(p.tendency,1,5))return null;
  return {type:"action",id:p.id.toLowerCase(),projectId:p.projectId.toLowerCase(),evidenceId:p.evidenceId.toLowerCase(),title:p.title.trim(),owner:p.owner,due:p.due,gravity:p.gravity,urgency:p.urgency,tendency:p.tendency};
 }
 if(p.type==="completion"){
  if(!allowed(p,["type","id","done"])||!isLabUuid(p.id)||typeof p.done!=="boolean")return null;
  return {type:"completion",id:p.id.toLowerCase(),done:p.done};
 }
 if(p.type==="appointment"){
  if(!allowed(p,["type","id","projectId","title","kind","due"])||!isLabUuid(p.id)||!isLabUuid(p.projectId)||typeof p.title!=="string"||!p.title.trim()||p.title.trim().length>120||typeof p.kind!=="string"||!["Reunião","Entrevista","Visita","Entrega","Revisão"].includes(p.kind)||!validDate(p.due))return null;
  return {type:"appointment",id:p.id.toLowerCase(),projectId:p.projectId.toLowerCase(),title:p.title.trim(),kind:p.kind,due:p.due};
 }
 if(p.type==="appointment_done"){
  if(!allowed(p,["type","id","done"])||!isLabUuid(p.id)||typeof p.done!=="boolean")return null;
  return {type:"appointment_done",id:p.id.toLowerCase(),done:p.done};
 }
 if(p.type==="ledger"){
  if(!allowed(p,["type","id","projectId","label","kind","cents","due"])||!isLabUuid(p.id)||!isLabUuid(p.projectId)||typeof p.label!=="string"||!p.label.trim()||p.label.trim().length>120||(p.kind!=="income"&&p.kind!=="expense")||!intIn(p.cents,1,10000000000)||!validDate(p.due))return null;
  return {type:"ledger",id:p.id.toLowerCase(),projectId:p.projectId.toLowerCase(),label:p.label.trim(),kind:p.kind,cents:p.cents,due:p.due};
 }
 if(p.type==="ledger_settled"){
  if(!allowed(p,["type","id","settled"])||!isLabUuid(p.id)||typeof p.settled!=="boolean")return null;
  return {type:"ledger_settled",id:p.id.toLowerCase(),settled:p.settled};
 }
 if(p.type==="lead_create"){
  if(!allowed(p,["type","id","submissionId","company","consent"])||!isLabUuid(p.id)||!isLabUuid(p.submissionId)||p.consent!==true||typeof p.company!=="string"||!p.company.trim().startsWith("Empresa fictícia ")||p.company.trim().length>120)return null;
  return {type:"lead_create",id:p.id.toLowerCase(),submissionId:p.submissionId.toLowerCase(),company:p.company.trim(),consent:true};
 }
 if(p.type==="lead_complete"){
  if(!allowed(p,["type","id","challenge"])||!isLabUuid(p.id)||typeof p.challenge!=="string"||!p.challenge.trim()||p.challenge.trim().length>500)return null;
  return {type:"lead_complete",id:p.id.toLowerCase(),challenge:p.challenge.trim()};
 }
 if(p.type==="lead_move"){
  const stages=["triagem","contato","reuniao","proposta","diagnostico"];
  if(!allowed(p,["type","id","expectedStage","nextStage"])||!isLabUuid(p.id)||typeof p.expectedStage!=="string"||typeof p.nextStage!=="string"||!stages.includes(p.expectedStage)||!stages.includes(p.nextStage))return null;
  return {type:"lead_move",id:p.id.toLowerCase(),expectedStage:p.expectedStage,nextStage:p.nextStage};
 }
 if(p.type==="lead_contract"){
  if(!allowed(p,["type","id","projectId","confirmed"])||!isLabUuid(p.id)||!isLabUuid(p.projectId)||p.confirmed!==true)return null;
  return {type:"lead_contract",id:p.id.toLowerCase(),projectId:p.projectId.toLowerCase(),confirmed:true};
 }
 if(p.type==="project_details"){
  if(!allowed(p,["type","id","stage","owner","due"])||!isLabUuid(p.id)||typeof p.stage!=="string"||!["Escutar","Investigar","Priorizar","Estruturar","Acompanhar"].includes(p.stage)||typeof p.owner!=="string"||!["A definir","Atendimento","Pesquisa","Produção","Equipe"].includes(p.owner)||(p.due!==null&&!validDate(p.due)))return null;
  return {type:"project_details",id:p.id.toLowerCase(),stage:p.stage,owner:p.owner,due:p.due};
 }
 if(p.type==="report_save"){
  if(!allowed(p,["type","id","synthesis"])||!isLabUuid(p.id)||typeof p.synthesis!=="string"||!p.synthesis.trim()||p.synthesis.trim().length>2000)return null;
  return {type:"report_save",id:p.id.toLowerCase(),synthesis:p.synthesis.trim()};
 }
 if(p.type==="report_review"){
  if(!allowed(p,["type","id","reviewed","note"])||!isLabUuid(p.id)||typeof p.reviewed!=="boolean"||typeof p.note!=="string"||!p.note.trim()||p.note.trim().length>500)return null;
  return {type:"report_review",id:p.id.toLowerCase(),reviewed:p.reviewed,note:p.note.trim()};
 }
 if(p.type==="portal_save"){
  if(!allowed(p,["type","id","summary","nextStep","showMaturity","showActions"])||!isLabUuid(p.id)||typeof p.summary!=="string"||!p.summary.trim()||p.summary.trim().length>1200||typeof p.nextStep!=="string"||!p.nextStep.trim()||p.nextStep.trim().length>500||typeof p.showMaturity!=="boolean"||typeof p.showActions!=="boolean")return null;
  return {type:"portal_save",id:p.id.toLowerCase(),summary:p.summary.trim(),nextStep:p.nextStep.trim(),showMaturity:p.showMaturity,showActions:p.showActions};
 }
 if(p.type==="portal_approve"){
  if(!allowed(p,["type","id","approved"])||!isLabUuid(p.id)||typeof p.approved!=="boolean")return null;
  return {type:"portal_approve",id:p.id.toLowerCase(),approved:p.approved};
 }
 if(p.type==="hypothesis_save"){
  if(!allowed(p,["type","id","projectId","pillar","cause","effect","supportId","challengeId","decision","rationale"])||!isLabUuid(p.id)||!isLabUuid(p.projectId)||!intIn(p.pillar,0,9)||typeof p.cause!=="string"||!p.cause.trim()||p.cause.trim().length>500||typeof p.effect!=="string"||!p.effect.trim()||p.effect.trim().length>500||(p.supportId!==null&&!isLabUuid(p.supportId))||(p.challengeId!==null&&!isLabUuid(p.challengeId))||(p.decision!=="open"&&p.decision!=="supported"&&p.decision!=="rejected")||typeof p.rationale!=="string"||p.rationale.trim().length>500)return null;
  const supportId=p.supportId===null?null:p.supportId.toLowerCase(),challengeId=p.challengeId===null?null:p.challengeId.toLowerCase();
  if((supportId!==null&&supportId===challengeId)||(p.decision!=="open"&&!p.rationale.trim())||(p.decision==="supported"&&supportId===null)||(p.decision==="rejected"&&challengeId===null))return null;
  return {type:"hypothesis_save",id:p.id.toLowerCase(),projectId:p.projectId.toLowerCase(),pillar:p.pillar,cause:p.cause.trim(),effect:p.effect.trim(),supportId,challengeId,decision:p.decision,rationale:p.rationale.trim()};
 }
 if(p.type==="quote_create"){
  if(!allowed(p,["type","id","leadId","minutes","hourlyCents","expenseCents","feeBps","marginBps"])||!isLabUuid(p.id)||!isLabUuid(p.leadId)||!intIn(p.minutes,1,600000)||!intIn(p.hourlyCents,0,10000000)||!intIn(p.expenseCents,0,10000000000)||!intIn(p.feeBps,0,9999)||!intIn(p.marginBps,0,9999)||(p.hourlyCents===0&&p.expenseCents===0)||p.feeBps+p.marginBps>=10000)return null;
  return {type:"quote_create",id:p.id.toLowerCase(),leadId:p.leadId.toLowerCase(),minutes:p.minutes,hourlyCents:p.hourlyCents,expenseCents:p.expenseCents,feeBps:p.feeBps,marginBps:p.marginBps};
 }
 return null;
}
