"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function getDocuments(params: {
  category?: string;
  clientId?: string;
  projectId?: string;
  fileType?: string;
  search?: string;
} = {}) {
  await requireAuth();

  const whereClause: any = {};

  if (params.category && params.category !== "ALL") {
    whereClause.category = params.category;
  }

  if (params.clientId) {
    whereClause.clientId = params.clientId;
  }

  if (params.projectId) {
    whereClause.projectId = params.projectId;
  }

  if (params.fileType) {
    whereClause.fileType = params.fileType;
  }

  if (params.search) {
    whereClause.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { client: { companyName: { contains: params.search, mode: "insensitive" } } },
      { project: { name: { contains: params.search, mode: "insensitive" } } },
    ];
  }

  const documents = await prisma.document.findMany({
    where: whereClause,
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          brandName: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      uploadedBy: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalBytes = documents.reduce((sum, d) => sum + (d.fileSize || 0), 0);
  const categoriesCount: Record<string, number> = {};
  for (const doc of documents) {
    categoriesCount[doc.category] = (categoriesCount[doc.category] || 0) + 1;
  }

  return {
    documents,
    totalCount: documents.length,
    totalBytes,
    categoriesCount,
  };
}

export async function uploadDocumentAction(data: {
  name: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  category: string;
  clientId?: string;
  projectId?: string;
}) {
  const user = await requireAuth();

  const doc = await prisma.document.create({
    data: {
      name: data.name.trim(),
      fileUrl: data.fileUrl.trim(),
      fileType: data.fileType || "PDF",
      fileSize: Number(data.fileSize) || 1024 * 250,
      category: data.category || "BRIEF",
      clientId: data.clientId || null,
      projectId: data.projectId || null,
      uploadedById: user.id,
    },
    include: {
      client: true,
      project: true,
      uploadedBy: true,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPLOAD_DOCUMENT",
    module: "DOCUMENTS",
    entityId: doc.id,
    details: { name: doc.name, category: doc.category, clientId: doc.clientId, projectId: doc.projectId },
  });

  revalidatePath("/documents");
  if (doc.projectId) revalidatePath(`/projets/${doc.projectId}`);
  if (doc.clientId) revalidatePath(`/clients/${doc.clientId}`);

  return { success: true, document: doc };
}

export async function deleteDocumentAction(id: string) {
  const user = await requireAuth();

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new Error("Document introuvable.");

  await prisma.document.delete({ where: { id } });

  await createAuditLog({
    userId: user.id,
    action: "DELETE_DOCUMENT",
    module: "DOCUMENTS",
    entityId: id,
    details: { name: doc.name, category: doc.category },
  });

  revalidatePath("/documents");
  if (doc.projectId) revalidatePath(`/projets/${doc.projectId}`);
  if (doc.clientId) revalidatePath(`/clients/${doc.clientId}`);

  return { success: true };
}
