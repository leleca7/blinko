-- Blinko OS — valor estimado auditável para forecast comercial
-- Fonte funcional: Documento 05 — Comercial e Jornada do Cliente + Documento 07 — Financeiro e Indicadores.
-- Depende de 021, 027 e 041.
-- Produção/main não deve receber esta migração sem promoção controlada.

create or replace function public.set_commercial_opportunity_estimate(
  p_opportunity_id uuid,
  p_estimated_value numeric,
  p_expected_close_date date,
  p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_previous_value numeric;
  v_previous_close date;
  v_stage text;
  v_outcome text;
begin
  if p_estimated_value is null or p_estimated_value <= 0 then
    raise exception 'estimated value must be greater than zero';
  end if;
  if nullif(trim(coalesce(p_actor_label,'')),'') is null then
    raise exception 'actor is required';
  end if;

  select estimated_value,expected_close_date,pipeline_stage,outcome_status
  into v_previous_value,v_previous_close,v_stage,v_outcome
  from public.commercial_opportunities
  where id=p_opportunity_id
  for update;

  if v_stage is null then raise exception 'opportunity not found'; end if;
  if v_outcome is not null then raise exception 'closed opportunity estimate cannot be changed'; end if;
  if v_stage not in ('P01','P02','P03','P04','P05','P06','P07','P08','P09','P10','P11','P12','P13') then
    raise exception 'opportunity stage does not accept forecast estimate';
  end if;

  update public.commercial_opportunities
  set estimated_value=p_estimated_value,
      expected_close_date=p_expected_close_date,
      updated_at=now()
  where id=p_opportunity_id;

  if v_previous_value is distinct from p_estimated_value or v_previous_close is distinct from p_expected_close_date then
    insert into public.commercial_opportunity_events(
      opportunity_id,event_type,summary,actor_label,payload
    ) values(
      p_opportunity_id,'estimate_changed','Estimativa comercial atualizada',trim(p_actor_label),
      jsonb_build_object(
        'previous_estimated_value',v_previous_value,
        'estimated_value',p_estimated_value,
        'previous_expected_close_date',v_previous_close,
        'expected_close_date',p_expected_close_date,
        'pipeline_stage',v_stage
      )
    );

    insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
    values(
      'commercial_opportunity',p_opportunity_id,'commercial_opportunity_estimate_changed',
      public.commercial_audit_actor_type(p_actor_label),trim(p_actor_label),
      jsonb_build_object(
        'previous_estimated_value',v_previous_value,
        'estimated_value',p_estimated_value,
        'previous_expected_close_date',v_previous_close,
        'expected_close_date',p_expected_close_date,
        'pipeline_stage',v_stage
      )
    );
  end if;

  return p_opportunity_id;
end;
$$;
