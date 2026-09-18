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

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

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
