"use server";

import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken, setSessionCookie, clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { redirect } from "next/navigation";

export async function loginAction(formData: FormData) {
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

  if (!user || !user.isActive) {
    return { error: "Identifiants invalides ou compte inactif." };
  }

  const passwordMatch = await verifyPassword(password, user.passwordHash);
  if (!passwordMatch) {
    return { error: "Identifiants invalides." };
  }

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
