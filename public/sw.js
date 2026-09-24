// Minimal service worker: no app caching, no offline mode.
// It only replaces the browser's own connection-error page with a clear
// Hebrew message when a page navigation fails because there is no network.

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>אין חיבור לאינטרנט</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; background: #0a0a0a; color: #ededed; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; text-align: center; }
  main { max-width: 360px; }
  h1 { font-size: 1.25rem; margin-bottom: 8px; }
  p { color: #a3a3a3; margin-bottom: 20px; }
  button { font-size: 16px; padding: 10px 20px; border-radius: 8px; border: none; background: #2563eb; color: white; cursor: pointer; }
</style>
</head>
<body>
  <main>
    <h1>אין חיבור לאינטרנט</h1>
    <p>בדקי את החיבור לרשת ונסי שוב.</p>
    <button onclick="location.reload()">נסי שוב</button>
  </main>
</body>
</html>`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } })
    )
  );
});
