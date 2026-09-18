import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPurchasesAndExpensesAction } from "@/actions/purchases";
import { AchatsClient } from "@/components/purchases/AchatsClient";

export default async function AchatsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Restrictions RBAC
  if (user.role === "SALES_REP") {
    redirect("/dashboard");
  }

  const data = await getPurchasesAndExpensesAction();

  return (
    <AppShell>
      <AchatsClient
        orders={data.orders as any}
        subscriptions={data.subscriptions as any}
        expenses={data.expenses as any}
        suppliers={data.suppliers}
        projects={data.projects}
        kpis={data.kpis}
      />
    </AppShell>
  );
}
