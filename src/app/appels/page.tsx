import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getRecentCalls, getCallStats } from "@/actions/calls";
import { getCalledProspects } from "@/actions/prospects";
import { prisma } from "@/lib/prisma";
import { CallsClient } from "@/components/appels/CallsClient";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppelsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const calls = await getRecentCalls(100);
  const stats = await getCallStats();
  const calledProspects = await getCalledProspects();

  // Fetch sales users for assignment dropdown
  const salesUsers = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["ADMIN", "SALES_DIRECTOR", "SALES_REP"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Fetch prospects for selector
  const prospectsList = await prisma.prospect.findMany({
    where: ["ADMIN", "SALES_DIRECTOR"].includes(user.role) ? {} : { assignedToId: user.id },
    select: { id: true, companyName: true, phone: true },
    orderBy: { companyName: "asc" },
  });

  const canDelete = ["ADMIN", "SALES_DIRECTOR"].includes(user.role);

  return (
    <AppShell>
      <CallsClient
        calls={calls}
        stats={stats}
        calledProspects={calledProspects}
        prospectsList={prospectsList}
        salesUsers={salesUsers}
        currentUserId={user.id}
        canDelete={canDelete}
      />
    </AppShell>
  );
}
