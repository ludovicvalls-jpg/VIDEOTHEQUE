# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Vue d'ensemble

« Ma Vidéothèque » : application web communautaire de collectionneurs de films physiques (VHS, DVD, Blu-ray, 4K, Laser Disc). L'interface, les messages et les commentaires du code sont en français.

Le dépôt GitHub `ludovicvalls-jpg/VIDEOTHEQUE` est déployé tel quel sur **Vercel**. Il n'y a ni build, ni package.json, ni linter, ni tests automatisés.

## Lancer / tester

- Ouvrir `index.html` directement dans un navigateur (ou le navigateur intégré). Toutes les dépendances viennent de CDN.
- Il n'y a pas de base de données de développement : la page parle directement à la **base Supabase de production**. Tout test une fois connecté modifie de vraies données. Utiliser un compte de test et ne jamais supprimer ou modifier des données d'autres membres.
- Vérifier la console du navigateur après chaque changement : c'est le seul « test » disponible.

## Architecture

Tout tient dans **`index.html`** (~5 900 lignes), en trois blocs :
1. `<style>` (début du fichier) : CSS global, couleurs en variables CSS (`--pink`, `--cyan`, `--muted`…).
2. Le HTML : écran de connexion `#loginScreen`, puis `#app` qui contient des `<div class="section" id="sectionXxx">` (Rayon, Wantlist/Market, Members, Messages, Activity, Forum, Extras, Deals, Profile).
3. Un seul `<script>` (après les `<script src>` de supabase-js v2 et Leaflet 1.9.4) avec toute la logique, en fonctions globales.

Points clés du script :
- **Navigation** : `showSection(id)` active la section et l'onglet `.nav-tab[data-section=…]` (+ entrées du menu hamburger mobile), et gère le bouton retour via l'historique.
- **Auth** : `initAuth()` (appelé vers la fin du script) → `onLogin(user)` charge/crée la ligne `profiles`, remplit le formulaire de profil, puis charge collection, wantlist, notifications, activité. `onLogout()` réinitialise. Attention : deux variables coexistent pour l'utilisateur, `currentUser` (objet, via `onLogin`) et `currentUserId` (id, défini plus bas pour la partie Bons Plans).
- **État global** : `collection`, `wantlist`, `currentUser`, `currentProfile`, `editingId`… ; `render()` redessine le rayon à partir de `collection`.
- **Données** : client `sb` (Supabase). La table `collection` utilise des colonnes snake_case converties par `toRow()` / `fromRow()` vers des objets camelCase : toute nouvelle colonne doit être ajoutée aux **deux** fonctions. Autres tables : `profiles`, `wantlist`, `messages` (+ canal temps réel `sb.channel('messages…')`), `notifications`, `posts`, `post_likes`, `film_note_comments`, `movie_polls` / `movie_poll_options` / `movie_poll_votes`, `deals` / `deal_votes`, vue `public_activity`. Le schéma et les règles RLS vivent dans Supabase ; les scripts SQL déjà appliqués sont archivés dans `supabase/` (un fichier daté par changement, à exécuter à la main dans le SQL Editor).
- **Règles d'accès** : toutes les lectures sont réservées aux membres connectés (rien n'est lisible en anonyme). Les « Notes » d'un film sont volontairement visibles par les autres membres ; la « Note publique » est en plus commentable.
- **Prêts privés** : le nom de l'emprunteur et la date ne sont plus stockés dans `collection` (colonnes `loaned_to`/`loaned_at` forcées à null par `toRow`) mais dans `collection_prets`, lisible uniquement par le propriétaire. `loadCollection()` fusionne les deux tables, `savePret()` (appelé par `saveItem`) écrit ou supprime le prêt.
- **Dernière connexion** : `marquerConnexion()` met à jour `profiles.last_seen_at` (à la connexion, au retour sur l'onglet, puis toutes les 5 min) ; `formatDerniereConnexion()` l'affiche dans la fiche membre (`#memberLastSeen`).
- **Alerte wantlist** : `saveItem` → `verifierMiseEnMarche()` compare l'état vente/échange à celui en base (`etatMarche`) ; si un film passe en vente ou à l'échange, `notifierWantlists()` crée une notification `wantlist_match` pour chaque membre qui a le même `tmdb_id` dans sa wantlist.
- **Rappel des prêts** : `PRET_RAPPEL_JOURS` (30) ; au-delà, le badge PRÊTÉ passe en rouge et la barre de stats affiche « à récupérer ».
- **Pseudos cliquables** : afficher un pseudo avec `lienMembre(uid, pseudo)` (échappe le HTML). Un écouteur global en phase de capture sur `.user-link` ouvre `openMemberCollection` avant les clics des cartes parentes ; sans uid, l'id est retrouvé par le pseudo (utilisé pour les @mentions du Mur).
- **Mobile (< 600 px)** : en-tête compact qui se cache en descendant (classe `header.cache`, gérée au scroll) ; `.toolbar` n'est plus collante. La barre de stats du rayon est `#stats`, juste au-dessus de `#grid`.
- **Fil d'accueil** (`#sectionAccueil`, page d'arrivée) : `loadAccueil()` fusionne sur 30 jours `public_activity` (groupé par membre et par jour), avis publics (`collection.public_note`), `posts`, `deals`, `movie_polls`, plus un bandeau « En ce moment » (`last_seen_at` < 7 j) et une vitrine « Les nouveautés des membres » (`renderNouveautes`, 3 films max par membre). Chaque carte a une couleur par type (classe `t-<type>` qui fixe `--accent`). Réactions ❤️/🔥/🤝 dans la table `reactions` (`cible_type` + `cible_id`) ; les posts gardent `post_likes`. Réagir notifie l'auteur (type `reaction`, détails dans `notifications.meta`).
- **Discussions sur les films** : sur toute fiche ouverte via `openMemberFilm`, n'importe quel membre peut écrire une note (`film_note_comments`), même sans « note publique » du propriétaire ; l'auteur peut la modifier (`editerNoteComment`, colonne `updated_at`) ou la supprimer. `loadAccueil()` regroupe ces notes par film en une carte « a écrit sur « X » de Y » (type `note`, fusionnée avec la carte d'avis public du même film si elle existe).
- **Types de notifications** : `mention`, `note_comment`, `new_deal`, `wantlist_match`, `reaction` (texte dans `renderNotifDropdown`, clic dans `handleNotifClick`).
- **Sécurité côté client** : utilitaires en tête de script (`escHtml`, `safeUrl`, `validateText`, `validatePrice`, `checkLoginRateLimit`). Le HTML est construit par concaténation de chaînes / template strings : passer tout contenu venant d'utilisateurs par `escHtml()` et les URLs par `safeUrl()`.
- **Événements** : mélange d'`addEventListener` et d'attributs `onclick="…"` inline (qui appellent des fonctions globales ; ne pas les rendre locales).
- **Doublons** : `showExtrasSection` est définie deux fois ; c'est la seconde définition (plus bas) qui s'applique.

## Services externes

Clés en clair dans le script (`SUPABASE_URL`/`SUPABASE_KEY` anon, `TMDB_KEY`, `GIPHY_KEY`).
- TMDB (`api.themoviedb.org`, `language=fr-FR`) : recherche de films, affiches, personnes.
- Giphy : GIF du forum. Nominatim + Leaflet : carte des membres par ville. `api.allorigins.win` : proxy pour lire les flux RSS Letterboxd.

**`vercel.json`** définit les en-têtes de sécurité, dont une **Content-Security-Policy** stricte : tout nouveau domaine appelé par `fetch` doit être ajouté à `connect-src`, tout nouveau script CDN à `script-src` (seuls `cdn.jsdelivr.net` et `unpkg.com` sont autorisés), sinon il sera bloqué en production alors qu'il fonctionne en local.

## Application installable (PWA)

`manifest.webmanifest` + `icons/` + `sw.js` permettent d'installer le site sur l'écran d'accueil (plein écran, sans barre du navigateur). `sw.js` ne met volontairement rien en cache : ne pas y ajouter de cache sans prévoir la mise à jour des versions. Les icônes sont générées par script (texte « MV » néon) ; les régénérer plutôt que les retoucher à la main.

## Images

`images/jour N.jpg` alimentent le « bonbon du jour » (liste `BONBON_IMAGES`). Elles ne sont **pas** chargées en chemin relatif mais depuis `raw.githubusercontent.com/ludovicvalls-jpg/VIDEOTHEQUE/main/images/` (`BONBON_BASE`) : une nouvelle image n'apparaît qu'une fois poussée sur la branche `main` de GitHub, et doit être ajoutée à `BONBON_IMAGES` (espaces encodés en `%20`).
