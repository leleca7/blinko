-- Blinko OS — Diagnóstico Blinko oficial estruturado
-- Fonte: Documento 03 v1.0. Mantém diagnostic_collection_versions.pillars JSON para compatibilidade.
-- Aplicação inicial: branch de simulação.

create table if not exists public.diagnostic_pillars_catalog (
  methodology_version text not null,
  pillar_code text not null,
  position integer not null check (position between 1 and 10),
  name text not null,
  central_question text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (methodology_version,pillar_code),
  unique (methodology_version,position)
);

create table if not exists public.diagnostic_items_catalog (
  methodology_version text not null,
  item_code text not null,
  pillar_code text not null,
  position integer not null check (position > 0),
  question text not null,
  subtheme text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (methodology_version,item_code),
  foreign key (methodology_version,pillar_code) references public.diagnostic_pillars_catalog(methodology_version,pillar_code),
  unique (methodology_version,pillar_code,position)
);

create table if not exists public.diagnostic_item_responses (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  collection_version_id uuid not null references public.diagnostic_collection_versions(id) on delete cascade,
  methodology_version text not null,
  item_code text not null,
  response_state text not null default 'nv' check (response_state in ('score','nv','na')),
  score smallint,
  applicability_note text,
  response_context text,
  consultant_note text,
  related_pillars jsonb not null default '[]'::jsonb,
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (methodology_version,item_code) references public.diagnostic_items_catalog(methodology_version,item_code),
  unique (collection_version_id,item_code),
  check ((response_state='score' and score between 0 and 4) or (response_state in ('nv','na') and score is null))
);

create index if not exists diagnostic_item_responses_diagnostic_idx on public.diagnostic_item_responses(diagnostic_id,collection_version_id);
create index if not exists diagnostic_item_responses_state_idx on public.diagnostic_item_responses(collection_version_id,response_state);

create table if not exists public.diagnostic_item_evidence (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.diagnostic_item_responses(id) on delete cascade,
  evidence_type text not null check (evidence_type in ('A','B','C','D','E')),
  evidence_reference text,
  evidence_summary text not null,
  confidence text not null check (confidence in ('low','medium','high')),
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists diagnostic_item_evidence_response_idx on public.diagnostic_item_evidence(response_id);

create table if not exists public.diagnostic_findings (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  collection_version_id uuid not null references public.diagnostic_collection_versions(id) on delete cascade,
  item_response_id uuid references public.diagnostic_item_responses(id) on delete set null,
  problem_id uuid references public.diagnostic_problems(id) on delete set null,
  finding_type text not null check (finding_type in ('strength','gap','bottleneck','risk','opportunity','inconsistency')),
  primary_pillar text not null check (primary_pillar in ('P01','P02','P03','P04','P05','P06','P07','P08','P09','P10')),
  related_pillars jsonb not null default '[]'::jsonb,
  title text not null,
  current_state text not null,
  evidence_summary text not null,
  evidence_confidence text not null check (evidence_confidence in ('low','medium','high')),
  symptom text,
  probable_cause text,
  impact_score smallint check (impact_score between 1 and 5),
  urgency_score smallint check (urgency_score between 1 and 5),
  risk_score smallint check (risk_score between 1 and 5),
  icb_score integer generated always as (
    case when impact_score is not null and urgency_score is not null and risk_score is not null
      then impact_score::integer * urgency_score::integer * risk_score::integer else null end
  ) stored,
  dependency_class text check (dependency_class in ('D0','D1','D2','D3')),
  effort_class text check (effort_class in ('E1','E2','E3','E4','E5')),
  recommendation text,
  next_decision_owner text,
  status text not null default 'open' check (status in ('open','validated','prioritized','resolved','discarded')),
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    finding_type in ('strength','opportunity')
    or (impact_score is not null and urgency_score is not null and risk_score is not null and dependency_class is not null)
  )
);

create index if not exists diagnostic_findings_diagnostic_idx on public.diagnostic_findings(diagnostic_id,status);
create index if not exists diagnostic_findings_icb_idx on public.diagnostic_findings(diagnostic_id,icb_score desc) where icb_score is not null;

alter table public.diagnostic_priorities add column if not exists finding_id uuid references public.diagnostic_findings(id) on delete set null;
create index if not exists diagnostic_priorities_finding_idx on public.diagnostic_priorities(finding_id) where finding_id is not null;

create or replace function public.initialize_diagnostic_structured_collection(p_collection_version_id uuid,p_actor_label text) returns integer
language plpgsql set search_path=public as $$
declare
  v_diagnostic_id uuid;
  v_methodology text;
  v_count integer;
begin
  select diagnostic_id,methodology_version into v_diagnostic_id,v_methodology
  from public.diagnostic_collection_versions where id=p_collection_version_id;
  if v_diagnostic_id is null then raise exception 'collection version not found'; end if;

  insert into public.diagnostic_item_responses(diagnostic_id,collection_version_id,methodology_version,item_code,response_state,created_by_label)
  select v_diagnostic_id,p_collection_version_id,i.methodology_version,i.item_code,'nv',nullif(trim(coalesce(p_actor_label,'')),'')
  from public.diagnostic_items_catalog i
  where i.methodology_version=v_methodology and i.active
  on conflict(collection_version_id,item_code) do nothing;

  get diagnostics v_count = row_count;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('diagnostic',v_diagnostic_id,'diagnostic_structured_collection_initialized','human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('collection_version_id',p_collection_version_id,'methodology_version',v_methodology,'inserted_items',v_count));
  return v_count;
end; $$;

create or replace function public.upsert_diagnostic_item_response(
  p_collection_version_id uuid,
  p_item_code text,
  p_response_state text,
  p_score integer,
  p_applicability_note text,
  p_response_context text,
  p_consultant_note text,
  p_related_pillars jsonb,
  p_actor_label text
) returns uuid language plpgsql set search_path=public as $$
declare
  v_diagnostic_id uuid;
  v_methodology text;
  v_response_id uuid;
begin
  select diagnostic_id,methodology_version into v_diagnostic_id,v_methodology from public.diagnostic_collection_versions where id=p_collection_version_id;
  if v_diagnostic_id is null then raise exception 'collection version not found'; end if;
  if not exists(select 1 from public.diagnostic_items_catalog where methodology_version=v_methodology and item_code=p_item_code and active) then raise exception 'diagnostic item not found for methodology'; end if;
  if p_response_state not in ('score','nv','na') then raise exception 'invalid response state'; end if;
  if p_response_state='score' and (p_score is null or p_score<0 or p_score>4) then raise exception 'score must be between 0 and 4'; end if;
  if p_response_state<>'score' and p_score is not null then raise exception 'NV and N/A cannot have score'; end if;
  if p_response_state='na' and nullif(trim(coalesce(p_applicability_note,'')),'') is null then raise exception 'N/A requires applicability justification'; end if;

  insert into public.diagnostic_item_responses(diagnostic_id,collection_version_id,methodology_version,item_code,response_state,score,applicability_note,response_context,consultant_note,related_pillars,created_by_label)
  values(v_diagnostic_id,p_collection_version_id,v_methodology,trim(p_item_code),p_response_state,case when p_response_state='score' then p_score else null end,nullif(trim(coalesce(p_applicability_note,'')),''),nullif(trim(coalesce(p_response_context,'')),''),nullif(trim(coalesce(p_consultant_note,'')),''),coalesce(p_related_pillars,'[]'::jsonb),nullif(trim(coalesce(p_actor_label,'')),''))
  on conflict(collection_version_id,item_code) do update set response_state=excluded.response_state,score=excluded.score,applicability_note=excluded.applicability_note,response_context=excluded.response_context,consultant_note=excluded.consultant_note,related_pillars=excluded.related_pillars,updated_at=now()
  returning id into v_response_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('diagnostic_item_response',v_response_id,'diagnostic_item_response_upserted','human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('diagnostic_id',v_diagnostic_id,'collection_version_id',p_collection_version_id,'item_code',p_item_code,'response_state',p_response_state,'score',case when p_response_state='score' then p_score else null end));
  return v_response_id;
end; $$;

create or replace function public.add_diagnostic_item_evidence(
  p_response_id uuid,p_evidence_type text,p_evidence_reference text,p_evidence_summary text,p_confidence text,p_actor_label text
) returns uuid language plpgsql set search_path=public as $$
declare v_id uuid; v_diagnostic_id uuid;
begin
  select diagnostic_id into v_diagnostic_id from public.diagnostic_item_responses where id=p_response_id;
  if v_diagnostic_id is null then raise exception 'diagnostic item response not found'; end if;
  if p_evidence_type not in ('A','B','C','D','E') then raise exception 'invalid evidence type'; end if;
  if p_confidence not in ('low','medium','high') then raise exception 'invalid evidence confidence'; end if;
  if nullif(trim(coalesce(p_evidence_summary,'')),'') is null then raise exception 'evidence summary is required'; end if;
  insert into public.diagnostic_item_evidence(response_id,evidence_type,evidence_reference,evidence_summary,confidence,created_by_label)
  values(p_response_id,p_evidence_type,nullif(trim(coalesce(p_evidence_reference,'')),''),trim(p_evidence_summary),p_confidence,nullif(trim(coalesce(p_actor_label,'')),'')) returning id into v_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('diagnostic_item_evidence',v_id,'diagnostic_item_evidence_added','human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('diagnostic_id',v_diagnostic_id,'response_id',p_response_id,'evidence_type',p_evidence_type,'confidence',p_confidence));
  return v_id;
end; $$;

create or replace view public.diagnostic_pillar_scores as
with agg as (
  select r.collection_version_id,r.diagnostic_id,r.methodology_version,i.pillar_code,
    count(*)::integer as catalog_items,
    count(*) filter(where r.response_state<>'na')::integer as applicable_items,
    count(*) filter(where r.response_state='score')::integer as evaluated_items,
    count(*) filter(where r.response_state='nv')::integer as nv_items,
    count(*) filter(where r.response_state='na')::integer as na_items,
    coalesce(sum(r.score) filter(where r.response_state='score'),0)::integer as score_sum
  from public.diagnostic_item_responses r
  join public.diagnostic_items_catalog i on i.methodology_version=r.methodology_version and i.item_code=r.item_code
  group by r.collection_version_id,r.diagnostic_id,r.methodology_version,i.pillar_code
)
select a.*,p.position,p.name,
  case when a.evaluated_items>0 then round((a.score_sum::numeric/(a.evaluated_items*4))*100,2) else null end as maturity_index,
  case when a.applicable_items>0 then round((a.evaluated_items::numeric/a.applicable_items)*100,2) else 100.00 end as completeness_pct,
  case
    when a.applicable_items=0 then 'not_applicable'
    when a.evaluated_items=0 then 'inconclusive'
    when (a.nv_items::numeric/a.applicable_items)>0.20 then 'inconclusive'
    else 'valid'
  end as pillar_status,
  case
    when a.evaluated_items=0 then null
    when (a.score_sum::numeric/(a.evaluated_items*4))*100 <25 then 'fragile'
    when (a.score_sum::numeric/(a.evaluated_items*4))*100 <50 then 'basic'
    when (a.score_sum::numeric/(a.evaluated_items*4))*100 <75 then 'structuring'
    when (a.score_sum::numeric/(a.evaluated_items*4))*100 <90 then 'structured'
    else 'optimized'
  end as maturity_band
from agg a join public.diagnostic_pillars_catalog p on p.methodology_version=a.methodology_version and p.pillar_code=a.pillar_code;

create or replace view public.diagnostic_overall_scores as
select collection_version_id,diagnostic_id,methodology_version,
  count(*)::integer as pillars_total,
  count(*) filter(where pillar_status='valid')::integer as valid_pillars,
  count(*) filter(where pillar_status='inconclusive')::integer as inconclusive_pillars,
  round(avg(maturity_index) filter(where pillar_status='valid'),2) as maturity_index,
  round((sum(evaluated_items)::numeric/nullif(sum(applicable_items),0))*100,2) as completeness_pct
from public.diagnostic_pillar_scores
group by collection_version_id,diagnostic_id,methodology_version;

create or replace view public.diagnostic_quality_flags as
select r.collection_version_id,r.diagnostic_id,r.item_code,r.response_state,r.score,
  case
    when r.response_state='score' and r.score>=3 and not exists(select 1 from public.diagnostic_item_evidence e where e.response_id=r.id) then 'high_score_without_evidence'
    when r.response_state='na' and nullif(trim(coalesce(r.applicability_note,'')),'') is null then 'na_without_justification'
    else null
  end as quality_flag
from public.diagnostic_item_responses r
where (r.response_state='score' and r.score>=3 and not exists(select 1 from public.diagnostic_item_evidence e where e.response_id=r.id))
   or (r.response_state='na' and nullif(trim(coalesce(r.applicability_note,'')),'') is null);

create or replace view public.diagnostic_findings_scored as
select f.*,
  case when f.icb_score is null then null when f.icb_score<=15 then 'low' when f.icb_score<=39 then 'medium' when f.icb_score<=79 then 'high' else 'critical' end as criticality_band
from public.diagnostic_findings f;

create or replace function public.record_diagnostic_finding(
  p_diagnostic_id uuid,p_collection_version_id uuid,p_item_response_id uuid,p_problem_id uuid,p_finding_type text,p_primary_pillar text,p_related_pillars jsonb,p_title text,p_current_state text,p_evidence_summary text,p_evidence_confidence text,p_symptom text,p_probable_cause text,p_impact_score integer,p_urgency_score integer,p_risk_score integer,p_dependency_class text,p_effort_class text,p_recommendation text,p_next_decision_owner text,p_status text,p_actor_label text
) returns uuid language plpgsql set search_path=public as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.diagnostic_collection_versions where id=p_collection_version_id and diagnostic_id=p_diagnostic_id) then raise exception 'collection version does not belong to diagnostic'; end if;
  if p_item_response_id is not null and not exists(select 1 from public.diagnostic_item_responses where id=p_item_response_id and diagnostic_id=p_diagnostic_id and collection_version_id=p_collection_version_id) then raise exception 'item response does not belong to diagnostic collection'; end if;
  if p_finding_type not in ('strength','gap','bottleneck','risk','opportunity','inconsistency') then raise exception 'invalid finding type'; end if;
  if p_primary_pillar not in ('P01','P02','P03','P04','P05','P06','P07','P08','P09','P10') then raise exception 'invalid primary pillar'; end if;
  if p_evidence_confidence not in ('low','medium','high') then raise exception 'invalid evidence confidence'; end if;
  if p_status not in ('open','validated','prioritized','resolved','discarded') then raise exception 'invalid finding status'; end if;
  insert into public.diagnostic_findings(diagnostic_id,collection_version_id,item_response_id,problem_id,finding_type,primary_pillar,related_pillars,title,current_state,evidence_summary,evidence_confidence,symptom,probable_cause,impact_score,urgency_score,risk_score,dependency_class,effort_class,recommendation,next_decision_owner,status,created_by_label)
  values(p_diagnostic_id,p_collection_version_id,p_item_response_id,p_problem_id,p_finding_type,p_primary_pillar,coalesce(p_related_pillars,'[]'::jsonb),trim(p_title),trim(p_current_state),trim(p_evidence_summary),p_evidence_confidence,nullif(trim(coalesce(p_symptom,'')),''),nullif(trim(coalesce(p_probable_cause,'')),''),p_impact_score,p_urgency_score,p_risk_score,nullif(p_dependency_class,''),nullif(p_effort_class,''),nullif(trim(coalesce(p_recommendation,'')),''),nullif(trim(coalesce(p_next_decision_owner,'')),''),p_status,nullif(trim(coalesce(p_actor_label,'')),'')) returning id into v_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('diagnostic_finding',v_id,'diagnostic_finding_recorded','human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('diagnostic_id',p_diagnostic_id,'collection_version_id',p_collection_version_id,'item_response_id',p_item_response_id,'finding_type',p_finding_type,'primary_pillar',p_primary_pillar));
  return v_id;
end; $$;
