const isLabUuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

type ScoreCommand = {type:"score";projectId:string;pillar:number;value:number;evidenceId:string};
type ActionCommand = {type:"action";id:string;projectId:string;evidenceId:string;title:string;owner:string;due:string;gravity:number;urgency:number;tendency:number};
type CompletionCommand = {type:"completion";id:string;done:boolean};
export type LabOperation = ScoreCommand|ActionCommand|CompletionCommand;
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
 return null;
}
