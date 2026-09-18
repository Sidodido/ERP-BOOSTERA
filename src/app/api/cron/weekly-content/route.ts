import { NextRequest, NextResponse } from "next/server";
import { triggerWeeklyCronForAllActiveClientsAction } from "@/actions/contentAi";

/**
 * Route API Cron pour le déclenchement hebdomadaire des notifications de contenu
 * Protégée par CRON_SECRET (ex: via Vercel Cron Header Authorization ou query ?secret=...)
 * Ex: curl -X POST https://crm.boostera.dz/api/cron/weekly-content -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export async function GET(request: NextRequest) {
  // Vérification de sécurité du token Cron
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret) {
    const authHeader = request.headers.get("authorization");
    const searchParams = request.nextUrl.searchParams;
    const querySecret = searchParams.get("secret");

    const isAuthorized =
      authHeader === `Bearer ${expectedSecret}` || querySecret === expectedSecret;

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Non autorisé. Jeton cron invalide ou manquant." },
        { status: 401 }
      );
    }
  }

  try {
    const result = await triggerWeeklyCronForAllActiveClientsAction();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erreur cron" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

