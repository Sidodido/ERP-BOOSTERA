import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getProjects } from "@/actions/projects";
import { ProjectsListView } from "@/components/projects/ProjectsListView";
import { prisma } from "@/lib/prisma";

export default async function ProjetsPage() {
  const projects = await getProjects();

  const clients = await prisma.client.findMany({
    select: {
      id: true,
      companyName: true,
      brandName: true,
      sector: true,
      wilaya: true,
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
      <ProjectsListView
        projects={projects as any}
        clients={clients}
        users={users}
      />
    </AppShell>
  );
}
