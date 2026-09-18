import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getStocksAndAssetsAction } from "@/actions/stocks";
import { StocksClient } from "@/components/stocks/StocksClient";

export default async function StocksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Restrictions RBAC
  if (user.role === "SALES_REP") {
    redirect("/dashboard");
  }

  const data = await getStocksAndAssetsAction();

  return (
    <AppShell>
      <StocksClient
        assets={data.assets as any}
        inventoryItems={data.inventoryItems as any}
        users={data.users}
        kpis={data.kpis}
      />
    </AppShell>
  );
}
