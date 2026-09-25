"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AttendanceStatus, DepartmentType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { calculateAndSyncPayroll } from "@/lib/payroll";

/**
 * Helper to ensure a User has an associated Employee profile
 */
async function ensureEmployeeForUser(userId: string) {
  let employee = await prisma.employee.findUnique({
    where: { userId },
  });

  if (!employee) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new Error("Utilisateur introuvable");

    const nameParts = user.name.trim().split(" ");
    const firstName = nameParts[0] || user.name;
    const lastName = nameParts.slice(1).join(" ") || "Collaborateur";

    // Map role to department & position
    let department: DepartmentType = "COMMERCIAL";
    let position = "Commercial B2B";

    switch (user.role) {
      case "SALES_REP":
        department = "COMMERCIAL";
        position = "Commercial(e) B2B";
        break;
      case "SALES_DIRECTOR":
        department = "COMMERCIAL";
        position = "Directeur Commercial";
        break;
      case "TECH_LEAD":
        department = "TECHNICAL";
        position = "Chef de Projet Technique";
        break;
      case "DEVELOPER":
        department = "DEVELOPMENT";
        position = "Développeur Full-Stack";
        break;
      case "DESIGNER":
        department = "DESIGN";
        position = "Designer UI/UX & Graphiste";
        break;
      case "VIDEO_EDITOR":
        department = "VIDEO";
        position = "Monteur Vidéo & Cadreur";
        break;
      case "ACCOUNTANT":
        department = "FINANCE";
        position = "Comptable & Trésorier";
        break;
      case "HR":
        department = "HR";
        position = "Responsable RH";
        break;
      case "ADMIN":
        department = "ADMINISTRATION";
        position = "Directeur Général";
        break;
      default:
        department = "COMMERCIAL";
        position = user.role;
    }

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
  }

  return employee;
}

/**
 * Normalizes a date to UTC midnight for exact matching against PostgreSQL @db.Date fields
 */
function getCalendarDateOnly(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Get attendance for today and recent history for the currently logged in user
 */
export async function getMyAttendanceAction() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      authenticated: false,
      today: null,
      recentHistory: [],
    };
  }

  const employee = await ensureEmployeeForUser(user.id);

  const now = new Date();
  const today = getCalendarDateOnly(now);

  // Today's record
  const todayAttendance = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId: employee.id,
        date: today,
      },
    },
  });

  // Recent 7 days history
  const recentHistory = await prisma.attendance.findMany({
    where: {
      employeeId: employee.id,
      date: { lt: today },
    },
    orderBy: { date: "desc" },
    take: 7,
  });

  // Calculate duration if clocked in
  let durationMinutes = 0;
  if (todayAttendance?.clockIn) {
    const end = todayAttendance.clockOut ? new Date(todayAttendance.clockOut) : now;
    durationMinutes = Math.max(
      0,
      Math.floor((end.getTime() - new Date(todayAttendance.clockIn).getTime()) / 60000)
    );
  }

  // Check active break status
  const recentBreakLogs = await prisma.auditLog.findMany({
    where: {
      userId: user.id,
      action: { in: ["PAUSE_START", "PAUSE_END"] },
      createdAt: { gte: today },
    },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  const activeBreak =
    recentBreakLogs.length > 0 && recentBreakLogs[0].action === "PAUSE_START"
      ? {
          isOnBreak: true,
          startTime: recentBreakLogs[0].createdAt.toISOString(),
          reason: (() => {
            try {
              const d = JSON.parse(recentBreakLogs[0].details || "{}");
              return d.reason || "Pause";
            } catch {
              return "Pause";
            }
          })(),
          elapsedMinutes: Math.max(
            0,
            Math.floor((now.getTime() - new Date(recentBreakLogs[0].createdAt).getTime()) / 60000)
          ),
        }
      : {
          isOnBreak: false,
          startTime: null,
          reason: null,
          elapsedMinutes: 0,
        };

  return {
    authenticated: true,
    employee: {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      position: employee.position,
      department: employee.department,
    },
    activeBreak,
    today: todayAttendance
      ? {
          id: todayAttendance.id,
          date: todayAttendance.date.toISOString(),
          clockIn: todayAttendance.clockIn ? todayAttendance.clockIn.toISOString() : null,
          clockOut: todayAttendance.clockOut ? todayAttendance.clockOut.toISOString() : null,
          status: todayAttendance.status,
          breakMinutes: todayAttendance.breakMinutes,
          durationMinutes,
          isClockedIn: !!todayAttendance.clockIn,
          isClockedOut: !!todayAttendance.clockOut,
        }
      : null,
    recentHistory: recentHistory.map((h) => {
      let dur = 0;
      if (h.clockIn && h.clockOut) {
        dur = Math.max(
          0,
          Math.floor((new Date(h.clockOut).getTime() - new Date(h.clockIn).getTime()) / 60000)
        );
      }
      return {
        id: h.id,
        date: h.date.toISOString(),
        clockIn: h.clockIn ? h.clockIn.toISOString() : null,
        clockOut: h.clockOut ? h.clockOut.toISOString() : null,
        status: h.status,
        durationMinutes: dur,
      };
    }),
  };
}

/**
 * Clock in (Je pointe mon arrivée)
 */
export async function clockInAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const employee = await ensureEmployeeForUser(user.id);

  const now = new Date();
  const today = getCalendarDateOnly(now);

  // Check if after 09:30 for late status
  const lateThreshold = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30, 0);
  const isLate = now > lateThreshold;
  const status: AttendanceStatus = isLate ? "LATE" : "PRESENT";

  const attendance = await prisma.attendance.upsert({
    where: {
      employeeId_date: {
        employeeId: employee.id,
        date: today,
      },
    },
    create: {
      employeeId: employee.id,
      date: today,
      clockIn: now,
      status,
    },
    update: {
      clockIn: now,
      clockOut: null,
      status,
      notes: isLate ? "Pointage en retard validé" : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "ATTENDANCE_CLOCK_IN",
      module: "HR",
      entityId: attendance.id,
      details: JSON.stringify({
        employeeName: `${employee.firstName} ${employee.lastName}`,
        clockIn: now.toISOString(),
        status,
      }),
    },
  });

  // Recalculer automatiquement les retenues du cycle pour lever la déduction d'absence d'aujourd'hui
  try {
    await calculateAndSyncPayroll();
  } catch (err) {
    console.error("Erreur auto-sync payroll après clockIn:", err);
  }

  revalidatePath("/dashboard");
  revalidatePath("/rh");
  revalidatePath("/parametres");
  return {
    success: true,
    clockIn: now.toISOString(),
    status,
    message: isLate
      ? `Arrivée enregistrée à ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} (En retard)`
      : `Arrivée enregistrée avec succès à ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
  };
}

/**
 * Clock out (Je pointe ma sortie)
 */
export async function clockOutAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const employee = await ensureEmployeeForUser(user.id);

  const now = new Date();
  const today = getCalendarDateOnly(now);

  const existing = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId: employee.id,
        date: today,
      },
    },
  });

  const clockInTime = existing?.clockIn || now;

  const attendance = await prisma.attendance.upsert({
    where: {
      employeeId_date: {
        employeeId: employee.id,
        date: today,
      },
    },
    create: {
      employeeId: employee.id,
      date: today,
      clockIn: now,
      clockOut: now,
      status: "PRESENT",
    },
    update: {
      clockOut: now,
      status: existing?.status === "LATE" ? "LATE" : "PRESENT",
    },
  });

  const durationMs = now.getTime() - new Date(clockInTime).getTime();
  const durationMinutes = Math.max(0, Math.floor(durationMs / 60000));
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "ATTENDANCE_CLOCK_OUT",
      module: "HR",
      entityId: attendance.id,
      details: JSON.stringify({
        employeeName: `${employee.firstName} ${employee.lastName}`,
        clockOut: now.toISOString(),
        durationMinutes,
      }),
    },
  });

  // Recalculer automatiquement les retenues du cycle
  try {
    await calculateAndSyncPayroll();
  } catch (err) {
    console.error("Erreur auto-sync payroll après clockOut:", err);
  }

  revalidatePath("/dashboard");
  revalidatePath("/rh");
  revalidatePath("/parametres");
  revalidatePath("/activites");
  return {
    success: true,
    clockOut: now.toISOString(),
    durationMinutes,
    message: `Sortie enregistrée à ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} • Temps de présence : ${hours}h ${minutes}min`,
  };
}

/**
 * Start a break / pause (Prendre une pause)
 */
export async function startBreakAction(reason: string = "Pause standard") {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const employee = await ensureEmployeeForUser(user.id);
  const now = new Date();
  const today = getCalendarDateOnly(now);

  const attendance = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId: employee.id,
        date: today,
      },
    },
  });

  if (!attendance || !attendance.clockIn) {
    throw new Error("Vous devez d'abord pointer votre arrivée pour prendre une pause.");
  }

  if (attendance.clockOut) {
    throw new Error("Votre journée de travail est déjà terminée.");
  }

  // Verify not already on break
  const lastBreakLog = await prisma.auditLog.findFirst({
    where: {
      userId: user.id,
      action: { in: ["PAUSE_START", "PAUSE_END"] },
      createdAt: { gte: today },
    },
    orderBy: { createdAt: "desc" },
  });

  if (lastBreakLog && lastBreakLog.action === "PAUSE_START") {
    throw new Error("Vous êtes déjà en pause.");
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "PAUSE_START",
      module: "HR",
      entityId: attendance.id,
      details: JSON.stringify({
        employeeName: `${employee.firstName} ${employee.lastName}`,
        reason,
        startTime: now.toISOString(),
      }),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/rh");
  revalidatePath("/activites");

  return {
    success: true,
    startTime: now.toISOString(),
    reason,
    message: `Pause « ${reason} » commencée à ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
  };
}

/**
 * End a break / pause (Reprendre le travail)
 */
export async function endBreakAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const employee = await ensureEmployeeForUser(user.id);
  const now = new Date();
  const today = getCalendarDateOnly(now);

  const attendance = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId: employee.id,
        date: today,
      },
    },
  });

  if (!attendance) {
    throw new Error("Fiche de présence introuvable");
  }

  // Find latest PAUSE_START
  const lastBreakStart = await prisma.auditLog.findFirst({
    where: {
      userId: user.id,
      action: "PAUSE_START",
      createdAt: { gte: today },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!lastBreakStart) {
    throw new Error("Aucune pause en cours trouvée.");
  }

  // Verify not already ended
  const lastBreakEnd = await prisma.auditLog.findFirst({
    where: {
      userId: user.id,
      action: "PAUSE_END",
      createdAt: { gt: lastBreakStart.createdAt },
    },
    orderBy: { createdAt: "desc" },
  });

  if (lastBreakEnd) {
    throw new Error("Aucune pause active en cours.");
  }

  let reason = "Pause";
  try {
    const d = JSON.parse(lastBreakStart.details || "{}");
    if (d.reason) reason = d.reason;
  } catch {}

  const durationMs = now.getTime() - new Date(lastBreakStart.createdAt).getTime();
  const durationMinutes = Math.max(1, Math.floor(durationMs / 60000));

  // Update attendance breakMinutes
  await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      breakMinutes: { increment: durationMinutes },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "PAUSE_END",
      module: "HR",
      entityId: attendance.id,
      details: JSON.stringify({
        employeeName: `${employee.firstName} ${employee.lastName}`,
        reason,
        startTime: lastBreakStart.createdAt.toISOString(),
        endTime: now.toISOString(),
        durationMinutes,
      }),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/rh");
  revalidatePath("/activites");

  return {
    success: true,
    durationMinutes,
    message: `Pause terminée (${durationMinutes} min). Bon retour au travail !`,
  };
}

/**
 * Get current break status for logged in user
 */
export async function getMyBreakStatusAction() {
  const user = await getCurrentUser();
  if (!user) return { isOnBreak: false, startTime: null, reason: null, elapsedMinutes: 0 };
  const now = new Date();
  const today = getCalendarDateOnly(now);

  const lastBreakLog = await prisma.auditLog.findFirst({
    where: {
      userId: user.id,
      action: { in: ["PAUSE_START", "PAUSE_END"] },
      createdAt: { gte: today },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!lastBreakLog || lastBreakLog.action !== "PAUSE_START") {
    return { isOnBreak: false, startTime: null, reason: null, elapsedMinutes: 0 };
  }

  let reason = "Pause";
  try {
    const d = JSON.parse(lastBreakLog.details || "{}");
    if (d.reason) reason = d.reason;
  } catch {}

  const elapsedMinutes = Math.max(
    0,
    Math.floor((now.getTime() - new Date(lastBreakLog.createdAt).getTime()) / 60000)
  );

  return {
    isOnBreak: true,
    startTime: lastBreakLog.createdAt.toISOString(),
    reason,
    elapsedMinutes,
  };
}

/**
 * Automatically sync absences for active employees who haven't clocked in and out
 * When an active collaborator does not record arrival and departure for a workday:
 * - If they have an approved leave during that date -> status: "ON_LEAVE"
 * - Otherwise -> status: "ABSENT" with notes: "Absence automatique - Aucun pointage enregistré"
 */
export async function syncDailyAbsences(options: {
  daysBack?: number;
  includeToday?: boolean;
} = {}) {
  const daysBack = options.daysBack ?? 35;
  const includeToday = options.includeToday ?? true;

  const now = new Date();
  const today = getCalendarDateOnly(now);

  // 1. Fetch all active employees
  const activeEmployees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, firstName: true, lastName: true, hireDate: true },
  });

  if (activeEmployees.length === 0) {
    return { createdCount: 0, updatedCount: 0, totalEvaluated: 0 };
  }

  // 2. Build array of dates to evaluate (excluding Fridays and Saturdays which are weekly rest days - chômés et payés)
  const datesToEvaluate: Date[] = [];
  for (let i = daysBack; i >= 1; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    // Friday = 5, Saturday = 6 (Week-end chômé et payé)
    if (d.getDay() !== 5 && d.getDay() !== 6) {
      datesToEvaluate.push(getCalendarDateOnly(d));
    }
  }

  if (includeToday && today.getDay() !== 5 && today.getDay() !== 6) {
    datesToEvaluate.push(today);
  }

  // 2b. Nettoyage proactif : supprimer toute absence automatique créée un vendredi ou un samedi
  try {
    const weekendAbsences = await prisma.attendance.findMany({
      where: {
        status: "ABSENT",
        clockIn: null,
        clockOut: null,
      },
      select: { id: true, date: true },
    });
    const weekendIdsToDelete = weekendAbsences
      .filter((a) => {
        const day = new Date(a.date).getDay();
        return day === 5 || day === 6;
      })
      .map((a) => a.id);

    if (weekendIdsToDelete.length > 0) {
      await prisma.attendance.deleteMany({
        where: { id: { in: weekendIdsToDelete } },
      });
    }
  } catch (cleanErr) {
    console.error("Erreur nettoyage absences weekend:", cleanErr);
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const targetDate of datesToEvaluate) {
    // Approved leaves for this date
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: { in: ["CONFIRMED_HR", "APPROVED_MANAGER"] },
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
      },
      select: { employeeId: true, type: true },
    });
    const leaveMap = new Map(approvedLeaves.map((l) => [l.employeeId, l.type]));

    // Existing attendances for this date
    const existingAttendances = await prisma.attendance.findMany({
      where: { date: targetDate },
      select: { id: true, employeeId: true, clockIn: true, clockOut: true, status: true, notes: true },
    });
    const attendanceMap = new Map(existingAttendances.map((a) => [a.employeeId, a]));

    for (const emp of activeEmployees) {
      // Don't evaluate dates prior to employee hire date
      if (emp.hireDate && targetDate < getCalendarDateOnly(new Date(emp.hireDate))) {
        continue;
      }

      const existing = attendanceMap.get(emp.id);
      const leaveType = leaveMap.get(emp.id);
      const isOnLeave = Boolean(leaveType);

      let leaveNote = "Absence autorisée (Congé validé)";
      if (leaveType === "ANNUAL") {
        leaveNote = "🌴 Congé Annuel (Chômé & Payé - 100% Salaire maintenu)";
      } else if (leaveType === "SICK") {
        leaveNote = "🩺 Congé Maladie (Non Rémunéré - Déduit du salaire / CNAS)";
      } else if (leaveType === "PERMISSION") {
        leaveNote = "⏱️ Permission non rémunérée (Déduit du salaire)";
      } else if (leaveType === "SPECIAL") {
        leaveNote = "🎉 Événement Familial Spécial (Chômé & Payé)";
      }

      if (!existing) {
        // Collaborator did NOT clock in or out on this day -> Auto mark as ABSENT or ON_LEAVE
        await prisma.attendance.create({
          data: {
            employeeId: emp.id,
            date: targetDate,
            clockIn: null,
            clockOut: null,
            status: isOnLeave ? "ON_LEAVE" : "ABSENT",
            notes: isOnLeave
              ? leaveNote
              : "Absence automatique - Aucun pointage d'arrivée ni de sortie",
          },
        });
        createdCount++;
      } else if (
        !existing.clockIn &&
        !existing.clockOut &&
        existing.status !== "HALF_DAY"
      ) {
        const targetStatus = isOnLeave ? "ON_LEAVE" : "ABSENT";
        const targetNotes = isOnLeave
          ? leaveNote
          : "Absence automatique - Aucun pointage d'arrivée ni de sortie";

        if (existing.status !== targetStatus || existing.notes !== targetNotes) {
          await prisma.attendance.update({
            where: { id: existing.id },
            data: {
              status: targetStatus,
              notes: targetNotes,
            },
          });
          updatedCount++;
        }
      }
    }
  }

  // Synchroniser automatiquement les salaires et retenues du cycle de paie en cours (-1 jour / absence)
  try {
    await calculateAndSyncPayroll();
  } catch (err) {
    console.error("Erreur auto-sync paie après sync absences:", err);
  }

  return {
    createdCount,
    updatedCount,
    totalEvaluated: activeEmployees.length * datesToEvaluate.length,
  };
}

/**
 * Server action for on-demand synchronization of absences
 */
export async function autoSyncDailyAbsencesAction(options?: {
  daysBack?: number;
  includeToday?: boolean;
}) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SALES_DIRECTOR" && user.role !== "HR")) {
    throw new Error("Accès réservé à la Direction et aux RH");
  }

  const result = await syncDailyAbsences(options);

  revalidatePath("/parametres");
  revalidatePath("/rh");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: `Synchronisation automatique terminée : ${result.createdCount} nouvelle(s) absence(s) enregistrée(s), ${result.updatedCount} mise(s) à jour.`,
    ...result,
  };
}
