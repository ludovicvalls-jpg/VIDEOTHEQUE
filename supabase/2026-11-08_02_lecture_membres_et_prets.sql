-- Sécurité, étape 2 (8 novembre 2026)
-- A. Les données ne sont plus lisibles par les visiteurs non connectés.
-- B. Les prêts (nom de l'emprunteur, date) passent dans une table privée,
--    lisible uniquement par le propriétaire du film.
-- À exécuter en une fois dans Supabase > SQL Editor.

begin;

-- A. Lecture réservée aux membres connectés -------------------------------
alter policy "Collection visible par tous"              on public.collection         to authenticated;
alter policy "deals_select"                             on public.deals              to authenticated;
alter policy "Tout le monde peut voir les commentaires" on public.film_note_comments to authenticated;
alter policy "Tout le monde peut voir les options"      on public.movie_poll_options to authenticated;
alter policy "Tout le monde peut voir les votes"        on public.movie_poll_votes   to authenticated;
alter policy "Tout le monde peut voir les sondages"     on public.movie_polls        to authenticated;
alter policy "Tout le monde peut voir les likes"        on public.post_likes         to authenticated;
alter policy "Posts visibles par tous"                  on public.posts              to authenticated;
alter policy "Profil visible par tous"                  on public.profiles           to authenticated;
alter policy "Wantlist visible par tous"                on public.wantlist           to authenticated;

-- La vue public_activity ne passe pas par les règles RLS : on retire l'accès anonyme.
revoke select on public.public_activity from anon;

-- B. Table privée des prêts ----------------------------------------------
create table public.collection_prets as
  select id as collection_id, user_id, loaned_to, loaned_at
  from public.collection
  where loaned_to is not null and loaned_to <> '';

alter table public.collection_prets
  add primary key (collection_id),
  add foreign key (collection_id) references public.collection(id) on delete cascade,
  alter column user_id set not null,
  alter column user_id set default auth.uid();

alter table public.collection_prets enable row level security;

create policy "Prets visibles et modifiables par le proprietaire"
  on public.collection_prets for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.collection c
                where c.id = collection_id and c.user_id = auth.uid())
  );

revoke all on public.collection_prets from anon;

-- Effacer les prêts de la table publique (ils sont maintenant copiés ci-dessus)
update public.collection set loaned_to = null, loaned_at = null
  where loaned_to is not null or loaned_at is not null;

commit;
