"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { TaskStatus, TaskPriority } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { dispatchTaskNotifications } from "@/actions/notifications";

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

  return { success: true, count: createdTasks.length, tasks: createdTasks };
}
