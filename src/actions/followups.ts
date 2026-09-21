"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { FollowUpStatus, ProspectStatus, CallResult, AppointmentType, AppointmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { autoSyncFollowUpsInternal } from "@/actions/prospects";

export async function getFollowUps(params: { status?: FollowUpStatus; userId?: string } = {}) {
  const user = await requireAuth();

  // Actualisation automatique transparente des relances
  try {
    await autoSyncFollowUpsInternal(user.id);
  } catch (syncErr) {
    console.error("Auto-sync follow-ups error in getFollowUps:", syncErr);
  }
  const isPrivileged = ["ADMIN", "SALES_DIRECTOR"].includes(user.role);

  const whereClause: any = {};
  if (!isPrivileged) {
    whereClause.userId = user.id;
  } else if (params.userId) {
    whereClause.userId = params.userId;
  }

  if (params.status) {
    whereClause.status = params.status;
  }

  const followUps = await prisma.followUp.findMany({
    where: whereClause,
    include: {
      prospect: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          phone: true,
          sector: true,
          wilaya: true,
          address: true,
          notes: true,
          response: true,
          rawState: true,
          callStatus: true,
        },
      },
      user: { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return followUps;
}

export async function updateFollowUpStatus(
  id: string,
  status: FollowUpStatus,
  notes?: string
) {
  const user = await requireAuth();

  const updated = await prisma.followUp.update({
    where: { id },
    data: {
      status,
      notes: notes !== undefined ? notes : undefined,
      completedAt: status === FollowUpStatus.COMPLETED ? new Date() : undefined,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE_FOLLOWUP_STATUS",
    module: "FOLLOWUPS",
    entityId: id,
    details: { status, notes },
  });

  revalidatePath("/relances");
  revalidatePath("/prospection");
  revalidatePath("/dashboard");
  return { success: true, followUp: updated };
}

export async function createManualFollowUp(data: {
  prospectId: string;
  stepNumber: number;
  scheduledAt: string;
  notes?: string;
}) {
  const user = await requireAuth();

  const created = await prisma.followUp.create({
    data: {
      prospectId: data.prospectId,
      userId: user.id,
      stepNumber: data.stepNumber,
      scheduledAt: new Date(data.scheduledAt),
      status: FollowUpStatus.SCHEDULED,
      notes: data.notes?.trim() || null,
    },
  });

  revalidatePath("/relances");
  revalidatePath("/prospection");
  return { success: true, followUp: created };
}

export async function rescheduleFollowUpAction(data: {
  followUpId: string;
  scheduledAt: string;
  notes?: string;
}) {
  const user = await requireAuth();

  const current = await prisma.followUp.findUnique({
    where: { id: data.followUpId },
    include: { prospect: true },
  });

  if (!current) {
    throw new Error("Relance introuvable.");
  }

  const rawDateStr = data.scheduledAt.trim();
  let newDate: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDateStr)) {
    const [y, m, d] = rawDateStr.split("-").map(Number);
    newDate = new Date(y, m - 1, d, 10, 0, 0);
  } else {
    newDate = new Date(rawDateStr);
    if (newDate.getHours() === 0 && newDate.getMinutes() === 0) {
      newDate.setHours(10, 0, 0, 0);
    }
  }

  const updatedNotes = data.notes?.trim() ? data.notes.trim() : current.notes;

  const updated = await prisma.followUp.update({
    where: { id: data.followUpId },
    data: {
      scheduledAt: newDate,
      status: FollowUpStatus.SCHEDULED,
      notes: updatedNotes,
    },
  });

  if (current.prospectId) {
    await prisma.prospect.update({
      where: { id: current.prospectId },
      data: {
        rawState: "A RAPPELER",
        callStatus: "A RAPPELER",
        response: `Reporté au ${newDate.toLocaleDateString("fr-FR")}`,
        notes: updatedNotes || undefined,
      },
    });

    try {
      await prisma.call.create({
        data: {
          prospectId: current.prospectId,
          userId: user.id,
          result: CallResult.CALLBACK_REQUESTED,
          comment: `Relance reportée au ${newDate.toLocaleDateString("fr-FR")} : ${updatedNotes || ""}`,
          durationSeconds: 60,
          calledAt: new Date(),
        },
      });
    } catch (e) {
      console.warn("Call log creation skipped:", e);
    }

    // Programmer automatiquement dans le calendrier (RDV Téléphonique)
    try {
      const endDateTime = new Date(newDate.getTime() + 30 * 60 * 1000);
      await prisma.appointment.create({
        data: {
          title: `Relance RDV (Reportée) — ${current.prospect?.companyName || "Prospect"}`,
          type: AppointmentType.PHONE,
          status: AppointmentStatus.SCHEDULED,
          startTime: newDate,
          endTime: endDateTime,
          durationMin: 30,
          location: current.prospect?.wilaya || "Téléphone / Bureau",
          notes: updatedNotes || `Relance commerciale reportée au ${newDate.toLocaleDateString("fr-FR")}`,
          prospectId: current.prospectId,
          userId: current.userId || user.id,
        },
      });
    } catch (e) {
      console.warn("Could not create calendar appointment for rescheduled followup:", e);
    }
  }

  await createAuditLog({
    userId: user.id,
    action: "RESCHEDULE_FOLLOWUP",
    module: "FOLLOWUPS",
    entityId: current.id,
    details: { newScheduledAt: data.scheduledAt, notes: updatedNotes },
  });

  revalidatePath("/relances");
  revalidatePath("/prospection");
  revalidatePath("/rendez-vous");
  revalidatePath("/appels");
  revalidatePath("/dashboard");

  return { success: true, followUp: updated };
}

export async function processFollowUpAction(data: {
  followUpId: string;
  decision: "NOT_INTERESTED" | "INTERESTED" | "RETRY" | "RETRY_15";
  notes?: string;
}) {
  const user = await requireAuth();

  const currentFollowUp = await prisma.followUp.findUnique({
    where: { id: data.followUpId },
    include: {
      prospect: true,
    },
  });

  if (!currentFollowUp) {
    throw new Error("Relance introuvable.");
  }

  const now = new Date();
  let nextFollowUp: any = null;

  if (data.decision === "NOT_INTERESTED") {
    // 1. PAS INTÉRESSÉ
    await prisma.followUp.update({
      where: { id: currentFollowUp.id },
      data: {
        status: FollowUpStatus.LOST,
        completedAt: now,
        notes: data.notes?.trim() || "Prospect non intéressé lors de la relance",
      },
    });

    if (currentFollowUp.prospectId) {
      await prisma.prospect.update({
        where: { id: currentFollowUp.prospectId },
        data: {
          status: ProspectStatus.NOT_INTERESTED,
          rawState: "PAS INTERESSE",
          callStatus: "EFFECTUE",
          response: "Pas intéressé (Relance)",
          prospectionDate: new Date(),
        },
      });

      try {
        await prisma.call.create({
          data: {
            prospectId: currentFollowUp.prospectId,
            userId: user.id,
            result: CallResult.NOT_INTERESTED,
            comment: data.notes?.trim() || "Relance commerciale : Pas intéressé",
            durationSeconds: 60,
            calledAt: now,
          },
        });
      } catch (e) {
        console.warn("Call log creation skipped:", e);
      }

      // Annuler les éventuels RDV de relance téléphoniques futurs pour ce prospect
      try {
        await prisma.appointment.updateMany({
          where: {
            prospectId: currentFollowUp.prospectId,
            status: AppointmentStatus.SCHEDULED,
            type: AppointmentType.PHONE,
          },
          data: {
            status: AppointmentStatus.CANCELLED,
            notes: "Annulé suite à refus lors de la relance (Pas intéressé)",
          },
        });
      } catch (e) {
        console.warn("Appointment cancellation skipped:", e);
      }
    }

    await createAuditLog({
      userId: user.id,
      action: "PROCESS_FOLLOWUP_NOT_INTERESTED",
      module: "FOLLOWUPS",
      entityId: currentFollowUp.id,
      details: { decision: data.decision, prospectId: currentFollowUp.prospectId },
    });
  } else if (data.decision === "INTERESTED") {
    // 2. INTÉRESSÉ -> PROGRAMMER AUTOMATIQUEMENT APRÈS 3 JOURS DANS LE CALENDRIER
    await prisma.followUp.update({
      where: { id: currentFollowUp.id },
      data: {
        status: FollowUpStatus.COMPLETED,
        completedAt: now,
        notes: data.notes?.trim() || "Prospect intéressé lors de la relance (Nouvelle relance programmée à J+3)",
      },
    });

    if (currentFollowUp.prospectId) {
      await prisma.prospect.update({
        where: { id: currentFollowUp.prospectId },
        data: {
          status: ProspectStatus.INTERESTED,
          rawState: "INTERESSE",
          callStatus: "EFFECTUE",
          response: "Intéressé (Relance J+3)",
          prospectionDate: new Date(),
        },
      });

      try {
        await prisma.call.create({
          data: {
            prospectId: currentFollowUp.prospectId,
            userId: user.id,
            result: CallResult.INTERESTED,
            comment: data.notes?.trim() || "Relance : Intéressé (Nouvelle relance J+3 programmée)",
            durationSeconds: 120,
            calledAt: now,
          },
        });
      } catch (e) {
        console.warn("Call log creation skipped:", e);
      }

      // Programmer la prochaine relance dans 3 jours à 10:00
      const scheduledIn3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      scheduledIn3Days.setHours(10, 0, 0, 0);

      nextFollowUp = await prisma.followUp.create({
        data: {
          prospectId: currentFollowUp.prospectId,
          userId: currentFollowUp.userId || user.id,
          stepNumber: currentFollowUp.stepNumber + 1,
          scheduledAt: scheduledIn3Days,
          status: FollowUpStatus.SCHEDULED,
          notes: "Relance automatique programmée suite à intérêt (J+3)",
        },
      });

      // Programmer automatiquement dans le calendrier (RDV Téléphonique)
      try {
        const endIn3Days = new Date(scheduledIn3Days.getTime() + 30 * 60 * 1000);
        await prisma.appointment.create({
          data: {
            title: `Relance RDV (Intéressé +3j) — ${currentFollowUp.prospect?.companyName || "Prospect"}`,
            type: AppointmentType.PHONE,
            status: AppointmentStatus.SCHEDULED,
            startTime: scheduledIn3Days,
            endTime: endIn3Days,
            durationMin: 30,
            location: currentFollowUp.prospect?.wilaya || "Téléphone / Bureau",
            notes: data.notes?.trim() || "Relance commerciale programmée à J+3 suite à intérêt",
            prospectId: currentFollowUp.prospectId,
            userId: currentFollowUp.userId || user.id,
          },
        });
      } catch (err) {
        console.warn("Could not create calendar appointment for J+3 followup:", err);
      }
    }

    await createAuditLog({
      userId: user.id,
      action: "PROCESS_FOLLOWUP_INTERESTED",
      module: "FOLLOWUPS",
      entityId: currentFollowUp.id,
      details: { decision: data.decision, prospectId: currentFollowUp.prospectId },
    });
  } else if (data.decision === "RETRY" || data.decision === "RETRY_15") {
    // 3. À RELANCER -> Détecter si relance après 7 jours pour reporter à J+15
    const is15Days =
      data.decision === "RETRY_15" ||
      currentFollowUp.stepNumber >= 2 ||
      Boolean(
        currentFollowUp.notes &&
          (currentFollowUp.notes.includes("+7j") ||
            currentFollowUp.notes.includes("J+7") ||
            currentFollowUp.notes.includes("7 jours") ||
            currentFollowUp.notes.includes("7j"))
      );

    const delayDays = is15Days ? 15 : 7;
    const delayLabel = is15Days ? "J+15" : "J+7";

    await prisma.followUp.update({
      where: { id: currentFollowUp.id },
      data: {
        status: FollowUpStatus.COMPLETED,
        completedAt: now,
        notes:
          data.notes?.trim() ||
          `Prospect à relancer (Nouvelle relance programmée à ${delayLabel})`,
      },
    });

    if (currentFollowUp.prospectId) {
      await prisma.prospect.update({
        where: { id: currentFollowUp.prospectId },
        data: {
          rawState: "A RAPPELER",
          callStatus: "A RAPPELER",
          response: `À relancer (${delayLabel})`,
          prospectionDate: new Date(),
        },
      });

      try {
        await prisma.call.create({
          data: {
            prospectId: currentFollowUp.prospectId,
            userId: user.id,
            result: CallResult.CALLBACK_REQUESTED,
            comment:
              data.notes?.trim() ||
              `Relance : À relancer (Nouvelle relance ${delayLabel} programmée)`,
            durationSeconds: 90,
            calledAt: now,
          },
        });
      } catch (e) {
        console.warn("Call log creation skipped:", e);
      }

      // Programmer la prochaine relance dans 7 ou 15 jours à 10:00
      const scheduledDate = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000);
      scheduledDate.setHours(10, 0, 0, 0);

      nextFollowUp = await prisma.followUp.create({
        data: {
          prospectId: currentFollowUp.prospectId,
          userId: currentFollowUp.userId || user.id,
          stepNumber: currentFollowUp.stepNumber + 1,
          scheduledAt: scheduledDate,
          status: FollowUpStatus.SCHEDULED,
          notes: `Relance automatique reportée à ${delayLabel}`,
        },
      });

      // Programmer automatiquement dans le calendrier (RDV Téléphonique)
      try {
        const endDate = new Date(scheduledDate.getTime() + 30 * 60 * 1000);
        await prisma.appointment.create({
          data: {
            title: `Relance RDV (${delayLabel}) — ${currentFollowUp.prospect?.companyName || "Prospect"}`,
            type: AppointmentType.PHONE,
            status: AppointmentStatus.SCHEDULED,
            startTime: scheduledDate,
            endTime: endDate,
            durationMin: 30,
            location: currentFollowUp.prospect?.wilaya || "Téléphone / Bureau",
            notes: data.notes?.trim() || `Relance téléphonique programmée à ${delayLabel}`,
            prospectId: currentFollowUp.prospectId,
            userId: currentFollowUp.userId || user.id,
          },
        });
      } catch (err) {
        console.warn("Could not create calendar appointment for retry followup:", err);
      }
    }

    await createAuditLog({
      userId: user.id,
      action: is15Days ? "PROCESS_FOLLOWUP_RETRY_15" : "PROCESS_FOLLOWUP_RETRY",
      module: "FOLLOWUPS",
      entityId: currentFollowUp.id,
      details: {
        decision: data.decision,
        delayDays,
        prospectId: currentFollowUp.prospectId,
      },
    });
  }

  revalidatePath("/rendez-vous");
  revalidatePath("/relances");
  revalidatePath("/prospection");
  revalidatePath("/appels");
  revalidatePath("/dashboard");

  return {
    success: true,
    nextFollowUp,
    message:
      data.decision === "NOT_INTERESTED"
        ? "Relance clôturée : Prospect marqué comme non intéressé."
        : data.decision === "INTERESTED"
        ? "Prospect intéressé ! Nouvelle relance programmée à J+3 dans le calendrier."
        : data.decision === "RETRY_15" || currentFollowUp.stepNumber >= 2
        ? "Relance programmée à J+15 dans le calendrier."
        : "Relance programmée à J+7 dans le calendrier.",
  };
}

/**
 * Enregistre un appel (+ APPEL) directement depuis une relance
 * et l'ajoute automatiquement dans la section /appels (Call + Prospect appelé)
 */
export async function logFollowUpCallAction(data: {
  followUpId: string;
  result: CallResult;
  comment?: string;
  durationSeconds?: number;
}) {
  const user = await requireAuth();

  const followUp = await prisma.followUp.findUnique({
    where: { id: data.followUpId },
    include: { prospect: true },
  });

  if (!followUp || !followUp.prospectId) {
    throw new Error("Relance ou prospect introuvable.");
  }

  const now = new Date();
  const prospectId = followUp.prospectId;

  // 1. Enregistrer dans la table Call (historique des appels)
  const call = await prisma.call.create({
    data: {
      prospectId,
      userId: user.id,
      result: data.result,
      comment: data.comment?.trim() || `Appel de relance (Étape ${followUp.stepNumber})`,
      durationSeconds: data.durationSeconds || 60,
      calledAt: now,
    },
  });

  // 2. Mettre à jour le prospect pour qu'il soit dans la liste des Appels
  let newStatus: ProspectStatus | null = null;
  let callStatus = "EFFECTUE";

  if (data.result === CallResult.INTERESTED) {
    newStatus = ProspectStatus.INTERESTED;
    callStatus = "EFFECTUE";
  } else if (data.result === CallResult.NOT_INTERESTED) {
    newStatus = ProspectStatus.NOT_INTERESTED;
    callStatus = "EFFECTUE";
  } else if (data.result === CallResult.NO_ANSWER) {
    newStatus = ProspectStatus.CONTACTED;
    callStatus = "PAS DE REPONSE";
  } else if (data.result === CallResult.UNREACHABLE) {
    newStatus = ProspectStatus.CONTACTED;
    callStatus = "INJOIGNABLE";
  } else if (data.result === CallResult.CALLBACK_REQUESTED) {
    newStatus = ProspectStatus.CONTACTED;
    callStatus = "A RAPPELER";
  } else if (data.result === CallResult.APPOINTMENT_BOOKED) {
    newStatus = ProspectStatus.MEETING_SCHEDULED;
    callStatus = "EFFECTUE";
  }

  const updateData: any = {
    rawState: "TRANSFERE_APPELS",
    callStatus,
    source: "APPELS",
    prospectionDate: now,
    assignedToId: followUp.userId || user.id,
  };
  if (newStatus) updateData.status = newStatus;
  if (data.comment?.trim()) {
    updateData.response = data.comment.trim();
  }

  await prisma.prospect.update({
    where: { id: prospectId },
    data: updateData,
  });

  // 3. Mettre à jour la relance et programmer l'étape suivante si applicable
  let nextFollowUp: any = null;
  if (data.result === CallResult.NOT_INTERESTED) {
    await prisma.followUp.update({
      where: { id: followUp.id },
      data: {
        status: FollowUpStatus.LOST,
        completedAt: now,
        notes: data.comment?.trim() || "Prospect non intéressé lors de l'appel",
      },
    });
  } else if (data.result === CallResult.INTERESTED) {
    await prisma.followUp.update({
      where: { id: followUp.id },
      data: {
        status: FollowUpStatus.COMPLETED,
        completedAt: now,
        notes: data.comment?.trim() || "Intéressé suite à appel (+3j)",
      },
    });
    // Schedule +3j
    const day3 = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3);
    nextFollowUp = await prisma.followUp.create({
      data: {
        prospectId,
        userId: followUp.userId || user.id,
        stepNumber: followUp.stepNumber + 1,
        scheduledAt: day3,
        status: FollowUpStatus.SCHEDULED,
        notes: `[Relance suite appel] Intéressé : ${data.comment?.trim() || "À relancer à +3j"}`,
      },
    });
  } else if (
    data.result === CallResult.CALLBACK_REQUESTED ||
    data.result === CallResult.NO_ANSWER ||
    data.result === CallResult.UNREACHABLE
  ) {
    await prisma.followUp.update({
      where: { id: followUp.id },
      data: {
        status: FollowUpStatus.COMPLETED,
        completedAt: now,
        notes: data.comment?.trim() || `Appel : ${data.result} (À relancer +7j)`,
      },
    });
    // Schedule +7j
    const day7 = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7);
    nextFollowUp = await prisma.followUp.create({
      data: {
        prospectId,
        userId: followUp.userId || user.id,
        stepNumber: followUp.stepNumber + 1,
        scheduledAt: day7,
        status: FollowUpStatus.SCHEDULED,
        notes: `[Relance suite appel] ${
          data.result === CallResult.NO_ANSWER ? "Pas de réponse" : "À rappeler"
        } : ${data.comment?.trim() || "À relancer à +7j"}`,
      },
    });
  } else if (data.result === CallResult.APPOINTMENT_BOOKED) {
    await prisma.followUp.update({
      where: { id: followUp.id },
      data: {
        status: FollowUpStatus.COMPLETED,
        completedAt: now,
        notes: data.comment?.trim() || "RDV fixé lors de l'appel",
      },
    });
  }

  try {
    await createAuditLog({
      userId: user.id,
      action: "LOG_FOLLOWUP_CALL",
      module: "CALLS",
      entityId: call.id,
      details: {
        prospectId,
        followUpId: followUp.id,
        result: data.result,
        comment: data.comment,
      },
    });
  } catch (auditErr) {
    console.warn("Audit log error:", auditErr);
  }

  revalidatePath("/relances");
  revalidatePath("/appels");
  revalidatePath("/prospection");
  revalidatePath("/dashboard");

  return { success: true, call, nextFollowUp };
}
