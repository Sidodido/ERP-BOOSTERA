"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PaymentMethod, PaymentType, PaymentStatus, InvoiceStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getFinanceOverviewAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  // Current month bounds
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // 1. All payments
  const payments = await prisma.payment.findMany({
    include: {
      client: {
        select: { id: true, companyName: true, contactName: true, phone: true },
      },
      invoice: {
        select: { id: true, invoiceNumber: true, total: true, balanceDue: true },
      },
      recordedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { paymentDate: "desc" },
    take: 100,
  });

  // Calculate totals
  let totalRevenueCollected = 0;
  let currentMonthCollected = 0;
  const methodBreakdown: Record<PaymentMethod, number> = {
    CASH: 0,
    BARIDIMOB: 0,
    BANK_TRANSFER: 0,
    CARD: 0,
    OTHER: 0,
  };

  for (const p of payments) {
    if (p.status === PaymentStatus.COMPLETED) {
      const amt = Number(p.amount);
      totalRevenueCollected += amt;
      const pDate = new Date(p.paymentDate);
      if (pDate >= startOfMonth && pDate <= endOfMonth) {
        currentMonthCollected += amt;
      }
      if (methodBreakdown[p.paymentMethod] !== undefined) {
        methodBreakdown[p.paymentMethod] += amt;
      } else {
        methodBreakdown.OTHER += amt;
      }
    }
  }

  // 2. Pending receivables from invoices
  const activeInvoices = await prisma.invoice.findMany({
    where: {
      status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.PAID] },
    },
    select: { balanceDue: true, dueDate: true, status: true },
  });

  let totalReceivables = 0;
  let overdueReceivables = 0;
  for (const inv of activeInvoices) {
    const bal = Number(inv.balanceDue);
    totalReceivables += bal;
    if (inv.status === InvoiceStatus.OVERDUE || new Date(inv.dueDate) < now) {
      overdueReceivables += bal;
    }
  }

  // 3. Payment Schedules
  const schedules = await prisma.paymentSchedule.findMany({
    include: {
      client: {
        select: { id: true, companyName: true, phone: true },
      },
      invoice: {
        select: { id: true, invoiceNumber: true },
      },
    },
    orderBy: { dueDate: "asc" },
    take: 50,
  });

  // 4. Sponsor Campaigns
  const sponsorCampaigns = await prisma.sponsorCampaign.findMany({
    include: {
      client: {
        select: { id: true, companyName: true },
      },
    },
    orderBy: { startDate: "desc" },
  });

  // 5. Clients list for selection
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      companyName: true,
      contactName: true,
      invoices: {
        where: { status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.PAID] } },
        select: { id: true, invoiceNumber: true, balanceDue: true, total: true },
      },
    },
    orderBy: { companyName: "asc" },
  });

  return {
    kpis: {
      totalRevenueCollected,
      currentMonthCollected,
      totalReceivables,
      overdueReceivables,
    },
    methodBreakdown,
    payments: payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
      invoice: p.invoice
        ? {
            ...p.invoice,
            total: Number(p.invoice.total),
            balanceDue: Number(p.invoice.balanceDue),
          }
        : null,
    })),
    schedules: schedules.map((s) => ({
      ...s,
      amount: Number(s.amount),
    })),
    sponsorCampaigns: sponsorCampaigns.map((sc) => ({
      ...sc,
      budget: Number(sc.budget),
      amountPaid: Number(sc.amountPaid),
      remaining: Number(sc.remaining),
    })),
    clients: clients.map((c) => ({
      ...c,
      invoices: c.invoices.map((inv) => ({
        ...inv,
        balanceDue: Number(inv.balanceDue),
        total: Number(inv.total),
      })),
    })),
  };
}

export async function recordPaymentAction(data: {
  clientId: string;
  invoiceId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentType?: PaymentType;
  reference?: string;
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const amt = Number(data.amount);
  if (!data.clientId || amt <= 0) {
    throw new Error("Client et montant positif requis");
  }

  const payment = await prisma.payment.create({
    data: {
      clientId: data.clientId,
      invoiceId: data.invoiceId || null,
      amount: new Prisma.Decimal(amt),
      paymentMethod: data.paymentMethod,
      paymentType: data.paymentType || PaymentType.MONTHLY_SUBSCRIPTION,
      reference: data.reference?.trim() || null,
      notes: data.notes?.trim() || null,
      status: PaymentStatus.COMPLETED,
      recordedById: user.id,
    },
  });

  // Update invoice balance if linked
  if (data.invoiceId) {
    const inv = await prisma.invoice.findUnique({
      where: { id: data.invoiceId },
    });
    if (inv) {
      const currentPaid = Number(inv.amountPaid);
      const total = Number(inv.total);
      const newPaid = currentPaid + amt;
      const newBalance = Math.max(0, total - newPaid);
      const newStatus = newBalance === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL;

      await prisma.invoice.update({
        where: { id: data.invoiceId },
        data: {
          amountPaid: new Prisma.Decimal(newPaid),
          balanceDue: new Prisma.Decimal(newBalance),
          status: newStatus,
        },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "PAYMENT_RECORDED",
      module: "FINANCE",
      entityId: payment.id,
      details: JSON.stringify({
        clientId: data.clientId,
        invoiceId: data.invoiceId,
        amount: amt,
        method: data.paymentMethod,
      }),
    },
  });

  revalidatePath("/finance");
  revalidatePath("/facturation");
  revalidatePath(`/clients/${data.clientId}`);

  return { success: true, paymentId: payment.id };
}

export async function createPaymentScheduleAction(data: {
  clientId: string;
  invoiceId?: string;
  dueDate: string;
  amount: number;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const schedule = await prisma.paymentSchedule.create({
    data: {
      clientId: data.clientId,
      invoiceId: data.invoiceId || null,
      dueDate: new Date(data.dueDate),
      amount: new Prisma.Decimal(data.amount),
      status: "PENDING",
    },
  });

  revalidatePath("/finance");
  return { success: true, scheduleId: schedule.id };
}

export async function createSponsorCampaignAction(data: {
  clientId: string;
  platform: string;
  budget: number;
  durationDays: number;
  startDate: string;
  endDate: string;
  amountPaid?: number;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const budget = Number(data.budget);
  const paid = Number(data.amountPaid) || 0;
  const remaining = Math.max(0, budget - paid);

  const campaign = await prisma.sponsorCampaign.create({
    data: {
      clientId: data.clientId,
      platform: data.platform,
      budget: new Prisma.Decimal(budget),
      durationDays: Number(data.durationDays) || 30,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      amountPaid: new Prisma.Decimal(paid),
      remaining: new Prisma.Decimal(remaining),
      status: "ACTIVE",
    },
  });

  revalidatePath("/finance");
  return { success: true, campaignId: campaign.id };
}

export async function updateSponsorCampaignAction(
  id: string,
  data: Partial<{ status: string; amountPaid: number }>
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const campaign = await prisma.sponsorCampaign.findUnique({ where: { id } });
  if (!campaign) throw new Error("Campagne non trouvée");

  const updateData: Prisma.SponsorCampaignUpdateInput = {};
  if (data.status) updateData.status = data.status;
  if (data.amountPaid !== undefined) {
    const paid = Number(data.amountPaid);
    const budget = Number(campaign.budget);
    updateData.amountPaid = new Prisma.Decimal(paid);
    updateData.remaining = new Prisma.Decimal(Math.max(0, budget - paid));
  }

  await prisma.sponsorCampaign.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/finance");
  return { success: true };
}
