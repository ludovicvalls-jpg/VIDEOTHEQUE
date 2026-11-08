-- Dernière connexion des membres (8 novembre 2026)
-- Ajoute la date/heure de dernière activité sur chaque profil.
-- Elle est mise à jour par l'application (marquerConnexion dans index.html)
-- et affichée sous le nom du membre dans sa fiche.
-- Les règles existantes suffisent : chacun ne peut modifier que son propre profil,
-- et seuls les membres connectés peuvent lire les profils.

alter table public.profiles add column if not exists last_seen_at timestamptz;
