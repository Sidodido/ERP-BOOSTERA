"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface LogActivityParams {
  action: string;
  module?: string;
  entityId?: string | null;
  details?: Record<string, any> | string | null;
}

export interface ActivityFilterParams {
  page?: number;
  limit?: number;
  userId?: string;
  category?: string;
  dateRange?: "TODAY" | "YESTERDAY" | "WEEK" | "MONTH" | "ALL";
  search?: string;
}

/**
 * Universally record any action taken inside the ERP (WhatsApp clicks, phone calls, breaks, updates, etc.)
 */
export async function logActivityAction({
  action,
  module = "COMMUNICATION",
  entityId,
  details,
}: LogActivityParams) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Non authentifié" };

    const detailsString =
      typeof details === "object" && details !== null
        ? JSON.stringify(details)
        : details || null;

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action,
        module,
        entityId: entityId || null,
        details: detailsString,
      },
    });

    revalidatePath("/activites");
    return { success: true };
  } catch (error) {
    console.error("Erreur logActivityAction:", error);
    return { success: false, error: "Erreur lors de l'enregistrement de l'activité" };
  }
}

/**
 * Fetch detailed activities data, KPIs, break tours, and team performance
 */
export async function getActivitiesDataAction(params: ActivityFilterParams = {}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("Non authentifié");

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(10, params.limit || 30));
  const skip = (page - 1) * limit;

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

  // Determine date filter
  let dateFilter: { gte?: Date; lt?: Date } | undefined = undefined;
  if (params.dateRange === "TODAY") {
    dateFilter = { gte: todayStart };
  } else if (params.dateRange === "YESTERDAY") {
    dateFilter = { gte: yesterdayStart, lt: todayStart };
  } else if (params.dateRange === "WEEK") {
    dateFilter = { gte: weekStart };
  } else if (params.dateRange === "MONTH") {
    dateFilter = { gte: monthStart };
  }

  // Determine category action filters
  let actionFilter: string[] | undefined = undefined;
  if (params.category === "CALLS") {
    actionFilter = ["COMMUNICATION_PHONE", "PHONE_CLICK", "LOG_CALL", "CREATE_CLIENT_CALL"];
  } else if (params.category === "WHATSAPP") {
    actionFilter = ["COMMUNICATION_WHATSAPP", "WHATSAPP_CLICK"];
  } else if (params.category === "BREAKS") {
    actionFilter = ["PAUSE_START", "PAUSE_END"];
  } else if (params.category === "APPOINTMENTS") {
    actionFilter = [
      "CREATE_APPOINTMENT",
      "RESCHEDULE_APPOINTMENT",
      "UPDATE_APPOINTMENT_STATUS",
    ];
  } else if (params.category === "CLIENTS") {
    actionFilter = [
      "CONVERT_TO_CLIENT",
      "COMMISSION_CLIENT_SIGNED",
      "RECORD_CLIENT_PAYMENT",
      "CREATE_CLIENT_INVOICE",
      "CREATE",
      "UPDATE_CLIENT_INFO",
      "UPDATE_CLIENT_STATUS",
    ];
  } else if (params.category === "ATTENDANCE") {
    actionFilter = ["ATTENDANCE_CLOCK_IN", "ATTENDANCE_CLOCK_OUT"];
  } else if (params.category === "PRODUCTION") {
    actionFilter = [
      "CREATE_TASK",
      "UPDATE_TASK_STATUS",
      "CREATE_PROJECT",
      "UPDATE_PROJECT_STATUS",
      "BATCH_CREATE_TASKS",
      "DELETE_TASK",
    ];
  }

  // Base where condition
  const where: any = {};

  if (dateFilter) {
    where.createdAt = dateFilter;
  }

  if (params.userId && params.userId !== "ALL") {
    where.userId = params.userId;
  }

  if (actionFilter) {
    where.action = { in: actionFilter };
  }

  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    where.OR = [
      { action: { contains: term } },
      { details: { contains: term } },
      { user: { name: { contains: term } } },
      { user: { email: { contains: term } } },
    ];
  }

  // Fetch paginated activities
  const [totalCount, logs, usersList] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
            employee: {
              select: {
                position: true,
                department: true,
              },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        employee: {
          select: {
            position: true,
            department: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // Compute team-wide KPIs for the selected filter or today
  const kpiDateGte = dateFilter?.gte || todayStart;
  const kpiDateLt = dateFilter?.lt;
  const kpiWhere: any = {
    createdAt: kpiDateLt ? { gte: kpiDateGte, lt: kpiDateLt } : { gte: kpiDateGte },
  };

  const [
    kpiTotalActions,
    kpiPhoneClicks,
    kpiWhatsAppClicks,
    kpiAppointments,
    kpiClientsSigned,
    breakLogsForPeriod,
    todayAttendanceRecords,
  ] = await Promise.all([
    prisma.auditLog.count({ where: kpiWhere }),
    prisma.auditLog.count({
      where: {
        ...kpiWhere,
        action: { in: ["COMMUNICATION_PHONE", "PHONE_CLICK", "LOG_CALL", "CREATE_CLIENT_CALL"] },
      },
    }),
    prisma.auditLog.count({
      where: {
        ...kpiWhere,
        action: { in: ["COMMUNICATION_WHATSAPP", "WHATSAPP_CLICK"] },
      },
    }),
    prisma.auditLog.count({
      where: {
        ...kpiWhere,
        action: { in: ["CREATE_APPOINTMENT", "RESCHEDULE_APPOINTMENT"] },
      },
    }),
    prisma.auditLog.count({
      where: {
        ...kpiWhere,
        action: { in: ["COMMISSION_CLIENT_SIGNED", "CONVERT_TO_CLIENT"] },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        createdAt: { gte: todayStart },
        action: { in: ["PAUSE_START", "PAUSE_END"] },
      },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
            employee: { select: { position: true } },
          },
        },
      },
    }),
    prisma.attendance.findMany({
      where: { date: todayStart },
      include: {
        employee: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    }),
  ]);

  // Determine who is currently on break
  // Group break logs by user
  const breaksByUser: Record<string, typeof breakLogsForPeriod> = {};
  for (const log of breakLogsForPeriod) {
    if (!log.userId) continue;
    if (!breaksByUser[log.userId]) breaksByUser[log.userId] = [];
    breaksByUser[log.userId].push(log);
  }

  const currentlyOnBreakUsers: {
    userId: string;
    userName: string;
    userRole: string;
    avatarUrl: string | null;
    reason: string;
    startTime: string;
    elapsedMinutes: number;
  }[] = [];

  const breakToursHistory: {
    id: string;
    userId: string;
    userName: string;
    userRole: string;
    avatarUrl: string | null;
    startTime: string;
    endTime: string | null;
    durationMinutes: number;
    reason: string;
    status: "EN_COURS" | "TERMINEE";
  }[] = [];

  let totalBreakMinutesTeamToday = 0;

  for (const [userId, userLogs] of Object.entries(breaksByUser)) {
    const sorted = [...userLogs].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let activeStart: (typeof breakLogsForPeriod)[0] | null = null;

    for (const log of sorted) {
      if (log.action === "PAUSE_START") {
        activeStart = log;
      } else if (log.action === "PAUSE_END" && activeStart) {
        let reason = "Pause standard";
        let durationMinutes = 0;
        try {
          const endDetails = JSON.parse(log.details || "{}");
          const startDetails = JSON.parse(activeStart.details || "{}");
          reason = endDetails.reason || startDetails.reason || "Pause standard";
          durationMinutes =
            endDetails.durationMinutes ||
            Math.max(
              1,
              Math.floor(
                (new Date(log.createdAt).getTime() - new Date(activeStart.createdAt).getTime()) /
                  60000
              )
            );
        } catch {
          durationMinutes = Math.max(
            1,
            Math.floor(
              (new Date(log.createdAt).getTime() - new Date(activeStart.createdAt).getTime()) /
                60000
            )
          );
        }

        totalBreakMinutesTeamToday += durationMinutes;

        breakToursHistory.push({
          id: `${activeStart.id}_${log.id}`,
          userId,
          userName: log.user?.name || "Collaborateur",
          userRole: log.user?.employee?.position || log.user?.role || "Collaborateur",
          avatarUrl: log.user?.avatarUrl || null,
          startTime: activeStart.createdAt.toISOString(),
          endTime: log.createdAt.toISOString(),
          durationMinutes,
          reason,
          status: "TERMINEE",
        });

        activeStart = null;
      }
    }

    // If still active
    if (activeStart) {
      let reason = "Pause standard";
      try {
        const d = JSON.parse(activeStart.details || "{}");
        if (d.reason) reason = d.reason;
      } catch {}

      const elapsed = Math.max(
        0,
        Math.floor((now.getTime() - new Date(activeStart.createdAt).getTime()) / 60000)
      );

      currentlyOnBreakUsers.push({
        userId,
        userName: activeStart.user?.name || "Collaborateur",
        userRole:
          activeStart.user?.employee?.position || activeStart.user?.role || "Collaborateur",
        avatarUrl: activeStart.user?.avatarUrl || null,
        reason,
        startTime: activeStart.createdAt.toISOString(),
        elapsedMinutes: elapsed,
      });

      breakToursHistory.push({
        id: activeStart.id,
        userId,
        userName: activeStart.user?.name || "Collaborateur",
        userRole:
          activeStart.user?.employee?.position || activeStart.user?.role || "Collaborateur",
        avatarUrl: activeStart.user?.avatarUrl || null,
        startTime: activeStart.createdAt.toISOString(),
        endTime: null,
        durationMinutes: elapsed,
        reason,
        status: "EN_COURS",
      });
    }
  }

  // Sort break history: most recent first
  breakToursHistory.sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  // Compute team performance breakdown (per collaborator)
  // Query all actions in current filter range grouped by user
  const userActionsGroup = await prisma.auditLog.groupBy({
    by: ["userId", "action"],
    where: kpiWhere,
    _count: { id: true },
  });

  const performanceMap: Record<
    string,
    {
      userId: string;
      name: string;
      email: string;
      role: string;
      position: string;
      avatarUrl: string | null;
      totalActions: number;
      phoneCalls: number;
      whatsApp: number;
      appointments: number;
      clientsSigned: number;
      pausesCount: number;
      breakMinutes: number;
      workMinutes: number;
      isCurrentlyClockedIn: boolean;
      isCurrentlyOnBreak: boolean;
    }
  > = {};

  // Initialize with all active users
  for (const u of usersList) {
    const todayAtt = todayAttendanceRecords.find((a) => a.employee.userId === u.id);
    let workMinutes = 0;
    if (todayAtt?.clockIn) {
      const end = todayAtt.clockOut ? new Date(todayAtt.clockOut) : now;
      workMinutes = Math.max(
        0,
        Math.floor((end.getTime() - new Date(todayAtt.clockIn).getTime()) / 60000)
      );
    }

    const isOnBreak = currentlyOnBreakUsers.some((b) => b.userId === u.id);

    performanceMap[u.id] = {
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      position: u.employee?.position || u.role,
      avatarUrl: u.avatarUrl,
      totalActions: 0,
      phoneCalls: 0,
      whatsApp: 0,
      appointments: 0,
      clientsSigned: 0,
      pausesCount: 0,
      breakMinutes: todayAtt?.breakMinutes || 0,
      workMinutes,
      isCurrentlyClockedIn: !!todayAtt?.clockIn && !todayAtt?.clockOut,
      isCurrentlyOnBreak: isOnBreak,
    };
  }

  for (const row of userActionsGroup) {
    if (!row.userId || !performanceMap[row.userId]) continue;
    const count = row._count.id;
    const p = performanceMap[row.userId];

    p.totalActions += count;

    if (
      ["COMMUNICATION_PHONE", "PHONE_CLICK", "LOG_CALL", "CREATE_CLIENT_CALL"].includes(
        row.action
      )
    ) {
      p.phoneCalls += count;
    } else if (["COMMUNICATION_WHATSAPP", "WHATSAPP_CLICK"].includes(row.action)) {
      p.whatsApp += count;
    } else if (
      ["CREATE_APPOINTMENT", "RESCHEDULE_APPOINTMENT", "UPDATE_APPOINTMENT_STATUS"].includes(
        row.action
      )
    ) {
      p.appointments += count;
    } else if (["COMMISSION_CLIENT_SIGNED", "CONVERT_TO_CLIENT"].includes(row.action)) {
      p.clientsSigned += count;
    } else if (row.action === "PAUSE_START") {
      p.pausesCount += count;
    }
  }

  // Active collaborators today (clocked in)
  const activeClockedInCount = todayAttendanceRecords.filter(
    (a) => a.clockIn && !a.clockOut
  ).length;

  return {
    activities: logs.map((log) => ({
      id: log.id,
      action: log.action,
      module: log.module,
      entityId: log.entityId,
      details: log.details,
      createdAt: log.createdAt.toISOString(),
      user: log.user
        ? {
            id: log.user.id,
            name: log.user.name,
            email: log.user.email,
            role: log.user.role,
            avatarUrl: log.user.avatarUrl,
            position: log.user.employee?.position || log.user.role,
            department: log.user.employee?.department || "GÉNÉRAL",
          }
        : null,
    })),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
    kpis: {
      totalActions: kpiTotalActions,
      phoneClicks: kpiPhoneClicks,
      whatsAppClicks: kpiWhatsAppClicks,
      appointments: kpiAppointments,
      clientsSigned: kpiClientsSigned,
      totalBreakMinutesTeam: totalBreakMinutesTeamToday,
      activeClockedInCount,
      currentlyOnBreakCount: currentlyOnBreakUsers.length,
    },
    currentlyOnBreakUsers,
    breakToursHistory,
    teamPerformance: Object.values(performanceMap).sort(
      (a, b) => b.totalActions - a.totalActions
    ),
    usersList: usersList.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      position: u.employee?.position || u.role,
    })),
  };
}
