// Same-origin client for the protected lab only. No tokens in JavaScript, no localStorage.
import type { LabOperation } from "./operations";
export type LabProject={id:string;label:string;method_stage:string;owner_label:string;due_on:string|null};
export type LabLead={id:string;display_name:string;stage:string;intake_complete:boolean;challenge:string|null;project_id:string|null};
export type LabEvidence={id:string;pillar:number;kind:"fact"|"report"|"hypothesis";summary:string;reviewed:boolean};
export type LabScore={pillar:number;value:number;evidence_id:string;eligible:boolean};
export type LabAction={id:string;title:string;owner_label:string;due_on:string;gravity:number;urgency:number;tendency:number;gut:number;done:boolean;evidence_id:string;eligible:boolean};
export type LabAppointment={id:string;title:string;kind:string;due_on:string;done:boolean};
export type LabHypothesis={id:string;pillar:number;cause:string;effect:string;support_id:string|null;challenge_id:string|null;decision:"open"|"supported"|"rejected";rationale:string;stale:boolean};
export type LabLedger={id:string;label:string;kind:"income"|"expense";cents:string;due_on:string;settled_at:string|null};
export type LabOperations={scores:LabScore[];actions:LabAction[];appointments:LabAppointment[];hypotheses:LabHypothesis[];finance:null|{entries:LabLedger[];totals:{planned_income:string;planned_expense:string;realized_income:string;realized_expense:string}}};
export type LabDelivery={draft:null|{synthesis:string;review_note:string|null;client_summary:string;client_next_step:string;show_maturity:boolean;show_actions:boolean;draft_revision:string;review_current:boolean};preview:null|{projectId:string;company:string;stage:string;due:string|null;summary:string;nextStep:string;maturity:null|{value:number;coverage:number};actions:{title:string;due:string;done:boolean}[]}};
export type LabQuote={id:string;lead_id:string;display_name:string;minutes:number;hourly_cents:number;expense_cents:string;fee_bps:number;margin_bps:number;cost_cents:string;price_cents:string};
export type LabMutation={id:string}|{changed:boolean};
export class LabClientError extends Error {
 readonly status:number;
 readonly code:string;
 constructor(status:number,code:string){super(code);this.status=status;this.code=code;}
}
const endpoint="/api/os-lab/projects";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function projectPath(id:string,scope?:"operations"|"delivery"){
 if(!uuid.test(id))throw new LabClientError(400,"invalid_project");
 return endpoint+"?"+new URLSearchParams({project:id,...(scope?{scope}:{})}).toString();
}
type Fetcher=typeof fetch;
export function createLabClient(fetcher:Fetcher=fetch){
 async function request<T>(path:string,method:"GET"|"POST"|"PATCH"|"PUT"="GET",body?:unknown,signal?:AbortSignal):Promise<T>{
  let res:Response;
  try {
   res=await fetcher(path,{method,credentials:"same-origin",cache:"no-store",redirect:"error",signal,
    headers:{Accept:"application/json",...(body===undefined?{}:{"Content-Type":"application/json"})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  } catch(error) {
   if(signal?.aborted)throw error;
   throw new LabClientError(0,"connection_failed");
  }
  let parsed:unknown;
  try {parsed=await res.json();} catch {throw new LabClientError(res.status,"invalid_response");}
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new LabClientError(res.status,"invalid_response");
  const p=parsed as Record<string,unknown>;
  if(!res.ok||p.ok!==true)throw new LabClientError(res.status,typeof p.error==="string"&&/^[a-z_]{1,80}$/.test(p.error)?p.error:"request_failed");
  if(!Object.prototype.hasOwnProperty.call(p,"data"))throw new LabClientError(res.status,"invalid_response");
  if(method==="PUT"||method==="PATCH") {
   const d=p.data as Record<string,unknown>|null;
   if(!d||typeof d!=="object"||Array.isArray(d)||!(typeof d.changed==="boolean"||typeof d.id==="string"&&uuid.test(d.id)))throw new LabClientError(res.status,"invalid_response");
  }
  if(method==="POST") {
   const d=p.data as Record<string,unknown>|null;
   if(!d||typeof d!=="object"||Array.isArray(d)||typeof d.id!=="string"||!uuid.test(d.id))throw new LabClientError(res.status,"invalid_response");
  }
  return p.data as T;
 }
 return {
  projects:(signal?:AbortSignal)=>request<LabProject[]>(endpoint,"GET",undefined,signal),
  leads:(signal?:AbortSignal)=>request<LabLead[]>(endpoint+"?scope=crm","GET",undefined,signal),
  evidence:(id:string,signal?:AbortSignal)=>request<LabEvidence[]>(projectPath(id),"GET",undefined,signal),
  operations:(id:string,signal?:AbortSignal)=>request<LabOperations>(projectPath(id,"operations"),"GET",undefined,signal),
  delivery:(id:string,signal?:AbortSignal)=>request<LabDelivery>(projectPath(id,"delivery"),"GET",undefined,signal),
  quotes:(signal?:AbortSignal)=>request<LabQuote[]>(endpoint+"?scope=quotes","GET",undefined,signal),
  createEvidence:(body:{projectId:string;pillar:number;kind:LabEvidence["kind"];summary:string})=>request<LabEvidence>(endpoint,"POST",body),
  reviewEvidence:(body:{evidenceId:string;reviewed:boolean;reason:string})=>request<{changed:boolean}>(endpoint,"PATCH",body),
  mutate:(body:LabOperation)=>request<LabMutation>(endpoint,"PUT",body)
 };
}
export function labErrorMessage(error:unknown):string{
 if(!(error instanceof LabClientError))return "Não foi possível confirmar a operação. Atualize os registros antes de tentar novamente.";
 if(error.status===401)return "Sessão inválida ou expirada. Entre novamente.";
 if(error.status===403)return "Seu perfil não tem permissão para esta operação.";
 if(error.status===404)return "Ambiente ou registro indisponível.";
 if(error.status===409)return "O registro mudou ou já existe. Atualize antes de repetir.";
 if(error.status===400)return "Confira os campos e as condições exigidas para esta operação.";
 return "Não foi possível confirmar a operação. Atualize os registros antes de tentar novamente.";
}
