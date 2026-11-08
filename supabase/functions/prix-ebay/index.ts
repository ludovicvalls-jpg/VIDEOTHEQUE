// Fonction relais « prix-ebay » (Supabase Edge Function)
// ------------------------------------------------------
// Cherche sur eBay France les annonces d'un film dans un format donné
// et renvoie une estimation : nombre d'annonces, prix mini, médiane, maxi.
//
// Pourquoi un relais ? La clé secrète eBay ne doit jamais être dans index.html
// (tout le monde pourrait la lire). Elle reste ici, côté serveur, dans les
// secrets Supabase : EBAY_CLIENT_ID et EBAY_CLIENT_SECRET.
//
// Seuls les membres connectés peuvent l'appeler (option « Verify JWT » activée).
// Installation : voir supabase/2026-11-08_08_prix_ebay_installation.md

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Mots pour la recherche, et mots qui doivent apparaître dans le titre de l'annonce
const FORMATS: Record<string, { recherche: string; motif: RegExp }> = {
  VHS:       { recherche: 'VHS',        motif: /\bvhs\b|k7|cassette/i },
  DVD:       { recherche: 'DVD',        motif: /\bdvd\b/i },
  BLURAY:    { recherche: 'Blu-ray',    motif: /blu[\s-]?ray|bluray/i },
  BLURAY4K:  { recherche: 'Blu-ray 4K', motif: /\b4k\b|uhd/i },
  LASERDISC: { recherche: 'Laserdisc',  motif: /laser\s?dis[ck]|\bld\b/i },
};
// Annonces à écarter : lots, objets qui ne sont pas le film lui-même
const EXCLUS = /\blots?\b|affiche|poster|jaquette|sleeve|pochette seule|boitier vide|boîtier vide|\bvide\b|figurine|t-shirt|livre/i;

let jeton: { valeur: string; expire: number } | null = null;

async function obtenirJeton(): Promise<string> {
  if (jeton && Date.now() < jeton.expire) return jeton.valeur;
  const id = Deno.env.get('EBAY_CLIENT_ID');
  const secret = Deno.env.get('EBAY_CLIENT_SECRET');
  if (!id || !secret) throw new Error('Clés eBay absentes des secrets Supabase');
  const rep = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(id + ':' + secret),
    },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
  });
  if (!rep.ok) throw new Error('eBay refuse les clés (' + rep.status + ')');
  const d = await rep.json();
  // On garde le jeton un peu moins longtemps que sa durée de vie (2 h en général)
  jeton = { valeur: d.access_token, expire: Date.now() + (d.expires_in - 300) * 1000 };
  return jeton.valeur;
}

type Annonce = { titre: string; prix: number; url: string; image: string | null; etat: string };

async function chercher(q: string, occasionSeulement: boolean): Promise<Annonce[]> {
  const filtres = ['buyingOptions:{FIXED_PRICE}', 'priceCurrency:EUR'];
  if (occasionSeulement) filtres.push('conditions:{USED}');
  const url = 'https://api.ebay.com/buy/browse/v1/item_summary/search'
    + '?q=' + encodeURIComponent(q)
    + '&limit=50&filter=' + encodeURIComponent(filtres.join(','));
  const rep = await fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + await obtenirJeton(),
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_FR',
      'Accept-Language': 'fr-FR',
    },
  });
  if (!rep.ok) throw new Error('Recherche eBay en échec (' + rep.status + ')');
  const d = await rep.json();
  return (d.itemSummaries || [])
    .filter((it: any) => it.price && it.price.currency === 'EUR')
    .map((it: any) => ({
      titre: it.title || '',
      prix: parseFloat(it.price.value),
      url: it.itemWebUrl || '',
      image: it.image?.imageUrl || null,
      etat: it.condition || '',
    }));
}

function mediane(v: number[]): number {
  const t = [...v].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

const normaliser = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Mots autorisés juste après un titre court : format, langue, état, édition, année…
// Tout le reste (« 3 », « vs », « : Covenant », « the series »…) désigne un autre film.
const SUITE_OK = /^(\s*$|\s*[\(\[\-\/\|,.!]|\s+(dvd|blu|bluray|vhs|k7|cassette|4k|uhd|laser|laserdisc|ld|vf|vo|vost|vostfr|fr|french|film|edition|collector|zone|version|import|pal|secam|steelbook|coffret|neuf|tres|bon|etat|comme|original|integrale?|director|special|ultimate|de|du|le|par|avec|(19|20)\d\d)\b)/;

// Garde les annonces du bon format, qui parlent bien de ce film-là
function trier(annonces: Annonce[], titre: string, format: string): Annonce[] {
  const motif = FORMATS[format]?.motif;
  const t0 = normaliser(titre);
  const mots = t0.split(/[^a-z0-9]+/).filter((m) => m.length > 2);
  const tousMots = t0.split(/[^a-z0-9]+/).filter(Boolean);
  // Titre court (1 ou 2 mots) : on exige le titre exact, suivi d'un mot « neutre »
  const phrase = tousMots.length
    ? new RegExp('(^|[^a-z0-9])' + tousMots.join('[^a-z0-9]+') + '(?![a-z0-9])(.*)$')
    : null;
  return annonces.filter((a) => {
    if (!a.prix || a.prix <= 0 || EXCLUS.test(a.titre)) return false;
    if (motif && !motif.test(a.titre)) return false;
    // Le format 4K ne doit pas ramasser les Blu-ray simples et inversement
    if (format === 'BLURAY' && /\b4k\b|uhd/i.test(a.titre)) return false;
    const t = normaliser(a.titre);
    if (mots.length >= 3) {
      const trouves = mots.filter((m) => t.includes(m)).length;
      return trouves >= Math.ceil(mots.length * 0.6);
    }
    if (!phrase) return true;
    const m = t.match(phrase);
    return !!m && SUITE_OK.test(m[2]);
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const repondre = (corps: unknown, statut = 200) =>
    new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, 'Content-Type': 'application/json' } });

  try {
    const { titre, titreVo, format } = await req.json();
    const t = String(titre || '').trim().slice(0, 120);
    const vo = String(titreVo || '').trim().slice(0, 120);
    const f = String(format || '');
    if (!t) return repondre({ erreur: 'Titre manquant' }, 400);
    const motFormat = FORMATS[f]?.recherche || '';

    // 1) titre français en occasion ; 2) sinon titre VO ; 3) sinon neuf compris
    let titreUtilise = t;
    let annonces = trier(await chercher(t + ' ' + motFormat, true), t, f);
    if (annonces.length < 3 && vo && vo.toLowerCase() !== t.toLowerCase()) {
      const avecVo = trier(await chercher(vo + ' ' + motFormat, true), vo, f);
      if (avecVo.length > annonces.length) { annonces = avecVo; titreUtilise = vo; }
    }
    let occasion = true;
    if (annonces.length < 3) {
      const tout = trier(await chercher(titreUtilise + ' ' + motFormat, false), titreUtilise, f);
      if (tout.length > annonces.length) { annonces = tout; occasion = false; }
    }

    // Écarte les prix aberrants (plus de 3 fois au-dessus ou en dessous de la médiane)
    if (annonces.length >= 4) {
      const m = mediane(annonces.map((a) => a.prix));
      annonces = annonces.filter((a) => a.prix <= m * 3 && a.prix >= m / 3);
    }
    const lien = 'https://www.ebay.fr/sch/i.html?_nkw=' + encodeURIComponent(titreUtilise + ' ' + motFormat)
      + (occasion ? '&LH_ItemCondition=3000' : '');
    if (!annonces.length) return repondre({ nb: 0, lien });

    const prix = annonces.map((a) => a.prix);
    annonces.sort((a, b) => a.prix - b.prix);
    return repondre({
      nb: annonces.length,
      occasion,
      min: Math.min(...prix),
      mediane: Math.round(mediane(prix) * 2) / 2, // arrondi à 0,50 €
      max: Math.max(...prix),
      lien,
      exemples: annonces.slice(0, 5),
    });
  } catch (e) {
    return repondre({ erreur: String((e as Error).message || e) }, 500);
  }
});
