-- Sécurité, étape 1 (8 novembre 2026) — déjà appliqué dans Supabase.
-- 1. Un membre ne peut plus se nommer administrateur lui-même.
-- 2. Les autres membres ne peuvent changer que les compteurs de votes d'un bon plan.
-- 3. Une notification doit venir d'un membre connecté, en son propre nom.

begin;

create or replace function public.proteger_is_admin()
returns trigger language plpgsql as $$
begin
  if auth.uid() is null then return new; end if; -- modifications faites depuis le tableau de bord
  if tg_op = 'INSERT' then
    if new.is_admin and not public.is_admin_user() then new.is_admin := false; end if;
  elsif new.is_admin is distinct from old.is_admin and not public.is_admin_user() then
    raise exception 'Seul un administrateur peut changer le statut administrateur';
  end if;
  return new;
end $$;
drop trigger if exists proteger_is_admin on public.profiles;
create trigger proteger_is_admin before insert or update on public.profiles
  for each row execute function public.proteger_is_admin();

create or replace function public.proteger_deals()
returns trigger language plpgsql as $$
begin
  if auth.uid() is null or auth.uid() = old.user_id or public.is_admin_user() then
    return new;
  end if;
  if (to_jsonb(new) - 'votes_hot' - 'votes_dead') is distinct from (to_jsonb(old) - 'votes_hot' - 'votes_dead') then
    raise exception 'Seul l''auteur du bon plan peut le modifier';
  end if;
  return new;
end $$;
drop trigger if exists proteger_deals on public.deals;
create trigger proteger_deals before update on public.deals
  for each row execute function public.proteger_deals();

drop policy "Notifs créables par tous" on public.notifications;
create policy "Notifs créables par l'expéditeur connecté" on public.notifications
  for insert to authenticated with check (auth.uid() = from_user_id);

commit;
