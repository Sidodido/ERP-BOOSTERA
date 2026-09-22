"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import {
  sendVerificationEmail,
  sendAdminNewRegistrationNotification,
  sendPasswordResetEmail,
} from "@/lib/email";
import crypto from "crypto";
import { DepartmentType, Role, UserStatus } from "@prisma/client";

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function resolveRoleFromDepartment(department: DepartmentType): Role {
  switch (department) {
    case "COMMERCIAL":
    case "PROSPECTION":
    case "SALES":
    case "CUSTOMER_RELATIONS":
      return "SALES_REP";
    case "DEVELOPMENT":
    case "TECHNICAL":
      return "DEVELOPER";
    case "DESIGN":
      return "DESIGNER";
    case "VIDEO":
      return "VIDEO_EDITOR";
    case "FINANCE":
      return "ACCOUNTANT";
    case "HR":
      return "HR";
    case "ADMINISTRATION":
      return "ADMIN";
    default:
      return "SALES_REP";
  }
}

export async function registerCollaboratorAction(formData: FormData) {
  const firstName = (formData.get("firstName") as string || "").trim();
  const lastName = (formData.get("lastName") as string || "").trim();
  const email = (formData.get("email") as string || "").trim().toLowerCase();
  const phone = (formData.get("phone") as string || "").trim();
  const position = (formData.get("position") as string || "").trim();
  const departmentRaw = (formData.get("department") as string || "COMMERCIAL").trim();
  const password = formData.get("password") as string || "";
  const confirmPassword = formData.get("confirmPassword") as string || "";

  if (!firstName || !lastName || !email || !password) {
    return { error: "Veuillez renseigner votre prénom, nom, e-mail et mot de passe." };
  }

  if (password.length < 6) {
    return { error: "Le mot de passe doit comporter au moins 6 caractères." };
  }

  if (password !== confirmPassword) {
    return { error: "Les deux mots de passe saisis ne correspondent pas." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: "Veuillez fournir une adresse e-mail professionnelle valide." };
  }

  // Vérification si un compte existe déjà
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    if (existingUser.status === "EMAIL_UNVERIFIED") {
      return {
        error: "Un compte avec cette adresse existe déjà mais son e-mail n'a pas été vérifié.",
        needsVerification: true,
        email,
      };
    }
    return { error: "Un compte avec cette adresse e-mail est déjà enregistré." };
  }

  const department = (Object.values(DepartmentType).includes(departmentRaw as DepartmentType)
    ? departmentRaw
    : "COMMERCIAL") as DepartmentType;

  const role = resolveRoleFromDepartment(department);
  const passwordHash = await hashPassword(password);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  const fullName = `${firstName} ${lastName}`;

  // Création du User et de l'Employee
  const newUser = await prisma.user.create({
    data: {
      name: fullName,
      email,
      phone: phone || null,
      passwordHash,
      role,
      status: "EMAIL_UNVERIFIED",
      isActive: false,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpiresAt: tokenExpiresAt,
      employee: {
        create: {
          firstName,
          lastName,
          email,
          phone: phone || null,
          position: position || "Collaborateur",
          department,
          isActive: false,
        },
      },
    },
  });

  // Envoi de l'e-mail de confirmation
  const appUrl = getAppUrl();
  const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`;

  await sendVerificationEmail(email, fullName, verificationUrl);

  await createAuditLog({
    userId: newUser.id,
    action: "REGISTER_REQUEST",
    module: "AUTH",
    details: { email, department, position },
  });

  return { success: true, email };
}

export async function resendVerificationEmailAction(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: cleanEmail },
  });

  if (!user || user.status !== "EMAIL_UNVERIFIED") {
    return { error: "Aucun compte en attente de vérification d'e-mail trouvé pour cette adresse." };
  }

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpiresAt: tokenExpiresAt,
    },
  });

  const appUrl = getAppUrl();
  const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`;

  await sendVerificationEmail(cleanEmail, user.name, verificationUrl);

  return { success: true };
}

export async function verifyEmailTokenAction(token: string) {
  if (!token) {
    return { error: "Jeton de vérification manquant." };
  }

  const user = await prisma.user.findUnique({
    where: { emailVerificationToken: token },
    include: { employee: true },
  });

  if (!user) {
    return { error: "Ce lien de vérification est invalide ou a déjà été utilisé." };
  }

  if (
    user.emailVerificationTokenExpiresAt &&
    user.emailVerificationTokenExpiresAt < new Date()
  ) {
    return {
      error: "Ce lien de vérification a expiré. Veuillez demander un nouvel e-mail.",
      expired: true,
      email: user.email,
    };
  }

  // Mise à jour de l'utilisateur : e-mail vérifié, statut en attente de l'administrateur
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: "PENDING",
      emailVerificationToken: null,
      emailVerificationTokenExpiresAt: null,
    },
  });

  // Notification in-app pour tous les administrateurs
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SALES_DIRECTOR"] }, isActive: true },
    select: { id: true, email: true },
  });

  const appUrl = getAppUrl();
  const dashboardRequestsUrl = `${appUrl}/collaborateurs?tab=REQUESTS`;

  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: "Nouvelle demande d'inscription",
        message: `Le collaborateur ${user.name} (${user.email}) a vérifié son e-mail et attend votre validation.`,
        type: "SYSTEM",
        link: "/collaborateurs?tab=REQUESTS",
      })),
    });

    // Envoi d'un e-mail d'alerte au premier administrateur configuré
    const primaryAdmin = admins[0];
    if (primaryAdmin.email) {
      await sendAdminNewRegistrationNotification({
        adminEmail: primaryAdmin.email,
        applicantName: user.name,
        applicantEmail: user.email,
        department: user.employee?.department || "COMMERCIAL",
        position: user.employee?.position || "Collaborateur",
        phone: user.phone,
        dashboardUrl: dashboardRequestsUrl,
      });
    }
  }

  await createAuditLog({
    userId: user.id,
    action: "EMAIL_VERIFIED",
    module: "AUTH",
    details: { email: user.email },
  });

  return {
    success: true,
    user: {
      name: user.name,
      email: user.email,
      submittedAt: user.createdAt.toISOString(),
      department: user.employee?.department || "Général",
    },
  };
}

export async function verifyEmailChangeTokenAction(token: string) {
  if (!token) {
    return { error: "Jeton de confirmation manquant." };
  }

  const user = await prisma.user.findUnique({
    where: { emailChangeToken: token },
  });

  if (!user || !user.pendingEmail) {
    return { error: "Ce lien de confirmation de changement d'e-mail est invalide." };
  }

  if (
    user.emailChangeTokenExpiresAt &&
    user.emailChangeTokenExpiresAt < new Date()
  ) {
    return { error: "Ce lien de confirmation a expiré. Veuillez demander une nouvelle modification." };
  }

  const oldEmail = user.email;
  const newEmail = user.pendingEmail;

  // Remplacement officiel
  await prisma.user.update({
    where: { id: user.id },
    data: {
      email: newEmail,
      pendingEmail: null,
      emailChangeToken: null,
      emailChangeTokenExpiresAt: null,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  // Mise à jour de l'employé s'il existe
  await prisma.employee.updateMany({
    where: { userId: user.id },
    data: { email: newEmail },
  });

  await createAuditLog({
    userId: user.id,
    action: "EMAIL_CHANGE_VERIFIED",
    module: "AUTH",
    details: { oldEmail, newEmail },
  });

  return { success: true, oldEmail, newEmail };
}

export async function requestPasswordResetAction(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    return { error: "Veuillez renseigner votre adresse e-mail." };
  }

  const user = await prisma.user.findUnique({
    where: { email: cleanEmail },
  });

  // Pour des raisons de sécurité, ne pas divulguer si l'e-mail n'existe pas
  if (!user || !user.isActive) {
    return { success: true };
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetPasswordToken: resetToken,
      resetPasswordTokenExpiresAt: expiresAt,
    },
  });

  const appUrl = getAppUrl();
  const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

  await sendPasswordResetEmail(user.email, user.name, resetUrl);

  return { success: true };
}

export async function resetPasswordAction(token: string, newPassword: string) {
  if (!token || !newPassword) {
    return { error: "Champs requis manquants." };
  }

  if (newPassword.length < 6) {
    return { error: "Le mot de passe doit comporter au moins 6 caractères." };
  }

  const user = await prisma.user.findUnique({
    where: { resetPasswordToken: token },
  });

  if (!user) {
    return { error: "Ce lien de réinitialisation est invalide ou a déjà été utilisé." };
  }

  if (
    user.resetPasswordTokenExpiresAt &&
    user.resetPasswordTokenExpiresAt < new Date()
  ) {
    return { error: "Ce lien de réinitialisation a expiré. Veuillez faire une nouvelle demande." };
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
      resetPasswordToken: null,
      resetPasswordTokenExpiresAt: null,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "PASSWORD_RESET",
    module: "AUTH",
  });

  return { success: true };
}
