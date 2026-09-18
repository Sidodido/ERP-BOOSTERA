import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getClientDetail } from "@/actions/clients";
import { ClientDetailView } from "@/components/clients/ClientDetailView";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // La fiche 360° n'est pas accessible au rôle commercial
  if (user.role === "SALES_REP") {
    redirect("/clients");
  }

  const { id } = await params;
  const client = await getClientDetail(id);

  if (!client) {
    notFound();
  }

  const salesUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <ClientDetailView client={client} salesUsers={salesUsers} />
    </AppShell>
  );
}
