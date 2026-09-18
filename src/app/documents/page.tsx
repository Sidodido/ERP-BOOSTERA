import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getDocuments } from "@/actions/documents";
import { DocumentsExplorerView } from "@/components/documents/DocumentsExplorerView";
import { prisma } from "@/lib/prisma";

export default async function DocumentsPage() {
  const data = await getDocuments();

  const clients = await prisma.client.findMany({
    select: {
      id: true,
      companyName: true,
    },
    orderBy: { companyName: "asc" },
  });

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell>
      <DocumentsExplorerView
        initialData={data as any}
        clients={clients}
        projects={projects}
      />
    </AppShell>
  );
}
