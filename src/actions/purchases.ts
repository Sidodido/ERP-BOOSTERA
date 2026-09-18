"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PaymentMethod, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getPurchasesAndExpensesAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  // 1. Purchase Orders
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    include: {
      supplier: {
        select: { id: true, name: true, company: true, category: true },
      },
      project: {
        select: { id: true, name: true, code: true },
      },
    },
    orderBy: { orderedAt: "desc" },
  });

  // 2. Tool Subscriptions
  const toolSubscriptions = await prisma.toolSubscription.findMany({
    include: {
      manager: {
        select: { id: true, name: true },
      },
    },
    orderBy: { renewalDate: "asc" },
  });

  // 3. General Expenses
  const expenses = await prisma.expense.findMany({
    orderBy: { date: "desc" },
    take: 100,
  });

  // 4. Suppliers & Projects list for select
  const suppliers = await prisma.supplier.findMany({
    select: { id: true, name: true, category: true },
    orderBy: { name: "asc" },
  });

  const projects = await prisma.project.findMany({
    select: { id: true, name: true, code: true },
    orderBy: { createdAt: "desc" },
  });

  const totalOrdersAmount = purchaseOrders.reduce(
    (acc, o) => acc + Number(o.amount),
    0
  );
  const totalMonthlySaaS = toolSubscriptions
    .filter((s) => s.status === "ACTIVE")
    .reduce((acc, s) => acc + Number(s.monthlyCost), 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0);

  return {
    orders: purchaseOrders.map((o) => ({
      ...o,
      amount: Number(o.amount),
    })),
    subscriptions: toolSubscriptions.map((s) => ({
      ...s,
      monthlyCost: Number(s.monthlyCost),
    })),
    expenses: expenses.map((e) => ({
      ...e,
      amount: Number(e.amount),
    })),
    suppliers,
    projects,
    kpis: {
      totalOrdersAmount,
      totalMonthlySaaS,
      totalExpenses,
      activeSubscriptionsCount: toolSubscriptions.filter((s) => s.status === "ACTIVE").length,
    },
  };
}

export async function createPurchaseOrderAction(data: {
  supplierId: string;
  projectId?: string;
  amount: number;
  category: string;
  status?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const order = await prisma.purchaseOrder.create({
    data: {
      supplierId: data.supplierId,
      projectId: data.projectId || null,
      amount: new Prisma.Decimal(Number(data.amount)),
      category: data.category.trim() || "Production",
      status: data.status || "ORDERED",
    },
  });

  revalidatePath("/achats");
  revalidatePath("/fournisseurs");
  revalidatePath("/rentabilite");
  return { success: true, orderId: order.id };
}

export async function updatePurchaseOrderStatusAction(id: string, status: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  await prisma.purchaseOrder.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/achats");
  return { success: true };
}

export async function createToolSubscriptionAction(data: {
  name: string;
  category: string;
  monthlyCost: number;
  renewalDate: string;
  paymentCard?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const sub = await prisma.toolSubscription.create({
    data: {
      name: data.name.trim(),
      category: data.category.trim() || "Logiciel",
      monthlyCost: new Prisma.Decimal(Number(data.monthlyCost)),
      renewalDate: new Date(data.renewalDate),
      paymentCard: data.paymentCard?.trim() || null,
      status: "ACTIVE",
      managerId: user.id,
    },
  });

  revalidatePath("/achats");
  return { success: true, subscriptionId: sub.id };
}

export async function updateToolSubscriptionAction(
  id: string,
  data: Partial<{
    status: string;
    monthlyCost: number;
    renewalDate: string;
  }>
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const updateData: Prisma.ToolSubscriptionUpdateInput = {};
  if (data.status) updateData.status = data.status;
  if (data.monthlyCost !== undefined)
    updateData.monthlyCost = new Prisma.Decimal(data.monthlyCost);
  if (data.renewalDate) updateData.renewalDate = new Date(data.renewalDate);

  await prisma.toolSubscription.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/achats");
  return { success: true };
}

export async function createExpenseAction(data: {
  category: string;
  amount: number;
  description: string;
  paymentMethod: PaymentMethod;
  projectId?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const expense = await prisma.expense.create({
    data: {
      category: data.category.trim(),
      amount: new Prisma.Decimal(Number(data.amount)),
      description: data.description.trim(),
      paymentMethod: data.paymentMethod,
      projectId: data.projectId || null,
    },
  });

  revalidatePath("/achats");
  revalidatePath("/rentabilite");
  return { success: true, expenseId: expense.id };
}
