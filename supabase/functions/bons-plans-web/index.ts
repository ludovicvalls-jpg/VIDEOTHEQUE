// Fonction relais « bons-plans-web » (Supabase Edge Function)
// -----------------------------------------------------------
// Lit les flux RSS publics de Dealabs (groupes Blu-ray, Blu-ray 4K et DVD)
// et renvoie les bons plans récents : titre, magasin, prix, image, lien.
// Les flux sont gardés en mémoire 30 minutes pour ne pas solliciter Dealabs
// à chaque visite. Aucune clé n'est nécessaire.
//
// Seuls les membres connectés peuvent l'appeler (option « Verify JWT » activée).
// Installation : voir supabase/2026-11-08_09_bons_plans_web_installation.md

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const FLUX = [
  { url: 'https://www.dealabs.com/rss/groupe/blu-ray', groupe: 'Blu-ray' },
  { url: 'https://www.dealabs.com/rss/groupe/blu-ray-4k', groupe: '4K' },
  { url: 'https://www.dealabs.com/rss/groupe/dvd', groupe: 'DVD' },
];
const DUREE_CACHE = 30 * 60 * 1000;
const JOURS_MAX = 21;

type BonPlan = {
  titre: string; lien: string; date: string; magasin: string | null;
  prix: string | null; image: string | null; groupe: string;
};

let cache: { quand: number; plans: BonPlan[] } | null = null;

function decoder(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").trim();
}
const attr = (bloc: string, re: RegExp) => { const m = bloc.match(re); return m ? decoder(m[1]) : null; };

async function lireFlux(url: string, groupe: string): Promise<BonPlan[]> {
  const rep = await fetch(url, { headers: { 'User-Agent': 'MaVideotheque/1.0 (lecteur RSS)' } });
  if (!rep.ok) return [];
  const xml = await rep.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items.map((it) => ({
    titre: attr(it, /<title>([\s\S]*?)<\/title>/) || '',
    lien: attr(it, /<link>([\s\S]*?)<\/link>/) || '',
    date: attr(it, /<pubDate>([\s\S]*?)<\/pubDate>/) || '',
    magasin: attr(it, /<pepper:merchant[^>]*\bname="([^"]*)"/),
    prix: attr(it, /<pepper:merchant[^>]*\bprice="([^"]*)"/),
    image: attr(it, /<media:content[^>]*\burl="([^"]*)"/),
    groupe,
  })).filter((p) => p.titre && /^https:\/\/www\.dealabs\.com\//.test(p.lien));
}

async function bonsPlans(): Promise<BonPlan[]> {
  if (cache && Date.now() - cache.quand < DUREE_CACHE) return cache.plans;
  const listes = await Promise.all(FLUX.map((f) => lireFlux(f.url, f.groupe).catch(() => [])));
  const vus = new Set<string>();
  const limite = Date.now() - JOURS_MAX * 86400000;
  const plans = listes.flat()
    .filter((p) => { if (vus.has(p.lien)) return false; vus.add(p.lien); return true; })
    .filter((p) => !p.date || new Date(p.date).getTime() >= limite)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 40);
  // On ne remplace le cache que si on a bien reçu quelque chose
  if (plans.length || !cache) cache = { quand: Date.now(), plans };
  return cache.plans;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const plans = await bonsPlans();
    return new Response(JSON.stringify({ plans, source: 'Dealabs' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ erreur: String((e as Error).message || e) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
