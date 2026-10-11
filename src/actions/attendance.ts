"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AttendanceStatus, DepartmentType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { calculateAndSyncPayroll, syncDailyAbsences, getCalendarDateOnly } from "@/lib/payroll";
export { syncDailyAbsences };

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

// Note: syncDailyAbsences est défini dans @/lib/payroll et ré-exporté au sommet de ce fichier

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
