-- Blinko OS — Permissões internas explícitas
-- Aplicar depois de 005.
--
-- Decisão técnica: o nome do papel organiza a equipe, mas não concede automaticamente
-- poder de aprovar comunicação estratégica ou alterar leads. Essas permissões ficam
-- explícitas por membro. O papel `owner` é a única exceção e possui acesso total.

create or replace function public.blinko_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.blinko_team_members m
     where m.user_id = auth.uid()
       and m.active = true
       and (
         m.role = 'owner'
         or (p_permission = 'view_internal' and m.role in ('operations','commercial','specialist','viewer'))
         or (p_permission = 'manage_leads' and m.can_manage_leads)
         or (p_permission = 'approve_initial_readings' and m.can_approve_initial_readings)
         or (p_permission = 'manage_settings' and m.can_manage_settings)
       )
  );
$$;

revoke all on function public.blinko_has_permission(text) from public, anon;
grant execute on function public.blinko_has_permission(text) to authenticated;

comment on function public.blinko_has_permission(text) is
'Permissões internas explícitas por membro. Role organiza o perfil; owner possui acesso total.';
