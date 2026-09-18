import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getDashboardMetrics } from "@/actions/dashboard";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CommercialDashboard } from "@/components/dashboard/CommercialDashboard";
import { TechnicianDashboard } from "@/components/dashboard/TechnicianDashboard";
import { ExecutiveDashboard } from "@/components/dashboard/ExecutiveDashboard";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const metrics = await getDashboardMetrics();

  return (
    <AppShell>
      {metrics.isCommercial ? (
        <CommercialDashboard metrics={metrics} userName={user.name} />
      ) : metrics.isTechnician ? (
        <TechnicianDashboard metrics={metrics} userName={user.name} />
      ) : (
        <ExecutiveDashboard metrics={metrics} userName={user.name} />
      )}
    </AppShell>
  );
}
