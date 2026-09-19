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

// 3. Ensure .next and .next/server directories exist and copy build artifacts
const nextDir = path.join(__dirname, ".next");
const nextServerDir = path.join(nextDir, "server");
const nextStaticDir = path.join(nextDir, "static");

try {
  fs.mkdirSync(nextServerDir, { recursive: true });
  fs.mkdirSync(nextStaticDir, { recursive: true });
} catch {}

// Copy recursive helper
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      try {
        fs.copyFileSync(srcPath, destPath);
      } catch {}
    }
  }
}

// If "server" folder exists at root, sync it into .next/server
const rootServerDir = path.join(__dirname, "server");
if (fs.existsSync(rootServerDir)) {
  copyDirRecursive(rootServerDir, nextServerDir);
}

// If "static" folder exists at root, sync it into .next/static
const rootStaticDir = path.join(__dirname, "static");
if (fs.existsSync(rootStaticDir)) {
  copyDirRecursive(rootStaticDir, nextStaticDir);
}

// Sync root manifest files into .next
const rootFiles = [
  "BUILD_ID",
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
];

for (const f of rootFiles) {
  const src = path.join(__dirname, f);
  const dst = path.join(nextDir, f);
  if (fs.existsSync(src)) {
    try {
      fs.copyFileSync(src, dst);
    } catch {}
  }
}

// Ensure pages-manifest.json exists in .next/server
const pagesManifestPath = path.join(nextServerDir, "pages-manifest.json");
if (!fs.existsSync(pagesManifestPath)) {
  const rootPagesManifest = path.join(rootServerDir, "pages-manifest.json");
  if (fs.existsSync(rootPagesManifest)) {
    try {
      fs.copyFileSync(rootPagesManifest, pagesManifestPath);
    } catch {}
  } else {
    try {
      fs.writeFileSync(
        pagesManifestPath,
        JSON.stringify({ "/404": "pages/404.html", "/500": "pages/500.html" }, null, 2)
      );
    } catch {}
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

  // Ensure database tables and initial accounts exist
  if (process.env.DATABASE_URL) {
    try {
      console.log("Synchronisation de la base PostgreSQL...");
      try {
        execSync("npx prisma db push --accept-data-loss", {
          cwd: __dirname,
          stdio: "pipe",
          timeout: 60000,
        });
        console.log("> Schéma Prisma synchronisé avec succès !");
      } catch (pe) {
        console.warn("Notice prisma db push:", pe.message);
      }

      const { PrismaClient } = require("@prisma/client");
      const testPrisma = new PrismaClient();
      const count = await testPrisma.user.count().catch(() => 0);
      if (count === 0) {
        console.log("Base vide : création des comptes initiaux...");
        const bcrypt = require("bcryptjs");
        const hash = await bcrypt.hash("Boostera2026!", 10);

        const admin = await testPrisma.user.create({
          data: {
            email: "admin@boostera.dz",
            passwordHash: hash,
            name: "Direction BOOSTERA",
            role: "ADMIN",
            phone: "0550 00 00 01",
          },
        });

        const meroua = await testPrisma.user.create({
          data: {
            email: "meroua@boostera.dz",
            passwordHash: hash,
            name: "Meroua (Commerciale)",
            role: "SALES_REP",
            phone: "0550 11 22 32",
          },
        });

        const wiam = await testPrisma.user.create({
          data: {
            email: "wiam@boostera.dz",
            passwordHash: hash,
            name: "Wiam (Commerciale)",
            role: "SALES_REP",
            phone: "0550 11 22 31",
          },
        });

        const toufik = await testPrisma.user.create({
          data: {
            email: "toufik@boostera.dz",
            passwordHash: hash,
            name: "Toufik (Commercial)",
            role: "SALES_REP",
            phone: "0550 11 22 33",
          },
        });

        const sidahmed = await testPrisma.user.create({
          data: {
            email: "sidahmed@boostera.dz",
            passwordHash: hash,
            name: "Sidahmed (Technicien)",
            role: "TECH_LEAD",
            phone: "0550 11 22 34",
          },
        });

        await testPrisma.employee.createMany({
          data: [
            { userId: admin.id, firstName: "Direction", lastName: "BOOSTERA", position: "Direction Générale", department: "ADMINISTRATION" },
            { userId: meroua.id, firstName: "Meroua", lastName: "Commerciale", position: "Commercial", department: "COMMERCIAL" },
            { userId: wiam.id, firstName: "Wiam", lastName: "Commerciale", position: "Commercial", department: "COMMERCIAL" },
            { userId: toufik.id, firstName: "Toufik", lastName: "Commercial", position: "Commercial", department: "COMMERCIAL" },
            { userId: sidahmed.id, firstName: "Sidahmed", lastName: "Technicien", position: "Chef de Projet", department: "TECHNICAL" },
          ],
        });

        console.log("> Comptes initiaux créés avec succès !");
      }
      await testPrisma.$disconnect();
    } catch (dbErr) {
      console.warn("Notice DB setup/seed:", dbErr.message);
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
