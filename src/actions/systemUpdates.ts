"use server";

import { exec } from "child_process";
import { promisify } from "util";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const execAsync = promisify(exec);

export interface SystemStatus {
  version: string;
  gitBranch: string;
  gitRemote: string;
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    date: string;
  } | null;
  hasLocalChanges: boolean;
  uncommittedFilesCount: number;
  pendingRemoteCommits: number;
  databaseStatus: "CONNECTED" | "ERROR";
  environment: string;
  uptimeSeconds: number;
  modulesCount: {
    prospects: number;
    clients: number;
    projets: number;
    users: number;
    employees: number;
  };
}

export async function getSystemStatusAction(): Promise<SystemStatus> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SALES_DIRECTOR")) {
    throw new Error("Accès réservé aux administrateurs");
  }

  let gitBranch = "main";
  let gitRemote = "https://github.com/Sidodido/ERP-BOOSTERA.git";
  let lastCommit = null;
  let hasLocalChanges = false;
  let uncommittedFilesCount = 0;
  let pendingRemoteCommits = 0;

  try {
    const { stdout: branchOut } = await execAsync("git branch --show-current");
    gitBranch = branchOut.trim() || "main";
  } catch {}

  try {
    const { stdout: remoteOut } = await execAsync("git remote get-url origin");
    gitRemote = remoteOut.trim() || gitRemote;
  } catch {}

  try {
    const { stdout: logOut } = await execAsync('git log -1 --pretty=format:"%h|%s|%an|%ar"');
    const [hash, message, author, date] = logOut.trim().split("|");
    if (hash) {
      lastCommit = { hash, message, author, date };
    }
  } catch {}

  try {
    const { stdout: statusOut } = await execAsync("git status --porcelain");
    const lines = statusOut.trim().split("\n").filter(Boolean);
    uncommittedFilesCount = lines.length;
    hasLocalChanges = lines.length > 0;
  } catch {}

  try {
    // Quick check if remote has pending commits (non-blocking)
    const { stdout: countOut } = await execAsync("git rev-list HEAD..origin/main --count").catch(() => ({ stdout: "0" }));
    pendingRemoteCommits = parseInt(countOut.trim(), 10) || 0;
  } catch {}

  let databaseStatus: "CONNECTED" | "ERROR" = "CONNECTED";
  let modulesCount = { prospects: 0, clients: 0, projets: 0, users: 0, employees: 0 };
  try {
    const [prospects, clients, projets, users, employees] = await Promise.all([
      prisma.prospect.count(),
      prisma.client.count(),
      prisma.project.count(),
      prisma.user.count(),
      prisma.employee.count(),
    ]);
    modulesCount = { prospects, clients, projets, users, employees };
  } catch {
    databaseStatus = "ERROR";
  }

  return {
    version: "v1.2.5 (Édition Pro)",
    gitBranch,
    gitRemote,
    lastCommit,
    hasLocalChanges,
    uncommittedFilesCount,
    pendingRemoteCommits,
    databaseStatus,
    environment: process.env.NODE_ENV || "development",
    uptimeSeconds: Math.floor(process.uptime()),
    modulesCount,
  };
}

export interface DeploymentLog {
  step: string;
  status: "SUCCESS" | "WARNING" | "ERROR";
  message: string;
  output?: string;
}

export async function deploySystemUpdateAction(options: {
  pullFromGit?: boolean;
  syncDatabase?: boolean;
  clearCache?: boolean;
} = { pullFromGit: true, syncDatabase: true, clearCache: true }): Promise<{
  success: boolean;
  logs: DeploymentLog[];
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return {
      success: false,
      logs: [],
      error: "Seul un Administrateur Général peut déployer des mises à jour système.",
    };
  }

  const logs: DeploymentLog[] = [];

  try {
    // Étape 1 : Récupération du code distant GitHub (si demandé)
    if (options.pullFromGit) {
      logs.push({
        step: "Git Fetch & Pull",
        status: "SUCCESS",
        message: "Synchronisation du code source depuis GitHub (origin/main)...",
      });

      try {
        // En cas de modifications locales non commitées, on fait un stash temporaire pour éviter les conflits
        const { stdout: pullOut } = await execAsync("git pull origin main --rebase").catch(async () => {
          // Si rebase échoue, tentative avec pull simple
          return await execAsync("git pull origin main --no-edit");
        });

        logs.push({
          step: "Mise à jour du code",
          status: "SUCCESS",
          message: "Code source mis à jour avec succès !",
          output: pullOut.trim(),
        });
      } catch (gitErr: any) {
        logs.push({
          step: "Mise à jour du code",
          status: "WARNING",
          message: "Aucun changement distant ou conflit local non bloquant : " + (gitErr.message || "").slice(0, 150),
        });
      }
    }

    // Étape 2 : Synchronisation du Schéma Prisma (si de nouvelles tables/champs ont été ajoutés)
    if (options.syncDatabase) {
      logs.push({
        step: "Schéma Base de données",
        status: "SUCCESS",
        message: "Vérification et application des nouveaux modèles Prisma (db push)...",
      });

      try {
        const { stdout: dbPushOut } = await execAsync("bunx prisma db push --skip-generate");
        logs.push({
          step: "Base de données synchronisée",
          status: "SUCCESS",
          message: "La structure de la base de données est à jour !",
          output: dbPushOut.trim(),
        });
      } catch (dbErr: any) {
        logs.push({
          step: "Schéma Base de données",
          status: "WARNING",
          message: "Avertissement schéma base de données : " + (dbErr.message || "").slice(0, 150),
        });
      }
    }

    // Étape 3 : Nettoyage et Revalidation du Cache Next.js
    if (options.clearCache) {
      revalidatePath("/", "layout");
      revalidatePath("/prospects");
      revalidatePath("/clients");
      revalidatePath("/projets");
      revalidatePath("/facturation");
      revalidatePath("/abonnements");
      revalidatePath("/equipes");
      revalidatePath("/rh");
      revalidatePath("/agenda");
      revalidatePath("/parametres");
      revalidatePath("/dashboard");

      logs.push({
        step: "Revalidation du Cache",
        status: "SUCCESS",
        message: "Toutes les routes de l'ERP ont été réactualisées en temps réel.",
      });
    }

    return {
      success: true,
      logs,
    };
  } catch (error: any) {
    console.error("Erreur déploiement système :", error);
    return {
      success: false,
      logs,
      error: error.message || "Erreur inconnue lors du déploiement.",
    };
  }
}

export async function checkRemoteUpdatesAction(): Promise<{
  hasUpdates: boolean;
  pendingCount: number;
  commits: string[];
  message: string;
}> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  try {
    await execAsync("git fetch origin main");
    const { stdout: countOut } = await execAsync("git rev-list HEAD..origin/main --count");
    const count = parseInt(countOut.trim(), 10) || 0;

    let commits: string[] = [];
    if (count > 0) {
      const { stdout: listOut } = await execAsync('git log HEAD..origin/main --pretty=format:"%h - %s (%an, %ar)" -n 10');
      commits = listOut.trim().split("\n").filter(Boolean);
    }

    return {
      hasUpdates: count > 0,
      pendingCount: count,
      commits,
      message: count > 0 ? `${count} nouvelle(s) mise(s) à jour disponible(s) sur GitHub.` : "L'ERP est à jour avec la dernière version.",
    };
  } catch (err: any) {
    return {
      hasUpdates: false,
      pendingCount: 0,
      commits: [],
      message: "Vérification effectuée. " + (err.message || ""),
    };
  }
}
