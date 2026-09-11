-- Blinko OS — usuários individuais, papéis e permissões
-- Fonte funcional: Documento 08 — BLINKO — SISTEMA E AUTOMAÇÃO, seções 5.21, 7.11, 14 e 21.
-- Regra central: autenticação individual + menor privilégio + financeiro protegido.
-- Parceiro é projeto-escopado; Cliente permanece reservado para portal futuro.
-- Produção/main não deve receber esta migração sem promoção controlada.

create table if not exists public.internal_roles (
  code text primary key,
  name text not null,
  description text not null,
  access_scope text not null check (access_scope in ('global','project_scoped','future_portal')),
  login_enabled boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive')),
  display_order integer not null default 100,
  source_document text not null default '08 — BLINKO — SISTEMA E AUTOMAÇÃO',
  source_version text not null default 'v1.0 — 09/09/2026',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(trim(code),'') is not null),
  check (nullif(trim(name),'') is not null)
);

create table if not exists public.internal_permissions (
  code text primary key,
  name text not null,
  domain text not null,
  sensitivity text not null default 'normal' check (sensitivity in ('normal','sensitive','critical')),
  description text not null,
  created_at timestamptz not null default now(),
  check (nullif(trim(code),'') is not null),
  check (nullif(trim(name),'') is not null)
);

create table if not exists public.internal_role_permissions (
  role_code text not null references public.internal_roles(code) on delete restrict,
  permission_code text not null references public.internal_permissions(code) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(role_code,permission_code)
);

create table if not exists public.internal_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  display_name text not null,
  email text,
  role_code text not null references public.internal_roles(code) on delete restrict,
  password_hash text not null,
  partner_id uuid references public.partners(id) on delete restrict,
  status text not null default 'active' check (status in ('active','disabled')),
  last_login_at timestamptz,
  password_changed_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_by_user_id uuid references public.internal_users(id) on delete restrict,
  created_by_label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (username = lower(trim(username))),
  check (username ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
  check (nullif(trim(display_name),'') is not null),
  check (nullif(trim(password_hash),'') is not null),
  check (nullif(trim(created_by_label),'') is not null),
  check ((role_code='partner' and partner_id is not null) or (role_code<>'partner' and partner_id is null))
);

create unique index if not exists internal_users_username_lower_uidx
  on public.internal_users(lower(username));
create unique index if not exists internal_users_email_lower_uidx
  on public.internal_users(lower(email)) where email is not null;

create table if not exists public.internal_user_project_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.internal_users(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  access_level text not null default 'read' check (access_level in ('read','contribute')),
  status text not null default 'active' check (status in ('active','revoked')),
  granted_by_user_id uuid references public.internal_users(id) on delete restrict,
  granted_by_label text not null,
  granted_at timestamptz not null default now(),
  revoked_by_user_id uuid references public.internal_users(id) on delete restrict,
  revoked_by_label text,
  revoked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,project_id),
  check (nullif(trim(granted_by_label),'') is not null),
  check (status <> 'revoked' or revoked_at is not null)
);

insert into public.internal_roles(code,name,description,access_scope,login_enabled,status,display_order)
values
  ('admin','Admin','Acesso integral ao Blinko OS e às configurações administrativas.','global',true,'active',10),
  ('strategy_consulting','Estratégia / Consultoria','Empresas, diagnósticos, gargalos, soluções, comercial e projetos, sem administração financeira irrestrita.','global',true,'active',20),
  ('operations','Operação','Projetos, tarefas, arquivos, aprovações, alterações e parceiros conforme operação.','global',true,'active',30),
  ('financial','Financeiro','Valores, recebíveis, despesas, repasses, contratos e indicadores financeiros.','global',true,'active',40),
  ('partner','Parceiro','Acesso futuro limitado somente aos projetos/tarefas/arquivos explicitamente concedidos.','project_scoped',false,'active',50),
  ('client','Cliente','Portal futuro com acesso somente às próprias informações, aprovações, documentos e solicitações.','future_portal',false,'active',60)
on conflict (code) do update set
  name=excluded.name,description=excluded.description,access_scope=excluded.access_scope,
  login_enabled=excluded.login_enabled,status=excluded.status,display_order=excluded.display_order,updated_at=now();

insert into public.internal_permissions(code,name,domain,sensitivity,description)
values
  ('dashboard.view','Ver Hoje','dashboard','normal','Acessar a fila operacional Hoje.'),
  ('companies.view','Ver empresas','companies','normal','Consultar Empresa 360.'),
  ('companies.manage','Gerenciar empresas','companies','sensitive','Alterar dados permanentes de empresas.'),
  ('contacts.view','Ver contatos','contacts','normal','Consultar contatos permanentes.'),
  ('contacts.manage','Gerenciar contatos','contacts','sensitive','Criar e alterar vínculos de contatos.'),
  ('diagnostics.view','Ver diagnósticos','diagnostics','sensitive','Consultar diagnóstico, evidências, achados e prioridades.'),
  ('diagnostics.manage','Gerenciar diagnósticos','diagnostics','critical','Registrar, revisar e validar diagnóstico e estratégia.'),
  ('commercial.view','Ver Comercial','commercial','normal','Consultar pipeline, propostas e histórico comercial.'),
  ('commercial.manage','Gerenciar Comercial','commercial','critical','Alterar pipeline, propostas, condições e formalização comercial.'),
  ('solutions.view','Ver soluções','solutions','normal','Consultar catálogo oficial S01–S40.'),
  ('projects.view','Ver projetos','projects','normal','Consultar projetos e ciclos autorizados.'),
  ('projects.manage','Gerenciar projetos','projects','critical','Ativar, alterar onboarding, solução e encerramento de projetos.'),
  ('tasks.manage','Gerenciar tarefas','tasks','normal','Criar e movimentar tarefas autorizadas.'),
  ('files.view','Ver arquivos','files','normal','Consultar referências de arquivos autorizados.'),
  ('files.manage','Gerenciar arquivos','files','sensitive','Registrar e alterar referências/arquivos autorizados.'),
  ('approvals.view','Ver aprovações','approvals','normal','Consultar aprovações.'),
  ('approvals.manage','Gerenciar aprovações','approvals','critical','Solicitar/registrar decisões de aprovação.'),
  ('changes.view','Ver alterações','changes','normal','Consultar Change Requests.'),
  ('changes.manage','Gerenciar alterações','changes','critical','Classificar, analisar, decidir e rotear Change Requests.'),
  ('partners.view','Ver parceiros','partners','normal','Consultar cadastro, elegibilidade e capacidades de parceiros.'),
  ('partners.manage','Gerenciar parceiros','partners','critical','Alterar governança/cadastro de parceiros.'),
  ('contracts.view','Ver contratos','contracts','sensitive','Consultar formalizações e contratos.'),
  ('contracts.manage','Gerenciar contratos','contracts','critical','Registrar e alterar formalizações contratuais.'),
  ('finance.view','Ver financeiro','finance','sensitive','Consultar valores, recebíveis, custos, caixa e rentabilidade.'),
  ('finance.manage','Gerenciar financeiro','finance','critical','Registrar/alterar movimentos e planos financeiros.'),
  ('partner_payments.manage','Liberar pagamentos a parceiros','finance','critical','Solicitar, aprovar e registrar pagamentos a parceiros.'),
  ('indicators.view','Ver indicadores','indicators','normal','Consultar indicadores permitidos ao papel.'),
  ('indicators.configure','Configurar metas/indicadores','indicators','critical','Criar novas versões de metas e parâmetros de cálculo.'),
  ('settings.users.manage','Gerenciar usuários','settings','critical','Criar, alterar papel, redefinir senha e desativar usuários.'),
  ('audit.view','Ver auditoria','audit','sensitive','Consultar trilhas de auditoria permitidas.')
on conflict (code) do update set
  name=excluded.name,domain=excluded.domain,sensitivity=excluded.sensitivity,description=excluded.description;

-- ADMIN: tudo.
insert into public.internal_role_permissions(role_code,permission_code)
select 'admin',p.code from public.internal_permissions p
on conflict do nothing;

-- Estratégia / Consultoria: método + relacionamento + comercial + projetos, sem financeiro/configuração.
insert into public.internal_role_permissions(role_code,permission_code)
select 'strategy_consulting',x.permission_code from (values
  ('dashboard.view'),('companies.view'),('companies.manage'),('contacts.view'),('contacts.manage'),
  ('diagnostics.view'),('diagnostics.manage'),('commercial.view'),('commercial.manage'),('solutions.view'),
  ('projects.view'),('projects.manage'),('tasks.manage'),('files.view'),('files.manage'),
  ('approvals.view'),('approvals.manage'),('changes.view'),('changes.manage'),('partners.view'),
  ('contracts.view'),('contracts.manage'),('indicators.view'),('audit.view')
) as x(permission_code)
on conflict do nothing;

-- Operação: execução, arquivos, aprovações, alterações e parceiros; sem comercial/diagnóstico mutável/financeiro.
insert into public.internal_role_permissions(role_code,permission_code)
select 'operations',x.permission_code from (values
  ('dashboard.view'),('companies.view'),('contacts.view'),('solutions.view'),('projects.view'),('projects.manage'),
  ('tasks.manage'),('files.view'),('files.manage'),('approvals.view'),('approvals.manage'),
  ('changes.view'),('changes.manage'),('partners.view'),('contracts.view'),('indicators.view')
) as x(permission_code)
on conflict do nothing;

-- Financeiro: financeiro e contratos, sem diagnóstico/comercial mutável.
insert into public.internal_role_permissions(role_code,permission_code)
select 'financial',x.permission_code from (values
  ('dashboard.view'),('companies.view'),('contacts.view'),('projects.view'),('contracts.view'),
  ('finance.view'),('finance.manage'),('partner_payments.manage'),('indicators.view'),('audit.view')
) as x(permission_code)
on conflict do nothing;

-- Parceiro: papel preparado, mas login interno desabilitado; qualquer acesso será projeto-escopado.
insert into public.internal_role_permissions(role_code,permission_code)
select 'partner',x.permission_code from (values
  ('projects.view'),('tasks.manage'),('files.view'),('files.manage')
) as x(permission_code)
on conflict do nothing;

create or replace view public.internal_user_access as
select
  u.id,
  u.username,
  u.display_name,
  u.email,
  u.role_code,
  r.name as role_name,
  r.access_scope,
  r.login_enabled,
  u.partner_id,
  u.status,
  u.last_login_at,
  u.password_changed_at,
  u.created_at,
  coalesce(array_agg(rp.permission_code order by rp.permission_code) filter (where rp.permission_code is not null),array[]::text[]) as permissions
from public.internal_users u
join public.internal_roles r on r.code=u.role_code and r.status='active'
left join public.internal_role_permissions rp on rp.role_code=u.role_code
group by u.id,r.name,r.access_scope,r.login_enabled;

create or replace function public.internal_individual_auth_initialized()
returns boolean
language sql
stable
set search_path=public
as $$
  select exists(select 1 from public.internal_users);
$$;

create or replace function public.internal_user_has_permission(p_user_id uuid,p_permission_code text)
returns boolean
language sql
stable
set search_path=public
as $$
  select exists(
    select 1
    from public.internal_users u
    join public.internal_roles r on r.code=u.role_code and r.status='active'
    join public.internal_role_permissions rp on rp.role_code=u.role_code
    where u.id=p_user_id
      and u.status='active'
      and rp.permission_code=p_permission_code
  );
$$;

create or replace function public.internal_user_can_access_project(p_user_id uuid,p_project_id uuid,p_permission_code text)
returns boolean
language sql
stable
set search_path=public
as $$
  select exists(
    select 1
    from public.internal_users u
    join public.internal_roles r on r.code=u.role_code and r.status='active'
    join public.internal_role_permissions rp on rp.role_code=u.role_code and rp.permission_code=p_permission_code
    where u.id=p_user_id
      and u.status='active'
      and (
        r.access_scope='global'
        or (
          r.access_scope='project_scoped'
          and exists(
            select 1 from public.internal_user_project_access a
            where a.user_id=u.id and a.project_id=p_project_id and a.status='active'
              and (a.access_level='contribute' or p_permission_code in ('projects.view','files.view'))
          )
        )
      )
  );
$$;

create or replace function public.create_internal_user(
  p_username text,
  p_display_name text,
  p_email text,
  p_role_code text,
  p_password_hash text,
  p_partner_id uuid,
  p_actor_user_id uuid,
  p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_username text:=lower(trim(coalesce(p_username,'')));
  v_id uuid;
  v_initialized boolean;
  v_login_enabled boolean;
begin
  if v_username !~ '^[a-z0-9][a-z0-9._-]{2,63}$' then raise exception 'invalid internal username'; end if;
  if nullif(trim(coalesce(p_display_name,'')),'') is null then raise exception 'display name is required'; end if;
  if nullif(trim(coalesce(p_password_hash,'')),'') is null then raise exception 'password hash is required'; end if;
  if nullif(trim(coalesce(p_actor_label,'')),'') is null then raise exception 'actor is required'; end if;

  select login_enabled into v_login_enabled from public.internal_roles where code=p_role_code and status='active';
  if not found then raise exception 'internal role not found or inactive'; end if;
  if p_role_code='partner' and p_partner_id is null then raise exception 'partner user requires partner id'; end if;
  if p_role_code<>'partner' and p_partner_id is not null then raise exception 'partner id is only valid for partner role'; end if;

  select public.internal_individual_auth_initialized() into v_initialized;
  if not v_initialized then
    if p_role_code<>'admin' then raise exception 'first internal user must be admin'; end if;
    if p_actor_user_id is not null then raise exception 'bootstrap actor user must be null'; end if;
  else
    if p_actor_user_id is null or not public.internal_user_has_permission(p_actor_user_id,'settings.users.manage') then
      raise exception 'permission denied: settings.users.manage';
    end if;
  end if;

  insert into public.internal_users(
    username,display_name,email,role_code,password_hash,partner_id,status,created_by_user_id,created_by_label
  ) values(
    v_username,trim(p_display_name),nullif(lower(trim(coalesce(p_email,''))),''),p_role_code,trim(p_password_hash),p_partner_id,
    'active',p_actor_user_id,trim(p_actor_label)
  ) returning id into v_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values(
    'internal_user',v_id,'internal_user_created','human',trim(p_actor_label),
    jsonb_build_object('target_user_id',v_id,'username',v_username,'role_code',p_role_code,'partner_id',p_partner_id,
      'bootstrap',not v_initialized,'actor_user_id',p_actor_user_id,'login_enabled',v_login_enabled)
  );
  return v_id;
end;
$$;

create or replace function public.set_internal_user_status(
  p_user_id uuid,p_status text,p_actor_user_id uuid,p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare v_previous text;v_role text;v_active_admins integer;
begin
  if p_status not in ('active','disabled') then raise exception 'invalid internal user status'; end if;
  if p_actor_user_id is null or not public.internal_user_has_permission(p_actor_user_id,'settings.users.manage') then
    raise exception 'permission denied: settings.users.manage';
  end if;
  if nullif(trim(coalesce(p_actor_label,'')),'') is null then raise exception 'actor is required'; end if;
  select status,role_code into v_previous,v_role from public.internal_users where id=p_user_id for update;
  if not found then raise exception 'internal user not found'; end if;
  if p_user_id=p_actor_user_id and p_status='disabled' then raise exception 'admin cannot disable own active session user'; end if;
  if v_role='admin' and v_previous='active' and p_status='disabled' then
    select count(*) into v_active_admins from public.internal_users where role_code='admin' and status='active';
    if v_active_admins<=1 then raise exception 'cannot disable last active admin'; end if;
  end if;
  update public.internal_users
  set status=p_status,disabled_at=case when p_status='disabled' then now() else null end,updated_at=now()
  where id=p_user_id;
  if v_previous is distinct from p_status then
    insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
    values('internal_user',p_user_id,'internal_user_status_changed','human',trim(p_actor_label),
      jsonb_build_object('target_user_id',p_user_id,'previous_status',v_previous,'status',p_status,'actor_user_id',p_actor_user_id));
  end if;
  return p_user_id;
end;
$$;

create or replace function public.set_internal_user_role(
  p_user_id uuid,p_role_code text,p_partner_id uuid,p_actor_user_id uuid,p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare v_previous_role text;v_status text;v_active_admins integer;
begin
  if p_actor_user_id is null or not public.internal_user_has_permission(p_actor_user_id,'settings.users.manage') then
    raise exception 'permission denied: settings.users.manage';
  end if;
  if not exists(select 1 from public.internal_roles where code=p_role_code and status='active') then raise exception 'internal role not found or inactive'; end if;
  if p_role_code='partner' and p_partner_id is null then raise exception 'partner user requires partner id'; end if;
  if p_role_code<>'partner' and p_partner_id is not null then raise exception 'partner id is only valid for partner role'; end if;
  select role_code,status into v_previous_role,v_status from public.internal_users where id=p_user_id for update;
  if not found then raise exception 'internal user not found'; end if;
  if p_user_id=p_actor_user_id and p_role_code<>'admin' then raise exception 'admin cannot remove own admin role'; end if;
  if v_previous_role='admin' and p_role_code<>'admin' and v_status='active' then
    select count(*) into v_active_admins from public.internal_users where role_code='admin' and status='active';
    if v_active_admins<=1 then raise exception 'cannot demote last active admin'; end if;
  end if;
  update public.internal_users set role_code=p_role_code,partner_id=p_partner_id,updated_at=now() where id=p_user_id;
  if v_previous_role is distinct from p_role_code then
    insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
    values('internal_user',p_user_id,'internal_user_role_changed','human',trim(p_actor_label),
      jsonb_build_object('target_user_id',p_user_id,'previous_role',v_previous_role,'role_code',p_role_code,
        'partner_id',p_partner_id,'actor_user_id',p_actor_user_id));
  end if;
  return p_user_id;
end;
$$;

create or replace function public.set_internal_user_password_hash(
  p_user_id uuid,p_password_hash text,p_actor_user_id uuid,p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
begin
  if p_actor_user_id is null or not public.internal_user_has_permission(p_actor_user_id,'settings.users.manage') then
    raise exception 'permission denied: settings.users.manage';
  end if;
  if nullif(trim(coalesce(p_password_hash,'')),'') is null then raise exception 'password hash is required'; end if;
  if not exists(select 1 from public.internal_users where id=p_user_id) then raise exception 'internal user not found'; end if;
  update public.internal_users set password_hash=trim(p_password_hash),password_changed_at=now(),updated_at=now() where id=p_user_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('internal_user',p_user_id,'internal_user_password_reset','human',trim(p_actor_label),
    jsonb_build_object('target_user_id',p_user_id,'actor_user_id',p_actor_user_id));
  return p_user_id;
end;
$$;

create or replace function public.grant_internal_project_access(
  p_user_id uuid,p_project_id uuid,p_access_level text,p_notes text,p_actor_user_id uuid,p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare v_id uuid;v_role text;
begin
  if p_actor_user_id is null or not public.internal_user_has_permission(p_actor_user_id,'settings.users.manage') then
    raise exception 'permission denied: settings.users.manage';
  end if;
  if p_access_level not in ('read','contribute') then raise exception 'invalid project access level'; end if;
  select role_code into v_role from public.internal_users where id=p_user_id;
  if not found then raise exception 'internal user not found'; end if;
  if v_role<>'partner' then raise exception 'explicit project grant is reserved for project-scoped partner users'; end if;
  if not exists(select 1 from public.projects where id=p_project_id) then raise exception 'project not found'; end if;
  insert into public.internal_user_project_access(user_id,project_id,access_level,status,granted_by_user_id,granted_by_label,granted_at,revoked_by_user_id,revoked_by_label,revoked_at,notes)
  values(p_user_id,p_project_id,p_access_level,'active',p_actor_user_id,trim(p_actor_label),now(),null,null,null,nullif(trim(coalesce(p_notes,'')),''))
  on conflict(user_id,project_id) do update set access_level=excluded.access_level,status='active',granted_by_user_id=excluded.granted_by_user_id,
    granted_by_label=excluded.granted_by_label,granted_at=now(),revoked_by_user_id=null,revoked_by_label=null,revoked_at=null,notes=excluded.notes,updated_at=now()
  returning id into v_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('internal_user_project_access',v_id,'internal_project_access_granted','human',trim(p_actor_label),
    jsonb_build_object('target_user_id',p_user_id,'project_id',p_project_id,'access_level',p_access_level,'actor_user_id',p_actor_user_id));
  return v_id;
end;
$$;

create or replace function public.revoke_internal_project_access(
  p_user_id uuid,p_project_id uuid,p_actor_user_id uuid,p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare v_id uuid;
begin
  if p_actor_user_id is null or not public.internal_user_has_permission(p_actor_user_id,'settings.users.manage') then
    raise exception 'permission denied: settings.users.manage';
  end if;
  update public.internal_user_project_access
  set status='revoked',revoked_by_user_id=p_actor_user_id,revoked_by_label=trim(p_actor_label),revoked_at=now(),updated_at=now()
  where user_id=p_user_id and project_id=p_project_id and status='active'
  returning id into v_id;
  if v_id is null then raise exception 'active project access not found'; end if;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('internal_user_project_access',v_id,'internal_project_access_revoked','human',trim(p_actor_label),
    jsonb_build_object('target_user_id',p_user_id,'project_id',p_project_id,'actor_user_id',p_actor_user_id));
  return v_id;
end;
$$;

create or replace function public.record_internal_login(p_user_id uuid)
returns uuid
language plpgsql
set search_path=public
as $$
declare v_username text;
begin
  select username into v_username from public.internal_users u
  join public.internal_roles r on r.code=u.role_code
  where u.id=p_user_id and u.status='active' and r.status='active' and r.login_enabled
  for update of u;
  if not found then raise exception 'internal user cannot login'; end if;
  update public.internal_users set last_login_at=now(),updated_at=now() where id=p_user_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('internal_user',p_user_id,'internal_user_login','human',v_username,jsonb_build_object('target_user_id',p_user_id,'username',v_username));
  return p_user_id;
end;
$$;
