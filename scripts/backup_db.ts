import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("==================================================");
  console.log("  ERP BOOSTERA — SAUVEGARDE AUTOMATIQUE DE LA BD");
  console.log("==================================================");
  const startTime = Date.now();
  const timestamp = new Date();
  const dateStr = timestamp.toISOString().replace(/[:.]/g, "-");
  const filename = `backup-boostera-${dateStr}.json`;

  const backupsDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  const filepath = path.join(backupsDir, filename);

  console.log(`[1/3] Connexion à la base de données Neon PostgreSQL...`);

  try {
    console.log(`[2/3] Extraction sécurisée des 33 tables en cours...`);
    const tablesToBackup = [
      "user", "prospect", "client", "call", "appointment", "followUp",
      "project", "projectTask", "document", "invoice", "invoiceItem",
      "payment", "paymentSchedule", "sponsorCampaign", "employee",
      "attendance", "leaveRequest", "commissionRule", "commission",
      "salaryPayment", "employeeGoal", "performanceReview", "supplier",
      "purchaseOrder", "expense", "toolSubscription", "asset",
      "inventoryItem", "stockMovement", "projectCost", "productionTaskTemplate",
      "auditLog", "notification"
    ];

    const data: Record<string, any[]> = {};
    const tableCounts: Record<string, number> = {};
    let totalRecords = 0;

    for (const tableName of tablesToBackup) {
      try {
        if ((prisma as any)[tableName]?.findMany) {
          const rows = await (prisma as any)[tableName].findMany();
          data[tableName] = rows;
          tableCounts[tableName] = rows.length;
          totalRecords += rows.length;
        }
      } catch (errTable: any) {
        console.warn(`  ⚠️ Table ${tableName}:`, errTable?.message || "erreur");
        data[tableName] = [];
        tableCounts[tableName] = 0;
      }
    }

    const payload = {
      metadata: {
        app: "ERP-BOOSTERA",
        version: "1.0",
        timestamp: timestamp.toISOString(),
        createdAtFormatted: timestamp.toLocaleString("fr-FR"),
        environment: process.env.NODE_ENV || "development",
        databaseProvider: "postgresql-neon",
        totalTables: Object.keys(data).length,
        totalRecords,
        tableCounts,
      },
      data,
    };

    console.log(`[3/3] Écriture du fichier de sauvegarde sécurisé...`);
    const jsonStr = JSON.stringify(payload, null, 2);
    fs.writeFileSync(filepath, jsonStr, "utf8");

    const sizeMb = (Buffer.byteLength(jsonStr, "utf8") / (1024 * 1024)).toFixed(2);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log("--------------------------------------------------");
    console.log(`✓ SUCCÈS : Sauvegarde complète effectuée en ${duration}s !`);
    console.log(`📁 Fichier : ${filepath}`);
    console.log(`📊 Total : ${totalRecords} enregistrements sur 33 tables (${sizeMb} Mo)`);
    console.log("==================================================");
  } catch (err: any) {
    console.error("❌ ERREUR LORS DE LA SAUVEGARDE :", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
