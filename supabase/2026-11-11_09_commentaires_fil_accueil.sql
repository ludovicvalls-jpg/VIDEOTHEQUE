-- Fil d'accueil : commentaires sous les actualités (11 novembre 2026)
-- Chaque membre peut commenter un ajout de films, une publication du Mur, un bon plan,
-- un sondage ou le Flashback de la semaine. (Les avis sur les films gardent leur propre
-- discussion, table film_note_comments.)
-- cible_type + cible_id désignent la carte commentée, comme dans la table reactions.
-- Tant que ce script n'est pas exécuté, le bouton « Commenter » reste simplement masqué.
-- À exécuter en une fois dans Supabase > SQL Editor.

begin;

create table if not exists public.commentaires (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cible_type text not null check (cible_type in ('ajouts','post','deal','sondage','flashback')),
  cible_id text not null,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists commentaires_cible_idx on public.commentaires (cible_id);

alter table public.commentaires enable row level security;

drop policy if exists "Commentaires visibles par les membres" on public.commentaires;
create policy "Commentaires visibles par les membres" on public.commentaires
  for select to authenticated using (true);
drop policy if exists "Commenter en son nom" on public.commentaires;
create policy "Commenter en son nom" on public.commentaires
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Supprimer son commentaire" on public.commentaires;
create policy "Supprimer son commentaire" on public.commentaires
  for delete to authenticated using (auth.uid() = user_id or public.is_admin_user());

revoke all on public.commentaires from anon;

commit;
