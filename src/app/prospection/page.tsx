import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getProspects, getLocalProspectionFileInfo, getProspectsOverviewStats } from "@/actions/prospects";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProspectsClient } from "@/components/prospection/ProspectsClient";
import { redirect } from "next/navigation";

export default async function ProspectionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [prospects, overviewStats, localFileInfo, salesUsers] = await Promise.all([
    getProspects(),
    getProspectsOverviewStats(),
    getLocalProspectionFileInfo(),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["ADMIN", "SALES_DIRECTOR", "SALES_REP"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const canDelete = ["ADMIN", "SALES_DIRECTOR"].includes(user.role);

  return (
    <AppShell>
      <ProspectsClient
        initialProspects={prospects}
        salesUsers={salesUsers}
        currentUserId={user.id}
        canDelete={canDelete}
        localFileInfo={localFileInfo}
        overviewStats={overviewStats}
      />
    </AppShell>
  );
}
