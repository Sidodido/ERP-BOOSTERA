import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getProjectDetail } from "@/actions/projects";
import { ProjectDetailView } from "@/components/projects/ProjectDetailView";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getProjectDetail(id);

  if (!project) {
    notFound();
  }

  // Si c'est un abonnement mensuel, rediriger vers sa section dédiée Abonnements
  if (project.isAbonnement && project.clientId) {
    redirect(`/abonnements/${project.clientId}`);
  }

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
      <ProjectDetailView project={project} users={users} />
    </AppShell>
  );
}
