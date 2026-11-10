-- Flashback de la semaine : réactions sur la carte du fil d'accueil (10 novembre 2026)
-- Autorise le type de cible « flashback » dans la table reactions
-- (cible_id = « flashback-jour1 », « flashback-jour2 »…).
-- À exécuter en une fois dans Supabase > SQL Editor.

begin;

alter table public.reactions drop constraint if exists reactions_cible_type_check;
alter table public.reactions add constraint reactions_cible_type_check
  check (cible_type in ('ajouts','note','deal','sondage','flashback'));

commit;
