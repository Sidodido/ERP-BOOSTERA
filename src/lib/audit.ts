import { prisma } from "./prisma";

interface LogParams {
  userId?: string | null;
  action: string;
  module: string;
  entityId?: string | null;
  details?: Record<string, unknown> | string | null;
  ipAddress?: string | null;
}

export async function createAuditLog({
  userId,
  action,
  module,
  entityId,
  details,
  ipAddress,
}: LogParams) {
  try {
    const detailsString =
      typeof details === "object" && details !== null
        ? JSON.stringify(details)
        : details || null;

    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        module,
        entityId: entityId || null,
        details: detailsString,
        ipAddress: ipAddress || null,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
