# Installer « Repérés sur le web » dans Bons Plans (8 novembre 2026)

Le bloc **🌐 Repérés sur le web** de la section Bons Plans affiche les promos
Blu-ray, 4K et DVD publiées sur Dealabs (Amazon, Fnac, Leclerc…). Il passe
par une fonction relais Supabase nommée **`bons-plans-web`**, dont le code est
dans `supabase/functions/bons-plans-web/index.ts`.

Aucune clé n'est nécessaire : les flux RSS de Dealabs sont publics.

## Créer la fonction (une seule fois)

1. Dans Supabase : **Edge Functions → Deploy a new function → Via Editor**.
2. Nom de la fonction : `bons-plans-web` (exactement, tout en minuscules).
3. Effacer le code d'exemple du fichier `index.ts` et coller tout le contenu de
   `supabase/functions/bons-plans-web/index.ts`.
4. Cliquer sur **Deploy function**.
5. Laisser **Verify JWT** activé : seuls les membres connectés peuvent l'utiliser.

## Tester

Ouvrir le site, se connecter, aller dans **🔥 Bons Plans** : le bandeau orange
« Repérés sur le web » apparaît au-dessus des bons plans des membres. Tant que
la fonction n'est pas installée, le bandeau ne s'affiche simplement pas.

## À savoir

- Les flux sont relus au plus toutes les 30 minutes, puis gardés en mémoire.
- Seuls les bons plans de moins de 21 jours sont affichés (40 maximum).
- Chaque carte renvoie vers la page Dealabs du bon plan.
