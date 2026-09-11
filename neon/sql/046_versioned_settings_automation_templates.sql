-- Blinko OS — Configurações, regras de automação e templates versionados
-- Fonte funcional: Documento 08 — BLINKO — SISTEMA E AUTOMAÇÃO, seções 5.23, 6, 7.11, 11, 12, 16, 17, 18, 22–25.
-- Regra central: configuração de negócio é versionada, evidenciada e auditável; cadastrar uma regra não executa código arbitrário.
-- Drive permanece como repositório de conteúdo documental; o OS guarda metadados, versão e referência.
-- Depende de 024, 041, 044 e 045.
-- Produção/main não deve receber esta migração sem promoção controlada.

insert into public.internal_permissions(code,name,domain,sensitivity,description)
values
  ('settings.view','Ver configurações','settings','sensitive','Consultar parâmetros, regras de automação, templates e seus históricos versionados.'),
  ('settings.manage','Gerenciar configurações','settings','critical','Criar novas versões governadas de parâmetros, regras de automação e templates.')
on conflict (code) do update set
  name=excluded.name,domain=excluded.domain,sensitivity=excluded.sensitivity,description=excluded.description;

-- Na V1 somente Admin recebe configuração geral. Gestão de usuários permanece permissão separada.
insert into public.internal_role_permissions(role_code,permission_code)
values ('admin','settings.view'),('admin','settings.manage')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Parâmetros gerais de negócio
-- Indicadores continuam usando indicator_parameters (041); esta estrutura cobre
-- somente parâmetros transversais não pertencentes a um indicador específico.
-- -----------------------------------------------------------------------------
create table if not exists public.os_parameter_definitions (
  parameter_key text primary key,
  domain text not null check (domain in ('commercial','diagnostic','operation','financial','partners','communications','files','system')),
  name text not null,
  description text not null,
  value_kind text not null check (value_kind in ('boolean','number','string','object','array')),
  sensitivity text not null default 'normal' check (sensitivity in ('normal','sensitive','critical')),
  source_document text,
  source_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parameter_key ~ '^[a-z][a-z0-9_.-]{2,119}$'),
  check (nullif(trim(name),'') is not null),
  check (nullif(trim(description),'') is not null)
);

create table if not exists public.os_parameter_versions (
  id uuid primary key default gen_random_uuid(),
  parameter_key text not null references public.os_parameter_definitions(parameter_key) on delete restrict,
  version_number integer not null check (version_number > 0),
  is_current boolean not null default true,
  value_json jsonb not null,
  status text not null default 'active' check (status in ('active','retired')),
  valid_from date,
  valid_until date,
  evidence_reference text not null,
  approved_by_label text not null,
  approved_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(parameter_key,version_number),
  check (valid_until is null or valid_from is null or valid_until >= valid_from),
  check (nullif(trim(evidence_reference),'') is not null),
  check (nullif(trim(approved_by_label),'') is not null),
  check (status <> 'retired' or is_current = false)
);

create unique index if not exists os_parameter_versions_current_uidx
  on public.os_parameter_versions(parameter_key) where is_current;

create or replace function public.validate_os_parameter_value()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_kind text;
  v_json_kind text;
begin
  select value_kind into v_kind from public.os_parameter_definitions where parameter_key=new.parameter_key;
  if v_kind is null then raise exception 'parameter definition not found'; end if;
  v_json_kind:=jsonb_typeof(new.value_json);
  if v_kind='boolean' and v_json_kind<>'boolean' then raise exception 'parameter requires boolean value'; end if;
  if v_kind='number' and v_json_kind<>'number' then raise exception 'parameter requires numeric value'; end if;
  if v_kind='string' and v_json_kind<>'string' then raise exception 'parameter requires string value'; end if;
  if v_kind='object' and v_json_kind<>'object' then raise exception 'parameter requires object value'; end if;
  if v_kind='array' and v_json_kind<>'array' then raise exception 'parameter requires array value'; end if;
  return new;
end;
$$;

drop trigger if exists os_parameter_versions_validate_trg on public.os_parameter_versions;
create trigger os_parameter_versions_validate_trg
before insert or update of parameter_key,value_json on public.os_parameter_versions
for each row execute function public.validate_os_parameter_value();

create or replace function public.set_os_parameter_version(
  p_parameter_key text,
  p_domain text,
  p_name text,
  p_description text,
  p_value_kind text,
  p_sensitivity text,
  p_value_json jsonb,
  p_valid_from date,
  p_valid_until date,
  p_evidence_reference text,
  p_source_document text,
  p_source_version text,
  p_notes text,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_existing public.os_parameter_definitions%rowtype;
  v_version integer;
  v_id uuid;
  v_key text:=lower(trim(coalesce(p_parameter_key,'')));
  v_sensitivity text:=coalesce(nullif(trim(coalesce(p_sensitivity,'')),''),'normal');
begin
  if v_key !~ '^[a-z][a-z0-9_.-]{2,119}$' then raise exception 'invalid parameter key'; end if;
  if p_domain not in ('commercial','diagnostic','operation','financial','partners','communications','files','system') then raise exception 'invalid parameter domain'; end if;
  if p_value_kind not in ('boolean','number','string','object','array') then raise exception 'invalid parameter value kind'; end if;
  if v_sensitivity not in ('normal','sensitive','critical') then raise exception 'invalid parameter sensitivity'; end if;
  if p_value_json is null then raise exception 'parameter value is required'; end if;
  if nullif(trim(coalesce(p_name,'')),'') is null then raise exception 'parameter name is required'; end if;
  if nullif(trim(coalesce(p_description,'')),'') is null then raise exception 'parameter description is required'; end if;
  if nullif(trim(coalesce(p_evidence_reference,'')),'') is null then raise exception 'parameter requires evidence/reference'; end if;
  if nullif(trim(coalesce(p_actor_label,'')),'') is null then raise exception 'parameter approver is required'; end if;
  if p_valid_until is not null and p_valid_from is not null and p_valid_until<p_valid_from then raise exception 'invalid parameter validity period'; end if;

  select * into v_existing from public.os_parameter_definitions where parameter_key=v_key for update;
  if found then
    if v_existing.domain<>p_domain or v_existing.value_kind<>p_value_kind then
      raise exception 'parameter domain/value kind are immutable; create a new key for a different semantic';
    end if;
    update public.os_parameter_definitions
       set name=trim(p_name),description=trim(p_description),sensitivity=v_sensitivity,
           source_document=nullif(trim(coalesce(p_source_document,'')),''),
           source_version=nullif(trim(coalesce(p_source_version,'')),''),updated_at=now()
     where parameter_key=v_key;
  else
    insert into public.os_parameter_definitions(parameter_key,domain,name,description,value_kind,sensitivity,source_document,source_version)
    values(v_key,p_domain,trim(p_name),trim(p_description),p_value_kind,v_sensitivity,
      nullif(trim(coalesce(p_source_document,'')),''),nullif(trim(coalesce(p_source_version,'')),''));
  end if;

  update public.os_parameter_versions set is_current=false,status='retired',updated_at=now()
   where parameter_key=v_key and is_current;
  select coalesce(max(version_number),0)+1 into v_version from public.os_parameter_versions where parameter_key=v_key;

  insert into public.os_parameter_versions(parameter_key,version_number,is_current,value_json,status,valid_from,valid_until,evidence_reference,approved_by_label,approved_at,notes)
  values(v_key,v_version,true,p_value_json,'active',p_valid_from,p_valid_until,trim(p_evidence_reference),trim(p_actor_label),now(),nullif(trim(coalesce(p_notes,'')),''))
  returning id into v_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('os_parameter',v_id,'os_parameter_version_created',public.commercial_audit_actor_type(p_actor_label),trim(p_actor_label),
    jsonb_build_object('parameter_key',v_key,'version_number',v_version,'domain',p_domain,'evidence_reference',trim(p_evidence_reference)));
  return v_id;
end;
$$;

create or replace function public.current_os_parameter_json(p_parameter_key text)
returns jsonb
language sql
stable
set search_path=public
as $$
  select v.value_json
  from public.os_parameter_versions v
  where v.parameter_key=lower(trim(p_parameter_key)) and v.is_current and v.status='active'
    and (v.valid_from is null or v.valid_from<=current_date)
    and (v.valid_until is null or v.valid_until>=current_date)
  order by v.version_number desc limit 1
$$;

create or replace view public.os_parameter_catalog as
select d.parameter_key,d.domain,d.name,d.description,d.value_kind,d.sensitivity,d.source_document,d.source_version,
       v.id as current_version_id,v.version_number,v.value_json,v.valid_from,v.valid_until,v.evidence_reference,
       v.approved_by_label,v.approved_at,v.notes
from public.os_parameter_definitions d
left join public.os_parameter_versions v on v.parameter_key=d.parameter_key and v.is_current and v.status='active';

-- -----------------------------------------------------------------------------
-- Catálogo oficial de regras A01–A25 + versões governadas.
-- O catálogo descreve intenção oficial. Só uma versão explícita pode indicar
-- status operacional, e status não executa código arbitrário por si só.
-- -----------------------------------------------------------------------------
create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  domain text not null check (domain in ('commercial','diagnostic','operation','financial','partners','communications','files','system')),
  name text not null,
  official_intent text not null,
  source_document text not null default '08 — BLINKO — SISTEMA E AUTOMAÇÃO',
  source_version text not null default 'v1.0 — 09/09/2026',
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code ~ '^A[0-9]{2}$'),
  check (nullif(trim(name),'') is not null),
  check (nullif(trim(official_intent),'') is not null)
);

insert into public.automation_rules(code,domain,name,official_intent,display_order)
values
 ('A01','commercial','Nova empresa/lead','Ao cadastrar empresa e contato, gerar registro comercial e próxima ação obrigatória.',10),
 ('A02','commercial','Oportunidade ativa sem próxima ação','Bloquear/alertar até que próxima ação e data sejam definidas.',20),
 ('A03','diagnostic','Diagnóstico iniciado','Criar instância do questionário oficial, checklist de evidências e pendências.',30),
 ('A04','diagnostic','Diagnóstico suficientemente concluído','Calcular maturidade, completude e ICB; listar NV; abrir etapa de validação humana.',40),
 ('A05','diagnostic','Prioridade validada','Vincular soluções elegíveis do catálogo e preparar plano de ação inicial.',50),
 ('A06','commercial','Proposta criada','Reaproveitar empresa, contato, problema, solução, escopo, entregáveis e parceiro; exigir preço e validação financeira.',60),
 ('A07','financial','Desconto inserido','Recalcular margem projetada e alertar/bloquear se abaixo do parâmetro vigente.',70),
 ('A08','commercial','Oportunidade ganha / contratação formalizada','Atualizar status, criar/vincular contrato, iniciar onboarding e preparar projeto.',80),
 ('A09','operation','Contrato assinado e condição de início cumprida','Criar estrutura de projeto, pasta no Drive, tarefas iniciais e recebíveis previstos.',90),
 ('A10','operation','Onboarding','Solicitar apenas dados ainda ausentes e módulos específicos da solução contratada.',100),
 ('A11','operation','Projeto criado','Aplicar template operacional da solução, gerar tarefas, portões de qualidade e marcos.',110),
 ('A12','operation','Dependência do cliente','Mover tarefa para aguardando cliente, registrar solicitação e criar data de acompanhamento.',120),
 ('A13','partners','Dependência de parceiro','Mover para aguardando parceiro, registrar responsável e follow-up.',130),
 ('A14','operation','Tarefa bloqueada','Exigir motivo, responsável pelo desbloqueio, impacto e próxima verificação.',140),
 ('A15','operation','Entregável pronto','Exigir revisão interna/QA antes de liberar aprovação externa quando aplicável.',150),
 ('A16','operation','Aprovação solicitada','Registrar versão enviada e criar lembrete de acompanhamento.',160),
 ('A17','operation','Aprovação recebida','Registrar evidência, decisão e liberar próxima etapa.',170),
 ('A18','operation','Pedido de alteração','Classificar como correção de erro, revisão ou mudança de escopo antes de abrir tarefa.',180),
 ('A19','financial','Recebível próximo do vencimento','Gerar alerta interno e, futuramente, comunicação automática quando a política estiver validada.',190),
 ('A20','financial','Recebível vencido','Atualizar inadimplência, criar ação de cobrança e aplicar regras contratuais configuradas.',200),
 ('A21','partners','Repasse de parceiro','Gerar obrigação somente quando a regra financeira estiver formalizada; base de cálculo indefinida não pode ser automatizada.',210),
 ('A22','operation','Projeto encerrado','Validar checklist, registrar entrega, custos, receita, horas, margem, aprendizados e arquivamento.',220),
 ('A23','operation','Contrato recorrente','Ao fechar um ciclo, criar o próximo somente se contrato estiver ativo e condições necessárias forem satisfeitas.',230),
 ('A24','commercial','Renovação','Alertar antes da data definida e abrir ação comercial de renovação/expansão/encerramento.',240),
 ('A25','diagnostic','Reavaliação diagnóstica','Quando a data de revisão chegar, criar pendência para nova avaliação sem sobrescrever o diagnóstico anterior.',250)
on conflict (code) do update set
  domain=excluded.domain,name=excluded.name,official_intent=excluded.official_intent,display_order=excluded.display_order,updated_at=now();

create table if not exists public.automation_rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.automation_rules(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  is_current boolean not null default true,
  status text not null check (status in ('draft','inactive','pilot','active','retired')),
  execution_mode text not null check (execution_mode in ('manual','deterministic','external')),
  runtime_binding text,
  trigger_description text not null,
  conditions_json jsonb not null default '[]'::jsonb,
  actions_json jsonb not null,
  exceptions_json jsonb not null default '[]'::jsonb,
  owner_label text not null,
  expected_result text not null,
  retry_policy text not null,
  evidence_reference text not null,
  approved_by_label text not null,
  approved_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(rule_id,version_number),
  check (jsonb_typeof(conditions_json)='array'),
  check (jsonb_typeof(actions_json)='array' and jsonb_array_length(actions_json)>0),
  check (jsonb_typeof(exceptions_json)='array'),
  check (nullif(trim(trigger_description),'') is not null),
  check (nullif(trim(owner_label),'') is not null),
  check (nullif(trim(expected_result),'') is not null),
  check (nullif(trim(retry_policy),'') is not null),
  check (nullif(trim(evidence_reference),'') is not null),
  check (nullif(trim(approved_by_label),'') is not null),
  check (execution_mode<>'deterministic' or status not in ('pilot','active') or nullif(trim(coalesce(runtime_binding,'')),'') is not null),
  check (status<>'retired' or is_current=false)
);

create unique index if not exists automation_rule_versions_current_uidx
  on public.automation_rule_versions(rule_id) where is_current;

create table if not exists public.automation_rule_executions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.automation_rules(id) on delete restrict,
  rule_version_id uuid not null references public.automation_rule_versions(id) on delete restrict,
  idempotency_key text not null,
  entity_type text,
  entity_id uuid,
  trigger_context jsonb not null default '{}'::jsonb,
  status text not null default 'started' check (status in ('started','succeeded','failed','skipped')),
  result_json jsonb,
  error_detail text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  started_by_label text not null,
  completed_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(rule_version_id,idempotency_key),
  check (nullif(trim(idempotency_key),'') is not null),
  check (nullif(trim(started_by_label),'') is not null),
  check ((status='started' and completed_at is null) or (status<>'started' and completed_at is not null)),
  check (status<>'failed' or nullif(trim(coalesce(error_detail,'')),'') is not null)
);

create index if not exists automation_rule_executions_rule_idx
  on public.automation_rule_executions(rule_id,started_at desc);

create or replace function public.set_automation_rule_version(
  p_rule_code text,
  p_status text,
  p_execution_mode text,
  p_runtime_binding text,
  p_trigger_description text,
  p_conditions_json jsonb,
  p_actions_json jsonb,
  p_exceptions_json jsonb,
  p_owner_label text,
  p_expected_result text,
  p_retry_policy text,
  p_evidence_reference text,
  p_notes text,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_rule_id uuid;
  v_version integer;
  v_id uuid;
begin
  select id into v_rule_id from public.automation_rules where code=upper(trim(coalesce(p_rule_code,''))) for update;
  if v_rule_id is null then raise exception 'automation rule not found'; end if;
  if p_status not in ('draft','inactive','pilot','active') then raise exception 'invalid automation rule status'; end if;
  if p_execution_mode not in ('manual','deterministic','external') then raise exception 'invalid execution mode'; end if;
  if p_execution_mode='deterministic' and p_status in ('pilot','active') and nullif(trim(coalesce(p_runtime_binding,'')),'') is null then
    raise exception 'deterministic pilot/active rule requires runtime binding';
  end if;
  if nullif(trim(coalesce(p_trigger_description,'')),'') is null then raise exception 'automation trigger is required'; end if;
  if p_conditions_json is null or jsonb_typeof(p_conditions_json)<>'array' then raise exception 'automation conditions must be an array'; end if;
  if p_actions_json is null or jsonb_typeof(p_actions_json)<>'array' or jsonb_array_length(p_actions_json)=0 then raise exception 'automation requires at least one action'; end if;
  if p_exceptions_json is null or jsonb_typeof(p_exceptions_json)<>'array' then raise exception 'automation exceptions must be an array'; end if;
  if nullif(trim(coalesce(p_owner_label,'')),'') is null then raise exception 'automation owner is required'; end if;
  if nullif(trim(coalesce(p_expected_result,'')),'') is null then raise exception 'automation expected result is required'; end if;
  if nullif(trim(coalesce(p_retry_policy,'')),'') is null then raise exception 'automation retry policy is required'; end if;
  if nullif(trim(coalesce(p_evidence_reference,'')),'') is null then raise exception 'automation requires evidence/reference'; end if;
  if nullif(trim(coalesce(p_actor_label,'')),'') is null then raise exception 'automation approver is required'; end if;

  update public.automation_rule_versions set is_current=false,status='retired',updated_at=now()
   where rule_id=v_rule_id and is_current;
  select coalesce(max(version_number),0)+1 into v_version from public.automation_rule_versions where rule_id=v_rule_id;

  insert into public.automation_rule_versions(rule_id,version_number,is_current,status,execution_mode,runtime_binding,trigger_description,
    conditions_json,actions_json,exceptions_json,owner_label,expected_result,retry_policy,evidence_reference,approved_by_label,approved_at,notes)
  values(v_rule_id,v_version,true,p_status,p_execution_mode,nullif(trim(coalesce(p_runtime_binding,'')),''),trim(p_trigger_description),
    p_conditions_json,p_actions_json,p_exceptions_json,trim(p_owner_label),trim(p_expected_result),trim(p_retry_policy),trim(p_evidence_reference),trim(p_actor_label),now(),nullif(trim(coalesce(p_notes,'')),''))
  returning id into v_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('automation_rule_version',v_id,'automation_rule_version_created',public.commercial_audit_actor_type(p_actor_label),trim(p_actor_label),
    jsonb_build_object('rule_code',upper(trim(p_rule_code)),'version_number',v_version,'status',p_status,'execution_mode',p_execution_mode,
      'runtime_binding',nullif(trim(coalesce(p_runtime_binding,'')),''),'evidence_reference',trim(p_evidence_reference)));
  return v_id;
end;
$$;

create or replace function public.begin_automation_rule_execution(
  p_rule_code text,
  p_idempotency_key text,
  p_entity_type text,
  p_entity_id uuid,
  p_trigger_context jsonb,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_rule_id uuid;
  v_version_id uuid;
  v_id uuid;
begin
  select r.id,v.id into v_rule_id,v_version_id
  from public.automation_rules r
  join public.automation_rule_versions v on v.rule_id=r.id and v.is_current
  where r.code=upper(trim(coalesce(p_rule_code,''))) and v.status in ('pilot','active')
  limit 1;
  if v_rule_id is null then raise exception 'automation rule is not pilot/active'; end if;
  if nullif(trim(coalesce(p_idempotency_key,'')),'') is null then raise exception 'automation idempotency key is required'; end if;
  if nullif(trim(coalesce(p_actor_label,'')),'') is null then raise exception 'automation execution actor is required'; end if;

  insert into public.automation_rule_executions(rule_id,rule_version_id,idempotency_key,entity_type,entity_id,trigger_context,status,started_by_label)
  values(v_rule_id,v_version_id,trim(p_idempotency_key),nullif(trim(coalesce(p_entity_type,'')),''),p_entity_id,coalesce(p_trigger_context,'{}'::jsonb),'started',trim(p_actor_label))
  returning id into v_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('automation_rule_execution',v_id,'automation_rule_execution_started',public.commercial_audit_actor_type(p_actor_label),trim(p_actor_label),
    jsonb_build_object('rule_code',upper(trim(p_rule_code)),'rule_version_id',v_version_id,'idempotency_key',trim(p_idempotency_key),
      'target_entity_type',nullif(trim(coalesce(p_entity_type,'')),''),'target_entity_id',p_entity_id));
  return v_id;
end;
$$;

create or replace function public.finish_automation_rule_execution(
  p_execution_id uuid,
  p_status text,
  p_result_json jsonb,
  p_error_detail text,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_current text;
begin
  if p_status not in ('succeeded','failed','skipped') then raise exception 'invalid automation final status'; end if;
  if p_status='failed' and nullif(trim(coalesce(p_error_detail,'')),'') is null then raise exception 'failed automation requires error detail'; end if;
  if nullif(trim(coalesce(p_actor_label,'')),'') is null then raise exception 'automation completion actor is required'; end if;
  select status into v_current from public.automation_rule_executions where id=p_execution_id for update;
  if v_current is null then raise exception 'automation execution not found'; end if;
  if v_current<>'started' then raise exception 'automation execution is already finalized'; end if;

  update public.automation_rule_executions
     set status=p_status,result_json=p_result_json,error_detail=nullif(trim(coalesce(p_error_detail,'')),''),
         completed_at=now(),completed_by_label=trim(p_actor_label),updated_at=now()
   where id=p_execution_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('automation_rule_execution',p_execution_id,'automation_rule_execution_finished',public.commercial_audit_actor_type(p_actor_label),trim(p_actor_label),
    jsonb_build_object('status',p_status,'error_detail',nullif(trim(coalesce(p_error_detail,'')),'')));
  return p_execution_id;
end;
$$;

create or replace view public.automation_rule_catalog as
select r.id,r.code,r.domain,r.name,r.official_intent,r.source_document,r.source_version,r.display_order,
       v.id as current_version_id,v.version_number,v.status,v.execution_mode,v.runtime_binding,v.trigger_description,
       v.conditions_json,v.actions_json,v.exceptions_json,v.owner_label,v.expected_result,v.retry_policy,
       v.evidence_reference,v.approved_by_label,v.approved_at,v.notes,
       (select max(e.started_at) from public.automation_rule_executions e where e.rule_id=r.id) as last_execution_at,
       (select count(*) from public.automation_rule_executions e where e.rule_id=r.id and e.status='failed') as failure_count
from public.automation_rules r
left join public.automation_rule_versions v on v.rule_id=r.id and v.is_current
order by r.display_order,r.code;

-- -----------------------------------------------------------------------------
-- Templates documentais: conteúdo permanece no Drive; OS controla identidade,
-- versão, público, origem de dados, responsável, revisão e referência.
-- -----------------------------------------------------------------------------
create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  template_type text not null,
  name text not null,
  description text,
  source_document text not null default '08 — BLINKO — SISTEMA E AUTOMAÇÃO',
  source_version text not null default 'v1.0 — 09/09/2026',
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code ~ '^TPL_[A-Z0-9_]{3,60}$'),
  check (nullif(trim(template_type),'') is not null),
  check (nullif(trim(name),'') is not null)
);

insert into public.document_templates(code,template_type,name,description,display_order)
values
 ('TPL_PROPOSAL','proposal','Proposta','Template de proposta.',10),
 ('TPL_INVESTMENT_SUMMARY','investment_summary','Resumo de investimento','Template de resumo de investimento.',20),
 ('TPL_CONTRACT_SCOPE','contract_scope','Contrato / anexo de escopo','Template de contrato ou anexo de escopo.',30),
 ('TPL_ONBOARDING','onboarding','Briefing / onboarding modular','Template de briefing e onboarding modular.',40),
 ('TPL_ACTION_PLAN','action_plan','Plano de ação','Template de plano de ação.',50),
 ('TPL_DIAGNOSTIC_REPORT','diagnostic_report','Diagnóstico / relatório','Template de diagnóstico ou relatório.',60),
 ('TPL_PLANNING','planning','Planejamento','Template de planejamento.',70),
 ('TPL_MEETING_MINUTES','meeting_minutes','Ata de reunião','Template de ata de reunião.',80),
 ('TPL_RESULTS_REPORT','results_report','Relatório de resultados','Template de relatório de resultados.',90),
 ('TPL_STANDARD_COMMUNICATION','standard_communication','Comunicação padronizada','Template de comunicação padronizada.',100)
on conflict (code) do update set
  template_type=excluded.template_type,name=excluded.name,description=excluded.description,display_order=excluded.display_order,updated_at=now();

create table if not exists public.document_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.document_templates(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  is_current boolean not null default true,
  status text not null check (status in ('draft','active','inactive','retired')),
  audience text not null check (audience in ('internal','client','team','client_team')),
  content_reference text,
  reusable_fields jsonb not null default '[]'::jsonb,
  data_sources jsonb not null default '[]'::jsonb,
  owner_label text not null,
  reviewed_at timestamptz not null,
  evidence_reference text not null,
  approved_by_label text not null,
  approved_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(template_id,version_number),
  check (jsonb_typeof(reusable_fields)='array'),
  check (jsonb_typeof(data_sources)='array'),
  check (nullif(trim(owner_label),'') is not null),
  check (nullif(trim(evidence_reference),'') is not null),
  check (nullif(trim(approved_by_label),'') is not null),
  check (status<>'active' or nullif(trim(coalesce(content_reference,'')),'') is not null),
  check (status<>'retired' or is_current=false)
);

create unique index if not exists document_template_versions_current_uidx
  on public.document_template_versions(template_id) where is_current;

create or replace function public.set_document_template_version(
  p_template_code text,
  p_status text,
  p_audience text,
  p_content_reference text,
  p_reusable_fields jsonb,
  p_data_sources jsonb,
  p_owner_label text,
  p_reviewed_at timestamptz,
  p_evidence_reference text,
  p_notes text,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_template_id uuid;
  v_version integer;
  v_id uuid;
begin
  select id into v_template_id from public.document_templates where code=upper(trim(coalesce(p_template_code,''))) for update;
  if v_template_id is null then raise exception 'document template not found'; end if;
  if p_status not in ('draft','active','inactive') then raise exception 'invalid document template status'; end if;
  if p_audience not in ('internal','client','team','client_team') then raise exception 'invalid document template audience'; end if;
  if p_status='active' and nullif(trim(coalesce(p_content_reference,'')),'') is null then raise exception 'active template requires content reference'; end if;
  if p_reusable_fields is null or jsonb_typeof(p_reusable_fields)<>'array' then raise exception 'reusable fields must be an array'; end if;
  if p_data_sources is null or jsonb_typeof(p_data_sources)<>'array' then raise exception 'data sources must be an array'; end if;
  if nullif(trim(coalesce(p_owner_label,'')),'') is null then raise exception 'template owner is required'; end if;
  if p_reviewed_at is null then raise exception 'template review date is required'; end if;
  if nullif(trim(coalesce(p_evidence_reference,'')),'') is null then raise exception 'template requires evidence/reference'; end if;
  if nullif(trim(coalesce(p_actor_label,'')),'') is null then raise exception 'template approver is required'; end if;

  update public.document_template_versions set is_current=false,status='retired',updated_at=now()
   where template_id=v_template_id and is_current;
  select coalesce(max(version_number),0)+1 into v_version from public.document_template_versions where template_id=v_template_id;

  insert into public.document_template_versions(template_id,version_number,is_current,status,audience,content_reference,reusable_fields,
    data_sources,owner_label,reviewed_at,evidence_reference,approved_by_label,approved_at,notes)
  values(v_template_id,v_version,true,p_status,p_audience,nullif(trim(coalesce(p_content_reference,'')),''),p_reusable_fields,
    p_data_sources,trim(p_owner_label),p_reviewed_at,trim(p_evidence_reference),trim(p_actor_label),now(),nullif(trim(coalesce(p_notes,'')),''))
  returning id into v_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('document_template_version',v_id,'document_template_version_created',public.commercial_audit_actor_type(p_actor_label),trim(p_actor_label),
    jsonb_build_object('template_code',upper(trim(p_template_code)),'version_number',v_version,'status',p_status,'audience',p_audience,
      'content_reference',nullif(trim(coalesce(p_content_reference,'')),''),'evidence_reference',trim(p_evidence_reference)));
  return v_id;
end;
$$;

create or replace view public.document_template_catalog as
select t.id,t.code,t.template_type,t.name,t.description,t.source_document,t.source_version,t.display_order,
       v.id as current_version_id,v.version_number,v.status,v.audience,v.content_reference,v.reusable_fields,v.data_sources,
       v.owner_label,v.reviewed_at,v.evidence_reference,v.approved_by_label,v.approved_at,v.notes
from public.document_templates t
left join public.document_template_versions v on v.template_id=t.id and v.is_current
order by t.display_order,t.code;
