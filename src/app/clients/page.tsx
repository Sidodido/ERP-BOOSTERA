import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getClients } from "@/actions/clients";
import { prisma } from "@/lib/prisma";
import { ClientsClient } from "@/components/clients/ClientsClient";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ClientsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const clients = await getClients();

  const salesUsers = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["ADMIN", "SALES_DIRECTOR", "SALES_REP"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <ClientsClient initialClients={clients as any} salesUsers={salesUsers} userRole={user.role} currentUserId={user.id} />
    </AppShell>
  );
}
