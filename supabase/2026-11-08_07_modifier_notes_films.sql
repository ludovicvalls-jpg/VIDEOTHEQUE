-- Notes sur les films des autres membres (8 novembre 2026)
-- Chaque membre peut désormais MODIFIER ses propres notes / commentaires
-- (avant, il ne pouvait que les écrire ou les supprimer).
-- À exécuter en une fois dans Supabase > SQL Editor.

begin;

alter table public.film_note_comments add column if not exists updated_at timestamptz;

drop policy if exists "Un membre peut modifier son commentaire" on public.film_note_comments;
create policy "Un membre peut modifier son commentaire" on public.film_note_comments
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
