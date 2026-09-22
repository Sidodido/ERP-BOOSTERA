"use server";

import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken, setSessionCookie, clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { redirect } from "next/navigation";

export interface LoginResult {
  error?: string;
  status?: string;
  email?: string;
}

export async function loginAction(formData: FormData): Promise<LoginResult | void> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Veuillez renseigner votre email et mot de passe." };
  }

  let user;
  let lastDbError: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      user = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      lastDbError = null;
      break;
    } catch (dbError: any) {
      lastDbError = dbError;
      console.warn(`[Login] Tentative ${attempt}/3 connexion DB échouée:`, dbError?.message || dbError);
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }

  if (lastDbError) {
    console.error("Erreur base de données finale lors du login:", lastDbError);
    return {
      error: `Erreur de connexion base de données (${lastDbError.code || "DB_RETRY_EXHAUSTED"}). Veuillez réessayer dans un instant.`,
    };
  }

  if (!user) {
    return { error: "Identifiants invalides." };
  }

  const passwordMatch = await verifyPassword(password, user.passwordHash);
  if (!passwordMatch) {
    return { error: "Identifiants invalides." };
  }

  // Contrôle strict des statuts de compte du collaborateur
  if (user.status === "EMAIL_UNVERIFIED" || !user.emailVerified) {
    return {
      error: "Veuillez confirmer votre adresse e-mail avant de vous connecter. Consultez votre boîte de réception pour valider votre compte.",
      status: "EMAIL_UNVERIFIED",
      email: user.email,
    };
  }

  if (user.status === "PENDING") {
    return {
      error: "Votre e-mail est vérifié, mais votre compte est en attente d'approbation par un administrateur. Vous recevrez un e-mail de confirmation dès sa validation.",
      status: "PENDING",
    };
  }

  if (user.status === "REJECTED") {
    return {
      error: `Votre demande de compte n'a pas été retenue par l'administration.${
        user.rejectionReason ? ` Motif : ${user.rejectionReason}` : ""
      }`,
      status: "REJECTED",
    };
  }

  if (user.status === "SUSPENDED") {
    return {
      error: "Ce compte collaborateur est temporairement suspendu. Veuillez contacter un administrateur.",
      status: "SUSPENDED",
    };
  }

  if (user.status === "ARCHIVED" || !user.isActive) {
    return {
      error: "Ce compte a été désactivé par l'administration.",
      status: "ARCHIVED",
    };
  }

  // Mise à jour de la dernière connexion et passage à ACTIVE si APPROVED
  await prisma.user.update({
    where: { id: user.id },
    data: {
      status: "ACTIVE",
      isActive: true,
      lastLoginAt: new Date(),
    },
  });

  const token = await signToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  await setSessionCookie(token);

  await createAuditLog({
    userId: user.id,
    action: "LOGIN",
    module: "AUTH",
    details: { email: user.email, role: user.role },
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) {
    await createAuditLog({
      userId: user.id,
      action: "LOGOUT",
      module: "AUTH",
    });
  }

  await clearSessionCookie();
  redirect("/login");
}
