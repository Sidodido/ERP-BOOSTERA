"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Role, CommissionRuleType, AttendanceStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { syncDailyAbsences } from "./attendance";

export async function getSettingsDataAction() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SALES_DIRECTOR")) {
    throw new Error("Accès réservé à la Direction et aux Administrateurs");
  }

  // Auto-sync absences for active collaborators without pointage
  try {
    await syncDailyAbsences({ daysBack: 7, includeToday: true });
  } catch (err) {
    console.error("Erreur auto-sync absences:", err);
  }

  // 1. Users
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // 2. Commission Rules
  const commissionRules = await prisma.commissionRule.findMany({
    orderBy: { createdAt: "asc" },
  });

  // 3. Audit Logs (Recent 50)
  const auditLogs = await prisma.auditLog.findMany({
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // 4. Global Attendances for the Administrator
  const attendances = await prisma.attendance.findMany({
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
          department: true,
          phone: true,
          email: true,
        },
      },
    },
    orderBy: [{ date: "desc" }, { clockIn: "desc" }],
    take: 200,
  });

  // 5. Active Employees list
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
      department: true,
    },
    orderBy: { lastName: "asc" },
  });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const todayAttendances = attendances.filter(
    (a) => new Date(a.date).toDateString() === today.toDateString()
  );

  const todayPresent = todayAttendances.filter(
    (a) => (a.status === "PRESENT" || a.status === "LATE") && a.clockIn !== null
  ).length;
  const todayCompleted = todayAttendances.filter((a) => a.clockOut !== null).length;
  const todayLates = todayAttendances.filter((a) => a.status === "LATE").length;
  const todayAbsents = todayAttendances.filter((a) => a.status === "ABSENT").length;

  return {
    users,
    commissionRules: commissionRules.map((cr) => ({
      ...cr,
      ratePercentage: Number(cr.ratePercentage),
    })),
    auditLogs: auditLogs.map((log) => ({
      ...log,
      details: log.details ? log.details : null,
    })),
    attendances: attendances.map((a) => {
      let durationMinutes = 0;
      if (a.clockIn && a.clockOut) {
        durationMinutes = Math.max(
          0,
          Math.floor((new Date(a.clockOut).getTime() - new Date(a.clockIn).getTime()) / 60000)
        );
      } else if (a.clockIn && new Date(a.date).toDateString() === today.toDateString()) {
        durationMinutes = Math.max(
          0,
          Math.floor((now.getTime() - new Date(a.clockIn).getTime()) / 60000)
        );
      }

      return {
        id: a.id,
        employeeId: a.employeeId,
        date: a.date.toISOString(),
        clockIn: a.clockIn ? a.clockIn.toISOString() : null,
        clockOut: a.clockOut ? a.clockOut.toISOString() : null,
        status: a.status,
        notes: a.notes,
        durationMinutes,
        employee: a.employee,
      };
    }),
    employees,
    attendanceStats: {
      totalRecorded: attendances.length,
      todayCount: todayPresent,
      todayCompleted,
      todayLates,
      todayAbsents,
    },
    agencyConfig: {
      name: "BOOSTERA Agency",
      address: "Kouba, Alger, Algérie",
      phone: "+213 (0) 550 00 00 00",
      email: "contact@boostera.dz",
      currency: "DA (Dinar Algérien)",
      defaultVatRate: 0,
      baridiMobRip: "00799999002233445521",
    },
  };
}

export async function adminSaveAttendanceAction(data: {
  employeeId: string;
  date: string;
  clockInTime?: string;
  clockOutTime?: string;
  status: AttendanceStatus;
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SALES_DIRECTOR")) {
    throw new Error("Accès réservé à la direction");
  }

  const [y, m, d] = data.date.split("-").map(Number);
  const dateOnly = new Date(Date.UTC(y, m - 1, d));

  let clockInDate: Date | null = null;
  if (data.clockInTime) {
    const [h, min] = data.clockInTime.split(":").map(Number);
    clockInDate = new Date(y, m - 1, d, h, min, 0);
  }

  let clockOutDate: Date | null = null;
  if (data.clockOutTime) {
    const [h, min] = data.clockOutTime.split(":").map(Number);
    clockOutDate = new Date(y, m - 1, d, h, min, 0);
  }

  const attendance = await prisma.attendance.upsert({
    where: {
      employeeId_date: {
        employeeId: data.employeeId,
        date: dateOnly,
      },
    },
    create: {
      employeeId: data.employeeId,
      date: dateOnly,
      clockIn: clockInDate,
      clockOut: clockOutDate,
      status: data.status,
      notes: data.notes || null,
    },
    update: {
      clockIn: clockInDate !== null ? clockInDate : undefined,
      clockOut: clockOutDate !== null ? clockOutDate : undefined,
      status: data.status,
      notes: data.notes !== undefined ? data.notes : undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "ADMIN_ADJUST_ATTENDANCE",
      module: "HR",
      entityId: attendance.id,
      details: JSON.stringify({
        employeeId: data.employeeId,
        date: data.date,
        clockInTime: data.clockInTime,
        clockOutTime: data.clockOutTime,
        status: data.status,
      }),
    },
  });

  revalidatePath("/parametres");
  revalidatePath("/rh");
  revalidatePath("/dashboard");
  return { success: true, attendanceId: attendance.id };
}

export async function adminDeleteAttendanceAction(id: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    throw new Error("Accès réservé à l'administrateur");
  }

  await prisma.attendance.delete({
    where: { id },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "ADMIN_DELETE_ATTENDANCE",
      module: "HR",
      entityId: id,
      details: JSON.stringify({ attendanceId: id }),
    },
  });

  revalidatePath("/parametres");
  revalidatePath("/rh");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function createUserAction(data: {
  name: string;
  email: string;
  password?: string;
  role: Role;
  phone?: string;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    throw new Error("Permission refusée");
  }

  const email = data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Cet email est déjà utilisé");

  const newUser = await prisma.user.create({
    data: {
      name: data.name.trim(),
      email,
      passwordHash: "$2b$10$defaultHashForStaffChangeOnFirstLogin",
      role: data.role,
      phone: data.phone?.trim() || null,
      isActive: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "CREATE",
      module: "AUTH",
      entityId: newUser.id,
      details: JSON.stringify({ email, role: data.role, name: data.name }),
    },
  });

  revalidatePath("/parametres");
  return { success: true, userId: newUser.id };
}

export async function updateUserAction(
  id: string,
  data: Partial<{
    name: string;
    role: Role;
    phone: string;
    isActive: boolean;
  }>
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    throw new Error("Permission refusée");
  }

  await prisma.user.update({
    where: { id },
    data,
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "UPDATE",
      module: "AUTH",
      entityId: id,
      details: JSON.stringify(data),
    },
  });

  revalidatePath("/parametres");
  return { success: true };
}

export async function createCommissionRuleAction(data: {
  name: string;
  ruleType: CommissionRuleType;
  ratePercentage: number;
  description?: string;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    throw new Error("Permission refusée");
  }

  const rule = await prisma.commissionRule.create({
    data: {
      name: data.name.trim(),
      ruleType: data.ruleType,
      ratePercentage: new Prisma.Decimal(Number(data.ratePercentage)),
      description: data.description?.trim() || null,
      isActive: true,
    },
  });

  revalidatePath("/parametres");
  return { success: true, ruleId: rule.id };
}

export async function updateCommissionRuleAction(
  id: string,
  data: Partial<{
    name: string;
    ratePercentage: number;
    isActive: boolean;
    description: string;
  }>
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    throw new Error("Permission refusée");
  }

  const updateData: Prisma.CommissionRuleUpdateInput = {};
  if (data.name) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.ratePercentage !== undefined)
    updateData.ratePercentage = new Prisma.Decimal(data.ratePercentage);

  await prisma.commissionRule.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/parametres");
  return { success: true };
}
