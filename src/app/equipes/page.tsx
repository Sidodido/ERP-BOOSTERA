import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTeamsDataAction } from "@/actions/teams";
import { TeamsClient } from "@/components/teams/TeamsClient";

export default async function EquipesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const resolvedSearchParams = searchParams ? await searchParams : {};
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
        initialTab={resolvedSearchParams?.tab}
        userRole={user.role}
      />
    </AppShell>
  );
}
