"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getUserNotificationsAction() {
  const user = await requireAuth();

  const isCommercial = user.role === "SALES_REP" || user.role === "SALES_DIRECTOR";

  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
      ...(isCommercial
        ? {
            OR: [
              { type: { in: ["APPOINTMENT", "CLIENT", "CALL", "FOLLOWUP", "PAYMENT", "SYSTEM"] } },
              {
                type: { notIn: ["CONTENT_AI", "APPOINTMENT", "CLIENT", "CALL", "FOLLOWUP", "PAYMENT", "SYSTEM"] },
                NOT: [
                  { title: { contains: "Planning Semaine", mode: "insensitive" } },
                  { title: { contains: "publication", mode: "insensitive" } },
                  { message: { contains: "publication", mode: "insensitive" } },
                ],
              },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const unreadCount = await prisma.notification.count({
    where: {
      userId: user.id,
      isRead: false,
      ...(isCommercial
        ? {
            OR: [
              { type: { in: ["APPOINTMENT", "CLIENT", "CALL", "FOLLOWUP", "PAYMENT", "SYSTEM"] } },
              {
                type: { notIn: ["CONTENT_AI", "APPOINTMENT", "CLIENT", "CALL", "FOLLOWUP", "PAYMENT", "SYSTEM"] },
                NOT: [
                  { title: { contains: "Planning Semaine", mode: "insensitive" } },
                  { title: { contains: "publication", mode: "insensitive" } },
                  { message: { contains: "publication", mode: "insensitive" } },
                ],
              },
            ],
          }
        : {}),
    },
  });

  return { notifications, unreadCount };
}

export async function markNotificationReadAction(id: string) {
  const user = await requireAuth();

  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { isRead: true },
  });

  revalidatePath("/");
  return { success: true };
}

export async function markAllNotificationsReadAction() {
  const user = await requireAuth();

  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/");
  return { success: true };
}

export async function deleteNotificationAction(id: string) {
  const user = await requireAuth();

  await prisma.notification.deleteMany({
    where: { id, userId: user.id },
  });

  revalidatePath("/");
  return { success: true };
}

export async function clearAllNotificationsAction() {
  const user = await requireAuth();

  await prisma.notification.deleteMany({
    where: { userId: user.id },
  });

  revalidatePath("/");
  return { success: true };
}

/**
 * Dispatch automatic task notification:
 * Règle métier : Notifier UNIQUEMENT la personne sélectionnée dans "Assigné à".
 */
export async function dispatchTaskNotifications(params: {
  taskId: string;
  taskTitle: string;
  taskDescription?: string | null;
  projectId: string;
  projectName: string;
  projectCode: string;
  assigneeId?: string | null;
}) {
  const { taskTitle, projectId, projectName, projectCode, assigneeId } = params;

  // Si aucun membre n'est assigné, aucune notification n'est émise
  if (!assigneeId) return;

  try {
    await prisma.notification.create({
      data: {
        userId: assigneeId,
        title: "📌 Nouvelle tâche assignée",
        message: `La tâche "${taskTitle}" vous a été assignée sur le projet ${projectName} (${projectCode}).`,
        type: "TASK",
        link: `/projets/${projectId}`,
      },
    });
  } catch (err) {
    console.warn("Error dispatching task notification:", err);
  }
}

/**
 * Notifier TOUS les collaborateurs lors de la création d'un rendez-vous
 */
export async function dispatchAppointmentCreatedNotifications(params: {
  appointmentId: string;
  title: string;
  startTime: Date;
  creatorName: string;
  location?: string | null;
  prospectName?: string | null;
  assignedUserName?: string | null;
}) {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    if (users.length === 0) return;

    const dateStr = params.startTime.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const targetLabel = params.prospectName ? ` avec "${params.prospectName}"` : "";
    const locLabel = params.location ? ` (${params.location})` : "";
    const assignedLabel =
      params.assignedUserName && params.assignedUserName !== params.creatorName
        ? ` • Assigné à : ${params.assignedUserName}`
        : "";

    const message = `Rendez-vous "${params.title}"${targetLabel} prévu le ${dateStr}${locLabel} (planifié par ${params.creatorName}${assignedLabel}).`;

    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        title: "📅 Nouveau Rendez-vous planifié",
        message,
        type: "APPOINTMENT",
        link: "/rendez-vous",
      })),
    });
  } catch (err) {
    console.warn("Erreur notification rendez-vous:", err);
  }
}

/**
 * Notifier TOUS les collaborateurs lors de la création d'un nouveau client
 */
export async function dispatchClientCreatedNotifications(params: {
  clientId: string;
  companyName: string;
  offerType: string;
  creatorName: string;
  monthlyFee?: number;
  assignedUserName?: string | null;
}) {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    if (users.length === 0) return;

    const packLabel = params.offerType ? ` (Pack ${params.offerType})` : "";
    const feeLabel =
      params.monthlyFee && params.monthlyFee > 0
        ? ` • ${params.monthlyFee.toLocaleString("fr-FR")} DA/mois`
        : "";
    const assignedLabel =
      params.assignedUserName && params.assignedUserName !== params.creatorName
        ? ` • Commercial : ${params.assignedUserName}`
        : "";

    const message = `Le client "${params.companyName}"${packLabel}${feeLabel} a été enregistré avec succès par ${params.creatorName}${assignedLabel}.`;

    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        title: "🎉 Nouveau Client créé",
        message,
        type: "CLIENT",
        link: "/clients",
      })),
    });
  } catch (err) {
    console.warn("Erreur notification client:", err);
  }
}
