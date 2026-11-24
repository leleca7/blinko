// Lab-only contracts: no provider calls, no customer data.
export type Source = {id:number;pillar:number;kind:string;source:string;statement:string;verified:boolean};
export type Suggestion = {id:string;pillar:number;question:string;sourceIds:number[];limitation:string};
export type PortalDraft = {summary:string;nextStep:string;showMaturity:boolean;showActions:boolean};
export type PortalInput = {projectId:number;company:string;stage:string;due:string;maturity:number|null;coverage:number;actions:{title:string;done:boolean;due:string}[];draft:PortalDraft};
const eligible=(e:Source)=>e.verified&&e.kind!=="Hipótese";
export function buildAssistiveDraft(sources:Source[],pillar:number):Suggestion[]{
  const selected=sources.filter(e=>e.pillar===pillar&&eligible(e));
  const ids=selected.map(e=>e.id).sort((a,b)=>a-b);
  const questions=selected.length?[
    ["compare","Que outro registro pode confirmar ou contrariar estas observações?"],
    ["context","Em quais situações estas observações não se repetem?"]
  ]:[["collect","Que fato concreto devemos registrar antes de formular uma hipótese?"]];
  return questions.map(([id,question])=>({id:pillar+"-"+id,pillar,question,sourceIds:ids,limitation:selected.length?"Registros revisados não comprovam causalidade nem independência.":"Sem evidências elegíveis; não formular conclusão."}));
}
// Future provider output must match the contract and cite only eligible IDs in this project/pillar.
// This only checks shape and provenance, not truth or professional validity.
export function validateSuggestion(value:unknown,sources:Source[],pillar:number):Suggestion|null {
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const v=value as Record<string,unknown>;
  if(Object.keys(v).some(k=>!["id","pillar","question","sourceIds","limitation"].includes(k)))return null;
  if(typeof v.id!=="string"||!v.id.trim()||v.id.length>100||v.pillar!==pillar||typeof v.question!=="string"||!v.question.trim()||v.question.length>500||typeof v.limitation!=="string"||!v.limitation.trim()||v.limitation.length>500||!Array.isArray(v.sourceIds))return null;
  const validIds=new Set(sources.filter(e=>e.pillar===pillar&&eligible(e)).map(e=>e.id));
  if(v.sourceIds.length>100||new Set(v.sourceIds).size!==v.sourceIds.length||v.sourceIds.some(id=>typeof id!=="number"||!validIds.has(id)))return null;
  return {id:v.id,pillar,question:v.question.trim(),sourceIds:[...v.sourceIds] as number[],limitation:v.limitation.trim()};
}
export function portalProjection(input:PortalInput) {
  // Explicit allowlist. Never spread project objects into a customer-facing payload.
  return {
    projectId:input.projectId,company:input.company,stage:input.stage,due:input.due,
    summary:input.draft.summary.trim(),nextStep:input.draft.nextStep.trim(),
    maturity:input.draft.showMaturity?{value:input.maturity,coverage:input.coverage}:null,
    actions:input.draft.showActions?input.actions.map(a=>({title:a.title,done:a.done,due:a.due})):[]
  };
}
export function portalApprovalKey(input:PortalInput,reviewKey:string):string {
  return JSON.stringify([portalProjection(input),reviewKey]);
}
export function canPreviewPortal(input:PortalInput,reviewed:boolean,key:string|undefined,reviewKey:string):boolean {
  return reviewed&&!!input.draft.summary.trim()&&!!input.draft.nextStep.trim()&&key===portalApprovalKey(input,reviewKey);
}
