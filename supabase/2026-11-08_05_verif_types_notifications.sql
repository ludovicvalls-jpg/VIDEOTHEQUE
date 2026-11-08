-- Vérification (lecture seule) avant l'alerte wantlist (8 novembre 2026)
-- L'application crée maintenant des notifications de type 'wantlist_match'.
-- Cette requête liste les contraintes qui limiteraient les valeurs de notifications.type.
-- Aucune ligne en résultat = rien à faire.

select conname as contrainte, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.notifications'::regclass
  and contype = 'c';
