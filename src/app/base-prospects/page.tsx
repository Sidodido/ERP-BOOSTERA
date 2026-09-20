import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getProspects, getProspectsOverviewStats, getLocalProspectionFileInfo } from "@/actions/prospects";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BaseProspectsClient } from "@/components/prospection/BaseProspectsClient";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Base de Données Globale des Prospects | CRM Boostera",
  description: "Répertoire centralisé et complet de tous les prospects du CRM.",
};

export default async function BaseProspectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [prospects, overviewStats, localFileInfo, salesUsers] = await Promise.all([
    getProspects({ isGlobalView: true }),
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
      <BaseProspectsClient
        initialProspects={prospects}
        overviewStats={overviewStats}
        salesUsers={salesUsers}
        currentUserId={user.id}
        canDelete={canDelete}
        localFileInfo={localFileInfo}
      />
    </AppShell>
  );
}
