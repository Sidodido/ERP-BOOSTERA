import { NextRequest, NextResponse } from "next/server";
import { syncDailyAbsences } from "@/actions/attendance";

/**
 * Route API Cron pour la détection et l'enregistrement automatique des absences
 * Déclenchée en fin de journée (ex: 18h00 ou 19h00) ou périodiquement
 * Tout collaborateur actif n'ayant pas pointé son arrivée et sa sortie est automatiquement marqué ABSENT.
 */
export async function GET(request: NextRequest) {
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
    const result = await syncDailyAbsences({ daysBack: 3, includeToday: true });
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erreur lors de la synchronisation des absences" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
