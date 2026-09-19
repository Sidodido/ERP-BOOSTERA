import { NextResponse } from "next/server";
import { createFullDatabaseBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for full DB export

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const authHeader = req.headers.get("authorization");
    const secret = process.env.CRON_SECRET;

    // Si un CRON_SECRET est défini dans l'environnement, on vérifie l'autorisation
    if (secret) {
      const token = searchParams.get("key") || authHeader?.replace("Bearer ", "");
      if (token !== secret) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
      }
    }

    const result = await createFullDatabaseBackup();

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Sauvegarde intégrale de la base de données terminée avec succès.",
      metadata: result.metadata,
    });
  } catch (error: any) {
    console.error("Cron backup-db error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erreur serveur lors de la sauvegarde" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
