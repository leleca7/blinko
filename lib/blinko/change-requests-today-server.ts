import "server-only";

import { neon } from "@neondatabase/serverless";

function getSql(){const databaseUrl=process.env.DATABASE_URL;if(!databaseUrl)throw new Error("neon_not_configured");return neon(databaseUrl);}
function errorCode(error:unknown){if(!error||typeof error!=="object")return "";return typeof (error as {code?:unknown}).code==="string"?String((error as {code?:string}).code):"";}

export async function getChangeRequestTodayActions(){
  const sql=getSql();
  try{
    const rows=await sql`
      select jsonb_build_object(
        'counts',jsonb_build_object(
          'change_requests_pending_decision',(select count(*) from public.project_change_requests cr join public.projects p on p.id=cr.project_id where cr.decision_status='pending' and p.status in ('active','waiting_client','at_risk','paused')),
          'change_requests_ready_for_execution',(select count(*) from public.project_change_requests cr join public.projects p on p.id=cr.project_id where cr.decision_status='approved' and cr.status='approved_for_execution' and p.status in ('active','waiting_client','at_risk','paused'))
        ),
        'actions',coalesce((
          select jsonb_agg(action_row order by (action_row->>'priority') desc,(action_row->>'created_at')::timestamptz)
          from (
            select jsonb_build_object(
              'source','change_request','bucket','do_now','action_id',cr.id,
              'action_type',case when cr.classification='new_demand' then 'change_request_route' else 'change_request_decision' end,
              'status','pending',
              'priority',case when cr.classification in ('scope_change','new_demand') then 'high' else 'normal' end,
              'title',case cr.classification
                when 'new_demand' then 'Encaminhar nova demanda para o Comercial'
                when 'scope_change' then 'Decidir mudança de escopo'
                when 'in_scope_revision' then 'Decidir revisão dentro do escopo'
                else 'Decidir correção operacional'
              end,
              'due_at',cr.requested_at,'created_at',cr.created_at,
              'lead_id',null,'pre_diagnostic_id',null,'lead_name','',
              'company_name',c.name,'commercial_score',0,'lead_status','',
              'ai_analysis_status',null,'human_review_status',null,
              'project_id',p.id,'project_status',p.status,
              'responsible_label',cr.decision_owner_label,'opportunity_id',null,'pipeline_stage',''
            ) as action_row
            from public.project_change_requests cr
            join public.projects p on p.id=cr.project_id
            join public.companies c on c.id=p.company_id
            where cr.decision_status='pending' and p.status in ('active','waiting_client','at_risk','paused')
            union all
            select jsonb_build_object(
              'source','change_request','bucket','do_now','action_id',cr.id,
              'action_type','change_request_execute','status','pending','priority','normal',
              'title','Iniciar execução da alteração aprovada',
              'due_at',cr.decided_at,'created_at',cr.created_at,
              'lead_id',null,'pre_diagnostic_id',null,'lead_name','',
              'company_name',c.name,'commercial_score',0,'lead_status','',
              'ai_analysis_status',null,'human_review_status',null,
              'project_id',p.id,'project_status',p.status,
              'responsible_label',cr.decision_owner_label,'opportunity_id',null,'pipeline_stage',''
            ) as action_row
            from public.project_change_requests cr
            join public.projects p on p.id=cr.project_id
            join public.companies c on c.id=p.company_id
            where cr.decision_status='approved' and cr.status='approved_for_execution'
              and p.status in ('active','waiting_client','at_risk','paused')
          ) q
        ),'[]'::jsonb)
      ) as result
    `;
    const result=rows[0]?.result as Record<string,unknown>|undefined;
    return {counts:(result?.counts&&typeof result.counts==="object"?result.counts:{}),actions:Array.isArray(result?.actions)?result.actions:[]};
  }catch(error){
    if(["42P01","42703","42883"].includes(errorCode(error)))return {counts:{change_requests_pending_decision:0,change_requests_ready_for_execution:0},actions:[]};
    throw error;
  }
}
