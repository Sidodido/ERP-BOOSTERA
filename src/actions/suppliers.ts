"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getSuppliersAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const suppliers = await prisma.supplier.findMany({
    include: {
      orders: {
        orderBy: { orderedAt: "desc" },
        include: {
          project: { select: { id: true, name: true, code: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return suppliers.map((s) => ({
    ...s,
    totalSpent: s.orders.reduce((acc, o) => acc + Number(o.amount), 0),
    orders: s.orders.map((o) => ({
      ...o,
      amount: Number(o.amount),
    })),
  }));
}

export async function createSupplierAction(data: {
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  address?: string;
  category: string;
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  if (!data.name.trim()) throw new Error("Nom requis");

  const supplier = await prisma.supplier.create({
    data: {
      name: data.name.trim(),
      company: data.company?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      address: data.address?.trim() || null,
      category: data.category.trim() || "Production",
      notes: data.notes?.trim() || null,
    },
  });

  revalidatePath("/fournisseurs");
  revalidatePath("/achats");
  return { success: true, supplierId: supplier.id };
}

export async function updateSupplierAction(
  id: string,
  data: Partial<{
    name: string;
    company: string;
    phone: string;
    email: string;
    address: string;
    category: string;
    notes: string;
  }>
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  await prisma.supplier.update({
    where: { id },
    data,
  });

  revalidatePath("/fournisseurs");
  return { success: true };
}

export async function deleteSupplierAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  await prisma.supplier.delete({
    where: { id },
  });

  revalidatePath("/fournisseurs");
  return { success: true };
}
