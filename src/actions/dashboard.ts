"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ProspectStatus, ClientStatus, TaskStatus, TaskPriority } from "@prisma/client";
import {
  ensureEmployeeProfile,
  getUserMonthlyGoals,
  type MonthlyGoalDisplay,
} from "@/lib/goals-sync";

export interface DashboardMetricsResult {
  role: string;
  isCommercial: boolean;
  isTechnician: boolean;
  isAdmin: boolean;

  // Objectifs Mensuels synchronisés en direct
  myMonthlyGoals: MonthlyGoalDisplay[];

  // Données Communes & Direction
  totalProspects: number;
  newProspects: number;
  interestedProspects: number;
  convertedProspects: number;
  callsToday: number;
  totalCalls: number;
  upcomingAppointments: number;
  activeClients: number;
  totalContractValue: number;
  totalCollected: number;
  balanceRemaining: number;
  conversionRate: number;
  recentActivities: any[];
  salesReps: any[];

  // Données Spécifiques Commercial
  commercialData?: {
    myProspectsCount: number;
    myNewProspectsCount: number;
    myInterestedProspectsCount: number;
    myConvertedProspectsCount: number;
    myCallsToday: number;
    myCallsTotal: number;
    myUpcomingAppointmentsCount: number;
    myPendingFollowUpsCount: number;
    myActiveClientsCount: number;
    myConversionRate: number;
    upcomingAppointmentsList: Array<{
      id: string;
      title: string;
      startTime: string;
      type: string;
      contactName?: string | null;
      companyName?: string | null;
      phone?: string | null;
      notes?: string | null;
    }>;
    pendingFollowUpsList: Array<{
      id: string;
      stepNumber: number;
      scheduledAt: string;
      contactName?: string | null;
      companyName?: string | null;
      phone?: string | null;
      notes?: string | null;
    }>;
    recentProspectsList: Array<{
      id: string;
      companyName: string;
      contactName?: string | null;
      phone?: string | null;
      wilaya?: string | null;
      sector?: string | null;
      status: string;
      callStatus?: string | null;
      updatedAt: string;
    }>;
  };

  // Données Spécifiques Technicien
  technicianData?: {
    tasksInProgressCount: number;
    tasksTodoCount: number;
    tasksUrgentCount: number;
    tasksCompletedCount: number;
    activeProjectsCount: number;
    activeSubscriptionsCount: number;
    urgentTasksList: Array<{
      id: string;
      title: string;
      description?: string | null;
      status: string;
      priority: string;
      dueDate?: string | null;
      projectName: string;
      clientName: string;
      clientId: string;
    }>;
    activeProjectsList: Array<{
      id: string;
      name: string;
      code: string;
      clientName: string;
      status: string;
      totalTasks: number;
      completedTasks: number;
      deadline?: string | null;
    }>;
    activeSubscriptionsList: Array<{
      id: string;
      companyName: string;
      brandName?: string | null;
      offerType: string;
      wilaya?: string | null;
      sector?: string | null;
      updatedAt: string;
    }>;
  };
}

export async function getDashboardMetrics(): Promise<DashboardMetricsResult> {
  const user = await requireAuth();

  const isCommercial =
    user.role === "SALES_REP" ||
    (user.role as any) === "COMMERCIAL";

  const isTechnician =
    user.role === "TECH_LEAD" ||
    user.role === "DEVELOPER" ||
    user.role === "DESIGNER" ||
    user.role === "VIDEO_EDITOR" ||
    (user.role as any) === "TECHNICIEN";

  const isAdmin =
    user.role === "ADMIN" ||
    user.role === "SALES_DIRECTOR" ||
    user.role === "ACCOUNTANT";

  const repFilter = isAdmin ? {} : { assignedToId: user.id };
  const userFilter = isAdmin ? {} : { userId: user.id };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Prospects metrics de base
  const totalProspects = await prisma.prospect.count({ where: repFilter });
  const newProspects = await prisma.prospect.count({
    where: { ...repFilter, status: ProspectStatus.NEW },
  });
  const interestedProspects = await prisma.prospect.count({
    where: { ...repFilter, status: ProspectStatus.INTERESTED },
  });
  const convertedProspects = await prisma.prospect.count({
    where: { ...repFilter, status: ProspectStatus.CONVERTED },
  });

  // 2. Appels
  const callsToday = await prisma.call.count({
    where: { ...userFilter, calledAt: { gte: today } },
  });
  const totalCalls = await prisma.call.count({ where: userFilter });

  // 3. Rendez-vous
  const upcomingAppointments = await prisma.appointment.count({
    where: {
      ...userFilter,
      startTime: { gte: new Date() },
      status: "SCHEDULED",
    },
  });

  // 4. Clients & Finance
  const activeClients = await prisma.client.count({
    where: { ...repFilter, status: ClientStatus.ACTIVE },
  });

  let totalContractValue = 0;
  let totalCollected = 0;
  let balanceRemaining = 0;

  // Calcul financier (uniquement exécuté pour Admin/Finance pour préserver la performance et la confidentialité)
  if (isAdmin) {
    const clients = await prisma.client.findMany({
      select: { contractValue: true, monthlyFee: true },
    });
    totalContractValue = clients.reduce(
      (sum, c) => sum + Number(c.contractValue || 0),
      0
    );

    const payments = await prisma.payment.findMany({
      where: { status: "COMPLETED" },
      select: { amount: true },
    });
    totalCollected = payments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );
    balanceRemaining = Math.max(0, totalContractValue - totalCollected);
  }

  // 5. Taux de conversion
  const conversionRate =
    totalProspects > 0
      ? Math.round((convertedProspects / totalProspects) * 100)
      : 0;

  // 6. Activités récentes (AuditLog)
  const recentActivitiesRaw = isAdmin
    ? await prisma.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, role: true } },
        },
      })
    : [];

  const recentActivities = recentActivitiesRaw.map((act) => ({
    ...act,
    createdAt: act.createdAt.toISOString(),
  }));

  // 7. Équipe commerciale
  const salesReps = isAdmin
    ? await prisma.user.findMany({
        where: { role: { in: ["SALES_REP", "SALES_DIRECTOR"] }, isActive: true },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              assignedProspects: true,
              loggedCalls: true,
              conductedAppointments: true,
              managedClients: true,
            },
          },
        },
      })
    : [];

  // 8. Données Commerciales spécifiques
  let commercialData: DashboardMetricsResult["commercialData"] = undefined;
  if (isCommercial) {
    const [rawUpcomingAppts, rawPendingFollowUps, rawRecentProspects] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          userId: user.id,
          status: "SCHEDULED",
          startTime: { gte: today },
        },
        orderBy: { startTime: "asc" },
        take: 6,
        include: {
          prospect: { select: { companyName: true, contactName: true, phone: true } },
          client: { select: { companyName: true, contactName: true, phone: true } },
        },
      }),
      prisma.followUp.findMany({
        where: {
          userId: user.id,
          status: "SCHEDULED",
        },
        orderBy: { scheduledAt: "asc" },
        take: 6,
        include: {
          prospect: { select: { companyName: true, contactName: true, phone: true } },
        },
      }),
      prisma.prospect.findMany({
        where: { assignedToId: user.id },
        orderBy: { updatedAt: "desc" },
        take: 6,
        select: {
          id: true,
          companyName: true,
          contactName: true,
          phone: true,
          wilaya: true,
          sector: true,
          status: true,
          notes: true,
          updatedAt: true,
        },
      }),
    ]);

    commercialData = {
      myProspectsCount: totalProspects,
      myNewProspectsCount: newProspects,
      myInterestedProspectsCount: interestedProspects,
      myConvertedProspectsCount: convertedProspects,
      myCallsToday: callsToday,
      myCallsTotal: totalCalls,
      myUpcomingAppointmentsCount: upcomingAppointments,
      myPendingFollowUpsCount: rawPendingFollowUps.length,
      myActiveClientsCount: activeClients,
      myConversionRate: conversionRate,
      upcomingAppointmentsList: rawUpcomingAppts.map((app) => ({
        id: app.id,
        title: app.title,
        startTime: app.startTime.toISOString(),
        type: app.type,
        contactName: app.prospect?.contactName || app.client?.contactName || null,
        companyName: app.prospect?.companyName || app.client?.companyName || null,
        phone: app.prospect?.phone || app.client?.phone || null,
        notes: app.notes,
      })),
      pendingFollowUpsList: rawPendingFollowUps.map((fol) => ({
        id: fol.id,
        stepNumber: fol.stepNumber,
        scheduledAt: fol.scheduledAt.toISOString(),
        contactName: fol.prospect?.contactName || null,
        companyName: fol.prospect?.companyName || null,
        phone: fol.prospect?.phone || null,
        notes: fol.notes,
      })),
      recentProspectsList: rawRecentProspects.map((p) => {
        const callMatch = (p.notes || "").match(/\[APPEL_STATUT:([^\]]+)\]/);
        return {
          id: p.id,
          companyName: p.companyName,
          contactName: p.contactName,
          phone: p.phone,
          wilaya: p.wilaya,
          sector: p.sector,
          status: p.status,
          callStatus: callMatch ? callMatch[1] : null,
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
    };
  }

  // 9. Données Technicien spécifiques
  let technicianData: DashboardMetricsResult["technicianData"] = undefined;
  if (isTechnician) {
    const isTechLead = user.role === "TECH_LEAD";
    // Si tech lead, vision d'ensemble de la production technique, sinon tâches assignées
    const taskFilter = isTechLead ? {} : { assigneeId: user.id };

    const [
      inProgressCount,
      todoCount,
      urgentCount,
      completedCount,
      activeProjectsCount,
      activeSubscriptionsCount,
      rawUrgentTasks,
      rawActiveProjects,
      rawActiveSubs,
    ] = await Promise.all([
      prisma.projectTask.count({
        where: { ...taskFilter, status: TaskStatus.IN_PROGRESS },
      }),
      prisma.projectTask.count({
        where: { ...taskFilter, status: TaskStatus.TODO },
      }),
      prisma.projectTask.count({
        where: {
          ...taskFilter,
          status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
          priority: { in: [TaskPriority.HIGH, TaskPriority.URGENT] },
        },
      }),
      prisma.projectTask.count({
        where: {
          ...taskFilter,
          status: { in: [TaskStatus.COMPLETED, TaskStatus.VALIDATED] },
        },
      }),
      prisma.project.count({
        where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
      }),
      prisma.client.count({
        where: { status: ClientStatus.ACTIVE },
      }),
      prisma.projectTask.findMany({
        where: {
          ...taskFilter,
          status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: 7,
        include: {
          project: {
            select: {
              name: true,
              client: { select: { id: true, companyName: true } },
            },
          },
        },
      }),
      prisma.project.findMany({
        where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          client: { select: { companyName: true } },
          tasks: { select: { status: true } },
        },
      }),
      prisma.client.findMany({
        where: { status: ClientStatus.ACTIVE },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          companyName: true,
          brandName: true,
          offerType: true,
          wilaya: true,
          sector: true,
          updatedAt: true,
        },
      }),
    ]);

    technicianData = {
      tasksInProgressCount: inProgressCount,
      tasksTodoCount: todoCount,
      tasksUrgentCount: urgentCount,
      tasksCompletedCount: completedCount,
      activeProjectsCount,
      activeSubscriptionsCount,
      urgentTasksList: rawUrgentTasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        projectName: t.project.name,
        clientName: t.project.client.companyName,
        clientId: t.project.client.id,
      })),
      activeProjectsList: rawActiveProjects.map((p) => {
        const total = p.tasks.length;
        const done = p.tasks.filter(
          (t) => t.status === "COMPLETED" || t.status === "VALIDATED"
        ).length;
        return {
          id: p.id,
          name: p.name,
          code: p.code,
          clientName: p.client.companyName,
          status: p.status,
          totalTasks: total,
          completedTasks: done,
          deadline: p.deadline ? p.deadline.toISOString() : null,
        };
      }),
      activeSubscriptionsList: rawActiveSubs.map((s) => ({
        id: s.id,
        companyName: s.companyName,
        brandName: s.brandName,
        offerType: s.offerType,
        wilaya: s.wilaya,
        sector: s.sector,
        updatedAt: s.updatedAt.toISOString(),
      })),
    };
  }

  // Synchronisation en direct des objectifs mensuels du collaborateur
  await ensureEmployeeProfile(user);
  const myMonthlyGoals = await getUserMonthlyGoals(user.id);

  return {
    role: user.role,
    isCommercial,
    isTechnician,
    isAdmin,
    myMonthlyGoals,
    totalProspects,
    newProspects,
    interestedProspects,
    convertedProspects,
    callsToday,
    totalCalls,
    upcomingAppointments,
    activeClients,
    totalContractValue,
    totalCollected,
    balanceRemaining,
    conversionRate,
    recentActivities,
    salesReps,
    commercialData,
    technicianData,
  };
}
