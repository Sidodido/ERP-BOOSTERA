process.env.UV_THREADPOOL_SIZE = "1";
process.env.NODE_ENV = "production";

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

const origConsoleError = console.error;
console.error = function (...args) {
  logDebug("[NEXT.ERROR] " + args.map(a => (a && a.stack) ? a.stack : (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
  origConsoleError.apply(console, args);
};

const origStderrWrite = process.stderr.write;
process.stderr.write = function (chunk, ...args) {
  try {
    const s = String(chunk);
    if (!s.includes("Fast Refresh") && !s.includes("webpack")) {
      fs.appendFileSync(debugLogFile, "[STDERR] " + s);
    }
  } catch {}
  return origStderrWrite.apply(process.stderr, [chunk, ...args]);
};

process.on("unhandledRejection", (reason) => {
  logDebug("[UNHANDLED REJECTION] " + ((reason && reason.stack) ? reason.stack : String(reason)));
});

process.on("uncaughtException", (err) => {
  logDebug("[UNCAUGHT EXCEPTION] " + (err.stack || err.message));
});

logDebug("Starting HDZ SECURITY ERP server.js...");

// Auto-extract erp-deploy.zip if uploaded to root
const deployZip = path.join(__dirname, "erp-deploy.zip");
if (fs.existsSync(deployZip)) {
  logDebug("Found erp-deploy.zip, auto-extracting with unzip -o...");
  try {
    const { execSync } = require("child_process");
    execSync('unzip -o "erp-deploy.zip"', { cwd: __dirname });
    execSync("chmod -R 755 .next", { cwd: __dirname });
    fs.unlinkSync(deployZip);
    logDebug("erp-deploy.zip successfully extracted and permissions fixed!");
  } catch (uzErr) {
    logDebug("unzip notice: " + uzErr.message);
  }
}

const Module = require("module");

// Auto-fix paths if needed
const possiblePaths = [
  path.join(__dirname, "node_modules"),
  path.join(process.cwd(), "node_modules"),
];

for (const p of possiblePaths) {
  if (fs.existsSync(p) && !module.paths.includes(p)) {
    module.paths.unshift(p);
  }
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

// 4. Prisma Helper
let prismaClient = null;
let prismaLoadError = null;

function getPrisma(forceReload = false) {
  if (forceReload) {
    prismaClient = null;
    prismaLoadError = null;
  }
  if (!prismaClient && !prismaLoadError) {
    try {
      const { PrismaClient } = require("@prisma/client");
      prismaClient = new PrismaClient({
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
  let logs = [];
  const { execSync } = require("child_process");
  const nodeBin = "/home/zidane17/nodevenv/erp/22/bin";
  const env = { ...process.env, PATH: `${nodeBin}:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ""}` };

  // 1. Ensure Prisma client is ready
  let prisma = getPrisma();
  if (!prisma) {
    const res = tryGeneratePrisma();
    prismaInstallLog = res.logs;
    prisma = getPrisma(true);
  }

  // 2. Strategy A: npx prisma db push --accept-data-loss
  try {
    logs.push("1. Exécution de 'npx prisma db push'...");
    const pushOut = execSync("npx prisma db push --accept-data-loss", { cwd: __dirname, env, encoding: "utf-8", timeout: 60000 });
    logs.push("✅ prisma db push a réussi :\n" + pushOut);
  } catch (pushErr) {
    logs.push("ℹ️ prisma db push notice: " + (pushErr.stdout || "") + " " + (pushErr.stderr || "") + " " + pushErr.message);
  }

  // 3. Strategy B: Execute SQL statement by statement if table User still missing
  const sqlPath = path.join(__dirname, "boostera_init.sql");
  if (fs.existsSync(sqlPath) && prisma) {
    logs.push("2. Exécution des instructions boostera_init.sql...");
    const sqlContent = fs.readFileSync(sqlPath, "utf-8");
    const cleanSql = sqlContent.replace(/--.*$/gm, "");
    const stmts = cleanSql.split(";").map(s => s.trim()).filter(s => s.length > 5);
    let ok = 0;
    for (const stmt of stmts) {
      try {
        await prisma.$executeRawUnsafe(stmt);
        ok++;
      } catch (stmtErr) {
        if (!stmtErr.message.includes("already exists") && !stmtErr.message.includes("déjà")) {
          logs.push("Notice SQL: " + stmtErr.message.split("\n")[0]);
        }
      }
    }
    logs.push(`✅ Exécuté ${ok}/${stmts.length} commandes SQL.`);
  }

  // 4. Strategy C: Seed accounts
  try {
    const seedPath = path.join(__dirname, "seed.js");
    if (fs.existsSync(seedPath)) {
      logs.push("3. Exécution de seed.js pour les utilisateurs...");
      const seedOut = execSync("node seed.js", { cwd: __dirname, env, encoding: "utf-8", timeout: 30000 });
      logs.push("✅ seed.js réussi:\n" + seedOut);
    }
  } catch (seedErr) {
    logs.push("ℹ️ seed.js notice: " + seedErr.message);
  }

  logDebug("Database schema and seed executed. Logs:\n" + logs.join("\n"));
  return logs.join("\n");
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
let nextAppReady = false;
let preparePromise = null;

async function bootstrap() {
  if (!next) {
    throw new Error(
      `Le module 'next' n'est pas accessible : ${nextImportError ? nextImportError.message : "Inconnu"}`
    );
  }

  // Non-blocking DB check on startup
  try {
    const prisma = getPrisma();
    if (prisma) {
      prisma.$queryRawUnsafe('SELECT 1 FROM "User" LIMIT 1')
        .then(() => logDebug("User table exists and is accessible."))
        .catch(err => logDebug("DB check notice: " + err.message));
    }
  } catch (dbBootErr) {
    logDebug("DB boot check notice: " + dbBootErr.message);
  }


  // Auto-fix permissions on Linux (.next directories require +x to be readable by Next.js)
  try {
    const { execSync } = require("child_process");
    execSync("chmod -R 755 .next", { cwd: __dirname });
    logDebug("Permissions 755 applied to .next successfully via chmod.");
  } catch (permErr) {
    logDebug("chmod execSync notice: " + permErr.message);
    try {
      function fixPermissionsRecursive(dir) {
        if (!fs.existsSync(dir)) return;
        try { fs.chmodSync(dir, 0o755); } catch {}
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            try { fs.chmodSync(fullPath, 0o755); } catch {}
            fixPermissionsRecursive(fullPath);
          } else {
            try { fs.chmodSync(fullPath, 0o644); } catch {}
          }
        }
      }
      fixPermissionsRecursive(nextDir);
      logDebug("Permissions 755 applied to .next recursively via fs.chmodSync.");
    } catch (fsPermErr) {
      logDebug("fs.chmodSync error: " + fsPermErr.message);
    }
  }

  const dev = false;
  nextApp = next({ dev, dir: __dirname, quiet: true });
  preparePromise = nextApp.prepare();
  await preparePromise;
  nextAppReady = true;
  logDebug("> HDZ SECURITY ERP démarré à vitesse maximale !");
}

bootstrap().catch((err) => {
  logDebug("BOOTSTRAP ERROR: " + err.stack);
  initError = err;
});

// 6. HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = parse(req.url, true);

  // === DEBUG LOGS ROUTE ===
  if (parsedUrl.pathname === "/api/debug-log") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    if (fs.existsSync(debugLogFile)) {
      const content = fs.readFileSync(debugLogFile, "utf-8");
      const lines = content.split("\n").filter((l) => !l.startsWith("Notice SQL:"));
      res.end(lines.slice(-500).join("\n"));
    } else {
      res.end("Aucun log disponible");
    }
    return;
  }

  // === DIRECT ADMIN ACCOUNT INITIALIZATION ENDPOINT ===
  if (parsedUrl.pathname === "/api/init-admin") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    try {
      const prisma = getPrisma();
      if (!prisma) {
        return res.end(JSON.stringify({ success: false, error: "Base de données non disponible." }));
      }
      let bcrypt = null;
      try { bcrypt = require("bcryptjs"); } catch {
        for (const p of possiblePaths) {
          try { const c = path.join(p, "bcryptjs"); if (fs.existsSync(c)) { bcrypt = require(c); break; } } catch {}
        }
      }
      const hash = bcrypt ? await bcrypt.hash("Boostera2026!", 10) : "$2b$10$txbFZDQr.6d2vt.3FrSDoe1963TpfE/ks8j3/IJiWKHDeaz";
      const user = await prisma.user.upsert({
        where: { email: "zidanesidahmed18@gmail.com" },
        update: {
          role: "ADMIN",
          isActive: true,
          status: "ACTIVE",
          emailVerified: true,
          passwordHash: hash,
          name: "Direction HDZ SECURITY",
        },
        create: {
          email: "zidanesidahmed18@gmail.com",
          passwordHash: hash,
          name: "Direction HDZ SECURITY",
          role: "ADMIN",
          phone: "0550 00 00 00",
          status: "ACTIVE",
          emailVerified: true,
        },
      });
      return res.end(JSON.stringify({
        success: true,
        message: "Compte Administrateur HDZ SECURITY configuré pour zidanesidahmed18@gmail.com",
        email: user.email,
        role: user.role,
      }));
    } catch (e) {
      return res.end(JSON.stringify({ success: false, error: e.message }));
    }
  }

  // === DIAGNOSTIC SSR & DATABASE ENDPOINT ===
  if (parsedUrl.pathname === "/api/diag") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    const steps = [];
    const prisma = getPrisma();
    if (!prisma) {
      return res.end("<h1 style='color:#f43f5e'>Prisma non disponible</h1>");
    }
    async function testStep(name, fn) {
      try {
        const out = await fn();
        const preview = typeof out === "object" ? JSON.stringify(out).slice(0, 120) : String(out);
        steps.push(`<div style="color:#34d399;margin-bottom:8px;">✅ <strong>${name}</strong>: OK &rarr; <code>${preview}</code></div>`);
      } catch (err) {
        steps.push(`<div style="color:#f43f5e;margin-bottom:8px;">❌ <strong>${name}</strong>: ERREUR<br><pre style="background:#18181b;padding:8px;border-radius:6px;color:#fb7185;overflow:auto;">${err.stack || err.message}</pre></div>`);
      }
    }

    try {
      await testStep("1. Session DB & Current Schema", () => prisma.$queryRawUnsafe("SELECT current_user, current_database(), current_schema()"));
      await testStep("2. User count", () => prisma.user.count());
      await testStep("3. User findFirst ADMIN", () => prisma.user.findFirst({ where: { role: "ADMIN" } }));
      await testStep("4. User columns (getCurrentUser)", async () => {
        const u = await prisma.user.findFirst({ where: { role: "ADMIN" } });
        if (!u) throw new Error("Aucun administrateur trouvé.");
        return prisma.user.findUnique({
          where: { id: u.id },
          select: { id: true, name: true, email: true, role: true, avatarUrl: true, phone: true, isActive: true, createdAt: true },
        });
      });
      await testStep("5. Client count (ClientStatus.ACTIVE)", () => prisma.client.count({ where: { status: "ACTIVE" } }));
      await testStep("6. Prospect count", () => prisma.prospect.count());
      await testStep("7. Invoice overdue", () => prisma.invoice.findMany({ where: { balanceDue: { gt: 0 } }, take: 1 }));
      await testStep("8. Attendance count", () => prisma.attendance.count());
      await testStep("9. ProjectTask count", () => prisma.projectTask.count());
      await testStep("10. Employee count", () => prisma.employee.count());
      await testStep("11. AuditLog count", () => prisma.auditLog.count());
    } catch (gErr) {
      steps.push(`<div style="color:#f43f5e">Erreur globale diag: ${gErr.message}</div>`);
    }

    return res.end(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>Diagnostic ERP</title></head>
        <body style="background:#09090b;color:#f4f4f5;font-family:monospace;padding:24px;line-height:1.5;">
          <h2 style="color:#38bdf8;">🛡️ Diagnostic Intégrité BD & Requêtes SSR</h2>
          <hr style="border-color:#27272a;margin-bottom:16px;">
          ${steps.join("")}
          <hr style="border-color:#27272a;margin-top:16px;">
          <p><a href="/dashboard" style="color:#60a5fa;">👉 Retour au Tableau de bord</a></p>
        </body>
      </html>
    `);
  }

  // === NATIVE HIGH-SPEED AUTH LOGIN HANDLER (Intercepts both /api/auth/login AND Next.js Server Action POST /login) ===
  if ((parsedUrl.pathname === "/login" || parsedUrl.pathname === "/api/auth/login") && req.method === "POST") {
    let bodyChunks = [];
    req.on("data", (chunk) => { bodyChunks.push(chunk); });
    req.on("end", async () => {
      const rawBody = Buffer.concat(bodyChunks).toString("utf-8");
      let email = "";
      let password = "";

      // 1. Try JSON
      try {
        const json = JSON.parse(rawBody);
        email = json.email;
        password = json.password;
      } catch {}

      // 2. Try FormData / Multipart / URL encoded
      if (!email || !password) {
        const emailMatch = rawBody.match(/name="email"[\r\n]+([^\r\n]+)/) || rawBody.match(/email=([^&]+)/);
        if (emailMatch) email = decodeURIComponent(emailMatch[1].trim());

        const pwdMatch = rawBody.match(/name="password"[\r\n]+([^\r\n]+)/) || rawBody.match(/password=([^&]+)/);
        if (pwdMatch) password = decodeURIComponent(pwdMatch[1].trim());
      }

      // 3. Match any email address in the body
      if (!email) {
        const anyEmail = rawBody.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (anyEmail) email = anyEmail[1];
      }

      // Fallback demo password if not extracted
      if (!password) {
        password = "Boostera2026!";
      }

      logDebug(`[AUTH] Intercepted login attempt for: '${email}' on path '${parsedUrl.pathname}'`);

      if (!email) {
        logDebug("[AUTH] No email found in request, replaying body stream to Next.js handler");
        const { Readable } = require("stream");
        const replayStream = new Readable();
        replayStream._read = () => {};
        for (const chunk of bodyChunks) replayStream.push(chunk);
        replayStream.push(null);
        Object.assign(replayStream, {
          headers: req.headers,
          method: req.method,
          url: req.url,
          httpVersion: req.httpVersion,
          socket: req.socket,
          connection: req.connection,
        });
        return nextApp.getRequestHandler()(replayStream, res, parsedUrl);
      }

      try {
        const prisma = getPrisma();
        if (!prisma) {
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          return res.end("Base de données non disponible.");
        }

        const user = await prisma.user.findUnique({
          where: { email: email.trim().toLowerCase() },
        });

        if (!user || !user.isActive) {
          logDebug(`[AUTH] User not found or inactive: ${email}`);
          if (parsedUrl.pathname === "/api/auth/login") {
            res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
            return res.end(JSON.stringify({ error: "Identifiants invalides ou compte inactif." }));
          }
          res.writeHead(303, { "Location": "/login?error=invalid_credentials" });
          return res.end();
        }

        let bcrypt = null;
        try { bcrypt = require("bcryptjs"); } catch {
          for (const p of possiblePaths) {
            try { const c = path.join(p, "bcryptjs"); if (fs.existsSync(c)) { bcrypt = require(c); break; } } catch {}
          }
        }

        if (bcrypt) {
          const match = await bcrypt.compare(password, user.passwordHash);
          if (!match) {
            logDebug(`[AUTH] Invalid password for: ${email}`);
            if (parsedUrl.pathname === "/api/auth/login") {
              res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
              return res.end(JSON.stringify({ error: "Mot de passe incorrect." }));
            }
            res.writeHead(303, { "Location": "/login?error=wrong_password" });
            return res.end();
          }
        }

        let SignJWT = null;
        try { SignJWT = require("jose").SignJWT; } catch {
          for (const p of possiblePaths) {
            try { const c = path.join(p, "jose"); if (fs.existsSync(c)) { SignJWT = require(c).SignJWT; break; } } catch {}
          }
        }

        let token = "";
        if (SignJWT) {
          const secret = new TextEncoder().encode(process.env.JWT_SECRET || "boostera_super_secret_jwt_key_2026_production_grade_crm_saas");
          token = await new SignJWT({
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("7d")
            .sign(secret);
        }

        logDebug(`[AUTH] SUCCESS! Logged in user: ${user.email} (${user.role}). Redirecting to /dashboard`);

        res.setHeader("Set-Cookie", `boostera_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800; secure`);

        // If JSON API request:
        if (parsedUrl.pathname === "/api/auth/login" || (req.headers["content-type"] && req.headers["content-type"].includes("application/json"))) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.writeHead(200);
          return res.end(JSON.stringify({
            success: true,
            redirectUrl: "/dashboard",
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
          }));
        }

        // If Server Action or Browser Form POST:
        res.setHeader("x-action-redirect", "/dashboard");
        res.writeHead(303, { "Location": "/dashboard" });
        return res.end();
      } catch (authErr) {
        logDebug("[AUTH] Error: " + (authErr.stack || authErr.message));
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("Erreur serveur : " + authErr.message);
      }
    });
    return;
  }

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

    let initLogs = "";
    if (parsedUrl.pathname === "/api/setup-db") {
      try {
        initLogs = await runDbInit();
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
          ${initLogs ? `<p><strong>Journal d'initialisation de la base :</strong></p><pre style="color: #38bdf8;">${initLogs}</pre>` : ''}
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
          <title>HDZ SECURITY ERP — Initialisation</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #f4f4f5; padding: 40px; display: flex; justify-content: center; align-items: center; min-height: 80vh; margin: 0; }
            .card { max-width: 750px; width: 100%; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
            h1 { color: #f43f5e; font-size: 22px; margin-top: 0; }
            pre { background: #09090b; padding: 16px; border-radius: 8px; border: 1px solid #3f3f46; color: #fb7185; font-size: 13px; font-family: monospace; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>⚠️ Diagnostic — HDZ SECURITY ERP</h1>
            <p>Détail de l'erreur :</p>
            <pre>${initError.stack || initError.message || initError}</pre>
          </div>
        </body>
      </html>
    `);
    return;
  }

  if (!nextAppReady && preparePromise) {
    try {
      await preparePromise;
      nextAppReady = true;
    } catch (prepErr) {
      initError = prepErr;
    }
  }

  if (!nextApp || !nextAppReady) {
    res.writeHead(503, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta http-equiv="refresh" content="2"></head>
        <body style="background:#09090b;color:#a1a1aa;font-family:sans-serif;padding:40px;text-align:center;">
          <h2>🚀 Démarrage de HDZ SECURITY ERP...</h2>
          <p>Chargement des modules. Actualisation automatique dans 2 secondes...</p>
        </body>
      </html>
    `);
    return;
  }

  try {
    await nextApp.getRequestHandler()(req, res, parsedUrl);
  } catch (err) {
    logDebug("Request handling error: " + (err.stack || err.message));
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <body style="background:#09090b;color:#f4f4f5;font-family:monospace;padding:32px;">
        <h2 style="color:#f43f5e">⚠️ Erreur Interne du Serveur (Next.js)</h2>
        <pre style="background:#18181b;padding:16px;border-radius:8px;border:1px solid #27272a;color:#fb7185;overflow:auto;">${err.stack || err.message}</pre>
      </body>
    `);
  }
});

server.listen(port, (err) => {
  if (err) {
    logDebug("Server listen error: " + err.message);
    return;
  }
  logDebug(`> HDZ SECURITY ERP listening on port ${port}`);
});
