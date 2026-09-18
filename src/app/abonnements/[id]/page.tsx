import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AbonnementDetailView } from "@/components/abonnements/AbonnementDetailView";
import { requireAuth } from "@/lib/auth";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AbonnementDetailPage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;

  let client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: {
        include: {
          tasks: {
            include: { assignee: true },
            orderBy: { createdAt: "desc" },
          },
          manager: true,
        },
      },
      assignedTo: true,
    },
  });

  if (!client) {
    // Si l'ID passé est celui d'un projet, récupérer le client associé
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            projects: {
              include: {
                tasks: {
                  include: { assignee: true },
                  orderBy: { createdAt: "desc" },
                },
                manager: true,
              },
            },
            assignedTo: true,
          },
        },
      },
    });

    if (project?.client) {
      client = project.client as any;
    }
  }

  if (!client) {
    notFound();
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
      <AbonnementDetailView client={client} users={users} />
    </AppShell>
  );
}
