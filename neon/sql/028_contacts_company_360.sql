-- Blinko OS — Contatos permanentes + base relacional da Empresa 360
-- Depende de 021–027.
-- Regra: Lead é a entrada/origem comercial; Contato é a pessoa permanente;
-- Empresa é o cadastro permanente. Nenhuma fusão de empresa é feita por nome.

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  source_lead_id uuid unique references public.leads(id) on delete set null,
  name text not null,
  email text,
  whatsapp text,
  role_title text,
  status text not null default 'active' check (status in ('active','inactive','former')),
  is_primary boolean not null default false,
  preferred_channel text check (preferred_channel is null or preferred_channel in ('whatsapp','email','phone','meeting','other')),
  notes text,
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(trim(coalesce(email,'')),'') is not null or nullif(trim(coalesce(whatsapp,'')),'') is not null)
);

create index if not exists contacts_company_idx on public.contacts(company_id,status,created_at desc);
create index if not exists contacts_name_idx on public.contacts(lower(name));
create index if not exists contacts_email_idx on public.contacts(lower(email)) where email is not null;
create index if not exists contacts_whatsapp_idx on public.contacts(whatsapp) where whatsapp is not null;
create unique index if not exists contacts_one_primary_per_company_idx
  on public.contacts(company_id)
  where company_id is not null and is_primary = true and status = 'active';

alter table public.leads
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;
create index if not exists leads_contact_idx on public.leads(contact_id) where contact_id is not null;

alter table public.commercial_opportunities
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;
create index if not exists commercial_opportunities_contact_idx
  on public.commercial_opportunities(contact_id,created_at desc) where contact_id is not null;

-- Backfill conservador: só associa empresa quando todas as relações existentes do lead
-- apontam para uma única empresa. Nome semelhante nunca é usado como chave de merge.
with relationship_candidates as (
  select c.source_lead_id as lead_id,c.id as company_id
    from public.companies c where c.source_lead_id is not null
  union
  select o.lead_id,o.company_id
    from public.commercial_opportunities o where o.company_id is not null
  union
  select d.lead_id,d.company_id
    from public.diagnostics d where d.company_id is not null
  union
  select d.lead_id,p.company_id
    from public.proposals p join public.diagnostics d on d.id=p.diagnostic_id
   where p.company_id is not null
), resolved_company as (
  select lead_id,
         case when count(distinct company_id)=1 then min(company_id) else null end as company_id
    from relationship_candidates
   group by lead_id
)
insert into public.contacts(
  company_id,source_lead_id,name,email,whatsapp,role_title,status,is_primary,preferred_channel,created_by_label
)
select r.company_id,l.id,l.name,nullif(trim(l.email),''),nullif(trim(l.whatsapp),''),
       nullif(trim(l.company_role),''),'active',false,
       case when nullif(trim(l.whatsapp),'') is not null then 'whatsapp'
            when nullif(trim(l.email),'') is not null then 'email' else null end,
       'migration-028'
  from public.leads l
  left join resolved_company r on r.lead_id=l.id
 on conflict (source_lead_id) do update
   set name=excluded.name,
       email=excluded.email,
       whatsapp=excluded.whatsapp,
       role_title=coalesce(excluded.role_title,public.contacts.role_title),
       company_id=coalesce(public.contacts.company_id,excluded.company_id),
       updated_at=now();

update public.leads l
   set contact_id=c.id,updated_at=now()
  from public.contacts c
 where c.source_lead_id=l.id
   and l.contact_id is distinct from c.id;

update public.commercial_opportunities o
   set contact_id=l.contact_id,
       company_id=coalesce(o.company_id,c.company_id),
       updated_at=now()
  from public.leads l
  left join public.contacts c on c.id=l.contact_id
 where o.lead_id=l.id
   and (o.contact_id is distinct from l.contact_id or (o.company_id is null and c.company_id is not null));

-- Define um contato principal por empresa somente quando ainda não existe um.
with ranked as (
  select c.id,c.company_id,
         row_number() over(partition by c.company_id order by c.created_at,c.id) as rn
    from public.contacts c
   where c.company_id is not null and c.status='active'
), chosen as (
  select r.id
    from ranked r
   where r.rn=1
     and not exists(
       select 1 from public.contacts p
        where p.company_id=r.company_id and p.status='active' and p.is_primary=true
     )
)
update public.contacts c set is_primary=true,updated_at=now()
  from chosen x where c.id=x.id;

create or replace function public.sync_contact_from_lead()
returns trigger
language plpgsql
set search_path=public
as $sync_contact_from_lead$
declare
  v_contact_id uuid;
begin
  select id into v_contact_id from public.contacts where source_lead_id=new.id limit 1;

  if v_contact_id is null then
    insert into public.contacts(
      source_lead_id,name,email,whatsapp,role_title,status,preferred_channel,created_by_label
    ) values (
      new.id,new.name,nullif(trim(new.email),''),nullif(trim(new.whatsapp),''),
      nullif(trim(new.company_role),''),'active',
      case when nullif(trim(new.whatsapp),'') is not null then 'whatsapp'
           when nullif(trim(new.email),'') is not null then 'email' else null end,
      'system'
    ) returning id into v_contact_id;
  else
    update public.contacts
       set name=new.name,
           email=nullif(trim(new.email),''),
           whatsapp=nullif(trim(new.whatsapp),''),
           role_title=coalesce(nullif(trim(new.company_role),''),role_title),
           updated_at=now()
     where id=v_contact_id;
  end if;

  if new.contact_id is distinct from v_contact_id then
    update public.leads set contact_id=v_contact_id where id=new.id;
  end if;

  return new;
end;
$sync_contact_from_lead$;

drop trigger if exists sync_contact_from_lead_trg on public.leads;
create trigger sync_contact_from_lead_trg
  after insert or update of name,email,whatsapp,company_role on public.leads
  for each row execute function public.sync_contact_from_lead();

create or replace function public.sync_commercial_opportunity_contact()
returns trigger
language plpgsql
set search_path=public
as $sync_commercial_opportunity_contact$
declare
  v_contact_id uuid;
  v_company_id uuid;
begin
  select l.contact_id into v_contact_id from public.leads l where l.id=new.lead_id;
  if new.contact_id is null then new.contact_id:=v_contact_id; end if;

  if new.company_id is null and new.contact_id is not null then
    select c.company_id into v_company_id from public.contacts c where c.id=new.contact_id;
    new.company_id:=v_company_id;
  end if;
  return new;
end;
$sync_commercial_opportunity_contact$;

drop trigger if exists sync_commercial_opportunity_contact_trg on public.commercial_opportunities;
create trigger sync_commercial_opportunity_contact_trg
  before insert or update of lead_id on public.commercial_opportunities
  for each row execute function public.sync_commercial_opportunity_contact();

create or replace function public.save_company_contact(
  p_contact_id uuid,
  p_company_id uuid,
  p_name text,
  p_email text,
  p_whatsapp text,
  p_role_title text,
  p_is_primary boolean,
  p_preferred_channel text,
  p_notes text,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path=public
as $save_company_contact$
declare
  v_id uuid;
  v_event text;
begin
  if not exists(select 1 from public.companies where id=p_company_id) then
    raise exception 'company not found';
  end if;
  if nullif(trim(coalesce(p_name,'')),'') is null then raise exception 'contact name is required'; end if;
  if nullif(trim(coalesce(p_email,'')),'') is null and nullif(trim(coalesce(p_whatsapp,'')),'') is null then
    raise exception 'contact requires email or whatsapp';
  end if;
  if p_preferred_channel is not null and p_preferred_channel<>'' and p_preferred_channel not in ('whatsapp','email','phone','meeting','other') then
    raise exception 'invalid preferred channel';
  end if;

  if coalesce(p_is_primary,false) then
    update public.contacts set is_primary=false,updated_at=now()
     where company_id=p_company_id and is_primary=true and status='active'
       and (p_contact_id is null or id<>p_contact_id);
  end if;

  if p_contact_id is null then
    insert into public.contacts(
      company_id,name,email,whatsapp,role_title,status,is_primary,preferred_channel,notes,created_by_label
    ) values (
      p_company_id,trim(p_name),nullif(trim(coalesce(p_email,'')),''),nullif(trim(coalesce(p_whatsapp,'')),''),
      nullif(trim(coalesce(p_role_title,'')),''),'active',coalesce(p_is_primary,false),
      nullif(trim(coalesce(p_preferred_channel,'')),''),nullif(trim(coalesce(p_notes,'')),''),
      nullif(trim(coalesce(p_actor_label,'')),'')
    ) returning id into v_id;
    v_event:='contact_created';
  else
    update public.contacts
       set name=trim(p_name),
           email=nullif(trim(coalesce(p_email,'')),''),
           whatsapp=nullif(trim(coalesce(p_whatsapp,'')),''),
           role_title=nullif(trim(coalesce(p_role_title,'')),''),
           is_primary=coalesce(p_is_primary,false),
           preferred_channel=nullif(trim(coalesce(p_preferred_channel,'')),''),
           notes=nullif(trim(coalesce(p_notes,'')),''),
           updated_at=now()
     where id=p_contact_id and company_id=p_company_id
     returning id into v_id;
    if v_id is null then raise exception 'contact not found for company'; end if;
    v_event:='contact_updated';
  end if;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('contact',v_id,v_event,'human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
         jsonb_build_object('company_id',p_company_id,'is_primary',coalesce(p_is_primary,false)));
  return v_id;
end;
$save_company_contact$;

create or replace function public.assign_contact_to_company(
  p_contact_id uuid,
  p_company_id uuid,
  p_is_primary boolean,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path=public
as $assign_contact_to_company$
declare
  v_previous_company uuid;
begin
  if not exists(select 1 from public.companies where id=p_company_id) then raise exception 'company not found'; end if;
  select company_id into v_previous_company from public.contacts where id=p_contact_id for update;
  if not found then raise exception 'contact not found'; end if;

  if coalesce(p_is_primary,false) then
    update public.contacts set is_primary=false,updated_at=now()
     where company_id=p_company_id and status='active' and is_primary=true and id<>p_contact_id;
  end if;

  update public.contacts
     set company_id=p_company_id,is_primary=coalesce(p_is_primary,false),updated_at=now()
   where id=p_contact_id;

  update public.commercial_opportunities
     set company_id=p_company_id,contact_id=p_contact_id,updated_at=now()
   where contact_id=p_contact_id and company_id is null;

  update public.diagnostics d
     set company_id=p_company_id,updated_at=now()
    from public.leads l
   where d.lead_id=l.id and l.contact_id=p_contact_id and d.company_id is null;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('contact',p_contact_id,'contact_company_assigned','human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
         jsonb_build_object('previous_company_id',v_previous_company,'company_id',p_company_id,'is_primary',coalesce(p_is_primary,false)));
  return p_contact_id;
end;
$assign_contact_to_company$;

-- Pagamento do diagnóstico passa a reutilizar a Empresa vinculada ao Contato.
-- Uma nova Empresa só é criada quando não existe vínculo inequívoco.
create or replace function public.confirm_blinko_diagnostic_payment(
  p_diagnostic_id uuid,
  p_actor_label text,
  p_payment_reference text default null
)
returns uuid
language plpgsql
set search_path=public
as $confirm_diagnostic_payment$
declare
  v_lead public.leads%rowtype;
  v_lead_id uuid;
  v_pre_diagnostic_id uuid;
  v_contact_id uuid;
  v_company_id uuid;
  v_status text;
begin
  select d.lead_id,d.pre_diagnostic_id,d.status
    into v_lead_id,v_pre_diagnostic_id,v_status
    from public.diagnostics d where d.id=p_diagnostic_id limit 1;

  if v_lead_id is null then raise exception 'diagnostic not found'; end if;
  if v_status <> 'awaiting_payment' then raise exception 'diagnostic is not awaiting payment'; end if;

  select * into v_lead from public.leads where id=v_lead_id;
  v_contact_id:=v_lead.contact_id;

  if v_contact_id is not null then
    select company_id into v_company_id from public.contacts where id=v_contact_id;
  end if;

  if v_company_id is null then
    select id into v_company_id from public.companies where source_lead_id=v_lead.id limit 1;
  end if;

  if v_company_id is null then
    insert into public.companies(
      source_lead_id,name,segment,city_state,website,social_url,objective,relationship_status,responsible_label
    ) values (
      v_lead.id,v_lead.company_name,v_lead.segment,v_lead.city_state,v_lead.website,v_lead.social_url,
      v_lead.objective,'active',nullif(trim(coalesce(p_actor_label,'')),'')
    ) returning id into v_company_id;
  else
    update public.companies
       set responsible_label=coalesce(nullif(trim(coalesce(p_actor_label,'')),''),responsible_label),updated_at=now()
     where id=v_company_id;
  end if;

  if v_contact_id is not null then
    update public.contacts
       set company_id=coalesce(company_id,v_company_id),
           is_primary=case when company_id is null and not exists(
             select 1 from public.contacts p where p.company_id=v_company_id and p.status='active' and p.is_primary=true
           ) then true else is_primary end,
           updated_at=now()
     where id=v_contact_id;
  end if;

  update public.diagnostics
     set company_id=v_company_id,status='collection',
         payment_confirmed_by_label=nullif(trim(coalesce(p_actor_label,'')),''),
         payment_reference=nullif(trim(coalesce(p_payment_reference,'')),''),
         payment_confirmed_at=now(),updated_at=now()
   where id=p_diagnostic_id;

  update public.commercial_opportunities
     set company_id=coalesce(company_id,v_company_id),contact_id=coalesce(contact_id,v_contact_id),updated_at=now()
   where lead_id=v_lead.id and outcome_status is null;

  update public.leads set status='diagnostic_paid',updated_at=now() where id=v_lead.id;

  update public.crm_actions set status='done',completed_at=now()
   where pre_diagnostic_id=v_pre_diagnostic_id and status in ('pending','in_progress')
     and action_type='diagnostic_payment_followup';

  if not exists(
    select 1 from public.crm_actions
     where pre_diagnostic_id=v_pre_diagnostic_id and action_type='diagnostic_collection'
       and status in ('pending','in_progress')
  ) then
    insert into public.crm_actions(lead_id,pre_diagnostic_id,action_type,status,priority,title,payload)
    values(v_lead.id,v_pre_diagnostic_id,'diagnostic_collection','pending','high','Iniciar coleta do Diagnóstico Blinko',
      jsonb_build_object('diagnostic_id',p_diagnostic_id,'company_id',v_company_id,'created_by',p_actor_label,'source','blinko_os_internal'));
  end if;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('diagnostic',p_diagnostic_id,'diagnostic_payment_confirmed','human',
         coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
         jsonb_build_object('lead_id',v_lead.id,'contact_id',v_contact_id,'company_id',v_company_id,
                            'pre_diagnostic_id',v_pre_diagnostic_id,
                            'payment_reference',nullif(trim(coalesce(p_payment_reference,'')),'')));
  return p_diagnostic_id;
end;
$confirm_diagnostic_payment$;

create or replace view public.commercial_pipeline as
select
  o.*,
  coalesce(ct.name,l.name) as contact_name,
  coalesce(ct.email,l.email) as email,
  coalesce(ct.whatsapp,l.whatsapp) as whatsapp,
  l.company_name as lead_company_name,l.segment,l.commercial_score,
  c.name as company_name,
  p.id as proposal_id,p.status as proposal_status,
  prj.id as project_id,prj.status as project_status,
  case
    when o.outcome_status is not null then 'closed'
    when o.pipeline_stage not in ('P00','P14') and o.next_action_at is null then 'missing_next_action'
    when o.pipeline_stage not in ('P00','P14') and nullif(trim(coalesce(o.owner_label,'')),'') is null then 'missing_owner'
    when o.next_action_at < now() then 'overdue'
    else 'healthy'
  end as health,
  greatest(0,floor(extract(epoch from (now()-o.stage_changed_at))/86400))::integer as days_in_stage
from public.commercial_opportunities o
join public.leads l on l.id=o.lead_id
left join public.contacts ct on ct.id=o.contact_id
left join public.companies c on c.id=o.company_id
left join lateral (select p0.* from public.proposals p0 where p0.opportunity_id=o.id order by p0.created_at desc limit 1) p on true
left join lateral (select p1.* from public.projects p1 where p1.proposal_id=p.id order by p1.created_at desc limit 1) prj on true;
