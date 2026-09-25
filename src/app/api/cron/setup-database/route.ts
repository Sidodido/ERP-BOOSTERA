import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const execAsync = promisify(exec);

export async function GET() {
  const logs: string[] = [];

  try {
    // 1. Push schema tables to PostgreSQL
    logs.push("Lancement de prisma db push...");
    const { stdout, stderr } = await execAsync("npx prisma db push --accept-data-loss", {
      cwd: process.cwd(),
      timeout: 60000,
    });
    logs.push("Sortie Prisma : " + (stdout || stderr || "OK").trim());

    // 2. Ensure default users exist
    const defaultPassword = await bcrypt.hash("Boostera2026!", 10);

    const admin = await prisma.user.upsert({
      where: { email: "admin@boostera.dz" },
      update: {},
      create: {
        email: "admin@boostera.dz",
        passwordHash: defaultPassword,
        name: "Direction BOOSTERA",
        role: "ADMIN",
        phone: "0550 00 00 01",
      },
    });
    logs.push("Compte Direction : " + admin.email);

    const meroua = await prisma.user.upsert({
      where: { email: "meroua@boostera.dz" },
      update: {},
      create: {
        email: "meroua@boostera.dz",
        passwordHash: defaultPassword,
        name: "Meroua (Commerciale)",
        role: "SALES_REP",
        phone: "0550 11 22 32",
      },
    });

    const wiam = await prisma.user.upsert({
      where: { email: "wiam@boostera.dz" },
      update: {},
      create: {
        email: "wiam@boostera.dz",
        passwordHash: defaultPassword,
        name: "Wiam (Commerciale)",
        role: "SALES_REP",
        phone: "0550 11 22 31",
      },
    });

    const sidahmed = await prisma.user.upsert({
      where: { email: "sidahmed@boostera.dz" },
      update: {},
      create: {
        email: "sidahmed@boostera.dz",
        passwordHash: defaultPassword,
        name: "Sidahmed (Technicien)",
        role: "TECH_LEAD",
        phone: "0550 11 22 34",
      },
    });

    // Employee profiles
    await prisma.employee.upsert({
      where: { userId: admin.id },
      update: {},
      create: {
        userId: admin.id,
        firstName: "Direction",
        lastName: "BOOSTERA",
        position: "Direction Générale",
        department: "ADMINISTRATION",
      },
    });

    await prisma.employee.upsert({
      where: { userId: meroua.id },
      update: {},
      create: {
        userId: meroua.id,
        firstName: "Meroua",
        lastName: "Commerciale",
        position: "Commercial",
        department: "COMMERCIAL",
      },
    });

    await prisma.employee.upsert({
      where: { userId: sidahmed.id },
      update: {},
      create: {
        userId: sidahmed.id,
        firstName: "Sidahmed",
        lastName: "Technicien",
        position: "Chef de Projet",
        department: "TECHNICAL",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Base de données initialisée et comptes créés avec succès !",
      logs,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
        logs,
      },
      { status: 500 }
    );
  }
}
