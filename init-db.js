const fs = require("fs");
const path = require("path");

// 1. Load .env
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

// 2. Support node_modules locations
const possiblePaths = [
  path.join(__dirname, "node_modules"),
  "/home/zidane17/nodevenv/erp/22/lib/node_modules",
  "/home/zidane17/nodevenv/erp/22/lib64/node_modules",
];
for (const p of possiblePaths) {
  if (fs.existsSync(p) && !module.paths.includes(p)) {
    module.paths.unshift(p);
  }
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  console.log("=== Initialisation Base de Données BOOSTERA ERP ===");
  console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Défini" : "NON DÉFINI !");

  const sqlPath = path.join(__dirname, "boostera_init.sql");
  if (!fs.existsSync(sqlPath)) {
    console.error("Fichier boostera_init.sql introuvable !");
    process.exit(1);
  }

  const fullSql = fs.readFileSync(sqlPath, "utf-8");
  console.log("Chargement de boostera_init.sql (" + fullSql.length + " octets)...");

  try {
    // Exécution du script SQL complet
    await prisma.$executeRawUnsafe(fullSql);
    console.log("✅ Toutes les tables, enums et index ont été créés avec succès !");
    console.log("✅ Compte administrateur créé : admin@boostera.dz (Mot de passe: Boostera2026!)");
    console.log("=== Configuration terminée avec succès ===");
  } catch (err) {
    console.error("Erreur lors de l'exécution SQL:", err.message);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((e) => {
  console.error("ECHEC:", e);
  process.exit(1);
});
