import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export interface BackupMetadata {
  filename: string;
  timestamp: string;
  createdAtFormatted: string;
  environment: string;
  databaseProvider: string;
  totalTables: number;
  totalRecords: number;
  tableCounts: Record<string, number>;
  fileSizeBytes?: number;
}

export interface BackupResult {
  success: boolean;
  metadata: BackupMetadata;
  filepath: string;
  jsonContent?: string;
  error?: string;
}

const BACKUPS_DIR = path.join(process.cwd(), "backups");

function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    try {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    } catch (e) {
      console.warn("Could not create backups directory on filesystem:", e);
    }
  }
}

/**
 * Réalise une sauvegarde intégrale de toutes les tables de la base de données
 */
export async function createFullDatabaseBackup(): Promise<BackupResult> {
  const timestamp = new Date();
  const dateStr = timestamp.toISOString().replace(/[:.]/g, "-");
  const filename = `backup-boostera-${dateStr}.json`;
  const filepath = path.join(BACKUPS_DIR, filename);

  try {
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
        console.warn(`Table ${tableName} backup warning:`, errTable?.message || "non trouvée");
        data[tableName] = [];
        tableCounts[tableName] = 0;
      }
    }

    const metadata: BackupMetadata = {
      filename,
      timestamp: timestamp.toISOString(),
      createdAtFormatted: timestamp.toLocaleString("fr-FR", { timeZone: "Africa/Algiers" }),
      environment: process.env.NODE_ENV || "production",
      databaseProvider: "postgresql-neon",
      totalTables: Object.keys(data).length,
      totalRecords,
      tableCounts,
    };

    const backupPayload = {
      metadata,
      data,
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    metadata.fileSizeBytes = Buffer.byteLength(jsonString, "utf8");

    // Écriture locale si possible
    ensureBackupsDir();
    try {
      fs.writeFileSync(filepath, jsonString, "utf8");
      pruneOldBackups(30);
    } catch (writeErr) {
      console.warn("Filesystem write skipped (read-only environment like Vercel Lambda):", writeErr);
    }

    // Journaliser dans AuditLog si possible
    try {
      const userList = (data["user"] || []) as any[];
      const adminUser = userList.find((u: any) => u.role === "ADMIN") || userList[0];
      if (adminUser) {
        await prisma.auditLog.create({
          data: {
            userId: adminUser.id,
            action: "DATABASE_BACKUP_AUTO",
            module: "SYSTEM",
            details: JSON.stringify({
              filename,
              totalTables: metadata.totalTables,
              totalRecords: metadata.totalRecords,
              sizeBytes: metadata.fileSizeBytes,
            }),
          },
        });
      }
    } catch (auditErr) {
      console.warn("AuditLog creation for backup skipped:", auditErr);
    }

    return {
      success: true,
      metadata,
      filepath,
      jsonContent: jsonString,
    };
  } catch (error: any) {
    console.error("Backup error:", error);
    return {
      success: false,
      metadata: {
        filename,
        timestamp: timestamp.toISOString(),
        createdAtFormatted: timestamp.toISOString(),
        environment: process.env.NODE_ENV || "production",
        databaseProvider: "postgresql-neon",
        totalTables: 0,
        totalRecords: 0,
        tableCounts: {},
      },
      filepath,
      error: error?.message || "Erreur inconnue lors de la sauvegarde",
    };
  }
}

/**
 * Nettoyage des anciennes sauvegardes (conserver les N dernières)
 */
function pruneOldBackups(keepCount = 30) {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return;
    const files = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.startsWith("backup-boostera-") && f.endsWith(".json"))
      .map((f) => ({
        name: f,
        time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > keepCount) {
      for (const oldFile of files.slice(keepCount)) {
        try {
          fs.unlinkSync(path.join(BACKUPS_DIR, oldFile.name));
        } catch {}
      }
    }
  } catch (err) {
    console.warn("Failed to prune old backups:", err);
  }
}

/**
 * Lister toutes les sauvegardes existantes
 */
export function listLocalBackups(): BackupMetadata[] {
  ensureBackupsDir();
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return [];
    const files = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.startsWith("backup-boostera-") && f.endsWith(".json"))
      .map((f) => {
        const fullPath = path.join(BACKUPS_DIR, f);
        const stats = fs.statSync(fullPath);
        return {
          filename: f,
          timestamp: stats.mtime.toISOString(),
          createdAtFormatted: stats.mtime.toLocaleString("fr-FR", { timeZone: "Africa/Algiers" }),
          environment: process.env.NODE_ENV || "production",
          databaseProvider: "postgresql-neon",
          totalTables: 33,
          totalRecords: 0,
          tableCounts: {},
          fileSizeBytes: stats.size,
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return files;
  } catch (err) {
    console.warn("Failed to list backups:", err);
    return [];
  }
}

/**
 * Récupérer le contenu d'un fichier de sauvegarde pour téléchargement
 */
export function readBackupFile(filename: string): string | null {
  ensureBackupsDir();
  const safeName = path.basename(filename);
  const fullPath = path.join(BACKUPS_DIR, safeName);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, "utf8");
  }
  return null;
}
