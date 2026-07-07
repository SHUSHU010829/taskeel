// Minimal service worker so the app is installable ("Add to Home Screen") and
// Chrome offers the install prompt. Intentionally a network passthrough — no
// asset caching, so a redeploy is never served stale.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // default network handling
});
