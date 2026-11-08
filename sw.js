// Service worker minimal : il rend le site installable comme une application.
// Il ne met RIEN en cache : chaque ouverture charge la dernière version publiée,
// donc aucun risque de rester bloqué sur une ancienne version du site.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {}); // laisse le navigateur gérer toutes les requêtes normalement
