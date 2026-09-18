"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  DepartmentType,
  AttendanceStatus,
  LeaveType,
  LeaveStatus,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { syncDailyAbsences } from "./attendance";
import {
  getPayrollCycleDates,
  getPayrollCycleForDate,
  getAvailablePayrollCycles,
} from "@/lib/payroll";

export async function getRhDataAction(monthParam?: number, yearParam?: number) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SALES_DIRECTOR" && user.role !== "HR")) {
    throw new Error("Accès réservé aux Administrateurs et aux RH");
  }

  // Auto-sync absences
  try {
    await syncDailyAbsences({ daysBack: 3, includeToday: true });
  } catch (err) {
    console.error("Erreur auto-sync absences RH:", err);
  }

  const now = new Date();
  const defaultCycle = getPayrollCycleForDate(now);
  const currentMonth = monthParam || defaultCycle.month;
  const currentYear = yearParam || defaultCycle.year;
  const cycleInfo = getPayrollCycleDates(currentMonth, currentYear);

  // 1. Employees Directory
  const employees = await prisma.employee.findMany({
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, avatarUrl: true },
      },
    },
    orderBy: { lastName: "asc" },
  });

  // 2. Today's Attendances
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
    leaveRequests,
    salaryPayments: salaryPayments.map((sp) => ({
      ...sp,
      baseSalary: Number(sp.baseSalary),
      primes: Number(sp.primes),
      commissions: Number(sp.commissions),
      bonuses: Number(sp.bonuses),
      deductions: Number(sp.deductions),
      netSalary: Number(sp.netSalary),
      employee: {
        ...sp.employee,
        baseSalary: Number(sp.employee.baseSalary),
      },
    })),
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
      absentToday: attendances.filter((a) => a.status === "ABSENT").length,
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
    } else {
      const generatedEmail =
        data.email?.trim().toLowerCase() ||
        `${data.firstName.toLowerCase()}.${data.lastName.toLowerCase()}@boostera.dz`;
      const newUser = await prisma.user.create({
        data: {
          name: `${data.firstName} ${data.lastName}`,
          email: generatedEmail,
          passwordHash: "$2b$10$dummyhashchangeonlogin",
          role: "SALES_REP",
          phone: data.phone || null,
        },
      });
      targetUserId = newUser.id;
    }
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
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let clockInDate: Date | null = null;
  if (data.clockInTime) {
    const [hours, minutes] = data.clockInTime.split(":").map(Number);
    clockInDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  } else if (data.status === "PRESENT" || data.status === "LATE") {
    clockInDate = now;
  }

  const attendance = await prisma.attendance.upsert({
    where: {
      employeeId_date: {
        employeeId: data.employeeId,
        date: today,
      },
    },
    create: {
      employeeId: data.employeeId,
      date: today,
      status: data.status,
      clockIn: clockInDate,
      notes: data.notes || null,
    },
    update: {
      status: data.status,
      clockIn: clockInDate || undefined,
      notes: data.notes || undefined,
    },
  });

  revalidatePath("/rh");
  return { success: true, attendanceId: attendance.id };
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

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
  });

  const { startDate, endDate } = cycleInfo;

  let generatedCount = 0;

  for (const emp of employees) {
    // 1. Sum commissions for this employee in this cycle (du 10 au 10)
    const empCommissions = await prisma.commission.aggregate({
      where: {
        employeeId: emp.id,
        earnedDate: { gte: startDate, lt: endDate },
      },
      _sum: { amount: true },
    });

    const commAmount = Number(empCommissions._sum.amount || 0);
    const base = Number(emp.baseSalary);

    // Taux journalier de référence (standard légal de 22 jours ouvrables par mois)
    const workingDaysDivisor = 22;
    const dailyRate = base > 0 ? base / workingDaysDivisor : 0;

    // 2. Fetch approved leaves overlapping this cycle
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

      // Count working days in overlap (excluding Friday rest day)
      let count = 0;
      const cur = new Date(leaveStart.getFullYear(), leaveStart.getMonth(), leaveStart.getDate());
      const last = new Date(leaveEnd.getFullYear(), leaveEnd.getMonth(), leaveEnd.getDate());

      while (cur <= last) {
        if (cur.getDay() !== 5) { // 5 = Friday
          count++;
        }
        cur.setDate(cur.getDate() + 1);
      }

      const effectiveDays = Math.max(1, Math.min(count, leave.daysCount));

      if (leave.type === "SICK") {
        // Congé Maladie : Non payé par l'employeur (couvert par la sécurité sociale CNAS) -> Déduit
        sickDays += effectiveDays;
      } else if (leave.type === "ANNUAL") {
        // Congé Annuel : Chômé et Payé à 100% -> 0 DA déduit (maintien intégral du salaire)
        annualDays += effectiveDays;
      } else if (leave.type === "PERMISSION") {
        // Permission courte non rémunérée -> Déduit
        permissionDays += effectiveDays;
      }
    }

    // 3. Count unexcused absences from Attendance (status === "ABSENT") in this cycle
    const absentAttendances = await prisma.attendance.findMany({
      where: {
        employeeId: emp.id,
        date: { gte: startDate, lt: endDate },
        status: "ABSENT",
      },
      select: { date: true },
    });

    // Prevent double counting if an absence record coincides with an approved leave
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

    // Règle RH & Droit du Travail :
    // - Congé Annuel : Chômé & Payé -> 0 DA de retenue (salaire fixe 100% maintenu)
    // - Congé Maladie : Non rémunéré par l'employeur -> Déduit du salaire mensuel
    // - Permissions et Absences non justifiées -> Déduites
    const deductibleDays = sickDays + permissionDays + unexcusedAbsences;
    const deductions = Math.min(base, Math.round(deductibleDays * dailyRate));
    const net = Math.max(0, Math.round(base + commAmount - deductions));

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
        baseSalary: emp.baseSalary,
        commissions: new Prisma.Decimal(commAmount),
        primes: new Prisma.Decimal(0),
        bonuses: new Prisma.Decimal(0),
        deductions: new Prisma.Decimal(deductions),
        netSalary: new Prisma.Decimal(net),
        status: "DRAFT",
      },
      update: {
        baseSalary: emp.baseSalary,
        commissions: new Prisma.Decimal(commAmount),
        deductions: new Prisma.Decimal(deductions),
        netSalary: new Prisma.Decimal(net),
      },
    });

    generatedCount++;
  }

  revalidatePath("/rh");
  return { success: true, count: generatedCount };
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
 * Attribue automatiquement une commission fixe de 500 DA au collaborateur
 * lorsqu'il signe un contrat avec un client, et intègre ce montant directement
 * dans la paie du mois où le contrat a été signé.
 */
export async function awardClientSigningCommissionAction(params: {
  clientId: string;
  userId?: string | null;
  signedDate?: Date | string | null;
}) {
  const { clientId, userId, signedDate } = params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      companyName: true,
      assignedToId: true,
      contractStart: true,
      createdAt: true,
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

  // 4. Créer la commission de 500 DA
  const commissionAmount = 500;
  const commission = await prisma.commission.create({
    data: {
      employeeId: employee.id,
      clientId: client.id,
      amount: new Prisma.Decimal(commissionAmount),
      rateApplied: new Prisma.Decimal(0),
      status: "APPROVED",
      notes: `Commission de signature client (+500 DA) - ${client.companyName}`,
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
 * Synchronise et rétro-attribue les commissions de 500 DA pour tous les clients signés
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
    },
  });

  let awardedCount = 0;
  for (const c of clients) {
    const res = await awardClientSigningCommissionAction({
      clientId: c.id,
      userId: c.assignedToId,
      signedDate: c.contractStart || c.createdAt,
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
