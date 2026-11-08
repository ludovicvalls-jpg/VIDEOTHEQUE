-- Fil d'accueil : réactions en un appui (8 novembre 2026)
-- ❤️ coeur · 🔥 feu (« pépite ») · 🤝 aussi (« je l'ai aussi »)
-- sur les ajouts de films, les avis publics, les bons plans et les sondages.
-- Les posts du Mur gardent leurs likes existants (table post_likes).
-- À exécuter en une fois dans Supabase > SQL Editor.

begin;

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cible_type text not null check (cible_type in ('ajouts','note','deal','sondage')),
  cible_id text not null,
  emoji text not null check (emoji in ('coeur','feu','aussi')),
  created_at timestamptz not null default now(),
  unique (user_id, cible_type, cible_id, emoji)
);
create index if not exists reactions_cible_idx on public.reactions (cible_id);

alter table public.reactions enable row level security;

create policy "Réactions visibles par les membres" on public.reactions
  for select to authenticated using (true);
create policy "Réagir en son nom" on public.reactions
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Retirer sa réaction" on public.reactions
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.reactions from anon;

-- Détails des notifications de réaction (emoji, type de contenu, titre)
alter table public.notifications add column if not exists meta jsonb;

commit;
