"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getUserNotificationsAction() {
  const user = await requireAuth();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, isRead: false },
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
