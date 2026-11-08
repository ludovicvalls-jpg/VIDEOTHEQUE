# Installer l'estimation du prix eBay (8 novembre 2026)

Le bouton **🔍 Prix** de la fiche d'ajout interroge eBay France à travers une
fonction relais Supabase nommée **`prix-ebay`**. Son code est dans
`supabase/functions/prix-ebay/index.ts`. Les clés eBay restent dans les secrets
Supabase et n'apparaissent jamais dans le site.

À faire une seule fois, dans le tableau de bord Supabase.

## 1. Enregistrer les clés eBay

1. Sur developer.ebay.com, ouvrir **Application Keys** et prendre le jeu de clés
   **Production** (pas Sandbox).
2. Dans Supabase : **Edge Functions → Secrets** (menu de gauche).
3. Ajouter deux secrets, avec exactement ces noms :
   - `EBAY_CLIENT_ID` : la valeur **App ID (Client ID)**
   - `EBAY_CLIENT_SECRET` : la valeur **Cert ID (Client Secret)**
4. Enregistrer.

## 2. Créer la fonction

1. Dans Supabase : **Edge Functions → Deploy a new function → Via Editor**.
2. Nom de la fonction : `prix-ebay` (exactement, tout en minuscules).
3. Effacer le code d'exemple et coller tout le contenu de
   `supabase/functions/prix-ebay/index.ts`.
4. Cliquer sur **Deploy function**.
5. Dans les réglages de la fonction, laisser **Verify JWT** activé : seuls les
   membres connectés pourront l'utiliser.

## 3. Tester

Ouvrir le site, se connecter, ajouter un film, choisir l'affiche : l'estimation
s'affiche toute seule sous « Valeur estimée ». Si la ligne eBay indique
« estimation indisponible », regarder **Edge Functions → prix-ebay → Logs**.
Le message d'erreur dit si ce sont les clés qui sont refusées.

## À savoir

- eBay ne donne gratuitement que les **annonces en cours**, pas les ventes
  conclues. On prend la médiane et on écarte les prix aberrants.
- La limite gratuite d'eBay est de 5 000 recherches par jour, largement assez.
