"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { ProjectStatus, TaskStatus, TaskPriority } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { STANDARD_TASK_TEMPLATES } from "@/lib/constants";
import { dispatchTaskNotifications } from "@/actions/notifications";

export async function getProjects(params: {
  search?: string;
  status?: ProjectStatus;
  clientId?: string;
  managerId?: string;
} = {}) {
  await requireAuth();

  const whereClause: any = {
    AND: [
      // Exclure strictement tous les abonnements et régies :
      // La section Projets est 100% réservée aux projets de développement web, plateformes et applications mobiles
      { code: { not: { startsWith: "ABN-" } } },
      { name: { not: { startsWith: "Abonnement" } } },
      { name: { not: { contains: "Abonnement Mensuel" } } },
      { name: { not: { startsWith: "Régie & Tâches" } } },
    ],
  };

  if (params.status) {
    whereClause.AND.push({ status: params.status });
  }

  if (params.clientId) {
    whereClause.AND.push({ clientId: params.clientId });
  }

  if (params.managerId) {
    whereClause.AND.push({ managerId: params.managerId });
  }

  if (params.search) {
    whereClause.AND.push({
      OR: [
        { name: { contains: params.search, mode: "insensitive" } },
        { code: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
        { client: { companyName: { contains: params.search, mode: "insensitive" } } },
      ],
    });
  }

  const projects = await prisma.project.findMany({
    where: whereClause,
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          brandName: true,
          sector: true,
          wilaya: true,
          phone: true,
          offerType: true,
        },
      },
      manager: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      tasks: {
        select: {
          id: true,
          status: true,
          timeSpentHours: true,
        },
      },
      costs: {
        select: {
          id: true,
          amount: true,
        },
      },
      _count: {
        select: {
          documents: true,
          tasks: true,
          costs: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return projects.map((p) => {
    const totalTasks = p.tasks.length;
    const completedTasks = p.tasks.filter(
      (t) => t.status === "COMPLETED" || t.status === "VALIDATED"
    ).length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const totalSpentHours = p.tasks.reduce(
      (sum, t) => sum + Number(t.timeSpentHours || 0),
      0
    );
    const totalCosts = p.costs.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const budgetNum = Number(p.budget || 0);
    const grossMargin = budgetNum - totalCosts;

    return {
      ...p,
      budget: budgetNum,
      progress,
      totalSpentHours,
      totalCosts,
      grossMargin,
    };
  });
}

export async function getProjectDetail(id: string) {
  await requireAuth();

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: {
        include: {
          assignedTo: { select: { id: true, name: true } },
        },
      },
      manager: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      tasks: {
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      },
      costs: {
        orderBy: { date: "desc" },
      },
      documents: {
        include: {
          uploadedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          amountPaid: true,
          balanceDue: true,
          status: true,
          issueDate: true,
        },
        orderBy: { issueDate: "desc" },
      },
    },
  });

  if (!project) return null;

  const totalTasks = project.tasks.length;
  const completedTasks = project.tasks.filter(
    (t) => t.status === "COMPLETED" || t.status === "VALIDATED"
  ).length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const totalSpentHours = project.tasks.reduce(
    (sum, t) => sum + Number(t.timeSpentHours || 0),
    0
  );
  const totalCosts = project.costs.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const budgetNum = Number(project.budget || 0);
  const grossMargin = budgetNum - totalCosts;
  const marginPercentage = budgetNum > 0 ? Math.round((grossMargin / budgetNum) * 100) : 0;

  const isAbonnement = Boolean(
    project.code?.startsWith("ABN-") ||
    project.name?.startsWith("Abonnement") ||
    project.name?.includes("Abonnement Mensuel") ||
    project.name?.startsWith("Régie & Tâches")
  );

  return {
    ...project,
    isAbonnement,
    budget: budgetNum,
    progress,
    totalSpentHours,
    totalCosts,
    grossMargin,
    marginPercentage,
    tasks: project.tasks.map((t) => ({
      ...t,
      timeSpentHours: Number(t.timeSpentHours || 0),
    })),
    costs: project.costs.map((c) => ({
      ...c,
      amount: Number(c.amount || 0),
    })),
    invoices: project.invoices.map((inv) => ({
      ...inv,
      total: Number(inv.total || 0),
      amountPaid: Number(inv.amountPaid || 0),
      balanceDue: Number(inv.balanceDue || 0),
    })),
  };
}

export async function createProjectAction(data: {
  clientId: string;
  name: string;
  code?: string;
  description?: string;
  status?: ProjectStatus;
  managerId?: string;
  startDate?: string;
  deadline?: string;
  budget?: number;
  projectType?: "WEB_DEV" | "PLATFORM" | "MOBILE_APP" | "CUSTOM_DEV";
}) {
  const user = await requireAuth();

  // Generate unique code if not provided according to tech project type
  let code = data.code?.trim();
  if (!code) {
    const year = new Date().getFullYear();
    const count = await prisma.project.count();
    let seq = count + 1;
    let prefix = "PRJ";
    if (data.projectType === "WEB_DEV") prefix = "WEB";
    else if (data.projectType === "PLATFORM") prefix = "PLT";
    else if (data.projectType === "MOBILE_APP") prefix = "APP";

    code = `${prefix}-${year}-${String(seq).padStart(3, "0")}`;
    while (await prisma.project.findUnique({ where: { code } })) {
      seq++;
      code = `${prefix}-${year}-${String(seq).padStart(3, "0")}`;
    }
  }

  // Format description with projectType tag if provided
  let formattedDescription = data.description?.trim() || "";
  if (data.projectType && !formattedDescription.includes("[TYPE:")) {
    formattedDescription = `[TYPE:${data.projectType}] ${formattedDescription}`.trim();
  }

  const project = await prisma.project.create({
    data: {
      clientId: data.clientId,
      name: data.name.trim(),
      code,
      description: formattedDescription || null,
      status: data.status || ProjectStatus.NEW_REQUEST,
      managerId: data.managerId || user.id,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      deadline: data.deadline ? new Date(data.deadline) : null,
      budget: Number(data.budget) || 0,
    },
    include: {
      client: true,
      manager: true,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE_PROJECT",
    module: "PROJECTS",
    entityId: project.id,
    details: { code: project.code, name: project.name, clientId: data.clientId, projectType: data.projectType },
  });

  revalidatePath("/projets");
  revalidatePath("/production");
  revalidatePath(`/clients/${data.clientId}`);

  return { success: true, project };
}

export async function updateProjectStatusAction(id: string, status: ProjectStatus) {
  const user = await requireAuth();

  const project = await prisma.project.update({
    where: { id },
    data: { status },
    include: { client: true },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE_PROJECT_STATUS",
    module: "PROJECTS",
    entityId: project.id,
    details: { code: project.code, newStatus: status },
  });

  revalidatePath("/projets");
  revalidatePath(`/projets/${id}`);
  revalidatePath("/production");
  revalidatePath(`/clients/${project.clientId}`);

  return { success: true, project };
}

export async function updateProjectAction(
  id: string,
  data: {
    name?: string;
    description?: string;
    managerId?: string;
    startDate?: string;
    deadline?: string;
    budget?: number;
    status?: ProjectStatus;
  }
) {
  const user = await requireAuth();

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.description !== undefined) updateData.description = data.description?.trim() || null;
  if (data.managerId !== undefined) updateData.managerId = data.managerId || null;
  if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
  if (data.deadline !== undefined) updateData.deadline = data.deadline ? new Date(data.deadline) : null;
  if (data.budget !== undefined) updateData.budget = Number(data.budget) || 0;
  if (data.status !== undefined) updateData.status = data.status;

  const project = await prisma.project.update({
    where: { id },
    data: updateData,
    include: { client: true },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE_PROJECT",
    module: "PROJECTS",
    entityId: project.id,
    details: { code: project.code, changes: Object.keys(updateData) },
  });

  revalidatePath("/projets");
  revalidatePath(`/projets/${id}`);
  revalidatePath("/production");
  revalidatePath(`/clients/${project.clientId}`);

  return { success: true, project };
}

export async function deleteProjectAction(id: string) {
  const user = await requireAuth();
  if (!["ADMIN", "TECH_LEAD"].includes(user.role)) {
    throw new Error("Seul un Administrateur ou Chef de Projet peut supprimer un projet.");
  }

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new Error("Projet introuvable.");

  await prisma.project.delete({ where: { id } });

  await createAuditLog({
    userId: user.id,
    action: "DELETE_PROJECT",
    module: "PROJECTS",
    entityId: id,
    details: { code: project.code, name: project.name },
  });

  revalidatePath("/projets");
  revalidatePath("/production");
  revalidatePath(`/clients/${project.clientId}`);

  return { success: true };
}

export async function addProjectCostAction(data: {
  projectId: string;
  costType: string;
  amount: number;
  description: string;
  date?: string;
}) {
  const user = await requireAuth();

  const cost = await prisma.projectCost.create({
    data: {
      projectId: data.projectId,
      costType: data.costType,
      amount: Number(data.amount) || 0,
      description: data.description.trim(),
      date: data.date ? new Date(data.date) : new Date(),
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "ADD_PROJECT_COST",
    module: "PROJECTS",
    entityId: cost.id,
    details: { projectId: data.projectId, amount: data.amount, costType: data.costType },
  });

  revalidatePath(`/projets/${data.projectId}`);
  revalidatePath("/projets");

  return { success: true, cost };
}

export async function deleteProjectCostAction(id: string, projectId: string) {
  const user = await requireAuth();

  await prisma.projectCost.delete({ where: { id } });

  await createAuditLog({
    userId: user.id,
    action: "DELETE_PROJECT_COST",
    module: "PROJECTS",
    entityId: id,
    details: { projectId },
  });

  revalidatePath(`/projets/${projectId}`);
  revalidatePath("/projets");

  return { success: true };
}
