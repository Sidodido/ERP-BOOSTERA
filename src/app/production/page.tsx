import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getProductionKanban, getProductionTaskTemplates } from "@/actions/production";
import { ProductionKanbanView } from "@/components/production/ProductionKanbanView";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ProductionPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [data, templates] = await Promise.all([
    getProductionKanban(),
    getProductionTaskTemplates(),
  ]);

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      client: {
        select: {
          id: true,
          companyName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const clients = await prisma.client.findMany({
    select: {
      id: true,
      companyName: true,
      brandName: true,
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
      <ProductionKanbanView
        initialData={data as any}
        initialTemplates={templates}
        projects={projects}
        clients={clients}
        users={users}
        currentUserId={user?.id}
        currentUserRole={user?.role}
        currentUserName={user?.name}
      />
    </AppShell>
  );
}
