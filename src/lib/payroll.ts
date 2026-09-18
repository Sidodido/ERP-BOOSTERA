/**
 * Utilitaires pour le calcul de la paie selon la règle :
 * "LE CALCUL DE LA PAYE SERA A PARTIR LE 10 DE CHAQUE MOIS"
 * "Cycle du 10 au 10 : la période de calcul prend en compte exactement du 10 du mois au 10 du mois suivant"
 */

export interface PayrollCycleInfo {
  month: number;
  year: number;
  startDate: Date;      // 10 du mois M à 00:00:00.000 UTC
  endDate: Date;        // 10 du mois suivant (M+1) à 00:00:00.000 UTC (à utiliser avec < ou lt)
  displayStartDate: string;
  displayEndDate: string;
  label: string;
  isUnlocked: boolean; // Accessible si la date courante >= 10 du mois M
}

export const MONTH_NAMES = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

/**
 * Retourne les dates précises du cycle de paie pour un mois donné (month: 1-12, year: 4 digits)
 * Cycle du 10 au 10 :
 * - Début : 10 du mois M à 00:00:00.000 UTC
 * - Fin : 10 du mois suivant (M+1) à 00:00:00.000 UTC (exclusif pour Prisma `lt`)
 */
export function getPayrollCycleDates(month: number, year: number): PayrollCycleInfo {
  const safeMonth = Math.min(12, Math.max(1, month));
  const safeYear = year;

  // Début : 10 du mois M à 00:00:00 UTC
  const startDate = new Date(Date.UTC(safeYear, safeMonth - 1, 10, 0, 0, 0, 0));

  // Fin : 10 du mois suivant à 00:00:00 UTC
  // En JavaScript, Date.UTC gère automatiquement le passage d'année (ex: mois 12 -> mois 1 de l'année suivante)
  const endDate = new Date(Date.UTC(safeYear, safeMonth, 10, 0, 0, 0, 0));

  // Calcul du mois suivant pour l'affichage
  const nextMonthDate = new Date(safeYear, safeMonth, 1);
  const nextMonthName = MONTH_NAMES[nextMonthDate.getMonth()];
  const nextYear = nextMonthDate.getFullYear();

  const pad = (n: number) => n.toString().padStart(2, "0");
  const displayStartDate = `10/${pad(safeMonth)}/${safeYear}`;
  const displayEndDate = `10/${pad(nextMonthDate.getMonth() + 1)}/${nextYear}`;

  const currentMonthName = MONTH_NAMES[safeMonth - 1];
  const label = `Cycle du 10 au 10 : du 10 ${currentMonthName} ${safeYear} au 10 ${nextMonthName} ${nextYear}`;

  // Déblocage du calcul : à partir du 10 du mois
  const now = new Date();
  const isUnlocked = now.getTime() >= startDate.getTime();

  return {
    month: safeMonth,
    year: safeYear,
    startDate,
    endDate,
    displayStartDate,
    displayEndDate,
    label,
    isUnlocked,
  };
}

/**
 * Détermine à quel cycle de paie appartient une date d'action (signature client, pointage, congé) :
 * - Si le jour du mois est >= 10 : appartient au cycle du mois courant M (du 10/M au 10/(M+1))
 * - Si le jour du mois est < 10 : appartient au cycle du mois précédent M-1 (du 10/(M-1) au 10/M)
 */
export function getPayrollCycleForDate(rawDate: Date | string): { month: number; year: number } {
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return getPayrollCycleForDate(now);
  }

  const day = d.getDate();
  const currentMonth = d.getMonth() + 1; // 1-12
  const currentYear = d.getFullYear();

  if (day >= 10) {
    // À partir du 10 du mois : cycle de ce mois
    return {
      month: currentMonth,
      year: currentYear,
    };
  } else {
    // Avant le 10 (1er au 9) : appartient au cycle démarré le 10 du mois précédent
    if (currentMonth === 1) {
      return {
        month: 12,
        year: currentYear - 1,
      };
    } else {
      return {
        month: currentMonth - 1,
        year: currentYear,
      };
    }
  }
}

/**
 * Retourne une liste de cycles de paie disponibles pour le sélecteur d'historique dans l'interface RH
 */
export function getAvailablePayrollCycles(referenceDate: Date = new Date(), pastMonthsCount = 5) {
  const cycles: Array<{
    month: number;
    year: number;
    label: string;
    displayPeriod: string;
    isCurrent: boolean;
  }> = [];

  const currentCycle = getPayrollCycleForDate(referenceDate);

  for (let offset = -pastMonthsCount; offset <= 1; offset++) {
    const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + offset, 15);
    const targetMonth = ref.getMonth() + 1;
    const targetYear = ref.getFullYear();

    const info = getPayrollCycleDates(targetMonth, targetYear);
    cycles.push({
      month: targetMonth,
      year: targetYear,
      label: `Du 10 ${MONTH_NAMES[targetMonth - 1]} au 10 ${MONTH_NAMES[info.endDate.getUTCMonth()]}`,
      displayPeriod: `${info.displayStartDate} — ${info.displayEndDate}`,
      isCurrent: targetMonth === currentCycle.month && targetYear === currentCycle.year,
    });
  }

  return cycles;
}
