/**
 * Utilitaires pour le calcul de la paie selon la règle :
 * "LE CALCUL DE LA PAYE SERA A PARTIR LE 10 DE CHAQUE MOIS"
 * "Cycle du 10 au 10 : la période de calcul prend en compte exactement du 10 du mois au 10 du mois suivant"
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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

/**
 * Calcule et synchronise automatiquement les salaires et retenues pour le cycle donné.
 * Règle RH & Droit du travail :
 * - Salaire journalier de référence = Salaire de base / 30 jours
 * - Toute absence non justifiée (non pointée / ABSENT) = Retenue automatique de 1 jour de salaire
 * - Congé Maladie (SICK) ou Permission non rémunérée = Retenue automatique de 1 jour par jour de congé
 * - Congé Annuel (ANNUAL) & Événement Familial (SPECIAL) = Chômé et payé à 100% (0 DA retenu)
 * - Commissions commerciales du cycle (du 10 au 10) = Ajoutées automatiquement
 */
export async function calculateAndSyncPayroll(monthParam?: number, yearParam?: number) {
  const now = new Date();
  const defaultCycle = getPayrollCycleForDate(now);
  const month = monthParam || defaultCycle.month;
  const year = yearParam || defaultCycle.year;

  const cycleInfo = getPayrollCycleDates(month, year);
  if (!cycleInfo.isUnlocked) {
    return { success: false, reason: "Cycle not unlocked yet", count: 0 };
  }

  const { startDate, endDate } = cycleInfo;

  // 1. Tous les collaborateurs actifs
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
  });

  let syncedCount = 0;

  for (const emp of employees) {
    // A. Commissions validées dans ce cycle (du 10 au 10)
    const empCommissions = await prisma.commission.aggregate({
      where: {
        employeeId: emp.id,
        earnedDate: { gte: startDate, lt: endDate },
      },
      _sum: { amount: true },
    });

    const commAmount = Number(empCommissions._sum.amount || 0);
    const base = Number(emp.baseSalary);

    // Taux journalier standard (Base mensuelle / 30 jours)
    const workingDaysDivisor = 30;
    const dailyRate = base > 0 ? base / workingDaysDivisor : 0;

    // B. Congés approuvés dans ce cycle
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId: emp.id,
        status: { in: ["CONFIRMED_HR", "APPROVED_MANAGER"] },
        startDate: { lt: endDate },
        endDate: { gte: startDate },
      },
    });

    let sickDays = 0;
    let annualDays = 0;
    let permissionDays = 0;

    for (const leave of approvedLeaves) {
      const leaveStart = new Date(Math.max(new Date(leave.startDate).getTime(), startDate.getTime()));
      const leaveEnd = new Date(Math.min(new Date(leave.endDate).getTime(), endDate.getTime() - 1));

      // Compte des jours ouvrables dans le cycle (en excluant le vendredi qui est chômé)
      let count = 0;
      const cur = new Date(leaveStart.getFullYear(), leaveStart.getMonth(), leaveStart.getDate());
      const last = new Date(leaveEnd.getFullYear(), leaveEnd.getMonth(), leaveEnd.getDate());

      while (cur <= last) {
        if (cur.getDay() !== 5) { // 5 = Vendredi (repos hebdomadaire)
          count++;
        }
        cur.setDate(cur.getDate() + 1);
      }

      const effectiveDays = Math.min(count, leave.daysCount);

      if (leave.type === "SICK") {
        sickDays += effectiveDays;
      } else if (leave.type === "ANNUAL") {
        annualDays += effectiveDays;
      } else if (leave.type === "PERMISSION") {
        permissionDays += effectiveDays;
      }
    }

    // C. Pointages absents non justifiés (status === "ABSENT") dans ce cycle
    const cycleStartDate = emp.hireDate
      ? new Date(Math.max(new Date(emp.hireDate).getTime(), startDate.getTime()))
      : startDate;

    const absentAttendances = await prisma.attendance.findMany({
      where: {
        employeeId: emp.id,
        date: { gte: cycleStartDate, lt: endDate },
        status: "ABSENT",
      },
      select: { date: true },
    });

    // Évite le double comptage si une fiche d'absence coïncide avec un congé approuvé
    let unexcusedAbsences = 0;
    for (const att of absentAttendances) {
      const attTime = new Date(att.date).getTime();
      const hasOverlap = approvedLeaves.some((l) => {
        const lStart = new Date(l.startDate).getTime();
        const lEnd = new Date(l.endDate).getTime();
        return attTime >= lStart && attTime <= lEnd;
      });
      if (!hasOverlap) {
        unexcusedAbsences++;
      }
    }

    // D. Calcul des déductions automatiques
    const deductibleDays = sickDays + permissionDays + unexcusedAbsences;
    const deductions = Math.min(base, Math.round(deductibleDays * dailyRate));
    const net = Math.max(0, Math.round(base + commAmount - deductions));

    // E. Upsert dans la table SalaryPayment
    const existingPayment = await prisma.salaryPayment.findUnique({
      where: {
        employeeId_month_year: {
          employeeId: emp.id,
          month,
          year,
        },
      },
    });

    await prisma.salaryPayment.upsert({
      where: {
        employeeId_month_year: {
          employeeId: emp.id,
          month,
          year,
        },
      },
      create: {
        employeeId: emp.id,
        month,
        year,
        baseSalary: new Prisma.Decimal(emp.baseSalary),
        commissions: new Prisma.Decimal(commAmount),
        primes: new Prisma.Decimal(0),
        bonuses: new Prisma.Decimal(0),
        deductions: new Prisma.Decimal(deductions),
        netSalary: new Prisma.Decimal(net),
        status: "DRAFT",
      },
      update: {
        baseSalary: new Prisma.Decimal(emp.baseSalary),
        commissions: new Prisma.Decimal(commAmount),
        deductions: new Prisma.Decimal(deductions),
        netSalary: new Prisma.Decimal(net),
        // Conserver le statut s'il a été préalablement marqué PAID
        status: existingPayment?.status || "DRAFT",
      },
    });

    syncedCount++;
  }

  return { success: true, count: syncedCount };
}
