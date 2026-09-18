"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AssetStatus, StockMovementType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getStocksAndAssetsAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  // 1. Assets (Equipment)
  const assets = await prisma.asset.findMany({
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // 2. Inventory Items (Consumables)
  const inventoryItems = await prisma.inventoryItem.findMany({
    include: {
      movements: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: { name: "asc" },
  });

  // 3. Users for asset assignment
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  const totalAssetValue = assets.reduce((acc, a) => acc + Number(a.price), 0);
  const lowStockCount = inventoryItems.filter(
    (i) => i.quantityInStock <= i.minThreshold
  ).length;

  return {
    assets: assets.map((a) => ({
      ...a,
      price: Number(a.price),
    })),
    inventoryItems: inventoryItems.map((i) => ({
      ...i,
      unitPrice: Number(i.unitPrice),
    })),
    users,
    kpis: {
      totalAssetsCount: assets.length,
      totalAssetValue,
      inUseAssetsCount: assets.filter((a) => a.status === AssetStatus.IN_USE).length,
      availableAssetsCount: assets.filter((a) => a.status === AssetStatus.AVAILABLE).length,
      lowStockCount,
    },
  };
}

export async function createAssetAction(data: {
  name: string;
  serialNumber?: string;
  category: string;
  price: number;
  assignedToId?: string;
  status?: AssetStatus;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const asset = await prisma.asset.create({
    data: {
      name: data.name.trim(),
      serialNumber: data.serialNumber?.trim() || null,
      category: data.category.trim() || "Matériel Vidéo",
      price: new Prisma.Decimal(Number(data.price) || 0),
      assignedToId: data.assignedToId || null,
      status: data.status || (data.assignedToId ? AssetStatus.IN_USE : AssetStatus.AVAILABLE),
    },
  });

  revalidatePath("/stocks");
  return { success: true, assetId: asset.id };
}

export async function updateAssetAction(
  id: string,
  data: Partial<{
    name: string;
    status: AssetStatus;
    assignedToId: string | null;
  }>
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  await prisma.asset.update({
    where: { id },
    data,
  });

  revalidatePath("/stocks");
  return { success: true };
}

export async function createInventoryItemAction(data: {
  name: string;
  sku?: string;
  quantityInStock: number;
  minThreshold: number;
  unitPrice: number;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const item = await prisma.inventoryItem.create({
    data: {
      name: data.name.trim(),
      sku: data.sku?.trim() || null,
      quantityInStock: Number(data.quantityInStock) || 0,
      minThreshold: Number(data.minThreshold) || 10,
      unitPrice: new Prisma.Decimal(Number(data.unitPrice) || 0),
    },
  });

  revalidatePath("/stocks");
  return { success: true, itemId: item.id };
}

export async function recordStockMovementAction(data: {
  itemId: string;
  type: StockMovementType;
  quantity: number;
  reason?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const qty = Math.max(1, Number(data.quantity) || 1);
  const item = await prisma.inventoryItem.findUnique({ where: { id: data.itemId } });
  if (!item) throw new Error("Article introuvable");

  let newQuantity = item.quantityInStock;
  if (data.type === StockMovementType.IN) {
    newQuantity += qty;
  } else if (data.type === StockMovementType.OUT) {
    newQuantity = Math.max(0, newQuantity - qty);
  } else if (data.type === StockMovementType.ADJUSTMENT) {
    newQuantity = qty;
  }

  await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        itemId: data.itemId,
        type: data.type,
        quantity: qty,
        reason: data.reason?.trim() || null,
        userId: user.id,
      },
    }),
    prisma.inventoryItem.update({
      where: { id: data.itemId },
      data: { quantityInStock: newQuantity },
    }),
  ]);

  revalidatePath("/stocks");
  return { success: true };
}
