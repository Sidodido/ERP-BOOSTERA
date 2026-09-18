"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import {
  ClientStatus,
  OfferType,
  CallResult,
  ProjectStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  parseClientMedia,
  serializeClientMedia,
  type ClientMediaLinks,
  parseClientBilling,
  serializeClientBilling,
  type ClientBillingData,
} from "@/lib/utils";
import fs from "fs/promises";
import path from "path";
import { awardClientSigningCommissionAction } from "@/actions/rh";

export async function getClients(params: {
  search?: string;
  status?: ClientStatus;
  sector?: string;
  offerType?: OfferType;
} = {}) {
  const user = await requireAuth();
  const isPrivileged = ["ADMIN", "SALES_DIRECTOR", "ACCOUNTANT"].includes(user.role);

  const whereClause: any = {};
  if (!isPrivileged) {
    whereClause.assignedToId = user.id;
  }

  if (params.status) {
    whereClause.status = params.status;
  }

  if (params.sector) {
    whereClause.sector = params.sector;
  }

  if (params.offerType) {
    whereClause.offerType = params.offerType;
  }

  if (params.search) {
    whereClause.OR = [
      { companyName: { contains: params.search, mode: "insensitive" } },
      { contactName: { contains: params.search, mode: "insensitive" } },
      { phone: { contains: params.search, mode: "insensitive" } },
      { email: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const clients = await prisma.client.findMany({
    where: whereClause,
    include: {
      assignedTo: { select: { id: true, name: true } },
      _count: {
        select: {
          projects: true,
          invoices: true,
          payments: true,
          calls: true,
          appointments: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return clients;
}

export async function getClientDetail(id: string) {
  const user = await requireAuth();

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, phone: true } },
      convertedFrom: { select: { id: true, createdAt: true, source: true } },
      calls: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { calledAt: "desc" },
      },
      appointments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { startTime: "desc" },
      },
      projects: {
        include: {
          manager: { select: { id: true, name: true } },
          documents: {
            include: { uploadedBy: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
          },
          _count: { select: { tasks: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      invoices: {
        include: { items: true, client: true },
        orderBy: { issueDate: "desc" },
      },
      payments: {
        include: {
          recordedBy: { select: { id: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true, total: true } },
        },
        orderBy: { paymentDate: "desc" },
      },
      documents: {
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!client) return null;

  // Commercial restrictions
  const isPrivileged = ["ADMIN", "SALES_DIRECTOR", "ACCOUNTANT", "TECH_LEAD"].includes(user.role);
  if (!isPrivileged && client.assignedToId !== user.id) {
    throw new Error("FORBIDDEN");
  }
  return client;
}

export async function createClientAction(data: {
  companyName: string;
  brandName?: string;
  contactName?: string;
  phone: string;
  email?: string;
  facebook?: string;
  instagram?: string;
  address?: string;
  sector: string;
  wilaya?: string;
  offerType: OfferType;
  hasWebsite?: boolean;
  status?: ClientStatus;
  contractValue: number;
  monthlyFee?: number;
  contractStart?: string;
  contractEnd?: string;
  notes?: string;
  assignedToId?: string;
}) {
  const user = await requireAuth();

  const contractVal = Number.isFinite(Number(data.contractValue)) ? Math.max(0, Number(data.contractValue)) : 0;
  const monthlyVal = Number.isFinite(Number(data.monthlyFee)) ? Math.max(0, Number(data.monthlyFee)) : 0;

  let startDate: Date = new Date();
  if (data.contractStart && !isNaN(Date.parse(data.contractStart))) {
    startDate = new Date(data.contractStart);
  }

  let endDate: Date | null = null;
  if (data.contractEnd && data.contractEnd.trim() !== "" && !isNaN(Date.parse(data.contractEnd))) {
    endDate = new Date(data.contractEnd);
  }

  const client = await prisma.client.create({
    data: {
      companyName: data.companyName.trim(),
      brandName: data.brandName?.trim() || data.companyName.trim(),
      contactName: data.contactName?.trim() || null,
      phone: data.phone.trim(),
      email: data.email?.trim() || null,
      facebook: data.facebook?.trim() || null,
      instagram: data.instagram?.trim() || null,
      address: data.address?.trim() || null,
      sector: data.sector || "Autre",
      wilaya: data.wilaya || "Alger",
      offerType: data.offerType,
      hasWebsite: Boolean(data.hasWebsite || data.offerType === "STARTER"),
      contractValue: contractVal,
      monthlyFee: monthlyVal,
      contractStart: startDate,
      contractEnd: endDate,
      notes: data.notes?.trim() || null,
      assignedToId: data.assignedToId || user.id,
      status: data.status || ClientStatus.IN_PREPARATION,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE",
    module: "CLIENTS",
    entityId: client.id,
    details: { companyName: client.companyName },
  });

  // Attribuer automatiquement la commission de signature de 500 DA dans la paie du mois de signature
  try {
    await awardClientSigningCommissionAction({
      clientId: client.id,
      userId: client.assignedToId || user.id,
      signedDate: client.contractStart || new Date(),
    });
  } catch (commErr) {
    console.warn("Erreur attribution commission signature client:", commErr);
  }

  revalidatePath("/clients");
  return { success: true, client };
}

export async function updateClientAction(
  id: string,
  data: {
    companyName?: string;
    brandName?: string;
    contactName?: string;
    phone?: string;
    email?: string;
    facebook?: string;
    instagram?: string;
    address?: string;
    sector?: string;
    wilaya?: string;
    status?: ClientStatus;
    offerType?: OfferType;
    hasWebsite?: boolean;
    contractStart?: string;
    contractEnd?: string;
    contractValue?: number;
    monthlyFee?: number;
    notes?: string;
    assignedToId?: string;
    mediaLinks?: ClientMediaLinks;
    billingInfo?: ClientBillingData;
  }
) {
  const user = await requireAuth();

  const current = await prisma.client.findUnique({ where: { id } });
  if (!current) throw new Error("Client introuvable.");

  let finalNotes = data.notes !== undefined ? data.notes : current.notes;

  // Handle media links if provided
  if (data.mediaLinks) {
    const { cleanNotes } = parseClientMedia(finalNotes, current);
    finalNotes = serializeClientMedia(data.mediaLinks, cleanNotes);
  }

  // Handle billing info if provided
  if (data.billingInfo) {
    finalNotes = serializeClientBilling(data.billingInfo, finalNotes);
  }

  const updateData: any = {};
  if (data.companyName !== undefined) updateData.companyName = data.companyName.trim();
  if (data.brandName !== undefined) updateData.brandName = data.brandName.trim() || null;
  if (data.contactName !== undefined) updateData.contactName = data.contactName.trim() || null;
  if (data.phone !== undefined) updateData.phone = data.phone.trim();
  if (data.email !== undefined) updateData.email = data.email.trim() || null;
  if (data.facebook !== undefined) updateData.facebook = data.facebook.trim() || null;
  if (data.instagram !== undefined) updateData.instagram = data.instagram.trim() || null;
  if (data.address !== undefined) updateData.address = data.address.trim() || null;
  if (data.sector !== undefined) updateData.sector = data.sector.trim();
  if (data.wilaya !== undefined) updateData.wilaya = data.wilaya.trim() || null;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.offerType !== undefined) updateData.offerType = data.offerType;
  if (data.hasWebsite !== undefined) updateData.hasWebsite = data.hasWebsite;
  if (data.contractStart !== undefined) updateData.contractStart = data.contractStart ? new Date(data.contractStart) : null;
  if (data.contractEnd !== undefined) updateData.contractEnd = data.contractEnd ? new Date(data.contractEnd) : null;
  if (data.contractValue !== undefined) updateData.contractValue = Number(data.contractValue) || 0;
  if (data.monthlyFee !== undefined) updateData.monthlyFee = Number(data.monthlyFee) || 0;
  if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId || null;
  if (finalNotes !== undefined) updateData.notes = finalNotes;

  const updated = await prisma.client.update({
    where: { id },
    data: updateData,
    include: {
      assignedTo: { select: { id: true, name: true, phone: true } },
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE_CLIENT_INFO",
    module: "CLIENTS",
    entityId: id,
    details: updateData,
  });

  if (updated.assignedToId) {
    try {
      await awardClientSigningCommissionAction({
        clientId: updated.id,
        userId: updated.assignedToId,
        signedDate: updated.contractStart || updated.createdAt,
      });
    } catch (commErr) {
      console.warn("Erreur attribution commission signature client:", commErr);
    }
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/facturation");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
  return { success: true, client: updated };
}

export async function updateClientStatusAction(id: string, status: ClientStatus) {
  const user = await requireAuth();
  const updated = await prisma.client.update({
    where: { id },
    data: { status },
    include: {
      assignedTo: { select: { id: true, name: true, phone: true } },
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE_CLIENT_STATUS",
    module: "CLIENTS",
    entityId: id,
    details: { status },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/abonnements");
  revalidatePath(`/abonnements/${id}`);
  revalidatePath("/dashboard");
  return { success: true, client: updated };
}

export async function updateClientMediaAction(
  clientId: string,
  media: ClientMediaLinks
) {
  const user = await requireAuth();
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("CLIENT_NOT_FOUND");

  const newNotes = serializeClientMedia(media, client.notes);

  const updated = await prisma.client.update({
    where: { id: clientId },
    data: {
      facebook: media.facebook?.trim() || null,
      instagram: media.instagram?.trim() || null,
      notes: newNotes,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE_CLIENT_MEDIA",
    module: "CLIENTS",
    entityId: clientId,
    details: media as any,
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/abonnements/${clientId}`);
  revalidatePath("/abonnements");
  return { success: true, client: updated };
}


export async function createClientCallAction(data: {
  clientId: string;
  purpose?: string;
  result?: CallResult;
  comment: string;
  durationMinutes?: number;
  calledAt?: string;
}) {
  const user = await requireAuth();
  const durationSeconds = (Number(data.durationMinutes) || 5) * 60;
  const calledAtDate = data.calledAt ? new Date(data.calledAt) : new Date();

  const purposeKey = data.purpose || "OTHER";
  const rawComment = data.comment?.trim() || "";
  const formattedComment = rawComment.startsWith("[BUT:")
    ? rawComment
    : `[BUT: ${purposeKey}] ${rawComment}`;

  const callResult = data.result || CallResult.INTERESTED;

  const call = await prisma.call.create({
    data: {
      clientId: data.clientId,
      userId: user.id,
      result: callResult,
      comment: formattedComment,
      durationSeconds,
      calledAt: calledAtDate,
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE_CLIENT_CALL",
    module: "CLIENTS",
    entityId: call.id,
    details: { clientId: data.clientId, purpose: purposeKey, result: callResult },
  });

  revalidatePath(`/clients/${data.clientId}`);
  return { success: true, call };
}

export async function uploadProjectFileAction(formData: FormData) {
  const user = await requireAuth();
  const file = formData.get("file") as File;
  if (!file || typeof file === "string") {
    return { success: false, error: "Aucun fichier valide fourni" };
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "cahiers-des-charges");
  await fs.mkdir(uploadsDir, { recursive: true });

  const safeOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${Date.now()}_${safeOriginalName}`;
  const targetPath = path.join(uploadsDir, uniqueName);

  await fs.writeFile(targetPath, buffer);

  const ext = safeOriginalName.split(".").pop()?.toUpperCase() || "PDF";
  let fileType = "OTHER";
  if (["PDF"].includes(ext)) fileType = "PDF";
  else if (["PNG", "JPG", "JPEG", "WEBP", "GIF", "SVG"].includes(ext)) fileType = "IMAGE";
  else if (["XLS", "XLSX", "CSV"].includes(ext)) fileType = "EXCEL";
  else if (["DOC", "DOCX"].includes(ext)) fileType = "WORD";
  else if (["ZIP", "RAR", "7Z"].includes(ext)) fileType = "ARCHIVE";

  const fileUrl = `/uploads/cahiers-des-charges/${uniqueName}`;

  return {
    success: true,
    file: {
      name: file.name,
      fileUrl,
      fileType,
      fileSize: file.size,
    },
  };
}

export async function uploadClientDocumentFileAction(formData: FormData) {
  const user = await requireAuth();
  const file = formData.get("file") as File;
  if (!file || typeof file === "string") {
    return { success: false, error: "Aucun fichier valide fourni" };
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "documents");
  await fs.mkdir(uploadsDir, { recursive: true });

  const safeOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${Date.now()}_${safeOriginalName}`;
  const targetPath = path.join(uploadsDir, uniqueName);

  await fs.writeFile(targetPath, buffer);

  const ext = safeOriginalName.split(".").pop()?.toUpperCase() || "PDF";
  let fileType = "OTHER";
  if (["PDF"].includes(ext)) fileType = "PDF";
  else if (["PNG", "JPG", "JPEG", "WEBP", "GIF", "SVG"].includes(ext)) fileType = "IMAGE";
  else if (["XLS", "XLSX", "CSV"].includes(ext)) fileType = "EXCEL";
  else if (["DOC", "DOCX"].includes(ext)) fileType = "WORD";
  else if (["ZIP", "RAR", "7Z"].includes(ext)) fileType = "ARCHIVE";

  const fileUrl = `/uploads/documents/${uniqueName}`;

  return {
    success: true,
    file: {
      name: file.name,
      fileUrl,
      fileType,
      fileSize: file.size,
    },
  };
}

export async function createClientProjectAction(data: {
  clientId: string;
  name: string;
  code?: string;
  description?: string;
  startDate?: string;
  deadline?: string;
  budget?: number;
  status?: ProjectStatus;
  files?: Array<{
    name: string;
    fileUrl: string;
    fileType?: string;
    fileSize?: number;
  }>;
}) {
  const user = await requireAuth();
  const count = await prisma.project.count();
  const code =
    data.code?.trim() ||
    `PRJ-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

  const project = await prisma.project.create({
    data: {
      clientId: data.clientId,
      name: data.name.trim(),
      code,
      description: data.description?.trim() || null,
      status: data.status || ProjectStatus.NEW_REQUEST,
      managerId: user.id,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      deadline: data.deadline ? new Date(data.deadline) : null,
      budget: Number(data.budget) || 0,
      documents:
        data.files && data.files.length > 0
          ? {
              create: data.files.map((f) => ({
                name: f.name,
                fileUrl: f.fileUrl,
                fileType: f.fileType || "PDF",
                fileSize: f.fileSize || 0,
                category: "BRIEF",
                clientId: data.clientId,
                uploadedById: user.id,
              })),
            }
          : undefined,
    },
    include: {
      manager: { select: { id: true, name: true } },
      documents: {
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
      _count: { select: { tasks: true } },
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE_CLIENT_PROJECT",
    module: "PROJECTS",
    entityId: project.id,
    details: {
      clientId: data.clientId,
      name: project.name,
      code: project.code,
      filesCount: data.files?.length || 0,
    },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${data.clientId}`);
  return { success: true, project };
}

export async function addProjectFileAction(data: {
  projectId: string;
  clientId: string;
  name: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
}) {
  const user = await requireAuth();
  const doc = await prisma.document.create({
    data: {
      name: data.name,
      fileUrl: data.fileUrl,
      fileType: data.fileType || "PDF",
      fileSize: data.fileSize || 0,
      category: "BRIEF",
      projectId: data.projectId,
      clientId: data.clientId,
      uploadedById: user.id,
    },
    include: {
      uploadedBy: { select: { id: true, name: true } },
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "ADD_PROJECT_DOCUMENT",
    module: "PROJECTS",
    entityId: doc.id,
    details: { projectId: data.projectId, name: data.name },
  });

  revalidatePath(`/clients/${data.clientId}`);
  return { success: true, document: doc };
}

export async function createClientInvoiceAction(data: {
  clientId: string;
  invoiceNumber?: string;
  monthLabel?: string;
  issueDate?: string;
  dueDate?: string;
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  status?: InvoiceStatus;
  notes?: string;
  itemDescription?: string;
  paymentMethod?: string;
  taxMode?: "HT" | "TTC";
  clientBilling?: {
    companyName?: string;
    contactName?: string;
    address?: string;
    wilaya?: string;
    phone?: string;
    email?: string;
    rc?: string;
    nif?: string;
    nis?: string;
    ai?: string;
    paymentMethod?: string;
    taxMode?: "HT" | "TTC";
  };
}) {
  const user = await requireAuth();
  const year = new Date().getFullYear();
  let invoiceNumber = data.invoiceNumber?.trim();

  if (!invoiceNumber) {
    const count = await prisma.invoice.count();
    let candidateSeq = count + 1;
    invoiceNumber = `FAC-${year}-${String(candidateSeq).padStart(4, "0")}`;
    while (await prisma.invoice.findUnique({ where: { invoiceNumber } })) {
      candidateSeq++;
      invoiceNumber = `FAC-${year}-${String(candidateSeq).padStart(4, "0")}`;
    }
  } else {
    const existing = await prisma.invoice.findUnique({ where: { invoiceNumber } });
    if (existing) {
      invoiceNumber = `${invoiceNumber}-${Date.now().toString().slice(-4)}`;
    }
  }

  const issueDate = data.issueDate ? new Date(data.issueDate) : new Date();
  const dueDate = data.dueDate
    ? new Date(data.dueDate)
    : new Date(issueDate.getTime() + 1000 * 60 * 60 * 24 * 30);

  let finalNotes = data.notes?.trim() || "";
  const billingMeta = {
    ...data.clientBilling,
    paymentMethod: data.paymentMethod || "BARIDIMOB",
    taxMode: data.taxMode || (Number(data.taxRate) > 0 ? "TTC" : "HT"),
  };
  finalNotes = `[BILLING_META:${JSON.stringify(billingMeta)}] ${finalNotes}`;

  const invoice = await prisma.invoice.create({
    data: {
      clientId: data.clientId,
      invoiceNumber,
      issueDate,
      dueDate,
      subtotal: Number(data.subtotal) || Number(data.total),
      taxRate: Number(data.taxRate) || 0,
      taxAmount: Number(data.taxAmount) || 0,
      total: Number(data.total),
      balanceDue: Number(data.total),
      status: data.status || InvoiceStatus.SENT,
      notes: finalNotes || null,
      items: {
        create: [
          {
            description:
              data.itemDescription?.trim() ||
              (data.monthLabel
                ? `Abonnement mensuel — ${data.monthLabel}`
                : "Prestation agence digitale"),
            quantity: 1,
            unitPrice: Number(data.subtotal) || Number(data.total),
            total: Number(data.subtotal) || Number(data.total),
          },
        ],
      },
    },
    include: {
      items: true,
      client: true,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE_CLIENT_INVOICE",
    module: "FINANCE",
    entityId: invoice.id,
    details: { clientId: data.clientId, invoiceNumber, total: invoice.total },
  });

  revalidatePath(`/clients/${data.clientId}`);
  return { success: true, invoice };
}

export async function createClientPaymentAction(data: {
  clientId: string;
  invoiceId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentType?: PaymentType;
  reference?: string;
  paymentDate?: string;
  notes?: string;
}) {
  const user = await requireAuth();
  const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();

  const payment = await prisma.payment.create({
    data: {
      clientId: data.clientId,
      invoiceId: data.invoiceId || null,
      amount: Number(data.amount),
      paymentMethod: data.paymentMethod,
      paymentType: data.paymentType || PaymentType.MONTHLY_SUBSCRIPTION,
      reference: data.reference?.trim() || null,
      status: "COMPLETED",
      paymentDate,
      notes: data.notes?.trim() || null,
      recordedById: user.id,
    },
    include: {
      recordedBy: { select: { id: true, name: true } },
      invoice: { select: { id: true, invoiceNumber: true, total: true } },
      client: true,
    },
  });

  if (data.invoiceId) {
    const inv = await prisma.invoice.findUnique({ where: { id: data.invoiceId } });
    if (inv) {
      const newPaid = Number(inv.amountPaid) + Number(data.amount);
      const newBalance = Math.max(0, Number(inv.total) - newPaid);
      const newStatus = newBalance === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL;

      await prisma.invoice.update({
        where: { id: data.invoiceId },
        data: {
          amountPaid: newPaid,
          balanceDue: newBalance,
          status: newStatus,
        },
      });
    }
  }

  await createAuditLog({
    userId: user.id,
    action: "RECORD_CLIENT_PAYMENT",
    module: "FINANCE",
    entityId: payment.id,
    details: { clientId: data.clientId, amount: payment.amount, method: data.paymentMethod },
  });

  revalidatePath(`/clients/${data.clientId}`);
  return { success: true, payment };
}

export async function createClientDocumentAction(data: {
  clientId: string;
  name: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  category?: string;
  notes?: string;
}) {
  const user = await requireAuth();

  const doc = await prisma.document.create({
    data: {
      clientId: data.clientId,
      name: data.name.trim(),
      fileUrl: data.fileUrl?.trim() || "#",
      fileType: data.fileType || "PDF",
      fileSize: Number(data.fileSize) || 1024 * 150,
      category: data.category || "CONTRACT",
      uploadedById: user.id,
    },
    include: {
      uploadedBy: { select: { id: true, name: true } },
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPLOAD_CLIENT_DOCUMENT",
    module: "DOCUMENTS",
    entityId: doc.id,
    details: { clientId: data.clientId, name: doc.name, category: doc.category },
  });

  revalidatePath(`/clients/${data.clientId}`);
  return { success: true, document: doc };
}
