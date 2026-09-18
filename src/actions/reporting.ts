"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function getReportingDataAction(period: string = "MONTH") {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const now = new Date();
  let startDate: Date;
  let endDate = now;

  if (period === "LAST_MONTH") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (period === "QUARTER") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  } else if (period === "YEAR") {
    startDate = new Date(now.getFullYear(), 0, 1);
  } else {
    // Current Month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // 1. Commercial Performance
  const [
    totalProspects,
    convertedClients,
    totalCalls,
    interestedCalls,
    totalAppointments,
    completedAppointments,
  ] = await Promise.all([
    prisma.prospect.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
    prisma.client.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
    prisma.call.count({ where: { calledAt: { gte: startDate, lte: endDate } } }),
    prisma.call.count({
      where: {
        calledAt: { gte: startDate, lte: endDate },
        result: { in: ["INTERESTED", "APPOINTMENT_BOOKED"] },
      },
    }),
    prisma.appointment.count({ where: { startTime: { gte: startDate, lte: endDate } } }),
    prisma.appointment.count({
      where: {
        startTime: { gte: startDate, lte: endDate },
        status: "COMPLETED",
      },
    }),
  ]);

  const commercialConversionRate =
    totalProspects > 0 ? Math.round((convertedClients / totalProspects) * 100) : 0;
  const callSuccessRate =
    totalCalls > 0 ? Math.round((interestedCalls / totalCalls) * 100) : 0;

  // 2. Production Performance
  const [activeProjects, completedProjects, totalTasks, completedTasks] =
    await Promise.all([
      prisma.project.count({ where: { status: { in: ["IN_PRODUCTION", "PLANNING", "CLIENT_VALIDATION"] } } }),
      prisma.project.count({ where: { status: "COMPLETED", updatedAt: { gte: startDate, lte: endDate } } }),
      prisma.projectTask.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
      prisma.projectTask.count({
        where: {
          status: "COMPLETED",
          updatedAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

  // 3. Financial Performance
  const invoices = await prisma.invoice.findMany({
    where: {
      issueDate: { gte: startDate, lte: endDate },
      status: { not: "CANCELLED" },
    },
    select: { total: true, amountPaid: true, balanceDue: true },
  });

  const payments = await prisma.payment.findMany({
    where: {
      paymentDate: { gte: startDate, lte: endDate },
      status: "COMPLETED",
    },
    select: { amount: true, paymentMethod: true },
  });

  const expenses = await prisma.expense.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    select: { amount: true },
  });

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: {
      orderedAt: { gte: startDate, lte: endDate },
      status: { in: ["ORDERED", "RECEIVED", "PAID"] },
    },
    select: { amount: true },
  });

  const totalInvoiced = invoices.reduce((acc, i) => acc + Number(i.total), 0);
  const totalCollected = payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const totalReceivables = invoices.reduce((acc, i) => acc + Number(i.balanceDue), 0);
  const totalExpensesAmt = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const totalPurchaseOrdersAmt = purchaseOrders.reduce(
    (acc, o) => acc + Number(o.amount),
    0
  );

  const totalCosts = totalExpensesAmt + totalPurchaseOrdersAmt;
  const netAgencyProfit = totalCollected - totalCosts;
  const globalMarginRate =
    totalCollected > 0 ? Math.round((netAgencyProfit / totalCollected) * 100) : 0;

  // Commercial Rankings
  const topSalesReps = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ["SALES_REP", "SALES_DIRECTOR"] },
    },
    select: {
      id: true,
      name: true,
      loggedCalls: {
        where: { calledAt: { gte: startDate, lte: endDate } },
        select: { id: true, result: true },
      },
      conductedAppointments: {
        where: { startTime: { gte: startDate, lte: endDate } },
        select: { id: true, status: true },
      },
      managedClients: {
        where: { createdAt: { gte: startDate, lte: endDate } },
        select: { id: true, monthlyFee: true },
      },
    },
  });

  const salesLeaderboard = topSalesReps.map((rep) => ({
    name: rep.name,
    callsCount: rep.loggedCalls.length,
    meetingsCount: rep.conductedAppointments.length,
    clientsSigned: rep.managedClients.length,
    revenueGenerated: rep.managedClients.reduce(
      (acc, c) => acc + Number(c.monthlyFee),
      0
    ),
  })).sort((a, b) => b.revenueGenerated - a.revenueGenerated);

  return {
    period,
    periodLabel:
      period === "LAST_MONTH"
        ? "Mois Précédent"
        : period === "QUARTER"
        ? "Dernier Trimestre"
        : period === "YEAR"
        ? "Année en cours"
        : "Mois en cours",
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    commercial: {
      totalProspects,
      convertedClients,
      commercialConversionRate,
      totalCalls,
      interestedCalls,
      callSuccessRate,
      totalAppointments,
      completedAppointments,
    },
    production: {
      activeProjects,
      completedProjects,
      totalTasks,
      completedTasks,
      taskCompletionRate:
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    },
    finance: {
      totalInvoiced,
      totalCollected,
      totalReceivables,
      totalCosts,
      netAgencyProfit,
      globalMarginRate,
    },
    salesLeaderboard,
  };
}
