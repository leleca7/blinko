import "server-only";

import { neon } from "@neondatabase/serverless";

function getSql(){
  const databaseUrl=process.env.DATABASE_URL;
  if(!databaseUrl)throw new Error("neon_not_configured");
  return neon(databaseUrl);
}
function errorCode(error:unknown){if(!error||typeof error!=="object")return "";return typeof (error as {code?:unknown}).code==="string"?String((error as {code?:string}).code):"";}
export function isChangeRequestOverviewSchemaPending(error:unknown){return ["42P01","42703","42883"].includes(errorCode(error));}
function record(value:unknown){return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;}

export async function listChangeRequestProjects(){
  const sql=getSql();
  try{
    const rows=await sql`
      select jsonb_build_object(
        'project_id',p.id,
        'project_status',p.status,
        'objective',p.objective,
        'company_id',p.company_id,
        'company_name',c.name,
        'total_requests',(select count(*)::integer from public.project_change_requests cr where cr.project_id=p.id),
        'pending_decisions',(select count(*)::integer from public.project_change_requests cr where cr.project_id=p.id and cr.decision_status='pending'),
        'scope_changes',(select count(*)::integer from public.project_change_requests cr where cr.project_id=p.id and cr.classification='scope_change'),
        'revision_rounds',(select count(*)::integer from public.project_change_requests cr where cr.project_id=p.id and cr.consumes_revision=true),
        'open_change_requests',(select count(*)::integer from public.project_change_requests cr where cr.project_id=p.id and cr.status not in ('closed','rejected','routed','cancelled')),
        'latest_request_at',(select max(cr.requested_at) from public.project_change_requests cr where cr.project_id=p.id)
      ) as result
      from public.projects p
      join public.companies c on c.id=p.company_id
      where p.status in ('active','waiting_client','at_risk','paused')
         or exists(select 1 from public.project_change_requests cr where cr.project_id=p.id and cr.status not in ('closed','rejected','routed','cancelled'))
      order by
        (select count(*) from public.project_change_requests cr where cr.project_id=p.id and cr.decision_status='pending') desc,
        (select max(cr.requested_at) from public.project_change_requests cr where cr.project_id=p.id) desc nulls last,
        lower(c.name)
    `;
    return {schemaReady:true,projects:rows.map((row)=>record(row.result)).filter(Boolean) as Record<string,unknown>[]};
  }catch(error){
    if(isChangeRequestOverviewSchemaPending(error))return {schemaReady:false,projects:[] as Record<string,unknown>[]};
    throw error;
  }
}
