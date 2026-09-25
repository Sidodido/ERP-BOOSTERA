"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import {
  sendAccountApprovedEmail,
  sendAccountRejectedEmail,
  sendEmailChangeVerificationEmail,
  sendPasswordResetEmail,
} from "@/lib/email";
import crypto from "crypto";
import { Role, UserStatus, DepartmentType } from "@prisma/client";
import { headers } from "next/headers";

export async function getAppUrl(): Promise<string> {
  try {
    const headersList = await headers();
    const host = headersList.get("x-forwarded-host") || headersList.get("host");
    const proto = headersList.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
    if (host && !host.includes("localhost")) {
      return `${proto}://${host}`;
    }
  } catch {
    // headers() might not be available in cron or background jobs
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, "")}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL.replace(/\/$/, "")}`;
  }
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function requireAdminUser() {
  const user = await requireAuth();
  if (user.role !== "ADMIN" && user.role !== "SALES_DIRECTOR") {
    throw new Error("Accès réservé aux administrateurs.");
  }
  return user;
}

export async function getRegistrationRequestsAction() {
  await requireAdminUser();

  const requests = await prisma.user.findMany({
    where: {
      status: { in: [UserStatus.PENDING, UserStatus.EMAIL_UNVERIFIED] },
    },
    include: {
      employee: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return requests.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    role: r.role,
    status: r.status,
    emailVerified: r.emailVerified,
    createdAt: r.createdAt.toISOString(),
    employee: r.employee
      ? {
          firstName: r.employee.firstName,
          lastName: r.employee.lastName,
          position: r.employee.position,
          department: r.employee.department,
        }
      : null,
  }));
}

export async function approveRegistrationRequestAction(userId: string) {
  const admin = await requireAdminUser();

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { employee: true },
  });

  if (!target) {
    throw new Error("Utilisateur introuvable.");
  }

  // Activation complète
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "ACTIVE",
      isActive: true,
      approvedAt: new Date(),
      approvedById: admin.id,
      rejectionReason: null,
      rejectedAt: null,
      rejectedById: null,
    },
  });

  if (target.employee) {
    await prisma.employee.update({
      where: { id: target.employee.id },
      data: { isActive: true },
    });
  }

  // Envoi de l'e-mail d'approbation
  const appUrl = await getAppUrl();
  await sendAccountApprovedEmail(target.email, target.name, `${appUrl}/login`);

  await createAuditLog({
    userId: admin.id,
    action: "APPROVE_REGISTRATION",
    module: "AUTH",
    details: {
      approvedUserId: target.id,
      approvedUserName: target.name,
      approvedUserEmail: target.email,
    },
  });

  return { success: true };
}

export async function rejectRegistrationRequestAction(userId: string, reason?: string | null) {
  const admin = await requireAdminUser();

  const target = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!target) {
    throw new Error("Utilisateur introuvable.");
  }

  const cleanReason = reason?.trim() || null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "REJECTED",
      isActive: false,
      rejectionReason: cleanReason,
      rejectedAt: new Date(),
      rejectedById: admin.id,
    },
  });

  await sendAccountRejectedEmail(target.email, target.name, cleanReason);

  await createAuditLog({
    userId: admin.id,
    action: "REJECT_REGISTRATION",
    module: "AUTH",
    details: {
      rejectedUserId: target.id,
      rejectedUserName: target.name,
      rejectedUserEmail: target.email,
      reason: cleanReason,
    },
  });

  return { success: true };
}

export async function setPendingRegistrationRequestAction(userId: string) {
  const admin = await requireAdminUser();

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "PENDING",
      isActive: false,
      rejectionReason: null,
      rejectedAt: null,
      rejectedById: null,
    },
  });

  await createAuditLog({
    userId: admin.id,
    action: "SET_PENDING_REGISTRATION",
    module: "AUTH",
    details: { targetUserId: userId },
  });

  return { success: true };
}

export interface CollaboratorFilterParams {
  search?: string;
  status?: string;
  department?: string;
}

export async function getCollaboratorsListAction(filters: CollaboratorFilterParams = {}) {
  await requireAdminUser();

  const whereClause: any = {};

  if (filters.status && filters.status !== "ALL") {
    whereClause.status = filters.status as UserStatus;
  }

  if (filters.department && filters.department !== "ALL") {
    whereClause.employee = {
      department: filters.department as DepartmentType,
    };
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    whereClause.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { employee: { position: { contains: q, mode: "insensitive" } } },
    ];
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    include: {
      employee: true,
      _count: {
        select: {
          assignedProspects: true,
          managedClients: true,
          assignedTasks: true,
          loggedCalls: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    pendingEmail: u.pendingEmail,
    phone: u.phone,
    role: u.role,
    status: u.status,
    isActive: u.isActive,
    emailVerified: u.emailVerified,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    passwordChangedAt: u.passwordChangedAt ? u.passwordChangedAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    employee: u.employee
      ? {
          id: u.employee.id,
          firstName: u.employee.firstName,
          lastName: u.employee.lastName,
          position: u.employee.position,
          department: u.employee.department,
          baseSalary: Number(u.employee.baseSalary || 0),
          hireDate: u.employee.hireDate.toISOString(),
        }
      : null,
    counts: u._count,
  }));
}

export async function getCollaboratorDetailAction(userId: string) {
  await requireAdminUser();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      employee: true,
      auditLogs: {
        take: 10,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) {
    throw new Error("Collaborateur introuvable.");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    pendingEmail: user.pendingEmail,
    phone: user.phone,
    role: user.role,
    status: user.status,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    rejectionReason: user.rejectionReason,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    passwordChangedAt: user.passwordChangedAt ? user.passwordChangedAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    employee: user.employee
      ? {
          id: user.employee.id,
          firstName: user.employee.firstName,
          lastName: user.employee.lastName,
          position: user.employee.position,
          department: user.employee.department,
          baseSalary: Number(user.employee.baseSalary || 0),
          hireDate: user.employee.hireDate.toISOString(),
        }
      : null,
    auditLogs: user.auditLogs.map((a) => ({
      id: a.id,
      action: a.action,
      module: a.module,
      details: a.details,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export async function initiateEmailChangeAction(userId: string, newEmail: string) {
  const admin = await requireAdminUser();
  const cleanNewEmail = newEmail.trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanNewEmail)) {
    throw new Error("Format d'adresse e-mail invalide.");
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: cleanNewEmail }, { pendingEmail: cleanNewEmail }],
      NOT: { id: userId },
    },
  });

  if (existing) {
    throw new Error("Cette adresse e-mail est déjà attribuée à un autre compte.");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!target) {
    throw new Error("Utilisateur introuvable.");
  }

  if (target.email === cleanNewEmail) {
    throw new Error("La nouvelle adresse e-mail est identique à l'adresse actuelle.");
  }

  const changeToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 heures

  await prisma.user.update({
    where: { id: userId },
    data: {
      pendingEmail: cleanNewEmail,
      emailChangeToken: changeToken,
      emailChangeTokenExpiresAt: expiresAt,
    },
  });

  const appUrl = await getAppUrl();
  const verifyChangeUrl = `${appUrl}/verify-email-change?token=${changeToken}`;

  await sendEmailChangeVerificationEmail({
    newEmail: cleanNewEmail,
    name: target.name,
    oldEmail: target.email,
    verificationUrl: verifyChangeUrl,
  });

  await createAuditLog({
    userId: admin.id,
    action: "INITIATE_EMAIL_CHANGE",
    module: "AUTH",
    details: {
      targetUserId: userId,
      oldEmail: target.email,
      newPendingEmail: cleanNewEmail,
    },
  });

  return { success: true };
}

export async function toggleUserSuspensionAction(userId: string, shouldSuspend: boolean) {
  const admin = await requireAdminUser();

  const target = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!target) {
    throw new Error("Utilisateur introuvable.");
  }

  if (target.id === admin.id) {
    throw new Error("Vous ne pouvez pas suspendre votre propre compte administrateur.");
  }

  const nextStatus: UserStatus = shouldSuspend ? "SUSPENDED" : "ACTIVE";

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: nextStatus,
      isActive: !shouldSuspend,
    },
  });

  await createAuditLog({
    userId: admin.id,
    action: shouldSuspend ? "SUSPEND_USER" : "UNSUSPEND_USER",
    module: "AUTH",
    details: { targetUserId: userId, userEmail: target.email },
  });

  return { success: true, status: nextStatus };
}

export async function adminTriggerPasswordResetAction(userId: string) {
  const admin = await requireAdminUser();

  const target = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!target) {
    throw new Error("Utilisateur introuvable.");
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await prisma.user.update({
    where: { id: userId },
    data: {
      resetPasswordToken: resetToken,
      resetPasswordTokenExpiresAt: expiresAt,
    },
  });

  const appUrl = await getAppUrl();
  const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

  await sendPasswordResetEmail(target.email, target.name, resetUrl);

  await createAuditLog({
    userId: admin.id,
    action: "ADMIN_TRIGGER_PASSWORD_RESET",
    module: "AUTH",
    details: { targetUserId: userId, userEmail: target.email },
  });

  return { success: true };
}

export async function adminDirectSetUserPasswordAction(userId: string, newPassword: string) {
  const admin = await requireAdminUser();

  if (!newPassword || newPassword.length < 6) {
    throw new Error("Le mot de passe doit comporter au moins 6 caractères.");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!target) {
    throw new Error("Utilisateur introuvable.");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
      resetPasswordToken: null,
      resetPasswordTokenExpiresAt: null,
    },
  });

  await createAuditLog({
    userId: admin.id,
    action: "ADMIN_DIRECT_PASSWORD_SET",
    module: "AUTH",
    details: { targetUserId: userId, userEmail: target.email },
  });

  return { success: true };
}

export async function updateUserRoleAction(userId: string, role: Role) {
  const admin = await requireAdminUser();

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  await createAuditLog({
    userId: admin.id,
    action: "UPDATE_USER_ROLE",
    module: "AUTH",
    details: { targetUserId: userId, newRole: role },
  });

  return { success: true };
}
