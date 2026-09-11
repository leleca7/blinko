-- Blinko OS — imutabilidade de classificação/decisão de Change Request
-- Depende de 034–035.
-- Regra: depois de sair de pending, a decisão não é reescrita. Nova situação = novo Change Request.

create or replace function public.project_change_request_decision_immutable_guard()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.classification is distinct from old.classification then
    raise exception 'change request classification is immutable; cancel and create a new request if reclassification is required';
  end if;

  if old.decision_status <> 'pending' then
    raise exception 'change request decision is immutable after human decision; create a new request for a new situation';
  end if;

  return new;
end;
$$;

create trigger project_change_request_decision_immutable_guard_trg
  before update of classification,decision_status on public.project_change_requests
  for each row execute function public.project_change_request_decision_immutable_guard();
