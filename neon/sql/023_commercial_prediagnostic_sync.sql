-- Blinko OS — sincronização do pré-diagnóstico com o pipeline oficial.

create or replace function public.commercial_sync_from_pre_diagnostic_review()
returns trigger language plpgsql set search_path=public as $$
declare
  v_id uuid;
  v_current text;
  v_reviewer text;
  v_target text;
  v_action text;
begin
  if new.human_review_status is not distinct from old.human_review_status then return new; end if;
  select id,pipeline_stage into v_id,v_current
  from public.commercial_opportunities
  where pre_diagnostic_id=new.id and outcome_status is null
  order by created_at desc limit 1;
  if v_id is null then return new; end if;

  select reviewer_label into v_reviewer
  from public.pre_diagnostic_review_versions
  where id=new.current_human_review_id;

  if new.human_review_status='reviewing' then
    v_target:='P03';
    v_action:='Concluir qualificação do pré-diagnóstico';
  elsif new.human_review_status='reviewed' then
    v_target:='P04';
    v_action:='Definir encaminhamento: diagnóstico/triagem ou solução objetiva';
  else
    return new;
  end if;

  if public.commercial_stage_number(v_current) <= public.commercial_stage_number(v_target) then
    perform public.set_commercial_opportunity_stage(
      v_id,v_target,coalesce(nullif(trim(v_reviewer),''),'Blinko'),v_action,now(),'interno',
      'Sincronização automática pela revisão do pré-diagnóstico.','system'
    );
  end if;
  return new;
end; $$;

drop trigger if exists commercial_sync_from_pre_diagnostic_review_trg on public.pre_diagnostics;
create trigger commercial_sync_from_pre_diagnostic_review_trg
  after update of human_review_status,current_human_review_id on public.pre_diagnostics
  for each row execute function public.commercial_sync_from_pre_diagnostic_review();

create or replace function public.commercial_sync_from_initial_reading()
returns trigger language plpgsql set search_path=public as $$
declare v_id uuid;v_current text;
begin
  if new.status is not distinct from old.status or new.status<>'sent' then return new; end if;
  select id,pipeline_stage into v_id,v_current
  from public.commercial_opportunities
  where pre_diagnostic_id=new.pre_diagnostic_id and outcome_status is null
  order by created_at desc limit 1;
  if v_id is null then return new; end if;
  if public.commercial_stage_number(v_current) <= 2 then
    perform public.set_commercial_opportunity_stage(
      v_id,'P02',coalesce(nullif(trim(new.approved_by_label),''),'Blinko'),
      'Acompanhar retorno e concluir qualificação',now(),coalesce(nullif(trim(new.channel),''),'interno'),
      'Leitura inicial registrada como enviada.','system'
    );
  end if;
  return new;
end; $$;

drop trigger if exists commercial_sync_from_initial_reading_trg on public.pre_diagnostic_initial_readings;
create trigger commercial_sync_from_initial_reading_trg
  after update of status on public.pre_diagnostic_initial_readings
  for each row execute function public.commercial_sync_from_initial_reading();
