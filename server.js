const http = require("http");
const { parse } = require("url");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

// 1. Support all possible node_modules locations in cPanel / CloudLinux / LiteSpeed
const possiblePaths = [
  path.join(__dirname, "node_modules"),
  path.join(process.cwd(), "node_modules"),
  "/home/zidane17/nodevenv/erp/22/lib/node_modules",
  "/home/zidane17/nodevenv/erp/22/lib64/node_modules",
];

for (const p of possiblePaths) {
  if (fs.existsSync(p) && !module.paths.includes(p)) {
    module.paths.unshift(p);
  }
}

// 2. Load .env file manually into process.env if present
const envPath = path.join(__dirname, ".env");
if (!fs.existsSync(envPath)) {
  const examplePath = path.join(__dirname, ".env.example");
  if (fs.existsSync(examplePath)) {
    try {
      fs.copyFileSync(examplePath, envPath);
    } catch {}
  }
}

if (fs.existsSync(envPath)) {
  try {
    const envLines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of envLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const idx = trimmed.indexOf("=");
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch {}
}

// 3. Auto-organize .next directory if build files were extracted to root
const nextDir = path.join(__dirname, ".next");
if (!fs.existsSync(nextDir)) {
  try {
    fs.mkdirSync(nextDir, { recursive: true });
  } catch {}
}

const rootBuildId = path.join(__dirname, "BUILD_ID");
if (fs.existsSync(rootBuildId)) {
  const buildItems = [
    "BUILD_ID",
    "server",
    "static",
    "app-path-routes-manifest.json",
    "build-manifest.json",
    "export-marker.json",
    "fallback-build-manifest.json",
    "images-manifest.json",
    "next-minimal-server.js.nft.json",
    "next-server.js.nft.json",
    "prerender-manifest.json",
    "required-server-files.js",
    "required-server-files.json",
    "routes-manifest.json",
    "trace",
    "trace-build",
  ];

  for (const item of buildItems) {
    const srcPath = path.join(__dirname, item);
    const dstPath = path.join(nextDir, item);
    if (fs.existsSync(srcPath)) {
      try {
        if (!fs.existsSync(dstPath)) {
          fs.cpSync(srcPath, dstPath, { recursive: true });
        }
      } catch {}
    }
  }
}

// 4. Require Next.js
let next;
let nextImportError = null;

try {
  next = require("next");
} catch (e) {
  nextImportError = e;
  console.error("Next.js import error:", e);
}

const port = process.env.PORT || 3000;
let nextApp = null;
let initError = null;

async function bootstrap() {
  if (!next) {
    throw new Error(
      `Le module 'next' n'est pas accessible : ${nextImportError ? nextImportError.message : "Inconnu"}`
    );
  }

  // Ensure database tables exist if database is configured
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost:5432/boostera_db")) {
    try {
      execSync("npx prisma db push --skip-generate --accept-data-loss", {
        cwd: __dirname,
        stdio: "pipe",
        timeout: 30000,
      });
      console.log("> Schéma Prisma synchronisé avec succès !");
    } catch (dbErr) {
      console.warn("Notice DB sync:", dbErr.message);
    }
  }

  const dev = process.env.NODE_ENV !== "production";
  nextApp = next({ dev, dir: __dirname });
  await nextApp.prepare();
  console.log("> BOOSTERA ERP Next.js application prepared successfully!");
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
          <title>BOOSTERA ERP — Initialisation</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #f4f4f5; padding: 40px; display: flex; justify-content: center; align-items: center; min-height: 80vh; margin: 0; }
            .card { max-width: 750px; width: 100%; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
            h1 { color: #f43f5e; font-size: 22px; margin-top: 0; display: flex; align-items: center; gap: 8px; }
            p { color: #d4d4d8; font-size: 14px; line-height: 1.5; }
            pre { background: #09090b; padding: 16px; border-radius: 8px; border: 1px solid #3f3f46; color: #fb7185; font-size: 13px; font-family: monospace; overflow-x: auto; white-space: pre-wrap; word-break: break-all; margin: 16px 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>⚠️ Diagnostic — BOOSTERA ERP</h1>
            <p>Le serveur est actif sur <strong>zidane-dev.dz</strong>. Détail :</p>
            <pre>${initError.stack || initError.message || initError}</pre>
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
        <head><meta charset="utf-8"><meta http-equiv="refresh" content="3"></head>
        <body style="background:#09090b;color:#a1a1aa;font-family:sans-serif;padding:40px;text-align:center;">
          <h2>🚀 Démarrage de BOOSTERA ERP...</h2>
          <p>Chargement des modules. Actualisation automatique dans 3 secondes...</p>
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
