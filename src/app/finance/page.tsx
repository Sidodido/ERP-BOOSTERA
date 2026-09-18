import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getFinanceOverviewAction } from "@/actions/finance";
import { FinanceClient } from "@/components/finance/FinanceClient";

export default async function FinancePage() {
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

  const data = await getFinanceOverviewAction();

  return (
    <AppShell>
      <FinanceClient
        kpis={data.kpis}
        methodBreakdown={data.methodBreakdown}
        payments={data.payments as any}
        schedules={data.schedules as any}
        sponsorCampaigns={data.sponsorCampaigns as any}
        clients={data.clients as any}
      />
    </AppShell>
  );
}
