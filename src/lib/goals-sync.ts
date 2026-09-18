import { prisma } from "@/lib/prisma";
import { Prisma, TaskStatus, DepartmentType } from "@prisma/client";

export interface MonthlyGoalDisplay {
  id: string;
  employeeId: string;
  employeeName?: string;
  position?: string;
  metric: string;
  metricLabel: string;
  targetValue: number;
  achievedValue: number;
  progressPercentage: number;
  isAchieved: boolean;
  unit: string;
  month: number;
  year: number;
}

export const METRIC_CONFIG: Record<
  string,
  { label: string; unit: string; description: string }
> = {
  APPELS: {
    label: "Appels Passés",
    unit: "appels",
    description: "Appels commerciaux enregistrés dans le mois",
  },
  RENDEZ_VOUS: {
    label: "Rendez-vous Décrochés",
    unit: "RDV",
    description: "Rendez-vous programmés ou honorés dans le mois",
  },
  CLIENTS: {
    label: "Nouveaux Clients Signés",
    unit: "clients",
    description: "Nouveaux clients closés et assignés dans le mois",
  },
  CA: {
    label: "Chiffre d'Affaires",
    unit: "DA",
    description: "Valeur totale des contrats ou encaissements dans le mois",
  },
  CA_DA: {
    label: "Chiffre d'Affaires",
    unit: "DA",
    description: "Valeur totale des contrats ou encaissements dans le mois",
  },
  VIDEOS: {
    label: "Vidéos Montées & Livrées",
    unit: "vidéos",
    description: "Tâches vidéo livrées et validées dans le mois",
  },
  DESIGNS: {
    label: "Créations Graphiques",
    unit: "visuels",
    description: "Maquettes & designs finalisés dans le mois",
  },
  CREATIONS: {
    label: "Créations & Livrables",
    unit: "livrables",
    description: "Tâches créatives terminées dans le mois",
  },
};

/**
 * Calcule en temps réel la valeur réalisée d'une métrique pour un utilisateur et une période donnée
 */
export async function calculateLiveMetricAchieved(
  metric: string,
  userId: string,
  startOfMonth: Date,
  endOfMonth: Date,
  employeeDepartment?: string
): Promise<number> {
  const normalizedMetric = metric.toUpperCase().trim();

  switch (normalizedMetric) {
    case "APPELS": {
      return await prisma.call.count({
        where: {
          userId,
          calledAt: { gte: startOfMonth, lte: endOfMonth },
        },
      });
    }

    case "RENDEZ_VOUS": {
      return await prisma.appointment.count({
        where: {
          userId,
          startTime: { gte: startOfMonth, lte: endOfMonth },
        },
      });
    }

    case "CLIENTS": {
      return await prisma.client.count({
        where: {
          assignedToId: userId,
          OR: [
            { contractStart: { gte: startOfMonth, lte: endOfMonth } },
            { createdAt: { gte: startOfMonth, lte: endOfMonth } },
          ],
        },
      });
    }

    case "CA":
    case "CA_DA": {
      const clients = await prisma.client.findMany({
        where: {
          assignedToId: userId,
          OR: [
            { contractStart: { gte: startOfMonth, lte: endOfMonth } },
            { createdAt: { gte: startOfMonth, lte: endOfMonth } },
          ],
        },
        select: { contractValue: true, monthlyFee: true },
      });
      const contractTotal = clients.reduce(
        (sum, c) => sum + Number(c.contractValue || c.monthlyFee || 0),
        0
      );

      const payments = await prisma.payment.findMany({
        where: {
          paymentDate: { gte: startOfMonth, lte: endOfMonth },
          status: "COMPLETED",
          client: { assignedToId: userId },
        },
        select: { amount: true },
      });
      const paymentsTotal = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      return Math.max(contractTotal, paymentsTotal);
    }

    case "VIDEOS": {
      const videoTasksCount = await prisma.projectTask.count({
        where: {
          assigneeId: userId,
          status: { in: [TaskStatus.COMPLETED, TaskStatus.VALIDATED] },
          updatedAt: { gte: startOfMonth, lte: endOfMonth },
          OR: [
            { title: { contains: "vidéo", mode: "insensitive" } },
            { title: { contains: "video", mode: "insensitive" } },
            { project: { name: { contains: "vidéo", mode: "insensitive" } } },
            { project: { name: { contains: "video", mode: "insensitive" } } },
            { description: { contains: "vidéo", mode: "insensitive" } },
            { description: { contains: "video", mode: "insensitive" } },
          ],
        },
      });

      if (videoTasksCount === 0 && employeeDepartment === "VIDEO") {
        return await prisma.projectTask.count({
          where: {
            assigneeId: userId,
            status: { in: [TaskStatus.COMPLETED, TaskStatus.VALIDATED] },
            updatedAt: { gte: startOfMonth, lte: endOfMonth },
          },
        });
      }
      return videoTasksCount;
    }

    case "DESIGNS":
    case "CREATIONS": {
      return await prisma.projectTask.count({
        where: {
          assigneeId: userId,
          status: { in: [TaskStatus.COMPLETED, TaskStatus.VALIDATED] },
          updatedAt: { gte: startOfMonth, lte: endOfMonth },
        },
      });
    }

    default:
      return 0;
  }
}

/**
 * Synchronise tous les objectifs d'un mois/année spécifique et met à jour la base de données
 */
export async function syncAllGoalsForMonth(month: number, year: number) {
  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const goals = await prisma.employeeGoal.findMany({
    where: { month, year },
    include: {
      employee: {
        select: {
          id: true,
          userId: true,
          firstName: true,
          lastName: true,
          position: true,
          department: true,
        },
      },
    },
  });

  const updatedGoals: MonthlyGoalDisplay[] = [];

  for (const goal of goals) {
    const userId = goal.employee.userId;
    const computedAchieved = await calculateLiveMetricAchieved(
      goal.metric,
      userId,
      startOfMonth,
      endOfMonth,
      goal.employee.department
    );

    // Mettre à jour en base si différent
    if (Number(goal.achievedValue) !== computedAchieved) {
      await prisma.employeeGoal.update({
        where: { id: goal.id },
        data: { achievedValue: new Prisma.Decimal(computedAchieved) },
      });
    }

    const targetVal = Number(goal.targetValue);
    const progressPct = targetVal > 0 ? Math.round((computedAchieved / targetVal) * 100) : 0;
    const conf = METRIC_CONFIG[goal.metric.toUpperCase()] || {
      label: goal.metric,
      unit: "unités",
      description: "",
    };

    updatedGoals.push({
      id: goal.id,
      employeeId: goal.employeeId,
      employeeName: `${goal.employee.firstName} ${goal.employee.lastName}`,
      position: goal.employee.position,
      metric: goal.metric,
      metricLabel: conf.label,
      targetValue: targetVal,
      achievedValue: computedAchieved,
      progressPercentage: progressPct,
      isAchieved: progressPct >= 100,
      unit: conf.unit,
      month: goal.month,
      year: goal.year,
    });
  }

  return updatedGoals;
}

/**
 * Récupère ou crée le profil employé pour un utilisateur
 */
export async function ensureEmployeeProfile(user: {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
  phone?: string | null;
}) {
  let employee = await prisma.employee.findUnique({
    where: { userId: user.id },
  });

  if (!employee) {
    const nameParts = (user.name || "Collaborateur").split(" ");
    const firstName = nameParts[0] || "Collaborateur";
    const lastName = nameParts.slice(1).join(" ") || "";

    let department: DepartmentType = "COMMERCIAL";
    let position = user.role;

    switch (user.role) {
      case "SALES_REP":
        department = "COMMERCIAL";
        position = "Commercial B2B";
        break;
      case "TECH_LEAD":
      case "DEVELOPER":
        department = "DEVELOPMENT";
        position = "Développeur Web & Tech";
        break;
      case "DESIGNER":
        department = "DESIGN";
        position = "Designer UI/UX";
        break;
      case "VIDEO_EDITOR":
        department = "VIDEO";
        position = "Monteur Vidéo";
        break;
      case "ACCOUNTANT":
        department = "ADMINISTRATION";
        position = "Comptable";
        break;
      case "HR":
        department = "ADMINISTRATION";
        position = "Responsable RH";
        break;
      case "ADMIN":
      case "SALES_DIRECTOR":
        department = "ADMINISTRATION";
        position = "Directeur Général";
        break;
      default:
        department = "COMMERCIAL";
        position = user.role;
    }

    try {
      employee = await prisma.employee.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          email: user.email,
          phone: user.phone,
          position,
          department,
          baseSalary: 0,
          isActive: true,
        },
      });
    } catch {
      employee = await prisma.employee.findUnique({
        where: { userId: user.id },
      });
    }
  }

  return employee;
}

/**
 * Default goals per user role — used when no goals exist for the month
 */
const DEFAULT_GOALS_BY_ROLE: Record<string, { metric: string; targetValue: number }[]> = {
  SALES_REP: [
    { metric: "APPELS", targetValue: 400 },
    { metric: "RENDEZ_VOUS", targetValue: 30 },
    { metric: "CLIENTS", targetValue: 3 },
  ],
  COMMERCIAL_DIRECTOR: [
    { metric: "APPELS", targetValue: 200 },
    { metric: "CLIENTS", targetValue: 5 },
  ],
  SALES_DIRECTOR: [
    { metric: "APPELS", targetValue: 200 },
    { metric: "CLIENTS", targetValue: 5 },
  ],
  ADMIN: [
    { metric: "APPELS", targetValue: 100 },
    { metric: "CLIENTS", targetValue: 5 },
  ],
  TECH_LEAD: [
    { metric: "VIDEOS", targetValue: 15 },
    { metric: "CREATIONS", targetValue: 20 },
  ],
  DEVELOPER: [{ metric: "CREATIONS", targetValue: 15 }],
  DESIGNER: [
    { metric: "DESIGNS", targetValue: 20 },
    { metric: "CREATIONS", targetValue: 25 },
  ],
  VIDEO_EDITOR: [{ metric: "VIDEOS", targetValue: 20 }],
  HR: [
    { metric: "APPELS", targetValue: 50 },
    { metric: "CREATIONS", targetValue: 10 },
  ],
  ACCOUNTANT: [
    { metric: "APPELS", targetValue: 50 },
    { metric: "CLIENTS", targetValue: 2 },
  ],
  COMMUNITY_MANAGER: [
    { metric: "CREATIONS", targetValue: 20 },
    { metric: "APPELS", targetValue: 100 },
  ],
};

/**
 * Récupère et synchronise en direct les objectifs mensuels pour un utilisateur connecté.
 * Si aucun objectif n'est défini pour ce mois, crée automatiquement des objectifs
 * par défaut selon le rôle de l'employé.
 */
export async function getUserMonthlyGoals(
  userId: string,
  monthParam?: number,
  yearParam?: number
): Promise<MonthlyGoalDisplay[]> {
  const now = new Date();
  const month = monthParam || now.getMonth() + 1;
  const year = yearParam || now.getFullYear();

  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const employee = await prisma.employee.findUnique({
    where: { userId },
    include: {
      user: { select: { role: true } },
      goals: {
        where: { month, year },
      },
    },
  });

  if (!employee) return [];

  // ── Auto-create default goals if none exist for this month ─────────────────
  if (!employee.goals || employee.goals.length === 0) {
    const userRole = employee.user?.role || "SALES_REP";
    const defaults = DEFAULT_GOALS_BY_ROLE[userRole] || DEFAULT_GOALS_BY_ROLE["SALES_REP"];

    try {
      await prisma.employeeGoal.createMany({
        data: defaults.map((d) => ({
          employeeId: employee.id,
          metric: d.metric,
          targetValue: d.targetValue,
          achievedValue: 0,
          month,
          year,
        })),
        skipDuplicates: true,
      });

      // Re-fetch after creation
      const freshEmployee = await prisma.employee.findUnique({
        where: { userId },
        include: {
          user: { select: { role: true } },
          goals: { where: { month, year } },
        },
      });
      if (!freshEmployee || !freshEmployee.goals.length) return [];
      employee.goals = freshEmployee.goals;
    } catch (err) {
      console.warn("[getUserMonthlyGoals] Failed to auto-create goals:", err);
      return [];
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const results: MonthlyGoalDisplay[] = [];

  for (const goal of employee.goals) {
    const computedAchieved = await calculateLiveMetricAchieved(
      goal.metric,
      userId,
      startOfMonth,
      endOfMonth,
      employee.department
    );

    if (Number(goal.achievedValue) !== computedAchieved) {
      await prisma.employeeGoal.update({
        where: { id: goal.id },
        data: { achievedValue: new Prisma.Decimal(computedAchieved) },
      });
    }

    const targetVal = Number(goal.targetValue);
    const progressPct = targetVal > 0 ? Math.round((computedAchieved / targetVal) * 100) : 0;
    const conf = METRIC_CONFIG[goal.metric.toUpperCase()] || {
      label: goal.metric,
      unit: "unités",
      description: "",
    };

    results.push({
      id: goal.id,
      employeeId: goal.employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      position: employee.position,
      metric: goal.metric,
      metricLabel: conf.label,
      targetValue: targetVal,
      achievedValue: computedAchieved,
      progressPercentage: progressPct,
      isAchieved: progressPct >= 100,
      unit: conf.unit,
      month: goal.month,
      year: goal.year,
    });
  }

  return results;
}
