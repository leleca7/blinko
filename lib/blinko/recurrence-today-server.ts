import "server-only";

import { neon } from "@neondatabase/serverless";

function getSql(){const databaseUrl=process.env.DATABASE_URL;if(!databaseUrl)throw new Error("neon_not_configured");return neon(databaseUrl);}
function errorCode(error:unknown){if(!error||typeof error!=="object")return "";return typeof (error as {code?:unknown}).code==="string"?String((error as {code?:string}).code):"";}

export async function getRecurrenceTodayActions(input:{scopeAll:boolean;userId?:string|null;renewals:boolean;reassessments:boolean}){
  const sql=getSql();
  const userId=input.userId||null;
  try{
    const rows=await sql`
      select jsonb_build_object(
        'counts',jsonb_build_object(
          'renewal_reviews_due',case when ${input.renewals} then (
            select count(*) from public.recurring_renewal_queue rq
            where rq.queue_status in ('due_to_open','pending_decision')
              and (${input.scopeAll} or (${userId}::uuid is not null and public.internal_user_can_access_project(${userId}::uuid,rq.project_id,'projects.view')))
          ) else 0 end,
          'reassessments_due',case when ${input.reassessments} then (
            select count(*) from public.diagnostic_reassessment_queue dq
            where dq.project_id is not null and dq.queue_status in ('due','pending','in_progress')
              and (${input.scopeAll} or (${userId}::uuid is not null and public.internal_user_can_access_project(${userId}::uuid,dq.project_id,'projects.view')))
          ) else 0 end
        ),
        'actions',coalesce((
          select jsonb_agg(action_row order by (action_row->>'due_at')::timestamptz nulls last,(action_row->>'created_at')::timestamptz)
          from (
            select jsonb_build_object(
              'source','renewal','bucket','do_now','action_id',coalesce(rq.review_id,rq.plan_id),
              'action_type',case when rq.queue_status='due_to_open' then 'renewal_open' else 'renewal_decision' end,
              'status','pending','priority',case when rq.due_at<now() then 'urgent' else 'high' end,
              'title',case when rq.queue_status='due_to_open' then 'Abrir revisão de renovação' else 'Decidir renovação recorrente' end,
              'due_at',rq.due_at,'created_at',coalesce((select opened_at from public.contract_renewal_reviews r where r.id=rq.review_id),rq.due_at),
              'lead_id',null,'pre_diagnostic_id',null,'lead_name','','company_name',c.name,'commercial_score',0,'lead_status','',
              'ai_analysis_status',null,'human_review_status',null,'project_id',p.id,'project_status',p.status,
              'responsible_label',rq.owner_label,'opportunity_id',rq.opportunity_id,'pipeline_stage',''
            ) as action_row
            from public.recurring_renewal_queue rq
            join public.projects p on p.id=rq.project_id
            join public.companies c on c.id=rq.company_id
            where ${input.renewals} and rq.queue_status in ('due_to_open','pending_decision')
              and (${input.scopeAll} or (${userId}::uuid is not null and public.internal_user_can_access_project(${userId}::uuid,p.id,'projects.view')))
            union all
            select jsonb_build_object(
              'source','reassessment','bucket','do_now','action_id',dq.id,
              'action_type',case when dq.status='in_progress' then 'reassessment_continue' when dq.route='to_define' then 'reassessment_route' when dq.route='included_in_contract' then 'reassessment_start' else 'reassessment_followup' end,
              'status','pending','priority',case when dq.due_at<now() then 'urgent' else 'high' end,
              'title',case when dq.status='in_progress' then 'Continuar reavaliação diagnóstica' when dq.route='to_define' then 'Definir rota da reavaliação diagnóstica' when dq.route='included_in_contract' then 'Iniciar reavaliação diagnóstica' else 'Tratar reavaliação diagnóstica' end,
              'due_at',dq.due_at,'created_at',dq.scheduled_at,
              'lead_id',null,'pre_diagnostic_id',null,'lead_name','','company_name',c.name,'commercial_score',0,'lead_status','',
              'ai_analysis_status',null,'human_review_status',null,'project_id',p.id,'project_status',p.status,
              'responsible_label',dq.owner_label,'opportunity_id',dq.opportunity_id,'pipeline_stage',''
            ) as action_row
            from public.diagnostic_reassessment_queue dq
            join public.projects p on p.id=dq.project_id
            join public.companies c on c.id=dq.company_id
            where ${input.reassessments} and dq.project_id is not null and dq.queue_status in ('due','pending','in_progress')
              and (${input.scopeAll} or (${userId}::uuid is not null and public.internal_user_can_access_project(${userId}::uuid,p.id,'projects.view')))
          ) q
        ),'[]'::jsonb)
      ) as result
    `;
    const result=rows[0]?.result as Record<string,unknown>|undefined;
    return {counts:result?.counts&&typeof result.counts==="object"?result.counts:{renewal_reviews_due:0,reassessments_due:0},actions:Array.isArray(result?.actions)?result.actions:[]};
  }catch(error){
    if(["42P01","42703","42883"].includes(errorCode(error)))return {counts:{renewal_reviews_due:0,reassessments_due:0},actions:[]};
    throw error;
  }
}
