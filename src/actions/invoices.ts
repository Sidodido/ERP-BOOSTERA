"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getInvoicesAction(filters?: {
  status?: string;
  search?: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Non authentifié");
  }

  const where: Prisma.InvoiceWhereInput = {};

  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status as InvoiceStatus;
  }

  if (filters?.search && filters.search.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { client: { companyName: { contains: q, mode: "insensitive" } } },
      { client: { contactName: { contains: q, mode: "insensitive" } } },
      { notes: { contains: q, mode: "insensitive" } },
    ];
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          phone: true,
          email: true,
          address: true,
          wilaya: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      items: true,
      payments: {
        orderBy: { paymentDate: "desc" },
        include: {
          recordedBy: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate global summary KPIs
  const allInvoices = await prisma.invoice.findMany({
    select: {
      total: true,
      amountPaid: true,
      balanceDue: true,
      status: true,
      dueDate: true,
    },
  });

  const now = new Date();
  let totalBilled = 0;
  let totalCollected = 0;
  let totalBalanceDue = 0;
  let overdueCount = 0;

  for (const inv of allInvoices) {
    if (inv.status !== InvoiceStatus.CANCELLED) {
      totalBilled += Number(inv.total);
      totalCollected += Number(inv.amountPaid);
      totalBalanceDue += Number(inv.balanceDue);
      if (
        (inv.status === InvoiceStatus.OVERDUE ||
          (inv.status !== InvoiceStatus.PAID && new Date(inv.dueDate) < now))
      ) {
        overdueCount++;
      }
    }
  }

  return {
    invoices: invoices.map((inv) => ({
      ...inv,
      subtotal: Number(inv.subtotal),
      taxRate: Number(inv.taxRate),
      taxAmount: Number(inv.taxAmount),
      total: Number(inv.total),
      amountPaid: Number(inv.amountPaid),
      balanceDue: Number(inv.balanceDue),
      items: inv.items.map((it) => ({
        ...it,
        unitPrice: Number(it.unitPrice),
        total: Number(it.total),
      })),
      payments: inv.payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
    })),
    kpis: {
      totalBilled,
      totalCollected,
      totalBalanceDue,
      overdueCount,
      totalInvoices: allInvoices.length,
    },
  };
}

export async function createInvoiceAction(data: {
  clientId: string;
  projectId?: string;
  dueDate: string;
  taxRate?: number;
  notes?: string;
  items: { description: string; quantity: number; unitPrice: number }[];
}) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Non authentifié");
  }

  if (!data.clientId) {
    throw new Error("Client requis");
  }
  if (!data.items || data.items.length === 0) {
    throw new Error("Au moins une ligne d'article est requise");
  }

  // Calculate items total
  let subtotal = 0;
  const processedItems = data.items.map((item) => {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    const lineTotal = qty * price;
    subtotal += lineTotal;
    return {
      description: item.description.trim() || "Prestation",
      quantity: qty,
      unitPrice: new Prisma.Decimal(price),
      total: new Prisma.Decimal(lineTotal),
    };
  });

  const taxRateVal = Number(data.taxRate) || 0;
  const taxAmount = (subtotal * taxRateVal) / 100;
  const total = subtotal + taxAmount;

  // Generate sequence invoice number FAC-YYYY-XXXX
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count();
  let candidateSeq = count + 1;
  let invoiceNumber = `FAC-${year}-${String(candidateSeq).padStart(4, "0")}`;
  while (await prisma.invoice.findUnique({ where: { invoiceNumber } })) {
    candidateSeq++;
    invoiceNumber = `FAC-${year}-${String(candidateSeq).padStart(4, "0")}`;
  }

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      clientId: data.clientId,
      projectId: data.projectId || null,
      dueDate: new Date(data.dueDate),
      subtotal: new Prisma.Decimal(subtotal),
      taxRate: new Prisma.Decimal(taxRateVal),
      taxAmount: new Prisma.Decimal(taxAmount),
      total: new Prisma.Decimal(total),
      amountPaid: new Prisma.Decimal(0),
      balanceDue: new Prisma.Decimal(total),
      status: InvoiceStatus.SENT,
      notes: data.notes || null,
      items: {
        create: processedItems,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "CREATE",
      module: "FINANCE",
      entityId: invoice.id,
      details: JSON.stringify({
        invoiceNumber,
        total,
        clientId: data.clientId,
      }),
    },
  });

  revalidatePath("/facturation");
  revalidatePath("/finance");
  revalidatePath(`/clients/${data.clientId}`);

  return { success: true, invoiceId: invoice.id, invoiceNumber };
}

export async function updateInvoiceStatusAction(id: string, status: InvoiceStatus) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const invoice = await prisma.invoice.update({
    where: { id },
    data: { status },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "UPDATE",
      module: "FINANCE",
      entityId: id,
      details: JSON.stringify({ status, invoiceNumber: invoice.invoiceNumber }),
    },
  });

  revalidatePath("/facturation");
  revalidatePath("/finance");
  return { success: true };
}

export async function deleteInvoiceAction(id: string) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SALES_DIRECTOR")) {
    throw new Error("Permission refusée");
  }

  const invoice = await prisma.invoice.delete({
    where: { id },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "DELETE",
      module: "FINANCE",
      entityId: id,
      details: JSON.stringify({ invoiceNumber: invoice.invoiceNumber }),
    },
  });

  revalidatePath("/facturation");
  revalidatePath("/finance");
  return { success: true };
}
