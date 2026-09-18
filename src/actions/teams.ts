"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { DepartmentType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  syncAllGoalsForMonth,
  calculateLiveMetricAchieved,
} from "@/lib/goals-sync";

export async function getTeamsDataAction(monthParam?: number, yearParam?: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const now = new Date();
  const currentMonth = monthParam || now.getMonth() + 1;
  const currentYear = yearParam || now.getFullYear();

  // Synchronisation automatique en temps réel des objectifs avec les actions réelles
  await syncAllGoalsForMonth(currentMonth, currentYear);

  // 1. Employees with department & assigned tasks
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          assignedTasks: {
            where: { status: { not: "COMPLETED" } },
            select: { id: true, title: true, priority: true, status: true },
          },
        },
      },
      goals: {
        where: { month: currentMonth, year: currentYear },
      },
      reviews: {
        orderBy: { reviewDate: "desc" },
        take: 3,
        include: {
          reviewer: { select: { name: true } },
        },
      },
    },
    orderBy: { firstName: "asc" },
  });

  // Group by Department
  const departmentGroups: Record<
    string,
    {
      name: string;
      label: string;
      leadName?: string;
      members: any[];
      activeTasksCount: number;
    }
  > = {
    COMMERCIAL: {
      name: "COMMERCIAL",
      label: "Pôle Commercial & Prospection",
      members: [],
      activeTasksCount: 0,
    },
    VIDEO: {
      name: "VIDEO",
      label: "Pôle Vidéo & Tournage",
      members: [],
      activeTasksCount: 0,
    },
    DESIGN: {
      name: "DESIGN",
      label: "Pôle Graphisme & Design UI/UX",
      members: [],
      activeTasksCount: 0,
    },
    DEVELOPMENT: {
      name: "DEVELOPMENT",
      label: "Pôle Développement Web & Tech",
      members: [],
      activeTasksCount: 0,
    },
    MARKETING: {
      name: "MARKETING",
      label: "Pôle Marketing & Media Buying",
      members: [],
      activeTasksCount: 0,
    },
    ADMINISTRATION: {
      name: "ADMINISTRATION",
      label: "Direction & Administration",
      members: [],
      activeTasksCount: 0,
    },
  };

  for (const emp of employees) {
    const deptKey = emp.department in departmentGroups ? emp.department : "ADMINISTRATION";
    const tasksCount = emp.user?.assignedTasks.length || 0;
    departmentGroups[deptKey].activeTasksCount += tasksCount;
    departmentGroups[deptKey].members.push({
      id: emp.id,
      userId: emp.userId,
      name: `${emp.firstName} ${emp.lastName}`,
      position: emp.position,
      email: emp.email || emp.user?.email,
      phone: emp.phone,
      activeTasksCount: tasksCount,
      goals: emp.goals.map((g) => ({
        ...g,
        targetValue: Number(g.targetValue),
        achievedValue: Number(g.achievedValue),
      })),
      reviews: emp.reviews.map((r) => ({
        ...r,
        scorePercentage: Number(r.scorePercentage),
        commercialScore: r.commercialScore ? Number(r.commercialScore) : null,
        technicalScore: r.technicalScore ? Number(r.technicalScore) : null,
      })),
    });
  }

  // 2. All active goals for the month
  const allGoals = await prisma.employeeGoal.findMany({
    where: { month: currentMonth, year: currentYear },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, position: true },
      },
    },
  });

  // 3. Recent Performance Reviews
  const recentReviews = await prisma.performanceReview.findMany({
    orderBy: { reviewDate: "desc" },
    take: 15,
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, position: true },
      },
      reviewer: {
        select: { id: true, name: true },
      },
    },
  });

  return {
    month: currentMonth,
    year: currentYear,
    departments: Object.values(departmentGroups),
    goals: allGoals.map((g) => ({
      ...g,
      targetValue: Number(g.targetValue),
      achievedValue: Number(g.achievedValue),
    })),
    recentReviews: recentReviews.map((r) => ({
      ...r,
      scorePercentage: Number(r.scorePercentage),
      commercialScore: r.commercialScore ? Number(r.commercialScore) : null,
      technicalScore: r.technicalScore ? Number(r.technicalScore) : null,
    })),
    employeesList: employees.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      position: e.position,
    })),
  };
}

export async function createEmployeeGoalAction(data: {
  employeeId: string;
  month: number;
  year: number;
  metric: string;
  targetValue: number;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const emp = await prisma.employee.findUnique({
    where: { id: data.employeeId },
    select: { userId: true, department: true },
  });

  const month = Number(data.month);
  const year = Number(data.year);
  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  let initialAchieved = 0;
  if (emp?.userId) {
    initialAchieved = await calculateLiveMetricAchieved(
      data.metric,
      emp.userId,
      startOfMonth,
      endOfMonth,
      emp.department
    );
  }

  const goal = await prisma.employeeGoal.create({
    data: {
      employeeId: data.employeeId,
      month: month,
      year: year,
      metric: data.metric,
      targetValue: new Prisma.Decimal(Number(data.targetValue)),
      achievedValue: new Prisma.Decimal(initialAchieved),
    },
  });

  revalidatePath("/equipes");
  revalidatePath("/dashboard");
  return { success: true, goalId: goal.id };
}

export async function updateEmployeeGoalAction(id: string, achievedValue: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  await prisma.employeeGoal.update({
    where: { id },
    data: {
      achievedValue: new Prisma.Decimal(Number(achievedValue)),
    },
  });

  revalidatePath("/equipes");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function syncGoalsAction(monthParam?: number, yearParam?: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const now = new Date();
  const currentMonth = monthParam || now.getMonth() + 1;
  const currentYear = yearParam || now.getFullYear();

  const synced = await syncAllGoalsForMonth(currentMonth, currentYear);
  revalidatePath("/equipes");
  revalidatePath("/dashboard");
  return { success: true, syncedCount: synced.length, goals: synced };
}

export async function createPerformanceReviewAction(data: {
  employeeId: string;
  scorePercentage: number;
  commercialScore?: number;
  technicalScore?: number;
  feedback?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const review = await prisma.performanceReview.create({
    data: {
      employeeId: data.employeeId,
      reviewerId: user.id,
      scorePercentage: new Prisma.Decimal(Number(data.scorePercentage)),
      commercialScore: data.commercialScore
        ? new Prisma.Decimal(Number(data.commercialScore))
        : null,
      technicalScore: data.technicalScore
        ? new Prisma.Decimal(Number(data.technicalScore))
        : null,
      feedback: data.feedback?.trim() || null,
    },
  });

  revalidatePath("/equipes");
  return { success: true, reviewId: review.id };
}
