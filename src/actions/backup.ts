"use server";

import { requireAuth } from "@/lib/auth";
import { createFullDatabaseBackup, listLocalBackups, readBackupFile, BackupMetadata } from "@/lib/backup";
import { revalidatePath } from "next/cache";

/**
 * Déclencher manuellement une sauvegarde complète de la base de données
 */
export async function triggerManualBackupAction(): Promise<{
  success: boolean;
  metadata?: BackupMetadata;
  jsonContent?: string;
  error?: string;
}> {
  const user = await requireAuth();
  if (user.role !== "ADMIN" && user.role !== "SALES_DIRECTOR") {
    return { success: false, error: "Action réservée aux administrateurs." };
  }

  const result = await createFullDatabaseBackup();
  if (result.success) {
    revalidatePath("/parametres");
  }
  return {
    success: result.success,
    metadata: result.metadata,
    jsonContent: result.jsonContent,
    error: result.error,
  };
}

/**
 * Récupérer la liste des sauvegardes existantes
 */
export async function getBackupListAction(): Promise<BackupMetadata[]> {
  const user = await requireAuth();
  if (user.role !== "ADMIN" && user.role !== "SALES_DIRECTOR") {
    return [];
  }
  return listLocalBackups();
}

/**
 * Télécharger le contenu d'un fichier de sauvegarde spécifique
 */
export async function downloadBackupAction(filename: string): Promise<string | null> {
  const user = await requireAuth();
  if (user.role !== "ADMIN" && user.role !== "SALES_DIRECTOR") {
    return null;
  }
  return readBackupFile(filename);
}
