import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTeamsDataAction } from "@/actions/teams";
import { TeamsClient } from "@/components/teams/TeamsClient";

export default async function EquipesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Restrictions RBAC
  if (user.role === "SALES_REP") {
    redirect("/dashboard");
  }

  const data = await getTeamsDataAction();

  return (
    <AppShell>
      <TeamsClient
        month={data.month}
        year={data.year}
        departments={data.departments}
        goals={data.goals as any}
        recentReviews={data.recentReviews as any}
        employeesList={data.employeesList}
      />
    </AppShell>
  );
}
