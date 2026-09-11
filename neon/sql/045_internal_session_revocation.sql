-- Blinko OS — revogação imediata de sessões internas
-- Complementa 044. Mudança de senha, papel ou status invalida cookies emitidos anteriormente.
-- Produção/main não deve receber esta migração sem promoção controlada.

alter table public.internal_users
  add column if not exists session_version integer not null default 1 check (session_version > 0);

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
  coalesce(array_agg(rp.permission_code order by rp.permission_code) filter (where rp.permission_code is not null),array[]::text[]) as permissions,
  u.session_version
from public.internal_users u
join public.internal_roles r on r.code=u.role_code and r.status='active'
left join public.internal_role_permissions rp on rp.role_code=u.role_code
group by u.id,r.name,r.access_scope,r.login_enabled;

create or replace function public.set_internal_user_status(
  p_user_id uuid,p_status text,p_actor_user_id uuid,p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare v_previous text;v_role text;v_active_admins integer;
begin
  if p_status not in ('active','disabled') then raise exception 'invalid internal user status'; end if;
  if p_actor_user_id is null or not public.internal_user_has_permission(p_actor_user_id,'settings.users.manage') then raise exception 'permission denied: settings.users.manage'; end if;
  if nullif(trim(coalesce(p_actor_label,'')),'') is null then raise exception 'actor is required'; end if;
  select status,role_code into v_previous,v_role from public.internal_users where id=p_user_id for update;
  if not found then raise exception 'internal user not found'; end if;
  if p_user_id=p_actor_user_id and p_status='disabled' then raise exception 'admin cannot disable own active session user'; end if;
  if v_role='admin' and v_previous='active' and p_status='disabled' then
    select count(*) into v_active_admins from public.internal_users where role_code='admin' and status='active';
    if v_active_admins<=1 then raise exception 'cannot disable last active admin'; end if;
  end if;
  update public.internal_users
  set status=p_status,
      disabled_at=case when p_status='disabled' then now() else null end,
      session_version=case when v_previous is distinct from p_status then session_version+1 else session_version end,
      updated_at=now()
  where id=p_user_id;
  if v_previous is distinct from p_status then
    insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
    values('internal_user',p_user_id,'internal_user_status_changed','human',trim(p_actor_label),
      jsonb_build_object('target_user_id',p_user_id,'previous_status',v_previous,'status',p_status,'actor_user_id',p_actor_user_id,'sessions_revoked',true));
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
  if p_actor_user_id is null or not public.internal_user_has_permission(p_actor_user_id,'settings.users.manage') then raise exception 'permission denied: settings.users.manage'; end if;
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
  update public.internal_users
  set role_code=p_role_code,
      partner_id=p_partner_id,
      session_version=case when v_previous_role is distinct from p_role_code then session_version+1 else session_version end,
      updated_at=now()
  where id=p_user_id;
  if v_previous_role is distinct from p_role_code then
    insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
    values('internal_user',p_user_id,'internal_user_role_changed','human',trim(p_actor_label),
      jsonb_build_object('target_user_id',p_user_id,'previous_role',v_previous_role,'role_code',p_role_code,'partner_id',p_partner_id,'actor_user_id',p_actor_user_id,'sessions_revoked',true));
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
  if p_actor_user_id is null or not public.internal_user_has_permission(p_actor_user_id,'settings.users.manage') then raise exception 'permission denied: settings.users.manage'; end if;
  if nullif(trim(coalesce(p_password_hash,'')),'') is null then raise exception 'password hash is required'; end if;
  if not exists(select 1 from public.internal_users where id=p_user_id) then raise exception 'internal user not found'; end if;
  update public.internal_users
  set password_hash=trim(p_password_hash),password_changed_at=now(),session_version=session_version+1,updated_at=now()
  where id=p_user_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('internal_user',p_user_id,'internal_user_password_reset','human',trim(p_actor_label),
    jsonb_build_object('target_user_id',p_user_id,'actor_user_id',p_actor_user_id,'sessions_revoked',true));
  return p_user_id;
end;
$$;
