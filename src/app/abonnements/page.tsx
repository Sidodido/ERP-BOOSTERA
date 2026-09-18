import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/prisma";
import { AbonnementsListView } from "@/components/abonnements/AbonnementsListView";
import { requireAuth } from "@/lib/auth";

export default async function AbonnementsPage() {
  await requireAuth();

  // Récupérer les clients qui ont un abonnement / offre mensuelle
  const clients = await prisma.client.findMany({
    where: {
      offerType: { in: ["STARTER", "SILVER", "GOLD", "CUSTOM"] },
    },
    include: {
      projects: {
        include: {
          tasks: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      },
      assignedTo: {
        select: { id: true, name: true, role: true },
      },
    },
    orderBy: { companyName: "asc" },
  });

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <AbonnementsListView clients={clients as any} users={users} />
    </AppShell>
  );
}
