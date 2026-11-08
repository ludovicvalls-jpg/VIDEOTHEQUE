-- Remplit la dernière connexion des membres qui ne sont pas revenus
-- depuis la mise en ligne de la fonctionnalité, à partir de la date de
-- dernière authentification (mot de passe) enregistrée par Supabase.
-- Ne touche pas aux membres qui ont déjà une valeur.

update public.profiles p
set last_seen_at = u.last_sign_in_at
from auth.users u
where u.id = p.id
  and p.last_seen_at is null
  and u.last_sign_in_at is not null;
