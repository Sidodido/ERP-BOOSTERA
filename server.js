const http = require("http");
const { parse } = require("url");
const path = require("path");
const fs = require("fs");

// 0. Error logging to file for troubleshooting
const debugLogFile = path.join(__dirname, "server_debug.log");
function logDebug(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  try {
    fs.appendFileSync(debugLogFile, line);
  } catch {}
}

logDebug("Starting BOOSTERA ERP server.js...");

const Module = require("module");

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

try {
  const existingNodePath = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];
  const validPaths = possiblePaths.filter(p => fs.existsSync(p));
  process.env.NODE_PATH = Array.from(new Set([...validPaths, ...existingNodePath])).join(path.delimiter);
  Module._initPaths();
} catch {}

// Auto-fix any extracted folders or zip files
try {
  const { execSync } = require("child_process");
  const nmDir = path.join(__dirname, "node_modules");
  fs.mkdirSync(nmDir, { recursive: true });

  // 1. Check for uploaded zip files and auto-extract
  const zipFiles = [
    path.join(__dirname, "prisma-engine.zip"),
    path.join(nmDir, "prisma-engine.zip"),
    path.join(__dirname, "prisma_linux.zip"),
    path.join(nmDir, "prisma_linux.zip"),
  ];
  for (const zf of zipFiles) {
    if (fs.existsSync(zf)) {
      logDebug(`Found zip archive ${zf}, auto-extracting with unzip...`);
      try {
        execSync(`unzip -o "${zf}" -d "${nmDir}"`);
        logDebug(`Successfully extracted ${zf}`);
      } catch (err) {
        logDebug(`Extraction notice: ${err.message}`);
      }
    }
  }

  // 2. Fix nested node_modules (e.g. node_modules/node_modules/@prisma)
  const nestedNm = path.join(nmDir, "node_modules");
  if (fs.existsSync(nestedNm)) {
    logDebug("Detected nested node_modules, flattening...");
    copyDirRecursive(nestedNm, nmDir);
  }

  // 3. Fix root-level extraction (e.g. erp/@prisma or erp/.prisma)
  const rootPrisma = path.join(__dirname, "@prisma");
  if (fs.existsSync(rootPrisma)) {
    logDebug("Moving root @prisma to node_modules/@prisma");
    copyDirRecursive(rootPrisma, path.join(nmDir, "@prisma"));
  }
  const rootDotPrisma = path.join(__dirname, ".prisma");
  if (fs.existsSync(rootDotPrisma)) {
    logDebug("Moving root .prisma to node_modules/.prisma");
    copyDirRecursive(rootDotPrisma, path.join(nmDir, ".prisma"));
  }

  // 4. Fix clean_prisma extraction
  const cleanPrisma = path.join(__dirname, "clean_prisma");
  if (fs.existsSync(cleanPrisma)) {
    logDebug("Moving clean_prisma to node_modules");
    copyDirRecursive(cleanPrisma, nmDir);
  }
} catch (autoFixErr) {
  logDebug("Auto-fix notice: " + autoFixErr.message);
}

const envPath = path.join(__dirname, ".env");
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
        // Force replace localhost with 127.0.0.1 for PostgreSQL to prevent Linux IPv6 timeouts
        if (key === "DATABASE_URL") {
          val = val.replace("@localhost:", "@127.0.0.1:");
        }
        process.env[key] = val;
      }
    }
    logDebug("Loaded .env file successfully.");
  } catch (err) {
    logDebug("Error loading .env: " + err.message);
  }
}

// 3. Ensure .next and required directories exist
const nextDir = path.join(__dirname, ".next");
const nextServerDir = path.join(nextDir, "server");
const nextStaticDir = path.join(nextDir, "static");

try {
  fs.mkdirSync(nextServerDir, { recursive: true });
  fs.mkdirSync(nextStaticDir, { recursive: true });
} catch {}

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

const rootServerDir = path.join(__dirname, "server");
if (fs.existsSync(rootServerDir)) {
  copyDirRecursive(rootServerDir, nextServerDir);
}

const rootStaticDir = path.join(__dirname, "static");
if (fs.existsSync(rootStaticDir)) {
  copyDirRecursive(rootStaticDir, nextStaticDir);
}

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

// 4. Prisma Auto-Init Helper
let prismaClient = null;
let prismaLoadError = null;
let prismaInstallLog = "";

function tryGeneratePrisma() {
  const { execSync } = require("child_process");
  const nodeBin = "/home/zidane17/nodevenv/erp/22/bin";
  const customPath = `${nodeBin}:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ""}`;
  const env = { ...process.env, PATH: customPath };
  let logs = [];

  // Step A: Attempt npx prisma generate
  try {
    logs.push("⏳ Lancement de 'npx prisma generate'...");
    const out = execSync("npx prisma generate", { cwd: __dirname, env, encoding: "utf-8", timeout: 60000 });
    logs.push("✅ prisma generate réussi :\n" + out);
    return { success: true, logs: logs.join("\n") };
  } catch (e1) {
    logs.push("ℹ️ npx prisma generate direct a échoué: " + (e1.stdout || "") + " " + (e1.stderr || "") + " " + e1.message);
  }

  // Step B: Attempt npm install @prisma/client prisma
  try {
    logs.push("⏳ Installation de @prisma/client et prisma via npm...");
    const out2 = execSync("npm install @prisma/client@6.4.1 prisma@6.4.1 --no-audit --no-fund --omit=dev", { cwd: __dirname, env, encoding: "utf-8", timeout: 90000 });
    logs.push("✅ npm install terminé :\n" + out2);
    logs.push("⏳ Génération du client...");
    const out3 = execSync("npx prisma generate", { cwd: __dirname, env, encoding: "utf-8", timeout: 60000 });
    logs.push("✅ prisma generate réussi :\n" + out3);
    return { success: true, logs: logs.join("\n") };
  } catch (e2) {
    logs.push("❌ Échec installation npm: " + (e2.stdout || "") + " " + (e2.stderr || "") + " " + e2.message);
    return { success: false, logs: logs.join("\n") };
  }
}

function getPrisma(forceReload = false) {
  if (forceReload) {
    prismaClient = null;
    prismaLoadError = null;
  }
  if (!prismaClient && !prismaLoadError) {
    try {
      let PrismaClientClass = null;
      try {
        PrismaClientClass = require("@prisma/client").PrismaClient;
      } catch (e1) {
        for (const p of possiblePaths) {
          try {
            const candidate = path.join(p, "@prisma/client");
            if (fs.existsSync(candidate)) {
              PrismaClientClass = require(candidate).PrismaClient;
              if (PrismaClientClass) break;
            }
          } catch {}
        }
        if (!PrismaClientClass) {
          // Attempt on-the-fly generation if missing
          const genRes = tryGeneratePrisma();
          prismaInstallLog = genRes.logs;
          if (genRes.success) {
            try {
              PrismaClientClass = require("@prisma/client").PrismaClient;
            } catch (eRetry) {
              for (const p of possiblePaths) {
                try {
                  const candidate = path.join(p, "@prisma/client");
                  if (fs.existsSync(candidate)) {
                    PrismaClientClass = require(candidate).PrismaClient;
                    if (PrismaClientClass) break;
                  }
                } catch {}
              }
            }
          }
        }
        if (!PrismaClientClass) throw e1;
      }
      prismaClient = new PrismaClientClass({
        log: ["error"],
      });
    } catch (e) {
      prismaLoadError = e;
      logDebug("Failed to require @prisma/client: " + (e.stack || e.message));
    }
  }
  return prismaClient;
}

async function runDbInit() {
  let prisma = getPrisma();
  if (!prisma) {
    const res = tryGeneratePrisma();
    prismaInstallLog = res.logs;
    prisma = getPrisma(true);
  }
  if (!prisma) {
    throw new Error("@prisma/client n'est pas disponible.\nLogs d'installation:\n" + prismaInstallLog);
  }
  const sqlPath = path.join(__dirname, "boostera_init.sql");
  if (!fs.existsSync(sqlPath)) {
    throw new Error("Fichier boostera_init.sql introuvable dans " + __dirname);
  }
  const sqlContent = fs.readFileSync(sqlPath, "utf-8");
  logDebug("Executing boostera_init.sql (" + sqlContent.length + " bytes)...");
  await prisma.$executeRawUnsafe(sqlContent);
  logDebug("Database schema and seed executed successfully!");
}

// 5. Require Next.js
let next;
let nextImportError = null;

try {
  next = require("next");
} catch (e) {
  nextImportError = e;
  logDebug("Next.js import error: " + e.message);
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

  // Attempt non-blocking DB check on startup
  try {
    const prisma = getPrisma();
    if (prisma) {
      logDebug("Checking if User table exists...");
      try {
        await prisma.$queryRawUnsafe('SELECT 1 FROM "User" LIMIT 1');
        logDebug("User table exists and is accessible.");
      } catch (tableErr) {
        logDebug("User table missing, auto-running DB initialization...");
        await runDbInit();
      }
    }
  } catch (dbBootErr) {
    logDebug("DB boot check notice: " + dbBootErr.message);
  }

  const dev = false;
  nextApp = next({ dev, dir: __dirname, quiet: true });
  await nextApp.prepare();
  logDebug("> BOOSTERA ERP démarré à vitesse maximale !");
}

bootstrap().catch((err) => {
  logDebug("BOOTSTRAP ERROR: " + err.stack);
  initError = err;
});

// 6. HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = parse(req.url, true);

  // === DIAGNOSTIC & AUTO-SETUP ROUTE (Bypasses Next.js) ===
  if (parsedUrl.pathname === "/api/setup-db" || parsedUrl.pathname === "/api/setup-status") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    
    let dbStatus = "Inconnu";
    let dbError = null;
    let userCount = 0;
    let usersList = [];

    const prisma = getPrisma();
    let dbDiag = "";

    if (prisma) {
      try {
        const userInfo = await prisma.$queryRawUnsafe(`
          SELECT current_user, session_user, current_database(), current_schema()
        `);
        dbDiag += "DB Session: " + JSON.stringify(userInfo) + "\n";

        const tablesInfo = await prisma.$queryRawUnsafe(`
          SELECT schemaname, tablename, tableowner 
          FROM pg_tables 
          WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        `);
        dbDiag += "Tables trouvées: " + JSON.stringify(tablesInfo) + "\n";

        // Try granting permissions if possible
        try {
          await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO CURRENT_USER;`);
          await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO CURRENT_USER;`);
          await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO CURRENT_USER;`);
          dbDiag += "Auto-grant permissions exécuté avec succès.\n";
        } catch (grantErr) {
          dbDiag += "Auto-grant notice: " + grantErr.message + "\n";
        }
      } catch (diagErr) {
        dbDiag += "Diag error: " + diagErr.message + "\n";
      }
    }

    if (parsedUrl.pathname === "/api/setup-db") {
      try {
        await runDbInit();
        dbStatus = "Initialisation réussie !";
      } catch (err) {
        dbError = err.message;
      }
    }

    if (prisma) {
      try {
        userCount = await prisma.user.count();
        usersList = await prisma.user.findMany({
          select: { email: true, name: true, role: true, isActive: true },
          take: 10,
        });
        dbStatus = "Connecté (Table User présente)";
      } catch (e) {
        if (!dbError) dbError = e.message;
      }
    } else {
      dbStatus = "PrismaClient non disponible";
      if (prismaLoadError) {
        dbError = "Erreur chargement PrismaClient:\n" + (prismaLoadError.stack || prismaLoadError.message);
        dbError += "\n\nChemins analysés :\n" + possiblePaths.map(p => `${p} => ${fs.existsSync(p) ? 'EXISTE' : 'ABSENT'}`).join('\n');
        dbError += "\n\nmodule.paths:\n" + module.paths.slice(0, 5).join('\n');
      }
    }

    const maskedUrl = (process.env.DATABASE_URL || "NON DÉFINIE").replace(/:([^:@]+)@/, ":****@");

    res.end(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <title>BOOSTERA ERP — Diagnostic & Configuration Base de données</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #f4f4f5; padding: 40px; margin: 0; display: flex; justify-content: center; }
          .card { max-width: 800px; width: 100%; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
          h1 { color: #38bdf8; font-size: 22px; margin-top: 0; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold; }
          .badge-success { background: #065f46; color: #34d399; }
          .badge-error { background: #881337; color: #f43f5e; }
          .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; margin-top: 15px; }
          .btn:hover { background: #1d4ed8; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
          th, td { border: 1px solid #27272a; padding: 8px 12px; text-align: left; }
          th { background: #27272a; }
          pre { background: #09090b; padding: 12px; border-radius: 8px; border: 1px solid #3f3f46; color: #f43f5e; font-size: 12px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🚀 BOOSTERA ERP — État de la Base de Données</h1>
          <p><strong>URL PostgreSQL :</strong> <code>${maskedUrl}</code></p>
          <p><strong>Statut :</strong> <span class="badge ${dbError ? 'badge-error' : 'badge-success'}">${dbStatus}</span></p>
          
          ${dbError ? `<p><strong>Détail de l'erreur :</strong></p><pre>${dbError}</pre>` : ''}
          ${dbDiag ? `<p><strong>Diagnostic PostgreSQL :</strong></p><pre style="color: #34d399;">${dbDiag}</pre>` : ''}
          ${prismaInstallLog ? `<p><strong>Journal d'installation / réparation Prisma :</strong></p><pre style="color: #38bdf8;">${prismaInstallLog}</pre>` : ''}
          
          <p><strong>Nombre d'utilisateurs actifs :</strong> ${userCount}</p>

          ${usersList.length > 0 ? `
            <h3>👥 Utilisateurs configurés (${usersList.length}) :</h3>
            <table>
              <tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Actif</th></tr>
              ${usersList.map(u => `<tr><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td><td>${u.isActive ? 'Oui' : 'Non'}</td></tr>`).join('')}
            </table>
            <div style="margin-top:20px;">
              <a href="/login" class="btn">👉 Aller sur la page de connexion</a>
            </div>
          ` : `
            <div style="background:#27272a; padding:16px; border-radius:8px; margin-top:15px;">
              <p style="margin:0 0 10px 0;">⚠️ Aucune table ou aucun utilisateur trouvé dans la base.</p>
              <a href="/api/setup-db" class="btn" style="background:#10b981;">⚡ Initialiser la base de données maintenant (1-Clic)</a>
            </div>
          `}
        </div>
      </body>
      </html>
    `);
    return;
  }

  // Next.js init error fallback
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
            h1 { color: #f43f5e; font-size: 22px; margin-top: 0; }
            pre { background: #09090b; padding: 16px; border-radius: 8px; border: 1px solid #3f3f46; color: #fb7185; font-size: 13px; font-family: monospace; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>⚠️ Diagnostic — BOOSTERA ERP</h1>
            <p>Détail de l'erreur :</p>
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
    await nextApp.getRequestHandler()(req, res, parsedUrl);
  } catch (err) {
    logDebug("Request handling error: " + (err.stack || err.message));
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
});

server.listen(port, (err) => {
  if (err) {
    logDebug("Server listen error: " + err.message);
    return;
  }
  logDebug(`> BOOSTERA ERP listening on port ${port}`);
});
