import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getInvoicesAction } from "@/actions/invoices";
import { prisma } from "@/lib/prisma";
import { FacturationClient } from "@/components/facturation/FacturationClient";

export default async function FacturationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Restrictions RBAC
  if (user.role === "SALES_REP" || user.role === "DEVELOPER" || user.role === "DESIGNER" || user.role === "VIDEO_EDITOR") {
    redirect("/dashboard");
  }

  const [{ invoices, kpis }, clients] = await Promise.all([
    getInvoicesAction(),
    prisma.client.findMany({
      select: {
        id: true,
        companyName: true,
        contactName: true,
        phone: true,
      },
      orderBy: { companyName: "asc" },
    }),
  ]);

  return (
    <AppShell>
      <FacturationClient
        initialInvoices={invoices as any}
        kpis={kpis}
        clients={clients}
        userRole={user.role}
      />
    </AppShell>
  );
}
