import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "NON_DEFINIE";
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ":****@");

  try {
    const start = Date.now();
    await prisma.$connect();
    const connectTime = Date.now() - start;

    const userCount = await prisma.user.count();
    const users = await prisma.user.findMany({
      select: { email: true, role: true, isActive: true },
      take: 10,
    });

    return NextResponse.json({
      status: "SUCCESS",
      databaseUrl: maskedUrl,
      connectTimeMs: connectTime,
      userCount,
      users,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "ERROR",
        databaseUrl: maskedUrl,
        errorMessage: error.message,
        errorCode: error.code,
      },
      { status: 500 }
    );
  }
}
