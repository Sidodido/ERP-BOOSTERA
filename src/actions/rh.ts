"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  DepartmentType,
  AttendanceStatus,
  LeaveType,
  LeaveStatus,
  Role,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { syncDailyAbsences } from "./attendance";
import {
  getPayrollCycleDates,
  getPayrollCycleForDate,
  getAvailablePayrollCycles,
  calculateAndSyncPayroll,
} from "@/lib/payroll";
import { pairBreakLogs, type EmployeeTodayBreak } from "@/lib/break-utils";
export type { EmployeeTodayBreak };

export async function getRhDataAction(monthParam?: number, yearParam?: number) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SALES_DIRECTOR" && user.role !== "HR")) {
    throw new Error("Accès réservé aux Administrateurs et aux RH");
  }

  const now = new Date();
  const defaultCycle = getPayrollCycleForDate(now);
  const currentMonth = monthParam || defaultCycle.month;
  const currentYear = yearParam || defaultCycle.year;
  const cycleInfo = getPayrollCycleDates(currentMonth, currentYear);

  // Auto-sync absences & payroll deductions (-1 jour de salaire par absence non pointée)
  try {
    await calculateAndSyncPayroll(currentMonth, currentYear);
  } catch (err) {
    console.error("Erreur auto-sync paie RH:", err);
  }

  // 1. Employees Directory
  const employees = await prisma.employee.findMany({
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, avatarUrl: true },
      },
    },
    orderBy: { lastName: "asc" },
  });

  // 2. Today's Attendances (UTC midnight normalisé pour correspondre au champ @db.Date de PostgreSQL)
  const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const attendances = await prisma.attendance.findMany({
    where: {
      date: todayStart,
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, position: true },
      },
    },
  });

  // 2b. Monthly Attendances (couvre le mois civil et le cycle de paie du 10 au 10)
  const monthStart = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
  const monthEnd = new Date(Date.UTC(currentYear, currentMonth, 1));
  const cycleStart = cycleInfo.startDate;
  const cycleEnd = cycleInfo.endDate;
  const queryStart = monthStart < cycleStart ? monthStart : cycleStart;
  const queryEnd = monthEnd > cycleEnd ? monthEnd : cycleEnd;

  const monthlyAttendances = await prisma.attendance.findMany({
    where: {
      date: { gte: queryStart, lt: queryEnd },
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, position: true, department: true },
      },
    },
    orderBy: { date: "desc" },
  });

  // 3. Leave Requests
  const leaveRequests = await prisma.leaveRequest.findMany({
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, position: true, department: true },
      },
      approvedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // 4. Payroll for current cycle (month/year)
  const salaryPayments = await prisma.salaryPayment.findMany({
    where: {
      month: currentMonth,
      year: currentYear,
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, position: true, baseSalary: true },
      },
    },
  });

  // 5. Commissions for current cycle (du 10 au 10)
  const commissions = await prisma.commission.findMany({
    where: {
      earnedDate: { gte: cycleInfo.startDate, lt: cycleInfo.endDate },
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true },
      },
      client: {
        select: { id: true, companyName: true },
      },
    },
  });

  // Eligible users without employee profile
  const usersWithoutEmployee = await prisma.user.findMany({
    where: {
      employee: null,
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  // Total payroll amount
  const totalBaseSalaries = employees.reduce(
    (acc, emp) => acc + (emp.isActive ? Number(emp.baseSalary) : 0),
    0
  );
  const totalCommissions = commissions.reduce(
    (acc, comm) => acc + Number(comm.amount),
    0
  );

  return {
    month: currentMonth,
    year: currentYear,
    cycleInfo: {
      startDate: cycleInfo.startDate.toISOString(),
      endDate: cycleInfo.endDate.toISOString(),
      displayStartDate: cycleInfo.displayStartDate,
      displayEndDate: cycleInfo.displayEndDate,
      label: cycleInfo.label,
      isUnlocked: cycleInfo.isUnlocked,
    },
    availableCycles: getAvailablePayrollCycles(now),
    employees: employees.map((emp) => ({
      ...emp,
      baseSalary: Number(emp.baseSalary),
    })),
    attendances: attendances.map((att) => ({
      ...att,
      breakMinutes: Number(att.breakMinutes),
    })),
    monthlyAttendances: monthlyAttendances.map((att) => ({
      ...att,
      breakMinutes: Number(att.breakMinutes),
    })),
    leaveRequests,
    salaryPayments: salaryPayments.map((sp) => {
      const base = Number(sp.baseSalary);
      const dailyRate = base > 0 ? Math.round(base / 30) : 0;
      const ded = Number(sp.deductions);
      const deductedDays = dailyRate > 0 ? Math.round(ded / dailyRate) : 0;
      return {
        ...sp,
        baseSalary: base,
        primes: Number(sp.primes),
        commissions: Number(sp.commissions),
        bonuses: Number(sp.bonuses),
        deductions: ded,
        netSalary: Number(sp.netSalary),
        dailyRate,
        deductedDays,
        employee: {
          ...sp.employee,
          baseSalary: Number(sp.employee.baseSalary),
        },
      };
    }),
    commissions: commissions.map((c) => ({
      ...c,
      amount: Number(c.amount),
      rateApplied: Number(c.rateApplied),
    })),
    usersWithoutEmployee,
    kpis: {
      totalEmployees: employees.length,
      activeEmployees: employees.filter((e) => e.isActive).length,
      presentToday: attendances.filter((a) => (a.status === "PRESENT" || a.status === "LATE") && a.clockIn !== null).length,
      absentToday: [5, 6].includes(new Date().getDay()) ? 0 : attendances.filter((a) => a.status === "ABSENT").length,
      pendingLeaves: leaveRequests.filter((l) => l.status === "PENDING").length,
      totalBaseSalaries,
      totalCommissions,
      totalDeductions: salaryPayments.reduce((acc, sp) => acc + Number(sp.deductions), 0),
    },
  };
}

export async function createEmployeeAction(data: {
  userId?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  address?: string;
  position: string;
  department: DepartmentType;
  baseSalary: number;
  userRole?: Role;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  let targetUserId = data.userId;
  if (!targetUserId) {
    // If no existing user selected, check if user exists by email or create placeholder
    const existing = await prisma.user.findFirst({
      where: { email: data.email?.trim().toLowerCase() },
    });
    if (existing) {
      targetUserId = existing.id;
      if (data.userRole) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: data.userRole },
        });
      }
    } else {
      const generatedEmail =
        data.email?.trim().toLowerCase() ||
        `${data.firstName.toLowerCase().replace(/[^a-z0-9]/g, "")}.${data.lastName.toLowerCase().replace(/[^a-z0-9]/g, "")}@boostera.dz`;
      const newUser = await prisma.user.create({
        data: {
          name: `${data.firstName} ${data.lastName}`,
          email: generatedEmail,
          passwordHash: "$2b$10$dummyhashchangeonlogin",
          role: data.userRole || "SALES_REP",
          phone: data.phone || null,
        },
      });
      targetUserId = newUser.id;
    }
  } else if (data.userRole) {
    await prisma.user.update({
      where: { id: targetUserId },
      data: { role: data.userRole },
    });
  }

  const employee = await prisma.employee.create({
    data: {
      userId: targetUserId,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      address: data.address?.trim() || null,
      position: data.position.trim(),
      department: data.department,
      baseSalary: new Prisma.Decimal(Number(data.baseSalary) || 0),
      isActive: true,
    },
  });

  revalidatePath("/rh");
  revalidatePath("/equipes");
  return { success: true, employeeId: employee.id };
}

export async function deleteEmployeeAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const emp = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          _count: {
            select: {
              assignedProspects: true,
              managedClients: true,
              loggedCalls: true,
              conductedAppointments: true,
              managedProjects: true,
              assignedTasks: true,
            },
          },
        },
      },
    },
  });

  if (!emp) throw new Error("Collaborateur introuvable");

  const userId = emp.userId;
  const userCounts = emp.user?._count;
  const hasUserActivity = Boolean(
    userCounts &&
      (userCounts.assignedProspects > 0 ||
        userCounts.managedClients > 0 ||
        userCounts.loggedCalls > 0 ||
        userCounts.conductedAppointments > 0 ||
        userCounts.managedProjects > 0 ||
        userCounts.assignedTasks > 0)
  );

  // Supprimer l'employé (Prisma supprime en cascade attendances, leaveRequests, salaryPayments, commissions, goals, reviews)
  await prisma.employee.delete({
    where: { id },
  });

  // Si le compte utilisateur autonome n'a pas d'autres données CRM actives, le nettoyer
  if (userId && !hasUserActivity) {
    try {
      await prisma.user.delete({
        where: { id: userId },
      });
    } catch (e) {
      console.warn("Compte utilisateur conservé:", e);
    }
  }

  revalidatePath("/rh");
  revalidatePath("/equipes");
  return { success: true };
}

export async function updateEmployeeAction(
  id: string,
  data: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    position: string;
    department: DepartmentType;
    baseSalary: number;
    isActive: boolean;
  }>
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const updateData: Prisma.EmployeeUpdateInput = {};
  if (data.firstName) updateData.firstName = data.firstName;
  if (data.lastName) updateData.lastName = data.lastName;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.position) updateData.position = data.position;
  if (data.department) updateData.department = data.department;
  if (data.baseSalary !== undefined)
    updateData.baseSalary = new Prisma.Decimal(data.baseSalary);
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  await prisma.employee.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/rh");
  revalidatePath("/equipes");
  return { success: true };
}

export async function recordAttendanceAction(data: {
  employeeId: string;
  status: AttendanceStatus;
  clockInTime?: string;
  clockOutTime?: string;
  notes?: string;
  date?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");
  if (user.role !== "ADMIN" && user.role !== "SALES_DIRECTOR" && user.role !== "HR") {
    throw new Error("Accès réservé aux administrateurs");
  }

  const now = new Date();
  let targetDate: Date;
  let year = now.getFullYear();
  let month = now.getMonth();
  let day = now.getDate();

  if (data.date) {
    const [y, m, d] = data.date.split("-").map(Number);
    year = y;
    month = m - 1;
    day = d;
    targetDate = new Date(Date.UTC(y, m - 1, d));
  } else {
    targetDate = new Date(Date.UTC(year, month, day));
  }

  let clockInDate: Date | null = null;
  if (data.status === "ABSENT" || data.status === "ON_LEAVE") {
    clockInDate = null;
  } else if (data.clockInTime && data.clockInTime.trim() !== "") {
    const [hours, minutes] = data.clockInTime.split(":").map(Number);
    clockInDate = new Date(year, month, day, hours, minutes, 0);
  } else if (data.status === "PRESENT" || data.status === "LATE") {
    clockInDate = now;
  }

  let clockOutDate: Date | null = null;
  if (data.status === "ABSENT" || data.status === "ON_LEAVE") {
    clockOutDate = null;
  } else if (data.clockOutTime && data.clockOutTime.trim() !== "") {
    const [hours, minutes] = data.clockOutTime.split(":").map(Number);
    clockOutDate = new Date(year, month, day, hours, minutes, 0);
  }

  const defaultNote =
    data.status === "ABSENT"
      ? "Marqué absent par la direction"
      : data.status === "LATE"
      ? "Retard validé par l'administrateur"
      : "Pointage ajusté par l'administrateur";

  const attendance = await prisma.attendance.upsert({
    where: {
      employeeId_date: {
        employeeId: data.employeeId,
        date: targetDate,
      },
    },
    create: {
      employeeId: data.employeeId,
      date: targetDate,
      status: data.status,
      clockIn: clockInDate,
      clockOut: clockOutDate,
      notes: data.notes || defaultNote,
    },
    update: {
      status: data.status,
      clockIn: clockInDate,
      clockOut: clockOutDate,
      notes: data.notes !== undefined ? (data.notes || null) : defaultNote,
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, position: true },
      },
    },
  });

  try {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ADMIN_UPDATE_ATTENDANCE",
        module: "HR",
        entityId: attendance.id,
        details: JSON.stringify({
          employeeId: data.employeeId,
          status: data.status,
          clockInTime: data.clockInTime,
          clockOutTime: data.clockOutTime,
          notes: data.notes,
        }),
      },
    });
  } catch {}

  try {
    const { month: cycleMonth, year: cycleYear } = getPayrollCycleForDate(targetDate);
    await calculateAndSyncPayroll(cycleMonth, cycleYear);
  } catch (err) {
    console.warn("Calcul paie post-attendance:", err);
  }

  revalidatePath("/rh");
  revalidatePath("/dashboard");
  revalidatePath("/parametres");

  return {
    success: true,
    attendanceId: attendance.id,
    attendance: {
      ...attendance,
      breakMinutes: Number(attendance.breakMinutes || 0),
    },
  };
}

/**
 * Récupère en temps réel les pointages du jour pour synchronisation automatique
 */
export async function getTodayAttendancesAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  // Synchroniser les absences automatiques pour aujourd'hui et les jours récents
  try {
    await syncDailyAbsences({ daysBack: 3, includeToday: true });
  } catch (err) {
    console.error("Erreur syncDailyAbsences dans getTodayAttendancesAction:", err);
  }

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  const attendances = await prisma.attendance.findMany({
    where: {
      date: todayStart,
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, position: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const isWeekendToday = [5, 6].includes(now.getDay());
  const presentToday = attendances.filter(
    (a) => (a.status === "PRESENT" || a.status === "LATE") && a.clockIn !== null
  ).length;
  const absentToday = isWeekendToday ? 0 : attendances.filter((a) => a.status === "ABSENT").length;

  return {
    success: true,
    attendances: attendances.map((att) => ({
      ...att,
      breakMinutes: Number(att.breakMinutes),
    })),
    kpis: {
      presentToday,
      absentToday,
    },
  };
}

/**
 * Récupère les pointages mensuels pour un mois et une année donnés
 */
export async function getMonthlyAttendancesAction(month: number, year: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const cycleInfo = getPayrollCycleDates(month, year);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const cycleStart = cycleInfo.startDate;
  const cycleEnd = cycleInfo.endDate;
  const queryStart = monthStart < cycleStart ? monthStart : cycleStart;
  const queryEnd = monthEnd > cycleEnd ? monthEnd : cycleEnd;

  const attendances = await prisma.attendance.findMany({
    where: {
      date: { gte: queryStart, lt: queryEnd },
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, position: true, department: true },
      },
    },
    orderBy: { date: "desc" },
  });

  return {
    success: true,
    attendances: attendances.map((att) => ({
      ...att,
      breakMinutes: Number(att.breakMinutes),
    })),
  };
}

/**
 * Récupère les pauses du jour de l'ensemble des collaborateurs en temps réel
 * avec le statut en cours, durée cumulée et dépassements.
 */
export async function getTodayAllUsersBreaksAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  // 1. Tous les employés actifs
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    include: {
      user: {
        select: { id: true, name: true, role: true, avatarUrl: true },
      },
    },
    orderBy: { lastName: "asc" },
  });

  // 2. Pointages d'aujourd'hui
  const attendances = await prisma.attendance.findMany({
    where: { date: todayStart },
  });
  const attMap = new Map(attendances.map((a) => [a.employeeId, a]));

  // 3. Audit logs de pause d'aujourd'hui
  const breakLogs = await prisma.auditLog.findMany({
    where: {
      action: { in: ["PAUSE_START", "PAUSE_END"] },
      createdAt: { gte: todayStart },
    },
    orderBy: { createdAt: "asc" },
  });

  const logsByUser = new Map<string, typeof breakLogs>();
  for (const log of breakLogs) {
    if (!log.userId) continue;
    if (!logsByUser.has(log.userId)) {
      logsByUser.set(log.userId, []);
    }
    logsByUser.get(log.userId)!.push(log);
  }

  const list: EmployeeTodayBreak[] = employees.map((emp) => {
    const userLogs = emp.userId ? logsByUser.get(emp.userId) || [] : [];
    const sessions = pairBreakLogs(userLogs, now);
    const ongoing = sessions.find((s) => s.isOngoing);
    const att = attMap.get(emp.id);

    const sumMinutes = sessions.reduce((acc, s) => acc + s.durationMinutes, 0);
    const totalBreakMinutes = Math.max(sumMinutes, att?.breakMinutes || 0);
    const currentElapsed = ongoing ? ongoing.durationMinutes : 0;
    const isOver = totalBreakMinutes > 40;
    const isCrit = ongoing ? ongoing.durationMinutes >= 120 : false;

    let clockInStr: string | null = att?.clockIn ? att.clockIn.toISOString() : null;
    let clockOutStr: string | null = att?.clockOut ? att.clockOut.toISOString() : null;

    return {
      employeeId: emp.id,
      userId: emp.userId,
      firstName: emp.firstName,
      lastName: emp.lastName,
      position: emp.position,
      department: emp.department,
      avatarUrl: emp.user?.avatarUrl || null,
      clockIn: clockInStr,
      clockOut: clockOutStr,
      status: att ? att.status : "ABSENT",
      isOnBreak: !!ongoing,
      currentBreakReason: ongoing?.reason || null,
      currentBreakElapsedMinutes: currentElapsed,
      currentBreakStartTime: ongoing?.startTime || null,
      totalBreakMinutes,
      sessionsCount: sessions.length,
      sessions: [...sessions].reverse(),
      isExceeded: isOver,
      isCritical: isCrit,
    };
  });

  const currentlyOnBreak = list.filter((e) => e.isOnBreak).length;
  const totalCompanyBreakMinutes = list.reduce((acc, e) => acc + e.totalBreakMinutes, 0);
  const exceededCount = list.filter((e) => e.isExceeded).length;
  const clockedInCount = list.filter((e) => Boolean(e.clockIn)).length;

  return {
    success: true,
    breaks: list,
    kpis: {
      totalEmployees: list.length,
      clockedInCount,
      currentlyOnBreak,
      totalCompanyBreakMinutes,
      exceededCount,
    },
  };
}

export async function submitLeaveRequestAction(data: {
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const leave = await prisma.leaveRequest.create({
    data: {
      employeeId: data.employeeId,
      type: data.type,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      daysCount: Math.max(1, Number(data.daysCount) || 1),
      reason: data.reason?.trim() || null,
      status: LeaveStatus.PENDING,
    },
  });

  revalidatePath("/rh");
  return { success: true, leaveId: leave.id };
}

export async function updateLeaveStatusAction(id: string, status: LeaveStatus) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      status,
      approvedById: user.id,
    },
  });

  try {
    await syncDailyAbsences({ daysBack: 35, includeToday: true });
    await calculateAndSyncPayroll();
  } catch (err) {
    console.error("Erreur auto-sync après décision de congé:", err);
  }

  revalidatePath("/rh");
  return { success: true };
}

export async function generatePayrollAction(month: number, year: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const cycleInfo = getPayrollCycleDates(month, year);
  if (!cycleInfo.isUnlocked) {
    throw new Error(
      `Le calcul de la paie pour ce cycle est accessible uniquement à partir du ${cycleInfo.displayStartDate}.`
    );
  }

  // Calculer et synchroniser les salaires avec déduction automatique (-1 jour par absence)
  const result = await calculateAndSyncPayroll(month, year);

  revalidatePath("/rh");
  return { success: true, count: result.count };
}

export async function syncPayrollDeductionsAction(month?: number, year?: number) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SALES_DIRECTOR" && user.role !== "HR")) {
    throw new Error("Accès réservé aux Administrateurs et aux RH");
  }

  await syncDailyAbsences({ daysBack: 35, includeToday: true });
  const result = await calculateAndSyncPayroll(month, year);

  revalidatePath("/rh");
  return result;
}

export async function markSalaryPaidAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  await prisma.salaryPayment.update({
    where: { id },
    data: {
      status: "PAID",
      paidAt: new Date(),
    },
  });

  revalidatePath("/rh");
  return { success: true };
}

/**
 * Attribue automatiquement une commission au collaborateur selon le pack signé :
 * - STARTER : 500 DA
 * - SILVER  : 1 000 DA
 * - GOLD    : 1 500 DA
 * Le montant est intégré directement dans la paie du mois où le contrat a été signé.
 */

/** Montants de commission par pack */
const PACK_COMMISSION_AMOUNTS: Record<string, number> = {
  STARTER: 500,
  SILVER: 1000,
  GOLD: 1500,
};

export async function awardClientSigningCommissionAction(params: {
  clientId: string;
  userId?: string | null;
  signedDate?: Date | string | null;
  offerType?: string | null;
}) {
  const { clientId, userId, signedDate, offerType: paramOfferType } = params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      companyName: true,
      assignedToId: true,
      contractStart: true,
      createdAt: true,
      offerType: true,
    },
  });

  if (!client) {
    return { success: false, reason: "Client introuvable" };
  }

  const targetUserId = userId || client.assignedToId;
  if (!targetUserId) {
    return { success: false, reason: "Aucun collaborateur assigné pour la commission" };
  }

  // 1. Vérifier si une commission de signature existe déjà pour ce client pour éviter les doublons
  const existingCommission = await prisma.commission.findFirst({
    where: {
      clientId: client.id,
      notes: { contains: "signature" },
    },
  });

  if (existingCommission) {
    return {
      success: true,
      alreadyAwarded: true,
      commissionId: existingCommission.id,
    };
  }

  // 2. S'assurer que le collaborateur a un profil Employé
  let employee = await prisma.employee.findUnique({
    where: { userId: targetUserId },
  });

  if (!employee) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      return { success: false, reason: "Utilisateur introuvable" };
    }

    const nameParts = user.name.trim().split(" ");
    const firstName = nameParts[0] || user.name;
    const lastName = nameParts.slice(1).join(" ") || "Commercial";

    employee = await prisma.employee.create({
      data: {
        userId: user.id,
        firstName,
        lastName,
        email: user.email,
        phone: user.phone,
        position: "Commercial(e) B2B",
        department: "COMMERCIAL",
        baseSalary: new Prisma.Decimal(45000),
        isActive: true,
      },
    });
  }

  // 3. Déterminer la date, le mois et l'année de signature
  let rawDate: Date;
  if (signedDate) {
    rawDate = new Date(signedDate);
  } else if (client.contractStart) {
    rawDate = new Date(client.contractStart);
  } else {
    rawDate = new Date(client.createdAt);
  }

  if (isNaN(rawDate.getTime())) {
    rawDate = new Date();
  }

  // Déterminer le cycle de paie correspondant (règle : cycle du 10 au 10)
  const cycle = getPayrollCycleForDate(rawDate);
  const signingMonth = cycle.month;
  const signingYear = cycle.year;
  const cycleInfo = getPayrollCycleDates(signingMonth, signingYear);

  // 4. Créer la commission selon le pack signé (STARTER=500, SILVER=1000, GOLD=1500)
  const resolvedOfferType = (paramOfferType || client.offerType || "STARTER").toUpperCase();
  const commissionAmount = PACK_COMMISSION_AMOUNTS[resolvedOfferType] ?? PACK_COMMISSION_AMOUNTS.STARTER;
  const commission = await prisma.commission.create({
    data: {
      employeeId: employee.id,
      clientId: client.id,
      amount: new Prisma.Decimal(commissionAmount),
      rateApplied: new Prisma.Decimal(0),
      status: "APPROVED",
      notes: `Commission de signature client Pack ${resolvedOfferType} (+${commissionAmount} DA) - ${client.companyName}`,
      earnedDate: rawDate,
    },
  });

  // 5. Intégrer directement dans la paie du cycle de paie (du 10 au 10)
  const empCommissions = await prisma.commission.aggregate({
    where: {
      employeeId: employee.id,
      earnedDate: { gte: cycleInfo.startDate, lt: cycleInfo.endDate },
    },
    _sum: { amount: true },
  });

  const totalCommAmount = Number(empCommissions._sum.amount || 0);

  const existingPayroll = await prisma.salaryPayment.findUnique({
    where: {
      employeeId_month_year: {
        employeeId: employee.id,
        month: signingMonth,
        year: signingYear,
      },
    },
  });

  if (existingPayroll) {
    const base = Number(existingPayroll.baseSalary);
    const deductions = Number(existingPayroll.deductions);
    const primes = Number(existingPayroll.primes);
    const bonuses = Number(existingPayroll.bonuses);
    const net = Math.max(0, Math.round(base + totalCommAmount + primes + bonuses - deductions));

    await prisma.salaryPayment.update({
      where: { id: existingPayroll.id },
      data: {
        commissions: new Prisma.Decimal(totalCommAmount),
        netSalary: new Prisma.Decimal(net),
      },
    });
  } else {
    const base = Number(employee.baseSalary);
    const net = Math.max(0, Math.round(base + totalCommAmount));

    await prisma.salaryPayment.create({
      data: {
        employeeId: employee.id,
        month: signingMonth,
        year: signingYear,
        baseSalary: employee.baseSalary,
        commissions: new Prisma.Decimal(totalCommAmount),
        primes: new Prisma.Decimal(0),
        bonuses: new Prisma.Decimal(0),
        deductions: new Prisma.Decimal(0),
        netSalary: new Prisma.Decimal(net),
        status: "DRAFT",
      },
    });
  }

  // 6. Journaliser dans l'audit log
  try {
    await prisma.auditLog.create({
      data: {
        userId: targetUserId,
        action: "COMMISSION_CLIENT_SIGNED",
        module: "HR",
        entityId: commission.id,
        details: JSON.stringify({
          clientName: client.companyName,
          amount: commissionAmount,
          month: signingMonth,
          year: signingYear,
          employeeName: `${employee.firstName} ${employee.lastName}`,
        }),
      },
    });
  } catch (err) {
    console.warn("Audit log creation skipped:", err);
  }

  try {
    revalidatePath("/rh");
    revalidatePath("/clients");
    revalidatePath("/dashboard");
  } catch {}

  return {
    success: true,
    commissionId: commission.id,
    amount: commissionAmount,
    month: signingMonth,
    year: signingYear,
    employeeName: `${employee.firstName} ${employee.lastName}`,
  };
}

/**
 * Synchronise et rétro-attribue les commissions selon le pack pour tous les clients signés
 * n'ayant pas encore reçu leur commission.
 */
export async function syncAllSignedClientsCommissionsAction() {
  const clients = await prisma.client.findMany({
    where: {
      assignedToId: { not: null },
    },
    select: {
      id: true,
      companyName: true,
      assignedToId: true,
      contractStart: true,
      createdAt: true,
      offerType: true,
    },
  });

  let awardedCount = 0;
  for (const c of clients) {
    const res = await awardClientSigningCommissionAction({
      clientId: c.id,
      userId: c.assignedToId,
      signedDate: c.contractStart || c.createdAt,
      offerType: c.offerType,
    });
    if (res.success && !res.alreadyAwarded) {
      awardedCount++;
    }
  }

  try {
    revalidatePath("/rh");
    revalidatePath("/clients");
  } catch {}
  return { success: true, count: awardedCount, totalClients: clients.length };
}
