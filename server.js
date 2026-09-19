const http = require("http");
const { parse } = require("url");

let next;
try {
  next = require("next");
} catch (e) {
  console.error("Next.js import error:", e);
}

const port = process.env.PORT || 3000;
let nextApp = null;
let initError = null;

async function bootstrap() {
  if (!next) {
    throw new Error(
      "Le module Next.js n'a pas été trouvé dans node_modules. Veuillez cliquer sur 'Run NPM Install' dans votre cPanel."
    );
  }

  const dev = process.env.NODE_ENV !== "production";
  nextApp = next({ dev, dir: __dirname });
  await nextApp.prepare();
  console.log("> Next.js application prepared successfully!");
}

bootstrap().catch((err) => {
  console.error("BOOTSTRAP ERROR:", err);
  initError = err;
});

const server = http.createServer(async (req, res) => {
  if (initError) {
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8">
          <title>BOOSTERA ERP — Diagnostic</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #f4f4f5; padding: 40px; display: flex; justify-content: center; align-items: center; min-height: 80vh; margin: 0; }
            .card { max-width: 700px; width: 100%; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
            h1 { color: #f43f5e; font-size: 22px; margin-top: 0; display: flex; align-items: center; gap: 8px; }
            p { color: #d4d4d8; font-size: 14px; line-height: 1.5; }
            pre { background: #09090b; padding: 16px; border-radius: 8px; border: 1px solid #3f3f46; color: #fb7185; font-size: 13px; font-family: monospace; overflow-x: auto; white-space: pre-wrap; word-break: break-all; margin: 16px 0; }
            .info { background: #1e1b4b; border: 1px solid #4338ca; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #c7d2fe; margin-top: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>⚠️ Diagnostic Système — BOOSTERA ERP</h1>
            <p>Le serveur Node.js est actif, mais Next.js a rencontré cette erreur lors de son initialisation :</p>
            <pre>${initError.stack || initError.message || initError}</pre>
            <div class="info">
              💡 <strong>Solution :</strong> Ce message indique précisément ce qui doit être fait (ex: exécuter 'npm run build', vérifier le fichier .env, ou installer les dépendances).
            </div>
          </div>
        </body>
      </html>
    `);
    return;
  }

  if (!nextApp) {
    res.writeHead(503, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta http-equiv="refresh" content="5"></head>
        <body style="background:#09090b;color:#a1a1aa;font-family:sans-serif;padding:40px;text-align:center;">
          <h2>🚀 Démarrage de BOOSTERA ERP en cours...</h2>
          <p>Le serveur prépare les pages de l'application. Cette page va s'actualiser automatiquement dans 5 secondes.</p>
        </body>
      </html>
    `);
    return;
  }

  try {
    const parsedUrl = parse(req.url, true);
    await nextApp.getRequestHandler()(req, res, parsedUrl);
  } catch (err) {
    console.error("Request handling error:", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
});

server.listen(port, (err) => {
  if (err) {
    console.error("Server listen error:", err);
    return;
  }
  console.log(`> BOOSTERA ERP listening on port ${port}`);
});
