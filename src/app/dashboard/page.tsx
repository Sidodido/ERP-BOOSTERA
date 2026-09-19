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

  let metrics;
  try {
    metrics = await getDashboardMetrics();
  } catch (err: any) {
    console.error("Dashboard metrics error:", err);
    metrics = {
      role: user.role,
      isCommercial: user.role === "SALES_REP" || (user.role as any) === "COMMERCIAL",
      isTechnician: user.role === "TECH_LEAD" || user.role === "DEVELOPER" || user.role === "DESIGNER",
      isAdmin: user.role === "ADMIN" || user.role === "SALES_DIRECTOR",
      myMonthlyGoals: [],
      allTeamGoals: [],
      totalProspects: 0,
      newProspects: 0,
      interestedProspects: 0,
      convertedProspects: 0,
      callsToday: 0,
      totalCalls: 0,
      upcomingAppointments: 0,
      activeClients: 0,
      totalContractValue: 0,
      totalCollected: 0,
      balanceRemaining: 0,
      conversionRate: 0,
      recentActivities: [],
      salesReps: [],
    };
  }

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
