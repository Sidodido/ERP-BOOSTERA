"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { CallResult, ProspectStatus, FollowUpStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { mapCallStatusToCallData } from "@/lib/utils";
import { syncSingleProspectFollowUp } from "@/actions/prospects";

export async function logCallAction(data: {
  prospectId?: string;
  clientId?: string;
  result: CallResult;
  comment?: string;
  durationSeconds?: number;
  autoScheduleFollowUp?: boolean;
}) {
  const user = await requireAuth();

  const call = await prisma.call.create({
    data: {
      prospectId: data.prospectId || null,
      clientId: data.clientId || null,
      userId: user.id,
      result: data.result,
      comment: data.comment?.trim() || null,
      durationSeconds: data.durationSeconds || 0,
      calledAt: new Date(),
    },
    include: {
      prospect: { select: { companyName: true } },
      client: { select: { companyName: true } },
    },
  });

  // Update prospect status and callStatus based on call outcome
  if (data.prospectId) {
    let newStatus: ProspectStatus | null = null;
    let callStatus = "EFFECTUE";
    let rawState: string | null = null;

    if (data.result === CallResult.INTERESTED) {
      newStatus = ProspectStatus.INTERESTED;
      rawState = "INTERESSE";
      callStatus = "EFFECTUE";
    } else if (data.result === CallResult.APPOINTMENT_BOOKED) {
      newStatus = ProspectStatus.MEETING_SCHEDULED;
      rawState = "RDV PRIS";
      callStatus = "EFFECTUE";
    } else if (data.result === CallResult.NOT_INTERESTED) {
      newStatus = ProspectStatus.NOT_INTERESTED;
      rawState = "PAS INTERESSE";
      callStatus = "EFFECTUE";
    } else if (data.result === CallResult.NO_ANSWER) {
      newStatus = ProspectStatus.CONTACTED;
      callStatus = "PAS DE REPONSE";
      rawState = "PAS DE CONTACT";
    } else if (data.result === CallResult.UNREACHABLE) {
      newStatus = ProspectStatus.CONTACTED;
      callStatus = "INJOIGNABLE";
      rawState = "PAS DE CONTACT";
    } else if (data.result === CallResult.CALLBACK_REQUESTED) {
      newStatus = ProspectStatus.CONTACTED;
      callStatus = "A RAPPELER";
      rawState = "A RAPPELER";
    }

    const updatePayload: any = {
      callStatus: callStatus,
      prospectionDate: new Date(),
    };
    if (newStatus) {
      updatePayload.status = newStatus;
    }
    if (rawState) {
      updatePayload.rawState = rawState;
    }
    if (data.comment?.trim()) {
      updatePayload.response = data.comment.trim();
    }

    await prisma.prospect.update({
      where: { id: data.prospectId },
      data: updatePayload,
    });

    // Auto-synchronisation immédiate et automatique des relances
    await syncSingleProspectFollowUp(data.prospectId, user.id);
  }

  await createAuditLog({
    userId: user.id,
    action: "LOG_CALL",
    module: "CALLS",
    entityId: call.id,
    details: {
      result: data.result,
      prospectId: data.prospectId,
      clientId: data.clientId,
      duration: data.durationSeconds,
    },
  });

  revalidatePath("/appels");
  revalidatePath("/prospection");
  revalidatePath("/relances");
  revalidatePath("/dashboard");
  revalidatePath("/equipes");
  return { success: true, call };
}

export async function getRecentCalls(limit = 50) {
  const user = await requireAuth();
  const isPrivileged = ["ADMIN", "SALES_DIRECTOR"].includes(user.role);

  const calls = await prisma.call.findMany({
    where: isPrivileged ? {} : { userId: user.id },
    include: {
      user: { select: { id: true, name: true, role: true } },
      prospect: { select: { id: true, companyName: true, phone: true, sector: true, wilaya: true } },
      client: { select: { id: true, companyName: true, phone: true } },
    },
    orderBy: { calledAt: "desc" },
    take: limit,
  });

  return calls;
}

export async function getCallStats() {
  const user = await requireAuth();
  const isPrivileged = ["ADMIN", "SALES_DIRECTOR"].includes(user.role);
  const whereFilter = isPrivileged ? {} : { userId: user.id };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [totalCalls, callsToday, answeredCalls, interestedCalls, appointmentsBooked] = await Promise.all([
    prisma.call.count({ where: whereFilter }),
    prisma.call.count({
      where: { ...whereFilter, calledAt: { gte: todayStart } },
    }),
    prisma.call.count({
      where: {
        ...whereFilter,
        result: {
          in: [
            CallResult.INTERESTED,
            CallResult.APPOINTMENT_BOOKED,
            CallResult.CALLBACK_REQUESTED,
            CallResult.NOT_INTERESTED,
          ],
        },
      },
    }),
    prisma.call.count({
      where: { ...whereFilter, result: CallResult.INTERESTED },
    }),
    prisma.appointment.count({
      where: isPrivileged ? {} : { userId: user.id },
    }),
  ]);

  const responseRate = totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0;
  const interestedRate = totalCalls > 0 ? Math.round((interestedCalls / totalCalls) * 100) : 0;
  const bookingRate = totalCalls > 0 ? Math.round((appointmentsBooked / totalCalls) * 100) : 0;

  // Breakdown by rep
  const repStats = await prisma.call.groupBy({
    by: ["userId"],
    where: isPrivileged ? {} : { userId: user.id },
    _count: { id: true },
  });

  const users = await prisma.user.findMany({
    where: { id: { in: repStats.map((r) => r.userId) } },
    select: { id: true, name: true },
  });

  const byRep = repStats.map((stat) => {
    const u = users.find((usr) => usr.id === stat.userId);
    return {
      userId: stat.userId,
      name: u?.name || "Utilisateur",
      count: stat._count.id,
    };
  });

  return {
    totalCalls,
    callsToday,
    answeredCalls,
    interestedCalls,
    appointmentsBooked,
    responseRate,
    interestedRate,
    bookingRate,
    byRep,
  };
}
