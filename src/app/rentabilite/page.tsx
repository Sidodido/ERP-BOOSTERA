import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProfitabilityMetricsAction } from "@/actions/profitability";
import { RentabiliteClient } from "@/components/profitability/RentabiliteClient";

export default async function RentabilitePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Restrictions RBAC
  if (
    user.role === "SALES_REP" ||
    user.role === "DEVELOPER" ||
    user.role === "DESIGNER" ||
    user.role === "VIDEO_EDITOR"
  ) {
    redirect("/dashboard");
  }

  const data = await getProfitabilityMetricsAction();

  return (
    <AppShell>
      <RentabiliteClient
        kpis={data.kpis}
        projects={data.projects as any}
        packSummary={data.packSummary}
      />
    </AppShell>
  );
}
