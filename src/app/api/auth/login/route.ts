import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Veuillez renseigner votre email et mot de passe." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Identifiants invalides." },
        { status: 401 }
      );
    }

    const passwordMatch = await verifyPassword(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Identifiants invalides." },
        { status: 401 }
      );
    }

    // Contrôle des statuts d'accès
    if (user.status === "EMAIL_UNVERIFIED" || !user.emailVerified) {
      return NextResponse.json(
        {
          error: "Veuillez confirmer votre adresse e-mail avant de vous connecter. Consultez votre boîte de réception.",
          status: "EMAIL_UNVERIFIED",
          email: user.email,
        },
        { status: 403 }
      );
    }

    if (user.status === "PENDING") {
      return NextResponse.json(
        {
          error: "Votre e-mail est vérifié, mais votre compte est en attente d'approbation par la direction générale.",
          status: "PENDING",
        },
        { status: 403 }
      );
    }

    if (user.status === "REJECTED") {
      return NextResponse.json(
        {
          error: `Votre demande d'accès n'a pas été retenue.${
            user.rejectionReason ? ` Motif : ${user.rejectionReason}` : ""
          }`,
          status: "REJECTED",
        },
        { status: 403 }
      );
    }

    if (user.status === "SUSPENDED") {
      return NextResponse.json(
        {
          error: "Ce compte collaborateur est temporairement suspendu. Contactez un administrateur.",
          status: "SUSPENDED",
        },
        { status: 403 }
      );
    }

    if (user.status === "ARCHIVED" || !user.isActive) {
      return NextResponse.json(
        { error: "Ce compte a été désactivé.", status: "ARCHIVED" },
        { status: 403 }
      );
    }

    // Mise à jour de la dernière connexion et statut actif
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

    await createAuditLog({
      userId: user.id,
      action: "LOGIN",
      module: "AUTH",
      details: { email: user.email, role: user.role },
    });

    const response = NextResponse.json({
      success: true,
      redirectUrl: "/dashboard",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set("boostera_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "Erreur serveur : " + (error?.message || "Inconnue") },
      { status: 500 }
    );
  }
}
