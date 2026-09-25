"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { TaskStatus, TaskPriority } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { dispatchTaskNotifications, dispatchWeeklyThemesReminderNotifications } from "@/actions/notifications";
import { getStoredEditorialPlan, saveEditorialPlanToNotes, getMonthKey } from "@/lib/utils";
import { WEEKLY_QUOTAS_BY_OFFER } from "@/lib/aiContentGenerator";

export async function getProductionKanban(params: {
  assigneeId?: string;
  projectId?: string;
  priority?: TaskPriority;
  search?: string;
} = {}) {
  await requireAuth();

  const whereClause: any = {};

  if (params.assigneeId) {
    whereClause.assigneeId = params.assigneeId;
  }

  if (params.projectId) {
    whereClause.projectId = params.projectId;
  }

  if (params.priority) {
    whereClause.priority = params.priority;
  }

  if (params.search) {
    whereClause.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
      { project: { name: { contains: params.search, mode: "insensitive" } } },
      { project: { client: { companyName: { contains: params.search, mode: "insensitive" } } } },
    ];
  }

  const tasks = await prisma.projectTask.findMany({
    where: whereClause,
    include: {
      assignee: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          managerId: true,
          manager: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
          client: {
            select: {
              id: true,
              companyName: true,
              brandName: true,
            },
          },
        },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  const serializedTasks = tasks.map((t) => ({
    ...t,
    timeSpentHours: Number(t.timeSpentHours || 0),
  }));

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Group into Kanban columns (Règle automatique : les tâches VALIDÉ CLIENT depuis +1 JOUR vont dans l'historique)
  const kanban: Record<TaskStatus, typeof serializedTasks> = {
    TODO: [],
    IN_PROGRESS: [],
    COMPLETED: [],
    VALIDATED: [],
  };

  const archivedTasks: typeof serializedTasks = [];

  for (const t of serializedTasks) {
    if (t.status === "VALIDATED") {
      const updatedAtTime = new Date(t.updatedAt).getTime();
      const isOlderThan1Day = (now - updatedAtTime) >= ONE_DAY_MS;
      if (isOlderThan1Day) {
        archivedTasks.push(t);
      } else {
        kanban.VALIDATED.push(t);
      }
    } else if (kanban[t.status]) {
      kanban[t.status].push(t);
    } else {
      kanban.TODO.push(t);
    }
  }

  const totalTasks = serializedTasks.length;
  const totalHours = serializedTasks.reduce((acc, t) => acc + Number(t.timeSpentHours || 0), 0);
  const overdueCount = serializedTasks.filter(
    (t) =>
      t.dueDate &&
      new Date(t.dueDate) < new Date() &&
      t.status !== "COMPLETED" &&
      t.status !== "VALIDATED"
  ).length;

  return {
    kanban,
    totalTasks,
    totalHours,
    overdueCount,
    archivedTasks,
    archivedCount: archivedTasks.length,
    recentValidatedCount: kanban.VALIDATED.length,
    allTasks: serializedTasks,
  };
}

export async function createTaskAction(data: {
  projectId?: string;
  clientId?: string;
  assigneeId?: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  timeSpentHours?: number;
}) {
  const user = await requireAuth();

  let finalProjectId = data.projectId;

  // Si la tâche est créée "Par Client" sans projet explicite
  if (!finalProjectId && data.clientId) {
    let proj = await prisma.project.findFirst({
      where: { clientId: data.clientId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
    });

    if (!proj) {
      const count = await prisma.project.count();
      const code = `PRJ-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;
      const client = await prisma.client.findUnique({ where: { id: data.clientId } });
      proj = await prisma.project.create({
        data: {
          clientId: data.clientId,
          name: `Régie & Tâches — ${client?.companyName || "Client"}`,
          code,
          description: "Projet créé automatiquement pour le suivi des tâches directes du client.",
          status: "IN_PRODUCTION",
        },
      });
    }
    finalProjectId = proj.id;
  }

  if (!finalProjectId) {
    throw new Error("Veuillez sélectionner un projet ou un client pour cette tâche.");
  }

  const task = await prisma.projectTask.create({
    data: {
      projectId: finalProjectId,
      assigneeId: data.assigneeId || null,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      status: data.status || TaskStatus.TODO,
      priority: data.priority || TaskPriority.MEDIUM,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      timeSpentHours: Number(data.timeSpentHours) || 0,
    },
    include: {
      assignee: true,
      project: { include: { client: true } },
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE_TASK",
    module: "PRODUCTION",
    entityId: task.id,
    details: { projectId: data.projectId, title: task.title, status: task.status },
  });

  // Notifications automatiques selon les règles métier (Meroua, Toufik, Direction)
  await dispatchTaskNotifications({
    taskId: task.id,
    taskTitle: task.title,
    taskDescription: task.description,
    projectId: task.projectId,
    projectName: task.project.name,
    projectCode: task.project.code,
    assigneeId: task.assigneeId,
  });

  revalidatePath("/production");
  revalidatePath("/projets");
  revalidatePath(`/projets/${data.projectId}`);
  revalidatePath("/calendrier-technicien");

  return { success: true, task };
}

export async function updateTaskStatusAction(id: string, status: TaskStatus) {
  const user = await requireAuth();

  const task = await prisma.projectTask.update({
    where: { id },
    data: { status },
    include: { project: true },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE_TASK_STATUS",
    module: "PRODUCTION",
    entityId: id,
    details: { title: task.title, newStatus: status, projectId: task.projectId },
  });

  revalidatePath("/production");
  revalidatePath("/projets");
  revalidatePath(`/projets/${task.projectId}`);
  revalidatePath("/dashboard");
  revalidatePath("/equipes");
  revalidatePath("/calendrier-technicien");

  return { success: true, task };
}

/**
 * Restaure une tâche depuis l'historique vers le Kanban actif
 */
export async function restoreArchivedTaskAction(id: string, targetStatus: TaskStatus = TaskStatus.IN_PROGRESS) {
  const user = await requireAuth();

  const task = await prisma.projectTask.update({
    where: { id },
    data: {
      status: targetStatus,
      updatedAt: new Date(),
    },
    include: { project: true },
  });

  await createAuditLog({
    userId: user.id,
    action: "RESTORE_ARCHIVED_TASK",
    module: "PRODUCTION",
    entityId: id,
    details: { title: task.title, newStatus: targetStatus, projectId: task.projectId },
  });

  revalidatePath("/production");
  revalidatePath("/projets");
  revalidatePath(`/projets/${task.projectId}`);

  return { success: true, task };
}

export async function updateTaskAction(
  id: string,
  data: {
    title?: string;
    description?: string;
    assigneeId?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string;
    timeSpentHours?: number;
  }
) {
  const user = await requireAuth();

  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.description !== undefined) updateData.description = data.description?.trim() || null;
  if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId || null;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (data.timeSpentHours !== undefined) updateData.timeSpentHours = Number(data.timeSpentHours) || 0;

  const task = await prisma.projectTask.update({
    where: { id },
    data: updateData,
    include: { project: true },
  });

  if (data.assigneeId && data.assigneeId !== user.id) {
    await prisma.notification.create({
      data: {
        userId: data.assigneeId,
        title: "📌 Tâche assignée",
        message: `La tâche "${task.title}" vous a été assignée sur le projet ${task.project.name}.`,
        type: "TASK",
        link: `/projets/${task.projectId}`,
      },
    }).catch(() => {});
  }

  await createAuditLog({
    userId: user.id,
    action: "UPDATE_TASK",
    module: "PRODUCTION",
    entityId: id,
    details: { title: task.title, projectId: task.projectId },
  });

  revalidatePath("/production");
  revalidatePath("/projets");
  revalidatePath(`/projets/${task.projectId}`);

  return { success: true, task };
}

export async function logTaskTimeAction(id: string, additionalHours: number) {
  const user = await requireAuth();

  const current = await prisma.projectTask.findUnique({ where: { id } });
  if (!current) throw new Error("Tâche introuvable.");

  const newTotal = Number(current.timeSpentHours || 0) + Number(additionalHours || 0);

  const task = await prisma.projectTask.update({
    where: { id },
    data: { timeSpentHours: newTotal },
    include: { project: true },
  });

  await createAuditLog({
    userId: user.id,
    action: "LOG_TASK_TIME",
    module: "PRODUCTION",
    entityId: id,
    details: { title: task.title, addedHours: additionalHours, newTotal },
  });

  revalidatePath("/production");
  revalidatePath(`/projets/${task.projectId}`);

  return { success: true, task };
}

export async function deleteTaskAction(id: string) {
  const user = await requireAuth();

  const task = await prisma.projectTask.findUnique({ where: { id } });
  if (!task) throw new Error("Tâche introuvable.");

  await prisma.projectTask.delete({ where: { id } });

  await createAuditLog({
    userId: user.id,
    action: "DELETE_TASK",
    module: "PRODUCTION",
    entityId: id,
    details: { title: task.title, projectId: task.projectId },
  });

  revalidatePath("/production");
  revalidatePath(`/projets/${task.projectId}`);

  return { success: true };
}

export async function getProductionTaskTemplates() {
  await requireAuth();

  const templates = await prisma.productionTaskTemplate.findMany({
    where: { isActive: true },
    orderBy: [
      { part: "asc" },
      { orderIndex: "asc" },
      { createdAt: "asc" },
    ],
  });

  return templates.map((t) => ({
    id: t.id,
    title: t.title,
    category: t.category,
    part: t.part as "PART_1" | "PART_2",
    partLabel: t.partLabel || (t.part === "PART_1" ? "Partie 1 : Modèles sur site & Voix-Off" : "Partie 2 : Modèles Montage, Web & Extras"),
    role: t.role,
    defaultHours: Number(t.defaultHours) || 2,
    priority: t.priority,
    description: t.description,
  }));
}

export async function createTaskTemplateAction(data: {
  title: string;
  category?: string;
  part: "PART_1" | "PART_2";
  defaultHours: number;
  priority?: TaskPriority;
  description?: string;
  role?: any;
}) {
  const user = await requireAuth();

  if (!data.title?.trim()) {
    throw new Error("Le titre du modèle est obligatoire.");
  }

  const count = await prisma.productionTaskTemplate.count();

  const partLabel =
    data.part === "PART_1"
      ? "Partie 1 : Modèles sur site & Voix-Off"
      : "Partie 2 : Modèles Montage, Web & Extras";

  const template = await prisma.productionTaskTemplate.create({
    data: {
      title: data.title.trim(),
      category: data.category || (data.part === "PART_1" ? "VIDEO" : "DESIGN"),
      part: data.part,
      partLabel,
      role: data.role || null,
      defaultHours: Number(data.defaultHours) || 2,
      priority: data.priority || TaskPriority.MEDIUM,
      description: data.description?.trim() || null,
      orderIndex: count + 1,
      isActive: true,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE_TASK_TEMPLATE",
    module: "PRODUCTION",
    entityId: template.id,
    details: { title: template.title, part: template.part },
  });

  revalidatePath("/production");

  return {
    success: true,
    template: {
      ...template,
      defaultHours: Number(template.defaultHours),
    },
  };
}

export async function deleteTaskTemplateAction(id: string) {
  const user = await requireAuth();

  const template = await prisma.productionTaskTemplate.findUnique({ where: { id } });
  if (!template) throw new Error("Modèle introuvable");

  await prisma.productionTaskTemplate.delete({ where: { id } });

  await createAuditLog({
    userId: user.id,
    action: "DELETE_TASK_TEMPLATE",
    module: "PRODUCTION",
    entityId: id,
    details: { title: template.title, part: template.part },
  });

  revalidatePath("/production");

  return { success: true };
}

export async function createBatchTasksAction(data: {
  projectId?: string;
  clientId?: string;
  templateIds: string[];
  dueDate?: string;
  customAssigneeId?: string;
}) {
  const user = await requireAuth();

  if (!data.templateIds || data.templateIds.length === 0) {
    throw new Error("Veuillez sélectionner au moins une tâche modèle.");
  }

  let finalProjectId = data.projectId;

  // Si création par Client sans projet explicite
  if (!finalProjectId && data.clientId) {
    let proj = await prisma.project.findFirst({
      where: { clientId: data.clientId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
    });

    if (!proj) {
      const code = `ABN-${Date.now().toString(36).toUpperCase()}`;
      const client = await prisma.client.findUnique({ where: { id: data.clientId } });
      proj = await prisma.project.create({
        data: {
          clientId: data.clientId,
          name: `Abonnement — ${client?.companyName || "Client"}`,
          code,
          description: "Conteneur automatique pour le suivi des tâches récurrentes du client.",
          status: "IN_PRODUCTION",
        },
      });
    }
    finalProjectId = proj.id;
  }

  if (!finalProjectId) {
    throw new Error("Veuillez sélectionner un projet ou un client pour ces tâches.");
  }

  const project = await prisma.project.findUnique({
    where: { id: finalProjectId },
    include: { client: true },
  });

  if (!project) throw new Error("Projet introuvable.");

  // Charger tous les utilisateurs pour l'auto-assignation intelligente
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true, email: true },
  });

  // Charger les templates demandés
  const templates = await prisma.productionTaskTemplate.findMany({
    where: { id: { in: data.templateIds } },
  });

  const createdTasks = [];

  for (const tpl of templates) {
    const assigneeId: string | null = data.customAssigneeId || null;

    const task = await prisma.projectTask.create({
      data: {
        projectId: finalProjectId,
        assigneeId,
        title: tpl.title,
        description: tpl.description || null,
        status: TaskStatus.TODO,
        priority: tpl.priority || TaskPriority.MEDIUM,
        dueDate: data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 7 * 86400000),
        timeSpentHours: Number(tpl.defaultHours) || 0,
      },
    });

    createdTasks.push(task);

    // Notifications automatiques selon les règles métier (Meroua, Toufik, Direction)
    await dispatchTaskNotifications({
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: task.description,
      projectId: project.id,
      projectName: project.name,
      projectCode: project.code,
      assigneeId: task.assigneeId,
    });
  }

  await createAuditLog({
    userId: user.id,
    action: "BATCH_CREATE_TASKS",
    module: "PRODUCTION",
    entityId: finalProjectId,
    details: {
      projectId: finalProjectId,
      tasksCount: createdTasks.length,
      taskTitles: createdTasks.map((t) => t.title),
    },
  });

  revalidatePath("/production");
  revalidatePath("/projets");
  revalidatePath(`/projets/${finalProjectId}`);
  revalidatePath("/calendrier-technicien");

  return { success: true, count: createdTasks.length, tasks: createdTasks };
}

/**
 * Synchronise et génère automatiquement les tâches des abonnements mensuels pour chaque client :
 * 1. Publications chaque début de semaine (Lundi)
 * 2. Shooting Photo & Vidéo programmé automatiquement 2 mois après la date de signature du contrat
 */
export async function syncSubscriptionTasksForClients(clientId?: string) {
  try {
    const clients = await prisma.client.findMany({
      where: {
        ...(clientId ? { id: clientId } : {}),
        status: { in: ["ACTIVE", "IN_PREPARATION"] },
      },
      include: {
        projects: {
          where: { code: { startsWith: "ABN-" } },
        },
      },
    });

    for (const client of clients) {
      let project = client.projects[0];
      if (!project) {
        project = await prisma.project.create({
          data: {
            clientId: client.id,
            name: `Abonnement — ${client.companyName}`,
            code: `ABN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
            description: "Conteneur automatique pour le suivi des tâches récurrentes de l'abonnement.",
            status: "IN_PRODUCTION",
          },
        });
      }

      const signatureDate = client.contractStart ? new Date(client.contractStart) : new Date(client.createdAt);

      const contractEndDate = client.contractEnd
        ? new Date(client.contractEnd)
        : new Date(signatureDate.getTime() + 12 * 30 * 24 * 60 * 60 * 1000);

      const existingTasks = await prisma.projectTask.findMany({
        where: { projectId: project.id },
        select: { id: true, title: true, dueDate: true },
      });

      // 1. Shooting Photo & Vidéo programmé automatiquement 2 mois après la date de signature
      const shootingDate = new Date(signatureDate);
      shootingDate.setMonth(shootingDate.getMonth() + 2);
      shootingDate.setHours(10, 0, 0, 0);

      const hasShooting = existingTasks.some((t) => {
        if (!t.title.toLowerCase().includes("shooting")) return false;
        if (!t.dueDate) return false;
        const diffDays = Math.abs(t.dueDate.getTime() - shootingDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays < 15;
      });

      if (!hasShooting) {
        await prisma.projectTask.create({
          data: {
            projectId: project.id,
            title: `🎬 Shooting Photo & Vidéo (M+2) — ${client.companyName}`,
            description: `Session de tournage et shooting vidéo/photo programmée automatiquement 2 mois après la date de signature du contrat (${signatureDate.toLocaleDateString("fr-FR")}).`,
            dueDate: shootingDate,
            priority: TaskPriority.HIGH,
            status: TaskStatus.TODO,
            timeSpentHours: 4,
          },
        });
      }

      // 2. Nettoyage des anciennes publications automatiques génériques
      // Les thèmes et sujets sont désormais saisis MANUELLEMENT depuis le Calendrier des Tâches
      await prisma.projectTask.deleteMany({
        where: {
          projectId: project.id,
          title: { contains: "📱 Publication Réseaux Sociaux (Début de semaine)" },
          status: TaskStatus.TODO,
          timeSpentHours: { lte: 1 },
        },
      });
    }

    return { success: true };
  } catch (err) {
    console.error("Erreur syncSubscriptionTasksForClients:", err);
    return { success: false, error: err };
  }
}

/**
 * Récupère l'ensemble des tâches de production pour le calendrier mensuel du rôle technicien.
 * Rassemble toutes les tâches du mois dans les packs signés (actifs ou en préparation)
 * et les projets en production.
 */
export async function getTechnicianCalendarData(params?: {
  month?: number;
  year?: number;
}) {
  const user = await requireAuth();

  // Auto-synchronisation des jalons de contrat (ex: Shooting M+2)
  try {
    await syncSubscriptionTasksForClients();
  } catch (syncErr) {
    console.error("Auto-sync subscription tasks error:", syncErr);
  }

  // Notification hebdomadaire automatique : en début de semaine (Dimanche ou Lundi),
  // rappeler à l'équipe de remplir manuellement les thèmes et sujets de chaque client
  const now = new Date();
  if ([0, 1].includes(now.getDay())) {
    try {
      await dispatchWeeklyThemesReminderNotifications();
    } catch (notifErr) {
      console.warn("Erreur notification début de semaine:", notifErr);
    }
  }
  const targetYear = params?.year || now.getFullYear();
  const targetMonth = params?.month || now.getMonth() + 1;

  // Calcul du premier et dernier jour du mois demandé
  const startOfMonth = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

  // Récupérer les tâches liées aux clients ayant un pack signé (ACTIVE, IN_PREPARATION)
  // ou aux projets en cours de réalisation
  const tasks = await prisma.projectTask.findMany({
    where: {
      OR: [
        // 1. Tâches dont la date d'échéance tombe dans le mois sélectionné
        {
          dueDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        // 2. Tâches créées dans le mois sans date d'échéance explicite
        {
          dueDate: null,
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        // 3. Tâches actives non terminées dans un pack actif ou en préparation
        {
          status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
          project: {
            client: {
              status: { in: ["ACTIVE", "IN_PREPARATION"] },
            },
          },
        },
      ],
      project: {
        OR: [
          {
            client: {
              status: { in: ["ACTIVE", "IN_PREPARATION"] },
            },
          },
          {
            status: {
              in: [
                "IN_PRODUCTION",
                "PLANNING",
                "NEW_REQUEST",
                "CLIENT_VALIDATION",
                "REVISION",
              ],
            },
          },
        ],
      },
    },
    include: {
      assignee: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          client: {
            select: {
              id: true,
              companyName: true,
              brandName: true,
              sector: true,
              offerType: true,
              status: true,
              phone: true,
            },
          },
        },
      },
    },
    orderBy: [
      { dueDate: "asc" },
      { priority: "desc" },
      { createdAt: "desc" },
    ],
  });

  const serializedTasks = tasks.map((t) => ({
    ...t,
    timeSpentHours: Number(t.timeSpentHours || 0),
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  // Liste des techniciens / utilisateurs pour attribution et filtrage
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });

  // Liste des clients actifs & en préparation avec leurs projets et thèmes éditoriaux
  const monthKey = getMonthKey(new Date(targetYear, targetMonth - 1, 15));
  const rawActiveClients = await prisma.client.findMany({
    where: {
      status: { in: ["ACTIVE", "IN_PREPARATION"] },
    },
    select: {
      id: true,
      companyName: true,
      brandName: true,
      offerType: true,
      status: true,
      notes: true,
      projects: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
    orderBy: { companyName: "asc" },
  });

  const activeClients = rawActiveClients.map((client) => {
    const plan = getStoredEditorialPlan(client.notes, monthKey);
    return {
      id: client.id,
      companyName: client.companyName,
      brandName: client.brandName,
      offerType: client.offerType,
      status: client.status,
      projects: client.projects,
      themes: plan?.themes || [],
      publications: plan?.publications || [],
    };
  });

  return {
    tasks: serializedTasks,
    users,
    activeClients,
    currentUserId: user.id,
    currentUserRole: user.role,
    month: targetMonth,
    year: targetYear,
  };
}

/**
 * Mise à jour rapide de l'assignation d'une tâche
 */
export async function updateTaskAssigneeAction(taskId: string, assigneeId: string | null) {
  const user = await requireAuth();

  const task = await prisma.projectTask.update({
    where: { id: taskId },
    data: { assigneeId: assigneeId || null },
    include: {
      assignee: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, code: true } },
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE_TASK_ASSIGNEE",
    module: "PRODUCTION",
    entityId: taskId,
    details: {
      taskTitle: task.title,
      newAssigneeId: assigneeId,
      newAssigneeName: task.assignee?.name || "Non assigné",
    },
  });

  revalidatePath("/production");
  revalidatePath("/calendrier-technicien");
  revalidatePath("/dashboard");

  return { success: true, task };
}

/**
 * Enregistre ou met à jour manuellement un thème hebdomadaire pour un client donné
 */
export async function saveClientEditorialThemeAction(params: {
  clientId: string;
  weekNumber: number; // 1 à 5
  pillar: string;
  title: string;
  description?: string;
  color?: string;
  month?: number;
  year?: number;
}) {
  const user = await requireAuth();
  const client = await prisma.client.findUnique({
    where: { id: params.clientId },
  });

  if (!client) {
    return { success: false, error: "Client introuvable" };
  }

  const targetDate = params.year && params.month 
    ? new Date(params.year, params.month - 1, 15)
    : new Date();
  const monthKey = getMonthKey(targetDate);

  let currentPlan = getStoredEditorialPlan(client.notes, monthKey);
  const defaultColors = ["purple", "blue", "emerald", "amber", "rose"];
  const themeIndex = Math.max(0, params.weekNumber - 1);

  if (!currentPlan) {
    const quota = WEEKLY_QUOTAS_BY_OFFER[client.offerType] || WEEKLY_QUOTAS_BY_OFFER.STARTER;
    currentPlan = {
      clientName: client.companyName,
      brandName: client.brandName,
      sector: client.sector,
      wilaya: client.wilaya,
      offerType: client.offerType,
      weeklyQuota: quota.weekly,
      monthlyTotal: quota.monthly,
      monthName: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(targetDate),
      goal: "MANUAL",
      goalLabel: "Stratégie Manuelle Personnalisée",
      strategicSummary: "Planification manuelle des thèmes & sujets",
      packSummary: quota.tagline || "",
      themes: [
        { id: "th-1", pillar: "Semaine 1 : Notoriété & Savoir-faire", title: "", description: "", color: "purple" },
        { id: "th-2", pillar: "Semaine 2 : Éducation & Conseils", title: "", description: "", color: "blue" },
        { id: "th-3", pillar: "Semaine 3 : Preuve Sociale & Confiance", title: "", description: "", color: "emerald" },
        { id: "th-4", pillar: "Semaine 4 : Offre Spéciale & Conversion", title: "", description: "", color: "amber" },
      ],
      publications: [],
    };
  }

  if (!Array.isArray(currentPlan.themes)) {
    currentPlan.themes = [];
  }

  // Assurer que le tableau de thèmes a au moins params.weekNumber éléments
  while (currentPlan.themes.length < params.weekNumber) {
    const nextIdx = currentPlan.themes.length;
    currentPlan.themes.push({
      id: `th-${nextIdx + 1}`,
      pillar: `Semaine ${nextIdx + 1}`,
      title: "",
      description: "",
      color: defaultColors[nextIdx % defaultColors.length],
    });
  }

  currentPlan.themes[themeIndex] = {
    id: currentPlan.themes[themeIndex]?.id || `th-${params.weekNumber}`,
    pillar: params.pillar?.trim() || `Semaine ${params.weekNumber}`,
    title: params.title.trim(),
    description: params.description?.trim() || "",
    color: params.color || currentPlan.themes[themeIndex]?.color || defaultColors[themeIndex % defaultColors.length],
  };

  const updatedNotes = saveEditorialPlanToNotes(client.notes, currentPlan, monthKey);
  await prisma.client.update({
    where: { id: client.id },
    data: { notes: updatedNotes },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE_EDITORIAL_THEME",
    module: "PRODUCTION",
    entityId: client.id,
    details: {
      week: params.weekNumber,
      title: params.title,
      pillar: params.pillar,
    },
  });

  revalidatePath("/calendrier-technicien");
  revalidatePath(`/abonnements/${client.id}`);
  return { success: true, theme: currentPlan.themes[themeIndex], updatedPlan: currentPlan };
}

/**
 * Crée manuellement un nouveau sujet sous forme de tâche dans le calendrier
 * et l'enregistre également dans le plan éditorial du client
 */
export async function createManualSubjectTaskAction(data: {
  clientId: string;
  themeTitle?: string;
  weekNumber: number;
  title: string;
  format: "REEL_9_16" | "CAROUSEL" | "STATIC_POST" | "STORY_INTERACTIVE" | "OTHER";
  dueDate: string;
  hook?: string;
  scriptOrDescription?: string;
  assigneeId?: string;
  priority?: TaskPriority;
}) {
  const user = await requireAuth();

  const client = await prisma.client.findUnique({
    where: { id: data.clientId },
    include: {
      projects: {
        select: { id: true, name: true, code: true },
        take: 1,
      },
    },
  });

  if (!client) {
    return { success: false, error: "Client introuvable" };
  }

  let projectId = client.projects[0]?.id;
  if (!projectId) {
    const newProj = await prisma.project.create({
      data: {
        clientId: client.id,
        name: `Production ${client.companyName}`,
        code: `PRJ-${Date.now().toString().slice(-6)}`,
        status: "IN_PRODUCTION",
      },
    });
    projectId = newProj.id;
  }

  const formatLabels: Record<string, string> = {
    REEL_9_16: "🎬 Reel (9:16)",
    CAROUSEL: "📑 Carrousel",
    STATIC_POST: "🖼️ Post Image",
    STORY_INTERACTIVE: "📱 Story",
    OTHER: "📄 Contenu",
  };
  const formatTag = formatLabels[data.format] || "📱 Publication";

  const parts: string[] = [];
  if (data.themeTitle) {
    parts.push(`🎯 Thème / Axe : ${data.themeTitle}`);
  }
  parts.push(`📅 Semaine ${data.weekNumber} • Format : ${formatTag}`);
  if (data.hook?.trim()) {
    parts.push(`\n⚡ Accroche (Hook) :\n"${data.hook.trim()}"`);
  }
  if (data.scriptOrDescription?.trim()) {
    parts.push(`\n📝 Script & Consignes de Production :\n${data.scriptOrDescription.trim()}`);
  }

  const finalTitle = `${formatTag} - ${data.title.trim()}`;
  const fullDescription = parts.join("\n");

  // 1. Créer la tâche de production
  const task = await prisma.projectTask.create({
    data: {
      projectId,
      assigneeId: data.assigneeId || null,
      title: finalTitle,
      description: fullDescription,
      status: TaskStatus.TODO,
      priority: data.priority || TaskPriority.MEDIUM,
      dueDate: new Date(data.dueDate),
      timeSpentHours: data.format === "REEL_9_16" ? 3 : 2,
    },
    include: {
      assignee: true,
      project: { include: { client: true } },
    },
  });

  // 2. Synchroniser dans le plan éditorial du client
  try {
    const targetDate = new Date(data.dueDate);
    const monthKey = getMonthKey(targetDate);
    let currentPlan = getStoredEditorialPlan(client.notes, monthKey);

    if (!currentPlan) {
      const quota = WEEKLY_QUOTAS_BY_OFFER[client.offerType] || WEEKLY_QUOTAS_BY_OFFER.STARTER;
      currentPlan = {
        clientName: client.companyName,
        brandName: client.brandName,
        sector: client.sector,
        wilaya: client.wilaya,
        offerType: client.offerType,
        weeklyQuota: quota.weekly,
        monthlyTotal: quota.monthly,
        monthName: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(targetDate),
        goal: "MANUAL",
        goalLabel: "Stratégie Manuelle",
        strategicSummary: "Planification manuelle",
        packSummary: quota.tagline || "",
        themes: [],
        publications: [],
      };
    }

    const newPublication = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      week: data.weekNumber,
      weekLabel: `Semaine ${data.weekNumber}`,
      daySuggestion: new Intl.DateTimeFormat("fr-FR", { weekday: "long" }).format(targetDate),
      theme: data.themeTitle || `Semaine ${data.weekNumber}`,
      title: data.title.trim(),
      format: (data.format === "OTHER" ? "STATIC_POST" : data.format) as any,
      formatLabel: formatTag,
      hook: data.hook?.trim() || "",
      scriptOrSlides: [
        {
          step: "Consigne",
          description: data.scriptOrDescription?.trim() || "Création de contenu",
        },
      ],
      caption: "",
      cta: "",
      hashtags: [],
      suggestedTaskTitle: finalTitle,
      isCreatedAsTask: true,
    };

    currentPlan.publications = [...(currentPlan.publications || []), newPublication];
    const updatedNotes = saveEditorialPlanToNotes(client.notes, currentPlan, monthKey);
    await prisma.client.update({
      where: { id: client.id },
      data: { notes: updatedNotes },
    });
  } catch (notesErr) {
    console.warn("Erreur synchronisation notes plan éditorial:", notesErr);
  }

  // 3. Notifier l'équipe
  await dispatchTaskNotifications({
    taskId: task.id,
    taskTitle: task.title,
    taskDescription: task.description,
    projectId: task.projectId,
    projectName: task.project.name,
    projectCode: task.project.code,
    assigneeId: task.assigneeId,
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE_MANUAL_EDITORIAL_SUBJECT",
    module: "PRODUCTION",
    entityId: task.id,
    details: {
      clientId: client.id,
      title: task.title,
      format: data.format,
      theme: data.themeTitle,
    },
  });

  revalidatePath("/production");
  revalidatePath("/projets");
  revalidatePath("/calendrier-technicien");
  revalidatePath(`/abonnements/${client.id}`);

  return { success: true, task };
}

/**
 * Déclenche manuellement la notification de début de semaine à toute l'équipe
 */
export async function triggerWeeklyReminderAction() {
  await requireAuth();
  return await dispatchWeeklyThemesReminderNotifications();
}

