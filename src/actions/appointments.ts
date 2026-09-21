"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { AppointmentType, AppointmentStatus, ProspectStatus, CallResult, FollowUpStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { dispatchAppointmentCreatedNotifications } from "@/actions/notifications";

export async function createAppointmentAction(data: {
  title: string;
  type: AppointmentType;
  startTime: string;
  endTime: string;
  durationMin?: number;
  location?: string;
  notes?: string;
  prospectId?: string;
  clientId?: string;
  assignedUserId?: string;
}) {
  const user = await requireAuth();

  const appt = await prisma.appointment.create({
    data: {
      title: data.title.trim(),
      type: data.type,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      durationMin: data.durationMin || 60,
      location: data.location?.trim() || null,
      notes: data.notes?.trim() || null,
      prospectId: data.prospectId || null,
      clientId: data.clientId || null,
      userId: data.assignedUserId || user.id,
      status: AppointmentStatus.SCHEDULED,
    },
    include: {
      prospect: { select: { companyName: true } },
      client: { select: { companyName: true } },
      user: { select: { name: true } },
    },
  });

  if (data.prospectId) {
    await prisma.prospect.update({
      where: { id: data.prospectId },
      data: {
        status: ProspectStatus.MEETING_SCHEDULED,
        rawState: "RDV PRIS",
        callStatus: "EFFECTUE",
        prospectionDate: new Date(),
      },
    });

    try {
      await prisma.call.create({
        data: {
          prospectId: data.prospectId,
          userId: user.id,
          result: CallResult.APPOINTMENT_BOOKED,
          comment: `Rendez-vous planifié : ${data.title.trim()} (${new Date(data.startTime).toLocaleString("fr-FR")})`,
          durationSeconds: 120,
          calledAt: new Date(),
        },
      });
    } catch (e) {
      console.warn("Call log for appointment skipped:", e);
    }
  }

  await createAuditLog({
    userId: user.id,
    action: "CREATE_APPOINTMENT",
    module: "APPOINTMENTS",
    entityId: appt.id,
    details: { title: appt.title, type: appt.type, date: appt.startTime },
  });

  // Notifier TOUS les collaborateurs
  try {
    await dispatchAppointmentCreatedNotifications({
      appointmentId: appt.id,
      title: appt.title,
      startTime: appt.startTime,
      creatorName: user.name,
      location: appt.location,
      prospectName: appt.prospect?.companyName || appt.client?.companyName || null,
      assignedUserName: appt.user?.name || null,
    });
  } catch (notifErr) {
    console.warn("Erreur envoi notification rendez-vous:", notifErr);
  }

  revalidatePath("/rendez-vous");
  revalidatePath("/prospection");
  revalidatePath("/appels");
  revalidatePath("/dashboard");
  revalidatePath("/equipes");
  return { success: true, appointment: appt };
}

export async function getAppointments(params: {
  userId?: string;
  month?: number;
  year?: number;
} = {}) {
  await requireAuth();

  const whereClause: any = {};
  if (params.userId && params.userId !== "ALL") {
    whereClause.userId = params.userId;
  }

  const appointments = await prisma.appointment.findMany({
    where: whereClause,
    include: {
      user: { select: { id: true, name: true } },
      prospect: {
        select: {
          id: true,
          companyName: true,
          phone: true,
          sector: true,
          status: true,
          address: true,
          email: true,
          notes: true,
          response: true,
          callStatus: true,
        },
      },
      client: { select: { id: true, companyName: true, phone: true } },
    },
    orderBy: { startTime: "asc" },
  });

  return appointments;
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  notes?: string
) {
  const user = await requireAuth();

  const existing = await prisma.appointment.findUnique({
    where: { id },
    include: { prospect: true },
  });

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      status,
      notes: notes !== undefined && notes.trim() !== "" ? notes.trim() : existing?.notes,
    },
  });

  // Automatically schedule +3j, +7j, +15j followups when RDV is Effectué or Annulé
  if (
    existing?.prospectId &&
    (status === AppointmentStatus.COMPLETED || status === AppointmentStatus.CANCELLED)
  ) {
    const prospectId = existing.prospectId;
    const now = new Date();
    const isCompleted = status === AppointmentStatus.COMPLETED;
    const typeLabel = isCompleted ? "RDV EFFECTUÉ" : "RDV ANNULÉ";
    const remarkClean = notes?.trim() || (isCompleted ? "Rendez-vous effectué" : "Rendez-vous annulé");

    // Update prospect with remark and state
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        notes: remarkClean,
        rawState: isCompleted ? "RDV EFFECTUE" : "RDV ANNULE",
        callStatus: "EFFECTUE",
      },
    });

    try {
      await prisma.call.create({
        data: {
          prospectId,
          userId: user.id,
          result: isCompleted ? CallResult.INTERESTED : CallResult.NOT_INTERESTED,
          comment: `[${typeLabel}] ${remarkClean}`,
          durationSeconds: isCompleted ? 300 : 60,
          calledAt: now,
        },
      });
    } catch (e) {
      console.warn("Call log skipped:", e);
    }

    // Automatically create 3 follow-ups (+3j, +7j, +15j)
    const day3 = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3);
    const day7 = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7);
    const day15 = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 15);

    // Étape 1 (+3j)
    await prisma.followUp.create({
      data: {
        prospectId,
        userId: existing.userId || user.id,
        stepNumber: 1,
        scheduledAt: day3,
        status: FollowUpStatus.SCHEDULED,
        notes: `[${typeLabel} +3j] ${remarkClean}`,
      },
    });

    // Étape 2 (+7j)
    await prisma.followUp.create({
      data: {
        prospectId,
        userId: existing.userId || user.id,
        stepNumber: 2,
        scheduledAt: day7,
        status: FollowUpStatus.SCHEDULED,
        notes: `[${typeLabel} +7j] Relance Étape 2 — ${remarkClean}`,
      },
    });

    // Étape 3 (+15j)
    await prisma.followUp.create({
      data: {
        prospectId,
        userId: existing.userId || user.id,
        stepNumber: 3,
        scheduledAt: day15,
        status: FollowUpStatus.SCHEDULED,
        notes: `[${typeLabel} +15j] Relance Étape 3 (Finale) — ${remarkClean}`,
      },
    });
  }

  await createAuditLog({
    userId: user.id,
    action: "UPDATE_APPOINTMENT_STATUS",
    module: "APPOINTMENTS",
    entityId: id,
    details: { status, notes },
  });

  revalidatePath("/rendez-vous");
  revalidatePath("/relances");
  revalidatePath("/prospection");
  revalidatePath("/appels");
  revalidatePath("/dashboard");
  return { success: true, appointment: updated };
}

export async function rescheduleAppointmentAction(data: {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string; // HH:mm
  durationMin?: number;
  notes?: string;
}) {
  const user = await requireAuth();

  const startDateTime = new Date(`${data.date}T${data.startTime}:00`);
  const endDateTime = data.endTime
    ? new Date(`${data.date}T${data.endTime}:00`)
    : new Date(startDateTime.getTime() + (data.durationMin || 60) * 60 * 1000);

  const existing = await prisma.appointment.findUnique({ where: { id: data.id } });

  const updated = await prisma.appointment.update({
    where: { id: data.id },
    data: {
      startTime: startDateTime,
      endTime: endDateTime,
      durationMin: data.durationMin || 60,
      notes: data.notes !== undefined && data.notes.trim() !== "" ? data.notes.trim() : existing?.notes,
      status: AppointmentStatus.SCHEDULED, // Reset to scheduled on reschedule
    },
    include: {
      user: { select: { id: true, name: true } },
      prospect: {
        select: {
          id: true,
          companyName: true,
          phone: true,
          sector: true,
          status: true,
          address: true,
          email: true,
          notes: true,
          response: true,
          callStatus: true,
        },
      },
      client: { select: { id: true, companyName: true, phone: true } },
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "RESCHEDULE_APPOINTMENT",
    module: "APPOINTMENTS",
    entityId: data.id,
    details: { newStart: startDateTime, newEnd: endDateTime },
  });

  revalidatePath("/rendez-vous");
  revalidatePath("/prospection");
  revalidatePath("/appels");
  return { success: true, appointment: updated };
}

export async function getPostAppointmentFollowUps(params: {
  userId?: string;
} = {}) {
  const user = await requireAuth();

  const whereClause: any = {};
  if (params.userId && params.userId !== "ALL") {
    whereClause.userId = params.userId;
  }

  // Ensure any completed or cancelled appointment has its 3 follow-up steps
  try {
    const finishedAppts = await prisma.appointment.findMany({
      where: {
        status: { in: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED] },
        prospectId: { not: null },
      },
      include: {
        prospect: {
          include: {
            followUps: true,
          },
        },
      },
    });

    for (const appt of finishedAppts) {
      if (appt.prospect && appt.prospect.followUps.length === 0) {
        const isCompleted = appt.status === AppointmentStatus.COMPLETED;
        const typeLabel = isCompleted ? "RDV EFFECTUÉ" : "RDV ANNULÉ";
        const remark = appt.notes || (isCompleted ? "Rendez-vous effectué" : "Rendez-vous annulé");
        const refDate = appt.startTime || new Date();

        await prisma.followUp.createMany({
          data: [
            {
              prospectId: appt.prospect.id,
              userId: appt.userId || user.id,
              stepNumber: 1,
              scheduledAt: new Date(refDate.getTime() + 1000 * 60 * 60 * 24 * 3),
              status: FollowUpStatus.SCHEDULED,
              notes: `[${typeLabel} +3j] ${remark}`,
            },
            {
              prospectId: appt.prospect.id,
              userId: appt.userId || user.id,
              stepNumber: 2,
              scheduledAt: new Date(refDate.getTime() + 1000 * 60 * 60 * 24 * 7),
              status: FollowUpStatus.SCHEDULED,
              notes: `[${typeLabel} +7j] Relance Étape 2 — ${remark}`,
            },
            {
              prospectId: appt.prospect.id,
              userId: appt.userId || user.id,
              stepNumber: 3,
              scheduledAt: new Date(refDate.getTime() + 1000 * 60 * 60 * 24 * 15),
              status: FollowUpStatus.SCHEDULED,
              notes: `[${typeLabel} +15j] Relance Étape 3 (Finale) — ${remark}`,
            },
          ],
        });
      }
    }
  } catch (e) {
    console.warn("Auto sync post appointment followups error:", e);
  }

  const followUps = await prisma.followUp.findMany({
    where: {
      ...whereClause,
      prospect: {
        appointments: {
          some: {},
        },
      },
    },
    include: {
      prospect: {
        include: {
          assignedTo: { select: { id: true, name: true } },
          appointments: {
            select: { id: true, status: true, title: true, startTime: true, notes: true },
            orderBy: { startTime: "desc" },
          },
        },
      },
      user: { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return followUps;
}

export async function deleteAppointmentAction(id: string) {
  const user = await requireAuth();

  const existing = await prisma.appointment.findUnique({
    where: { id },
    include: { prospect: true },
  });

  if (!existing) {
    return { error: "Rendez-vous introuvable." };
  }

  // Delete the appointment
  await prisma.appointment.delete({
    where: { id },
  });

  // If associated with a prospect, check if other appointments remain
  if (existing.prospectId) {
    const remainingAppts = await prisma.appointment.count({
      where: { prospectId: existing.prospectId },
    });

    if (remainingAppts === 0) {
      if (
        existing.prospect?.status === ProspectStatus.MEETING_SCHEDULED ||
        existing.prospect?.rawState?.includes("RDV")
      ) {
        await prisma.prospect.update({
          where: { id: existing.prospectId },
          data: {
            status: ProspectStatus.NEW,
            rawState: null,
          },
        });
      }
    }
  }

  try {
    await createAuditLog({
      userId: user.id,
      action: "DELETE_APPOINTMENT",
      module: "APPOINTMENTS",
      entityId: id,
      details: { title: existing.title, date: existing.startTime },
    });
  } catch (auditErr) {
    console.warn("Audit log error on appointment deletion:", auditErr);
  }

  revalidatePath("/rendez-vous");
  revalidatePath("/prospection");
  revalidatePath("/appels");
  revalidatePath("/dashboard");
  revalidatePath("/relances");

  return { success: true };
}

