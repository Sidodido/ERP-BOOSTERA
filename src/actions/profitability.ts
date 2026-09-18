"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { OfferType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getProfitabilityMetricsAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  // 1. Projects with client, invoices, costs and purchase orders
  const projects = await prisma.project.findMany({
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          offerType: true,
          monthlyFee: true,
        },
      },
      invoices: {
        where: { status: { not: "CANCELLED" } },
        select: { total: true, amountPaid: true },
      },
      costs: {
        orderBy: { date: "desc" },
      },
      purchaseOrders: {
        where: { status: { not: "REQUESTED" } },
        select: { amount: true, category: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  let totalAgencyRevenue = 0;
  let totalAgencyCosts = 0;

  const packStats: Record<
    OfferType,
    { revenue: number; costs: number; count: number }
  > = {
    STARTER: { revenue: 0, costs: 0, count: 0 },
    SILVER: { revenue: 0, costs: 0, count: 0 },
    GOLD: { revenue: 0, costs: 0, count: 0 },
    CUSTOM: { revenue: 0, costs: 0, count: 0 },
  };

  const projectMetrics = projects.map((p) => {
    // Project revenue: sum of invoices total or fallback to project budget
    const invoicesTotal = p.invoices.reduce((acc, inv) => acc + Number(inv.total), 0);
    const revenue = invoicesTotal > 0 ? invoicesTotal : Number(p.budget);

    // Project costs: sum of direct project costs + purchase orders
    const directCosts = p.costs.reduce((acc, c) => acc + Number(c.amount), 0);
    const orderCosts = p.purchaseOrders.reduce((acc, o) => acc + Number(o.amount), 0);
    const totalCosts = directCosts + orderCosts;

    const netMargin = revenue - totalCosts;
    const marginPercentage =
      revenue > 0 ? Math.round((netMargin / revenue) * 100) : 0;

    totalAgencyRevenue += revenue;
    totalAgencyCosts += totalCosts;

    const pack = p.client.offerType || OfferType.CUSTOM;
    if (packStats[pack]) {
      packStats[pack].revenue += revenue;
      packStats[pack].costs += totalCosts;
      packStats[pack].count++;
    }

    return {
      id: p.id,
      name: p.name,
      code: p.code,
      clientName: p.client.companyName,
      offerType: p.client.offerType,
      revenue,
      costs: totalCosts,
      directCosts,
      orderCosts,
      netMargin,
      marginPercentage,
      status: p.status,
      costsList: p.costs.map((c) => ({
        ...c,
        amount: Number(c.amount),
      })),
    };
  });

  const agencyNetMargin = totalAgencyRevenue - totalAgencyCosts;
  const agencyMarginPercentage =
    totalAgencyRevenue > 0
      ? Math.round((agencyNetMargin / totalAgencyRevenue) * 100)
      : 0;

  const packSummary = Object.entries(packStats).map(([pack, stats]) => {
    const margin = stats.revenue - stats.costs;
    const marginPct =
      stats.revenue > 0 ? Math.round((margin / stats.revenue) * 100) : 0;
    return {
      pack: pack as OfferType,
      count: stats.count,
      revenue: stats.revenue,
      costs: stats.costs,
      netMargin: margin,
      marginPercentage: marginPct,
    };
  });

  return {
    kpis: {
      totalAgencyRevenue,
      totalAgencyCosts,
      agencyNetMargin,
      agencyMarginPercentage,
      totalProjects: projects.length,
      profitableProjectsCount: projectMetrics.filter((m) => m.marginPercentage >= 35).length,
      atRiskProjectsCount: projectMetrics.filter((m) => m.marginPercentage < 20).length,
    },
    projects: projectMetrics,
    packSummary,
  };
}

export async function addProjectCostAction(data: {
  projectId: string;
  costType: string;
  amount: number;
  description: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const cost = await prisma.projectCost.create({
    data: {
      projectId: data.projectId,
      costType: data.costType,
      amount: new Prisma.Decimal(Number(data.amount)),
      description: data.description.trim(),
    },
  });

  revalidatePath("/rentabilite");
  return { success: true, costId: cost.id };
}
