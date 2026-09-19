"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { ProspectStatus, OfferType, ClientStatus, CallResult, FollowUpStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { mapCallStatusToCallData } from "@/lib/utils";
import { awardClientSigningCommissionAction } from "@/actions/rh";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";

export interface ProspectFilterParams {
  search?: string;
  sector?: string;
  wilaya?: string;
  status?: ProspectStatus;
  assignedToId?: string;
  onlyVirgin?: boolean;
}

export async function getProspects(params: ProspectFilterParams = {}) {
  const user = await requireAuth();

  // If user is a SALES_REP, by default restrict to their assigned leads unless director/admin
  const isPrivileged = ["ADMIN", "SALES_DIRECTOR"].includes(user.role);

  const whereClause: any = {};

  if (!isPrivileged) {
    whereClause.assignedToId = user.id;
  } else if (params.assignedToId) {
    whereClause.assignedToId = params.assignedToId;
  }

  if (params.onlyVirgin) {
    whereClause.status = ProspectStatus.NEW;
    whereClause.AND = whereClause.AND || [];
    whereClause.AND.push(
      {
        OR: [
          { callStatus: null },
          { callStatus: "" },
          { callStatus: "—" },
          { callStatus: "-" },
          { callStatus: "VIERGE" },
        ],
      },
      {
        OR: [
          { rawState: null },
          { rawState: "" },
          { rawState: "NOUVEAU" },
          { rawState: "NEW" },
          { rawState: "VIERGE" },
          { rawState: "—" },
          { rawState: "-" },
        ],
      },
      {
        OR: [
          { response: null },
          { response: "" },
        ],
      },
      {
        OR: [
          { notes: null },
          { notes: "" },
        ],
      },
      {
        calls: { none: {} },
      },
      {
        appointments: { none: {} },
      }
    );
  } else if (params.status) {
    whereClause.status = params.status;
  }

  if (params.sector) {
    whereClause.sector = params.sector;
  }

  if (params.wilaya) {
    whereClause.wilaya = params.wilaya;
  }

  if (params.search) {
    whereClause.OR = [
      { companyName: { contains: params.search, mode: "insensitive" } },
      { contactName: { contains: params.search, mode: "insensitive" } },
      { phone: { contains: params.search, mode: "insensitive" } },
      { email: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const [prospects, scheduledAppointments] = await Promise.all([
    prisma.prospect.findMany({
      where: whereClause,
      select: {
        id: true,
        companyName: true,
        contactName: true,
        phone: true,
        email: true,
        sector: true,
        wilaya: true,
        address: true,
        status: true,
        rawState: true,
        prospectionDate: true,
        callStatus: true,
        response: true,
        notes: true,
        createdAt: true,
        assignedToId: true,
        assignedTo: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.appointment.findMany({
      where: {
        prospectId: { not: null },
        status: "SCHEDULED",
      },
      select: { prospectId: true },
      distinct: ["prospectId"],
    }),
  ]);

  const apptSet = new Set(scheduledAppointments.map((a) => a.prospectId));

  return prospects.map((p) => {
    const hasAppt =
      apptSet.has(p.id) ||
      p.status === ProspectStatus.MEETING_SCHEDULED ||
      p.rawState === "RDV PRIS";

    return {
      ...p,
      _count: {
        calls: p.callStatus === "EFFECTUE" ? 1 : 0,
        appointments: hasAppt ? 1 : 0,
        followUps: 0,
      },
      appointments: hasAppt
        ? [{ id: "has_appt", startTime: new Date(), title: "RDV", status: "SCHEDULED" }]
        : [],
      calls: [],
    };
  });
}

export async function getProspectsOverviewStats() {
  await requireAuth();
  const [total, virgin, interested, converted, scheduledAppointments] = await Promise.all([
    prisma.prospect.count(),
    prisma.prospect.count({
      where: {
        status: ProspectStatus.NEW,
        AND: [
          {
            OR: [
              { callStatus: null },
              { callStatus: "" },
              { callStatus: "NON EFFECTUE" },
              { callStatus: "PAS DE CONTACT" },
            ],
          },
          {
            OR: [
              { rawState: null },
              { rawState: "" },
              { rawState: "NOUVEAU" },
              { rawState: "VIERGE" },
              { rawState: "PAS DE CONTACT" },
            ],
          },
          { calls: { none: {} } },
          { appointments: { none: {} } },
        ],
      },
    }),
    prisma.prospect.count({
      where: {
        status: { in: [ProspectStatus.INTERESTED, ProspectStatus.MEETING_SCHEDULED] },
      },
    }),
    prisma.prospect.count({
      where: { status: ProspectStatus.CONVERTED },
    }),
    prisma.appointment.count({
      where: { status: "SCHEDULED", prospectId: { not: null } },
    }),
  ]);

  const treated = Math.max(0, total - virgin);

  return {
    total,
    virgin,
    treated,
    interested,
    converted,
    scheduledAppointments,
  };
}

export async function getCalledProspects(params: ProspectFilterParams = {}) {
  const user = await requireAuth();
  const isPrivileged = ["ADMIN", "SALES_DIRECTOR"].includes(user.role);

  const whereClause: any = {
    AND: [
      isPrivileged ? {} : { assignedToId: user.id },
      {
        OR: [
          { callStatus: { in: ["EFFECTUE", "A RAPPELER", "PAS DE REPONSE", "OCCUPE", "INJOIGNABLE", "A CONTACTER", "TRANSFERE_APPELS"] } },
          { rawState: { in: ["TRANSFERE_APPELS", "A CONTACTER"] } },
          { calls: { some: {} } },
        ],
      },
    ],
  };

  if (params.assignedToId) {
    whereClause.AND.push({ assignedToId: params.assignedToId });
  }

  if (params.status) {
    whereClause.AND.push({ status: params.status });
  }

  if (params.sector) {
    whereClause.AND.push({ sector: params.sector });
  }

  if (params.wilaya) {
    whereClause.AND.push({ wilaya: params.wilaya });
  }

  if (params.search) {
    whereClause.AND.push({
      OR: [
        { companyName: { contains: params.search, mode: "insensitive" } },
        { contactName: { contains: params.search, mode: "insensitive" } },
        { phone: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
      ],
    });
  }

  const [prospects, scheduledAppointments] = await Promise.all([
    prisma.prospect.findMany({
      where: whereClause,
      select: {
        id: true,
        companyName: true,
        contactName: true,
        phone: true,
        email: true,
        sector: true,
        wilaya: true,
        address: true,
        status: true,
        rawState: true,
        prospectionDate: true,
        callStatus: true,
        response: true,
        notes: true,
        createdAt: true,
        assignedToId: true,
        assignedTo: { select: { id: true, name: true, role: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.appointment.findMany({
      where: {
        prospectId: { not: null },
        status: "SCHEDULED",
      },
      select: { prospectId: true },
      distinct: ["prospectId"],
    }),
  ]);

  const apptSet = new Set(scheduledAppointments.map((a) => a.prospectId));

  return prospects.map((p) => {
    const hasAppt =
      apptSet.has(p.id) ||
      p.status === ProspectStatus.MEETING_SCHEDULED ||
      p.rawState === "RDV PRIS";

    return {
      ...p,
      _count: {
        calls: 1,
        appointments: hasAppt ? 1 : 0,
        followUps: 0,
      },
      appointments: hasAppt
        ? [{ id: "has_appt", startTime: new Date(), title: "RDV", status: "SCHEDULED" }]
        : [],
      calls: [],
    };
  });
}

export async function createProspect(data: {
  companyName: string;
  contactName?: string;
  phone: string;
  email?: string;
  sector: string;
  wilaya: string;
  address?: string;
  notes?: string;
  assignedToId?: string;
}) {
  const user = await requireAuth();

  // Deduplication check by phone or company
  const existing = await prisma.prospect.findFirst({
    where: {
      OR: [
        { phone: data.phone.trim() },
        { companyName: { equals: data.companyName.trim(), mode: "insensitive" } },
      ],
    },
  });

  if (existing) {
    return {
      error: `Un prospect similaire existe déjà : "${existing.companyName}" (${existing.phone}).`,
    };
  }

  const prospect = await prisma.prospect.create({
    data: {
      companyName: data.companyName.trim(),
      contactName: data.contactName?.trim() || null,
      phone: data.phone.trim(),
      email: data.email?.trim() || null,
      sector: data.sector,
      wilaya: data.wilaya,
      address: data.address?.trim() || null,
      notes: data.notes?.trim() || null,
      assignedToId: data.assignedToId || user.id,
      createdById: user.id,
      status: ProspectStatus.NEW,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE",
    module: "PROSPECTS",
    entityId: prospect.id,
    details: { companyName: prospect.companyName, phone: prospect.phone },
  });

  revalidatePath("/prospection");
  return { success: true, prospect };
}

export async function updateProspect(
  id: string,
  data: {
    companyName?: string;
    contactName?: string;
    phone?: string;
    email?: string;
    sector?: string;
    wilaya?: string;
    address?: string;
    notes?: string;
    status?: ProspectStatus;
    assignedToId?: string | null;
    prospectionDate?: string | Date | null;
    callStatus?: string | null;
    rawState?: string | null;
    response?: string | null;
    callResult?: CallResult | null;
  }
) {
  const user = await requireAuth();

  const updatePayload: any = { ...data };
  delete updatePayload.callResult;

  if (data.prospectionDate !== undefined) {
    updatePayload.prospectionDate = data.prospectionDate ? parseExcelDate(data.prospectionDate) : null;
  } else if (
    (data.callStatus && data.callStatus.trim() && data.callStatus.trim().toUpperCase() !== "NON EFFECTUE") ||
    (data.callResult !== undefined && data.callResult)
  ) {
    updatePayload.prospectionDate = new Date();
  }

  // Handle call result if specified
  if (data.callResult !== undefined && data.callResult) {
    const callResult = data.callResult;
    const recentCall = await prisma.call.findFirst({
      where: {
        prospectId: id,
        calledAt: { gte: new Date(Date.now() - 1000 * 60 * 15) },
      },
      orderBy: { calledAt: "desc" },
    });

    if (recentCall) {
      await prisma.call.update({
        where: { id: recentCall.id },
        data: {
          result: callResult,
          userId: user.id,
        },
      });
    } else {
      await prisma.call.create({
        data: {
          prospectId: id,
          userId: user.id,
          result: callResult,
          comment: `Fiche: Résultat sélectionné : ${callResult}`,
          durationSeconds: 60,
          calledAt: new Date(),
        },
      });
    }

    if (callResult === CallResult.INTERESTED) {
      updatePayload.status = ProspectStatus.INTERESTED;
      updatePayload.callStatus = "EFFECTUE";
      updatePayload.rawState = "INTERESSE";
    } else if (callResult === CallResult.APPOINTMENT_BOOKED) {
      updatePayload.status = ProspectStatus.MEETING_SCHEDULED;
      updatePayload.callStatus = "EFFECTUE";
      updatePayload.rawState = "RDV PRIS";
    } else if (callResult === CallResult.NOT_INTERESTED) {
      updatePayload.status = ProspectStatus.NOT_INTERESTED;
      updatePayload.callStatus = "EFFECTUE";
      updatePayload.rawState = "PAS INTERESSE";
    } else if (callResult === CallResult.CALLBACK_REQUESTED) {
      updatePayload.status = ProspectStatus.CONTACTED;
      updatePayload.callStatus = "A RAPPELER";
      updatePayload.rawState = "A RAPPELER";
    } else if (callResult === CallResult.NO_ANSWER) {
      updatePayload.status = ProspectStatus.CONTACTED;
      updatePayload.callStatus = "PAS DE REPONSE";
      updatePayload.rawState = "PAS DE CONTACT";
    } else if (callResult === CallResult.UNREACHABLE) {
      updatePayload.status = ProspectStatus.CONTACTED;
      updatePayload.callStatus = "INJOIGNABLE";
      updatePayload.rawState = "PAS DE CONTACT";
    }
  }

  // Handle call attempt if callStatus is provided
  if (data.callStatus !== undefined && data.callStatus) {
    const callData = mapCallStatusToCallData(data.callStatus);
    if (callData) {
      const recentCall = await prisma.call.findFirst({
        where: {
          prospectId: id,
          calledAt: { gte: new Date(Date.now() - 1000 * 60 * 15) },
        },
        orderBy: { calledAt: "desc" },
      });

      if (recentCall) {
        await prisma.call.update({
          where: { id: recentCall.id },
          data: {
            result: callData.result,
            comment: callData.comment,
            durationSeconds: callData.durationSeconds,
            userId: user.id,
          },
        });
      } else {
        await prisma.call.create({
          data: {
            prospectId: id,
            userId: user.id,
            result: callData.result,
            comment: callData.comment,
            durationSeconds: callData.durationSeconds,
            calledAt: new Date(),
          },
        });
      }

      if (callData.answered && !updatePayload.status) {
        updatePayload.status = ProspectStatus.CONTACTED;
      }
    }
  }

  const prospect = await prisma.prospect.update({
    where: { id },
    data: updatePayload,
    include: {
      assignedTo: { select: { id: true, name: true, role: true } },
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    module: "PROSPECTS",
    entityId: prospect.id,
    details: data,
  });

  // Synchronize follow-up status (auto-relance if contacted, cancel if pas de contact or pas interesse)
  await syncSingleProspectFollowUp(prospect.id, user.id);

  revalidatePath("/prospection");
  revalidatePath("/relances");
  revalidatePath("/appels");
  revalidatePath("/dashboard");
  return { success: true, prospect };
}

export async function assignProspect(prospectId: string, assignedToId: string | null) {
  const user = await requireAuth();

  const prospect = await prisma.prospect.update({
    where: { id: prospectId },
    data: { assignedToId: assignedToId || null },
    include: {
      assignedTo: { select: { id: true, name: true, role: true } },
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "ASSIGN_COMMERCIAL",
    module: "PROSPECTS",
    entityId: prospectId,
    details: { assignedToId },
  });

  revalidatePath("/prospection");
  revalidatePath("/appels");
  return { success: true, prospect };
}

export async function updateProspectField(
  id: string,
  field: "callStatus" | "rawState" | "response" | "notes" | "assignedToId" | "companyName" | "phone" | "sector" | "address" | "wilaya" | "email" | "callResult",
  value: string | null
) {
  const user = await requireAuth();

  const updateData: any = {};
  if (field !== "callResult") {
    updateData[field] = value;
  }

  // If callResult is modified (e.g. directly from the table or modal)
  if (field === "callResult") {
    if (value && value.trim()) {
      updateData.prospectionDate = new Date();
      const callResult = value as CallResult;
      const recentCall = await prisma.call.findFirst({
        where: {
          prospectId: id,
          calledAt: { gte: new Date(Date.now() - 1000 * 60 * 15) },
        },
        orderBy: { calledAt: "desc" },
      });

      if (recentCall) {
        await prisma.call.update({
          where: { id: recentCall.id },
          data: {
            result: callResult,
            userId: user.id,
          },
        });
      } else {
        await prisma.call.create({
          data: {
            prospectId: id,
            userId: user.id,
            result: callResult,
            comment: `Résultat d'appel mis à jour : ${callResult}`,
            durationSeconds: 60,
            calledAt: new Date(),
          },
        });
      }

      if (callResult === CallResult.INTERESTED) {
        updateData.status = ProspectStatus.INTERESTED;
        updateData.callStatus = "EFFECTUE";
        updateData.rawState = "INTERESSE";
      } else if (callResult === CallResult.APPOINTMENT_BOOKED) {
        updateData.status = ProspectStatus.MEETING_SCHEDULED;
        updateData.callStatus = "EFFECTUE";
        updateData.rawState = "RDV PRIS";
      } else if (callResult === CallResult.NOT_INTERESTED) {
        updateData.status = ProspectStatus.NOT_INTERESTED;
        updateData.callStatus = "EFFECTUE";
        updateData.rawState = "PAS INTERESSE";
      } else if (callResult === CallResult.CALLBACK_REQUESTED) {
        updateData.status = ProspectStatus.CONTACTED;
        updateData.callStatus = "A RAPPELER";
        updateData.rawState = "A RAPPELER";
      } else if (callResult === CallResult.NO_ANSWER) {
        updateData.status = ProspectStatus.CONTACTED;
        updateData.callStatus = "PAS DE REPONSE";
        updateData.rawState = "PAS DE CONTACT";
      } else if (callResult === CallResult.UNREACHABLE) {
        updateData.status = ProspectStatus.CONTACTED;
        updateData.callStatus = "INJOIGNABLE";
        updateData.rawState = "PAS DE CONTACT";
      }
    } else {
      // Reinitialization of call result
      const currentP = await prisma.prospect.findUnique({
        where: { id },
        select: { callStatus: true },
      });
      if (!currentP?.callStatus) {
        updateData.prospectionDate = null;
      }
    }
  }

  // If callStatus is modified, create or update call record so stats and contactability rate are 100% accurate
  if (field === "callStatus") {
    if (value && value.trim() && value.trim().toUpperCase() !== "NON EFFECTUE") {
      updateData.prospectionDate = new Date();
      const callData = mapCallStatusToCallData(value);
      if (callData) {
        const recentCall = await prisma.call.findFirst({
          where: {
            prospectId: id,
            calledAt: { gte: new Date(Date.now() - 1000 * 60 * 15) },
          },
          orderBy: { calledAt: "desc" },
        });

        if (recentCall) {
          await prisma.call.update({
            where: { id: recentCall.id },
            data: {
              result: callData.result,
              comment: callData.comment,
              durationSeconds: callData.durationSeconds,
              userId: user.id,
            },
          });
        } else {
          await prisma.call.create({
            data: {
              prospectId: id,
              userId: user.id,
              result: callData.result,
              comment: callData.comment,
              durationSeconds: callData.durationSeconds,
              calledAt: new Date(),
            },
          });
        }

        if (callData.answered) {
          updateData.status = ProspectStatus.CONTACTED;
        }
      }
    } else if (!value || value.trim() === "" || value.trim().toUpperCase() === "NON EFFECTUE") {
      updateData.callStatus = null;
      updateData.prospectionDate = null;
    }
  }

  // If rawState changed, also update status if relevant
  if (field === "rawState" && value) {
    updateData.status = mapRawStateToProspectStatus(value);
  }

  // If response (REPENSE) is entered, prospect was contacted -> auto date du jour
  if (field === "response" && value && value.trim()) {
    updateData.prospectionDate = new Date();
  }

  const prospect = await prisma.prospect.update({
    where: { id },
    data: updateData,
    include: {
      assignedTo: { select: { id: true, name: true, role: true } },
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE_FIELD",
    module: "PROSPECTS",
    entityId: id,
    details: { field, value },
  });

  // Synchronize follow-up status (auto-relance if contacted, cancel if pas de contact or pas interesse)
  if (["callStatus", "rawState", "callResult", "status"].includes(field)) {
    await syncSingleProspectFollowUp(id, user.id);
  }

  revalidatePath("/prospection");
  revalidatePath("/relances");
  revalidatePath("/appels");
  revalidatePath("/dashboard");

  return { success: true, prospect };
}

/**
 * Déplace explicitement un prospect depuis la file de Prospection
 * vers la section Appels et la Base de données globale (via clic sur l'icône +)
 */
export async function transferProspectToAppelsAction(prospectId: string) {
  const user = await requireAuth();

  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
  });

  if (!prospect) {
    throw new Error("Prospect introuvable");
  }

  const updated = await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      status: prospect.status === ProspectStatus.NEW ? ProspectStatus.CONTACTED : prospect.status,
      callStatus: prospect.callStatus || "A CONTACTER",
      rawState: "TRANSFERE_APPELS",
      assignedToId: prospect.assignedToId || user.id,
      prospectionDate: prospect.prospectionDate || new Date(),
    },
    include: {
      assignedTo: { select: { id: true, name: true, role: true } },
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "TRANSFER_PROSPECT_TO_APPELS",
    module: "PROSPECTION",
    entityId: prospectId,
    details: {
      companyName: prospect.companyName,
      previousStatus: prospect.status,
      newStatus: ProspectStatus.CONTACTED,
      callStatus: "A CONTACTER",
    },
  });

  revalidatePath("/prospection");
  revalidatePath("/appels");
  revalidatePath("/base-prospects");
  revalidatePath("/dashboard");

  return { success: true, prospect: updated };
}

export async function deleteProspect(id: string) {
  const user = await requireAuth();

  if (!["ADMIN", "SALES_DIRECTOR"].includes(user.role)) {
    return { error: "Seuls les administrateurs et directeurs peuvent supprimer un prospect." };
  }

  await prisma.prospect.delete({ where: { id } });

  await createAuditLog({
    userId: user.id,
    action: "DELETE",
    module: "PROSPECTS",
    entityId: id,
  });

  revalidatePath("/prospection");
  revalidatePath("/appels");
  return { success: true };
}

export async function convertProspectToClient(data: {
  prospectId: string;
  offerType: OfferType;
  hasWebsite?: boolean;
  contractValue: number;
  monthlyFee?: number;
  contractStart?: string;
  contractEnd?: string;
  notes?: string;
}) {
  const user = await requireAuth();

  const prospect = await prisma.prospect.findUnique({
    where: { id: data.prospectId },
  });

  if (!prospect) {
    return { error: "Prospect introuvable." };
  }

  if (prospect.status === ProspectStatus.CONVERTED) {
    return { error: "Ce prospect a déjà été converti en client." };
  }

  // Database Transaction to guarantee consistency
  const result = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        companyName: prospect.companyName,
        brandName: prospect.companyName,
        contactName: prospect.contactName,
        phone: prospect.phone,
        email: prospect.email,
        address: prospect.address,
        sector: prospect.sector,
        wilaya: prospect.wilaya,
        status: ClientStatus.IN_PREPARATION,
        offerType: data.offerType,
        hasWebsite: Boolean(data.hasWebsite || data.offerType === "STARTER"),
        contractStart: data.contractStart ? new Date(data.contractStart) : new Date(),
        contractEnd: data.contractEnd ? new Date(data.contractEnd) : null,
        contractValue: data.contractValue,
        monthlyFee: data.monthlyFee || 0,
        notes: data.notes || prospect.notes,
        assignedToId: prospect.assignedToId || user.id,
      },
    });

    await tx.prospect.update({
      where: { id: prospect.id },
      data: {
        status: ProspectStatus.CONVERTED,
        convertedClientId: client.id,
      },
    });

    return client;
  });

  await createAuditLog({
    userId: user.id,
    action: "CONVERT_TO_CLIENT",
    module: "CRM",
    entityId: result.id,
    details: {
      prospectId: prospect.id,
      companyName: result.companyName,
      contractValue: data.contractValue,
    },
  });

  // Attribuer automatiquement la commission de signature selon le pack (STARTER=500, SILVER=1000, GOLD=1500 DA)
  try {
    await awardClientSigningCommissionAction({
      clientId: result.id,
      userId: result.assignedToId || user.id,
      signedDate: result.contractStart || new Date(),
      offerType: result.offerType,
    });
  } catch (commErr) {
    console.warn("Erreur attribution commission signature client:", commErr);
  }

  revalidatePath("/prospection");
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/equipes");
  return { success: true, client: result };
}

function normalizePhoneNumber(raw: string | number): string {
  let cleaned = String(raw).replace(/[^0-9+]/g, "");
  if (cleaned.startsWith("+213")) {
    cleaned = "0" + cleaned.slice(4);
  } else if (cleaned.startsWith("213") && cleaned.length >= 11) {
    cleaned = "0" + cleaned.slice(3);
  }
  if (cleaned.length === 9 && ["5", "6", "7"].includes(cleaned[0])) {
    cleaned = "0" + cleaned;
  }
  return cleaned;
}

function extractCleanDigits(phone: string | number | null | undefined): string {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("213") && digits.length >= 11) {
    digits = "0" + digits.slice(3);
  }
  return digits;
}

function extractAllPhoneNumbers(raw: string | number | null | undefined): string[] {
  if (!raw) return [];
  const str = String(raw);
  const parts = str.split(/[/,;\n\r|]/);
  const result: string[] = [];
  for (const part of parts) {
    const cleaned = extractCleanDigits(part);
    if (cleaned.length >= 8) {
      result.push(cleaned);
      if (cleaned.length >= 9) {
        result.push(cleaned.slice(-9)); // Matches whether leading 0 is present or omitted
      }
    }
  }
  return Array.from(new Set(result));
}

function normalizeCompanyNameForDedupe(name: string | null | undefined): string {
  if (!name) return "";
  return String(name)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Critère d'éligibilité pour mettre un prospect dans la relance :
 * - Tous les prospects CONTACTÉS sont mis en relance automatique (+3j, +7j, +15j)
 * - À l'exception stricte de :
 *   1) PAS DE CONTACT (Pas de réponse, injoignable, non effectué...)
 *   2) PAS INTERESSE (Refus, sans suite...)
 *   3) Déjà converti en client officiel
 */
function isProspectContactedForRelance(
  rawState?: string | null,
  callStatus?: string | null,
  status?: ProspectStatus | null
): boolean {
  const rs = (rawState || "").toUpperCase().trim();
  const cs = (callStatus || "").toUpperCase().trim();
  const st = status || ProspectStatus.NEW;

  // 1. NE PAS METTRE DANS LA RELANCE : PAS DE CONTACT
  if (
    rs.includes("PAS DE CONTACT") ||
    cs === "PAS DE CONTACT" ||
    cs === "PAS DE REPONSE" ||
    cs === "INJOIGNABLE" ||
    cs === "NE REPEND PAS" ||
    cs === "OCCUPE" ||
    cs === "NON EFFECTUE"
  ) {
    return false;
  }

  // 2. NE PAS METTRE DANS LA RELANCE : PAS INTERESSE
  if (
    rs.includes("PAS INTERESSE") ||
    rs.includes("REFUS") ||
    st === ProspectStatus.NOT_INTERESTED
  ) {
    return false;
  }

  // 3. Déjà converti en client officiel
  if (st === ProspectStatus.CONVERTED || rs.includes("CONVERTI")) {
    return false;
  }

  // 4. TOUT PROSPECT CONTACTÉ EST MIS DANS LA RELANCE
  return (
    cs === "EFFECTUE" ||
    cs === "A RAPPELER" ||
    rs.includes("INTERESSE") ||
    rs.includes("INTERRESE") ||
    rs.includes("A RAPPELER") ||
    rs.includes("RDV") ||
    rs.includes("JSP") ||
    rs.includes("EFFECTUE") ||
    st === ProspectStatus.INTERESTED ||
    st === ProspectStatus.MEETING_SCHEDULED ||
    st === ProspectStatus.CONTACTED
  );
}

/**
 * Synchronise les relances pour un prospect unique lors de modifications
 */
export async function syncSingleProspectFollowUp(prospectId: string, assignedUserId?: string) {
  try {
    const p = await prisma.prospect.findUnique({
      where: { id: prospectId },
      include: {
        followUps: {
          where: { status: FollowUpStatus.SCHEDULED },
        },
      },
    });
    if (!p) return;

    const isEligible = isProspectContactedForRelance(p.rawState, p.callStatus, p.status);
    const now = Date.now();
    const targetUserId = p.assignedToId || assignedUserId;

    if (isEligible) {
      if (p.followUps.length === 0 && targetUserId) {
        await prisma.followUp.createMany({
          data: [
            {
              prospectId: p.id,
              userId: targetUserId,
              stepNumber: 1,
              scheduledAt: new Date(now + 3 * 24 * 60 * 60 * 1000),
              status: FollowUpStatus.SCHEDULED,
              notes: "Relance Étape 1 (+3j) : Prospect contacté en prospection",
            },
            {
              prospectId: p.id,
              userId: targetUserId,
              stepNumber: 2,
              scheduledAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
              status: FollowUpStatus.SCHEDULED,
              notes: "Relance Étape 2 (+7j)",
            },
            {
              prospectId: p.id,
              userId: targetUserId,
              stepNumber: 3,
              scheduledAt: new Date(now + 15 * 24 * 60 * 60 * 1000),
              status: FollowUpStatus.SCHEDULED,
              notes: "Relance Étape 3 (+15j)",
            },
          ],
        });
      }
    } else {
      const isExempt =
        (p.rawState && (p.rawState.includes("PAS DE CONTACT") || p.rawState.includes("PAS INTERESSE"))) ||
        (p.callStatus && (p.callStatus.includes("PAS") || p.callStatus.includes("INJOIGNABLE") || p.callStatus.includes("OCCUPE") || p.callStatus === "PAS DE CONTACT")) ||
        p.status === ProspectStatus.NOT_INTERESTED;

      if (isExempt && p.followUps.length > 0) {
        await prisma.followUp.updateMany({
          where: {
            prospectId: p.id,
            status: FollowUpStatus.SCHEDULED,
          },
          data: {
            status: FollowUpStatus.LOST,
            notes: "Relance clôturée : Prospect 'Pas de contact' ou 'Pas intéressé'",
          },
        });
      }
    }
  } catch (err) {
    console.error("Error in syncSingleProspectFollowUp:", err);
  }
}

/**
 * Fonction interne automatique ultra-rapide pour synchroniser les relances sans nécessiter de clic manuel
 */
export async function autoSyncFollowUpsInternal(fallbackUserId?: string) {
  try {
    // 1. Prospects contactés sans relance planifiée
    const candidates = await prisma.prospect.findMany({
      where: {
        followUps: {
          none: {
            status: FollowUpStatus.SCHEDULED,
          },
        },
        OR: [
          { callStatus: { in: ["EFFECTUE", "A RAPPELER"] } },
          { status: { in: [ProspectStatus.INTERESTED, ProspectStatus.MEETING_SCHEDULED, ProspectStatus.CONTACTED] } },
          { rawState: { contains: "INTERESSE" } },
          { rawState: { contains: "A RAPPELER" } },
          { rawState: { contains: "RDV" } },
          { rawState: { contains: "EFFECTUE" } },
        ],
      },
      select: {
        id: true,
        assignedToId: true,
        rawState: true,
        callStatus: true,
        status: true,
      },
      take: 200,
    });

    const now = Date.now();
    let synced = 0;

    for (const p of candidates) {
      if (isProspectContactedForRelance(p.rawState, p.callStatus, p.status)) {
        const targetUserId = p.assignedToId || fallbackUserId;
        if (targetUserId) {
          await prisma.followUp.createMany({
            data: [
              {
                prospectId: p.id,
                userId: targetUserId,
                stepNumber: 1,
                scheduledAt: new Date(now + 3 * 24 * 60 * 60 * 1000),
                status: FollowUpStatus.SCHEDULED,
                notes: "Relance Étape 1 (+3j) : Prospect contacté en prospection",
              },
              {
                prospectId: p.id,
                userId: targetUserId,
                stepNumber: 2,
                scheduledAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
                status: FollowUpStatus.SCHEDULED,
                notes: "Relance Étape 2 (+7j)",
              },
              {
                prospectId: p.id,
                userId: targetUserId,
                stepNumber: 3,
                scheduledAt: new Date(now + 15 * 24 * 60 * 60 * 1000),
                status: FollowUpStatus.SCHEDULED,
                notes: "Relance Étape 3 (+15j)",
              },
            ],
          });
          synced++;
        }
      }
    }

    // 2. Annuler les relances pour les prospects inéligibles (pas intéressé, pas de contact)
    const ineligibles = await prisma.prospect.findMany({
      where: {
        followUps: {
          some: {
            status: FollowUpStatus.SCHEDULED,
          },
        },
        OR: [
          { status: ProspectStatus.NOT_INTERESTED },
          { status: ProspectStatus.CONVERTED },
          { rawState: { contains: "PAS INTERESSE" } },
          { rawState: { contains: "PAS DE CONTACT" } },
          { callStatus: { in: ["PAS DE REPONSE", "INJOIGNABLE", "OCCUPE", "PAS DE CONTACT", "NE REPEND PAS", "NON EFFECTUE"] } },
        ],
      },
      select: { id: true },
      take: 200,
    });

    if (ineligibles.length > 0) {
      const ids = ineligibles.map((p) => p.id);
      await prisma.followUp.updateMany({
        where: {
          prospectId: { in: ids },
          status: FollowUpStatus.SCHEDULED,
        },
        data: {
          status: FollowUpStatus.LOST,
          notes: "Relance clôturée automatiquement : Statut 'Pas de contact' ou 'Pas intéressé'",
        },
      });
    }

    return { synced, cancelled: ineligibles.length };
  } catch (err) {
    console.error("Error in autoSyncFollowUpsInternal:", err);
    return { synced: 0, cancelled: 0 };
  }
}

/**
 * Action globale pour synchroniser tous les prospects contactés vers la relance
 */
export async function syncContactedProspectsToFollowUpsAction() {
  const user = await requireAuth();
  const { synced, cancelled } = await autoSyncFollowUpsInternal(user.id);

  await createAuditLog({
    userId: user.id,
    action: "SYNC_PROSPECTS_TO_FOLLOWUPS",
    module: "PROSPECTS",
    details: { syncedCount: synced, cancelledCount: cancelled },
  });

  revalidatePath("/prospection");
  revalidatePath("/relances");
  revalidatePath("/dashboard");

  return {
    success: true,
    syncedCount: synced,
    cancelledCount: cancelled,
    message: `${synced} prospect(s) contacté(s) synchronisé(s) vers les relances (+3j, +7j, +15j).`,
  };
}

function parseExcelDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "number" && val > 30000 && val < 60000) {
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  if (typeof val === "string") {
    const parts = val.trim().split(/[/.-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
        if (!isNaN(d.getTime())) return d;
      } else if (parts[2].length === 4) {
        const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        if (!isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function mapRawStateToProspectStatus(rawState?: string): ProspectStatus {
  if (!rawState) return ProspectStatus.NEW;
  const s = rawState.toUpperCase().trim();
  if (s.includes("INTER") || s.includes("INTERRESE") || s.includes("INTERESSE")) {
    return ProspectStatus.INTERESTED;
  }
  if (s.includes("RDV") || s.includes("RENDEZ")) {
    return ProspectStatus.MEETING_SCHEDULED;
  }
  if (s.includes("PAS INTER") || s.includes("REFUS") || s.includes("NON")) {
    return ProspectStatus.NOT_INTERESTED;
  }
  if (s.includes("CONVERTI") || s.includes("CLIENT") || s.includes("SIGNE")) {
    return ProspectStatus.CONVERTED;
  }
  if (s.includes("EFFECTUE") || s.includes("CONTACT") || s.includes("JSP") || s.includes("VU")) {
    return ProspectStatus.CONTACTED;
  }
  return ProspectStatus.NEW;
}

export async function bulkImportProspects(
  rows: Array<{
    companyName: string;   // CLIENT
    phone: string | number;// NUMERO
    date?: any;            // DATE
    sector?: string;       // TYPE
    address?: string;      // ADRESS
    wilaya?: string;       // ADRESS / zone
    callStatus?: string;   // APPEL
    rawState?: string;     // ETAT
    email?: string;        // MAIL
    response?: string;     // REPENSE
    notes?: string;        // REMARQUE
    commercialName?: string;// COMMERCIAL
    assignedToId?: string;
  }>,
  defaultAssignedToId?: string,
  options?: {
    importAsVirgin?: boolean;
  }
) {
  const user = await requireAuth();

  // Load sales users to match commercial names
  const salesUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  // Pre-load all existing prospects & clients to eliminate duplicates in O(1)
  // Preserving all existing prospects completely intact
  const [existingProspects, existingClients] = await Promise.all([
    prisma.prospect.findMany({ select: { id: true, phone: true, companyName: true } }),
    prisma.client.findMany({ select: { id: true, phone: true, companyName: true } }),
  ]);

  const existingPhoneSet = new Set<string>();
  const existingCompanySet = new Set<string>();

  for (const p of existingProspects) {
    for (const num of extractAllPhoneNumbers(p.phone)) {
      existingPhoneSet.add(num);
    }
    const compKey = normalizeCompanyNameForDedupe(p.companyName);
    if (compKey) existingCompanySet.add(compKey);
  }

  for (const c of existingClients) {
    for (const num of extractAllPhoneNumbers(c.phone)) {
      existingPhoneSet.add(num);
    }
    const compKey = normalizeCompanyNameForDedupe(c.companyName);
    if (compKey) existingCompanySet.add(compKey);
  }

  let imported = 0;
  let skippedDuplicates = 0;
  let skippedInvalid = 0;
  let autoRelancesCreated = 0;
  const errors: string[] = [];

  interface ValidRowToInsert {
    cleanCompany: string;
    cleanPhone: string;
    prospectionDate: Date | null;
    sector: string;
    address: string | null;
    wilaya: string;
    callStatus: string | null;
    status: ProspectStatus;
    rawState: string | null;
    email: string | null;
    response: string | null;
    notes: string | null;
    assignedToId: string;
    isVirginProspect: boolean;
    rowCallStatus?: string;
  }

  const validRowsToInsert: ValidRowToInsert[] = [];

  for (const row of rows) {
    if (!row.companyName || !row.phone) {
      skippedInvalid++;
      continue;
    }

    const cleanCompany = String(row.companyName).trim();
    const cleanPhone = normalizePhoneNumber(row.phone);
    const rowPhoneNumbers = extractAllPhoneNumbers(row.phone);
    const compKey = normalizeCompanyNameForDedupe(cleanCompany);

    if (!cleanPhone || cleanPhone.length < 8) {
      skippedInvalid++;
      continue;
    }

    // Élimination stricte des doublons : conserver les prospects existants intacts
    const isPhoneDuplicate = rowPhoneNumbers.some((num) => existingPhoneSet.has(num));
    const isCompanyDuplicate = compKey ? existingCompanySet.has(compKey) : false;

    if (isPhoneDuplicate || isCompanyDuplicate) {
      skippedDuplicates++;
      continue;
    }

    // Enregistrement dans le Set pour éviter les doublons au sein du même lot
    for (const num of rowPhoneNumbers) {
      existingPhoneSet.add(num);
    }
    if (compKey) {
      existingCompanySet.add(compKey);
    }

    const prospectionDate = options?.importAsVirgin ? null : parseExcelDate(row.date);

    const rawCallUpper = (row.callStatus || "").trim().toUpperCase();
    const rawStateUpper = (row.rawState || "").trim().toUpperCase();

    const isCallStatusVirgin =
      !rawCallUpper ||
      ["NON EFFECTUE", "NON EFFECTUÉ", "NON", "VIERGE", "AUCUN", "PAS ENCORE", "NOUVEAU", "NEW"].includes(rawCallUpper);

    const isRawStateVirgin =
      !rawStateUpper ||
      ["NOUVEAU", "NEW", "A CONTACTER", "À CONTACTER", "AUCUN", "VIERGE", "EN ATTENTE", "SANS"].includes(rawStateUpper);

    const hasResponse = Boolean(row.response && row.response.trim());
    const hasNotes = Boolean(row.notes && row.notes.trim());
    const isVirginProspect = Boolean(options?.importAsVirgin) || (isCallStatusVirgin && isRawStateVirgin && !hasResponse && !hasNotes);

    const mappedStatus = isVirginProspect
      ? ProspectStatus.NEW
      : mapRawStateToProspectStatus(row.rawState);

    // Resolve assigned commercial
    let resolvedAssignedToId = defaultAssignedToId || user.id;
    if (row.assignedToId) {
      resolvedAssignedToId = row.assignedToId;
    } else if (row.commercialName && row.commercialName.trim()) {
      const commQuery = row.commercialName.trim().toLowerCase();
      const matched = salesUsers.find((s) => {
        const sName = s.name.toLowerCase();
        return (
          sName.includes(commQuery) ||
          commQuery.includes(sName) ||
          sName.split(" ")[0] === commQuery.split(" ")[0]
        );
      });
      if (matched) {
        resolvedAssignedToId = matched.id;
      }
    }

    validRowsToInsert.push({
      cleanCompany,
      cleanPhone,
      prospectionDate,
      sector: row.sector?.trim() || "Autre prestation",
      address: row.address?.trim() || null,
      wilaya: row.wilaya?.trim() || (row.address?.trim() ? row.address.trim() : "Alger"),
      callStatus: isVirginProspect ? null : (row.callStatus?.trim() || null),
      status: mappedStatus,
      rawState: isVirginProspect ? null : (row.rawState?.trim() || null),
      email: row.email?.trim() || null,
      response: isVirginProspect ? null : (row.response?.trim() || null),
      notes: isVirginProspect ? null : (row.notes?.trim() || null),
      assignedToId: resolvedAssignedToId,
      isVirginProspect,
      rowCallStatus: isVirginProspect ? undefined : row.callStatus?.trim(),
    });
  }

  // Insertion ultra-rapide par bloc SQL natif (1 seule requête SQL au lieu de centaines)
  if (validRowsToInsert.length > 0) {
    try {
      const prospectsData = validRowsToInsert.map((item) => ({
        companyName: item.cleanCompany,
        phone: item.cleanPhone,
        prospectionDate: item.isVirginProspect ? null : item.prospectionDate,
        sector: item.sector,
        address: item.address,
        wilaya: item.wilaya,
        callStatus: item.callStatus,
        status: item.status,
        rawState: item.rawState,
        email: item.email,
        response: item.response,
        notes: item.notes,
        assignedToId: item.assignedToId,
        createdById: user.id,
      }));

      const createdProspects = await (prisma.prospect as any).createManyAndReturn({
        data: prospectsData,
        skipDuplicates: true,
        select: { id: true, phone: true, companyName: true },
      });

      imported = createdProspects.length;

      const callsToCreate: any[] = [];
      const followUpsToCreate: any[] = [];
      const now = Date.now();

      for (let i = 0; i < createdProspects.length; i++) {
        const created = createdProspects[i];
        const item = validRowsToInsert[i];
        if (!item) continue;

        // Si appel effectif
        if (!item.isVirginProspect && item.rowCallStatus) {
          const callData = mapCallStatusToCallData(item.rowCallStatus);
          if (callData) {
            callsToCreate.push({
              prospectId: created.id,
              userId: item.assignedToId,
              result: callData.result,
              comment: `Import Excel: ${callData.comment}`,
              durationSeconds: callData.durationSeconds,
              calledAt: item.prospectionDate || new Date(),
            });
          }
        }

        // Relance automatique (+3j, +7j, +15j)
        const isContactedEligible = !item.isVirginProspect && isProspectContactedForRelance(
          item.rawState || undefined,
          item.callStatus || undefined,
          item.status
        );

        if (isContactedEligible) {
          followUpsToCreate.push(
            {
              prospectId: created.id,
              userId: item.assignedToId,
              stepNumber: 1,
              scheduledAt: new Date(now + 3 * 24 * 60 * 60 * 1000),
              status: FollowUpStatus.SCHEDULED,
              notes: "Relance Étape 1 (+3j) : Prospect contacté lors de l'import",
            },
            {
              prospectId: created.id,
              userId: item.assignedToId,
              stepNumber: 2,
              scheduledAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
              status: FollowUpStatus.SCHEDULED,
              notes: "Relance Étape 2 (+7j)",
            },
            {
              prospectId: created.id,
              userId: item.assignedToId,
              stepNumber: 3,
              scheduledAt: new Date(now + 15 * 24 * 60 * 60 * 1000),
              status: FollowUpStatus.SCHEDULED,
              notes: "Relance Étape 3 (+15j)",
            }
          );
          autoRelancesCreated++;
        }
      }

      if (callsToCreate.length > 0) {
        await prisma.call.createMany({ data: callsToCreate });
      }

      if (followUpsToCreate.length > 0) {
        await prisma.followUp.createMany({ data: followUpsToCreate });
      }
    } catch (err: any) {
      console.error("Batch insert error:", err);
      errors.push(`Erreur lors de l'insertion du lot: ${err?.message || "inconnue"}`);
    }
  }

  await createAuditLog({
    userId: user.id,
    action: "BULK_IMPORT",
    module: "PROSPECTS",
    details: {
      imported,
      skippedDuplicates,
      skippedInvalid,
      autoRelancesCreated,
      total: rows.length,
    },
  });

  revalidatePath("/prospection");
  revalidatePath("/relances");
  revalidatePath("/appels");
  revalidatePath("/dashboard");

  return {
    success: true,
    imported,
    skipped: skippedDuplicates + skippedInvalid,
    skippedDuplicates,
    skippedInvalid,
    autoRelancesCreated,
    errors,
  };
}

function findLocalProspectionFile(): string | null {
  const userProfile = process.env.USERPROFILE || process.env.HOME || "C:/Users/amatek";
  const dlDir = path.join(userProfile, "Downloads");

  const candidates = [
    path.join(dlDir, "Feuille de calcul sans titre.xlsx"),
    path.join(dlDir, "PROSPECTION BOOSTERA.xlsx"),
    path.join(dlDir, "PROSPECTION_BOOSTERA.xlsx"),
    path.join(dlDir, "prospection.xlsx"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(/*turbopackIgnore: true*/ c)) return c;
  }
  // Try finding any .xlsx file in Downloads
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ dlDir)) {
      const files = fs.readdirSync(dlDir);
      const match = files.find(f => f.endsWith(".xlsx") && (f.toLowerCase().includes("sans titre") || f.toLowerCase().includes("prospect") || f.toLowerCase().includes("boostera")));
      if (match) return path.join(dlDir, match);
    }
  } catch {}
  return null;
}

export async function getLocalProspectionFileInfo() {
  await requireAuth();
  const filePath = findLocalProspectionFile();
  if (!filePath) {
    return { exists: false, sheets: [] };
  }
  try {
    const workbook = XLSX.readFile(filePath, { bookSheets: true });
    return {
      exists: true,
      filePath,
      sheets: workbook.SheetNames || [],
    };
  } catch {
    return { exists: false, sheets: [] };
  }
}

export async function importLocalProspectionFile(sheetName?: string, defaultAssignedToId?: string) {
  const user = await requireAuth();

  const filePath = findLocalProspectionFile();
  if (!filePath) {
    return { error: "Aucun fichier Excel de prospection trouvé dans Téléchargements." };
  }

  try {
    const workbook = XLSX.readFile(filePath);
    const targetSheetName = sheetName && workbook.Sheets[sheetName] ? sheetName : (workbook.SheetNames[0] || "TOUS");
    const selectedSheet = workbook.Sheets[targetSheetName];
    if (!selectedSheet) {
      return { error: `Feuille "${targetSheetName}" non trouvée.` };
    }

    const matrix: any[][] = XLSX.utils.sheet_to_json(selectedSheet, { header: 1, defval: "" });
    if (!matrix || matrix.length === 0) {
      return { error: "Feuille vide." };
    }

    let headerRowIdx = -1;
    let maxMatchScore = 0;

    for (let i = 0; i < Math.min(15, matrix.length); i++) {
      const row = matrix[i] || [];
      const normalizedCells = row.map((cell) =>
        String(cell || "")
          .trim()
          .toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
      );

      let score = 0;
      for (const cell of normalizedCells) {
        if (cell.includes("CLIENT") || cell.includes("NOM")) score += 3;
        if (cell.includes("NUMERO") || cell.includes("TEL") || cell.includes("PHONE") || cell === "µ") score += 3;
        if (cell.includes("DATE")) score += 2;
        if (cell.includes("TYPE") || cell.includes("SECTEUR")) score += 2;
        if (cell.includes("ADRESS") || cell.includes("ZONE") || cell.includes("PLACE")) score += 2;
        if (cell.includes("APPEL")) score += 2;
        if (cell.includes("ETAT") || cell.includes("STATUT")) score += 2;
        if (cell.includes("REPENSE") || cell.includes("REPONSE")) score += 2;
        if (cell.includes("REMARQUE") || cell.includes("NOTE")) score += 2;
        if (cell.includes("MAIL")) score += 2;
      }

      if (score > maxMatchScore) {
        maxMatchScore = score;
        headerRowIdx = i;
      }
    }

    if (headerRowIdx === -1 || maxMatchScore < 3) {
      headerRowIdx = 0;
    }

    const rawHeaders = matrix[headerRowIdx] || [];

    let clientIdx = -1;
    let numeroIdx = -1;
    let dateIdx = -1;
    let typeIdx = -1;
    let adressIdx = -1;
    let appelIdx = -1;
    let etatIdx = -1;
    let mailIdx = -1;
    let repenseIdx = -1;
    let remarqueIdx = -1;
    let commercialIdx = -1;

    rawHeaders.forEach((h, colIdx) => {
      const norm = String(h || "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      if (clientIdx === -1 && (norm.includes("CLIENT") || norm.includes("NOM") || norm.includes("ENTREPRISE") || norm.includes("SOCIETE"))) {
        clientIdx = colIdx;
      } else if (numeroIdx === -1 && (norm.includes("NUMERO") || norm.includes("TEL") || norm.includes("PHONE") || norm === "µ")) {
        numeroIdx = colIdx;
      } else if (dateIdx === -1 && norm.includes("DATE")) {
        dateIdx = colIdx;
      } else if (typeIdx === -1 && (norm.includes("TYPE") || norm.includes("SECTEUR") || norm.includes("ACTIVITE"))) {
        typeIdx = colIdx;
      } else if (adressIdx === -1 && (norm.includes("ADRESS") || norm.includes("ZONE") || norm.includes("PLACE") || norm.includes("WILAYA") || norm.includes("VILLE"))) {
        adressIdx = colIdx;
      } else if (appelIdx === -1 && norm.includes("APPEL")) {
        appelIdx = colIdx;
      } else if (etatIdx === -1 && (norm.includes("ETAT") || norm.includes("STATUT"))) {
        etatIdx = colIdx;
      } else if (mailIdx === -1 && (norm.includes("MAIL") || norm.includes("EMAIL") || norm.includes("WHATSAPP"))) {
        mailIdx = colIdx;
      } else if (repenseIdx === -1 && (norm.includes("REPENSE") || norm.includes("REPONSE"))) {
        repenseIdx = colIdx;
      } else if (remarqueIdx === -1 && (norm.includes("REMARQUE") || norm.includes("NOTE") || norm.includes("COMMENT"))) {
        remarqueIdx = colIdx;
      } else if (commercialIdx === -1 && (norm.includes("COMMERCIAL") || norm.includes("VENDEUR") || norm.includes("AGENT") || norm.includes("AFFECTE") || norm.includes("RESPONSABLE"))) {
        commercialIdx = colIdx;
      }
    });

    if (clientIdx === -1) clientIdx = 0;
    if (numeroIdx === -1) numeroIdx = 1;

    const mapped: any[] = [];

    for (let r = headerRowIdx + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row || row.length === 0) continue;

      const rawClient = row[clientIdx];
      const rawNumero = row[numeroIdx];

      const clientStr = String(rawClient || "").trim();
      const numeroStr = String(rawNumero || "").trim();

      if (!clientStr && !numeroStr) continue;
      if (clientStr.toUpperCase() === "CLIENT" || numeroStr.toUpperCase() === "NUMERO") continue;

      const detectedCommercial = commercialIdx !== -1 && row[commercialIdx] 
        ? String(row[commercialIdx]).trim() 
        : (targetSheetName !== "TOUS" && targetSheetName !== "Feuille 1" ? targetSheetName : undefined);

      mapped.push({
        companyName: clientStr || "Sans nom",
        phone: numeroStr,
        date: dateIdx !== -1 ? row[dateIdx] : null,
        sector: typeIdx !== -1 && row[typeIdx] ? String(row[typeIdx]).trim() : "Agence de voyage",
        address: adressIdx !== -1 && row[adressIdx] ? String(row[adressIdx]).trim() : "Alger",
        wilaya: adressIdx !== -1 && row[adressIdx] ? String(row[adressIdx]).trim() : "Alger",
        callStatus: appelIdx !== -1 && row[appelIdx] ? String(row[appelIdx]).trim() : null,
        rawState: etatIdx !== -1 && row[etatIdx] ? String(row[etatIdx]).trim() : null,
        email: mailIdx !== -1 && row[mailIdx] ? String(row[mailIdx]).trim() : null,
        response: repenseIdx !== -1 && row[repenseIdx] ? String(row[repenseIdx]).trim() : null,
        notes: remarqueIdx !== -1 && row[remarqueIdx] ? String(row[remarqueIdx]).trim() : null,
        commercialName: detectedCommercial,
      });
    }

    return await bulkImportProspects(mapped, defaultAssignedToId);
  } catch (err: any) {
    return { error: `Échec de l'importation : ${err?.message || "Erreur inconnue"}` };
  }
}
