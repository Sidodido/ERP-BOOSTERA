import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRhDataAction } from "@/actions/rh";
import { getTeamsDataAction } from "@/actions/teams";
import { RhClient } from "@/components/rh/RhClient";

export default async function RhPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; month?: string; year?: string }>;
}) {
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

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const monthParam = resolvedSearchParams?.month ? parseInt(resolvedSearchParams.month, 10) : undefined;
  const yearParam = resolvedSearchParams?.year ? parseInt(resolvedSearchParams.year, 10) : undefined;

  const [data, teamsData] = await Promise.all([
    getRhDataAction(monthParam, yearParam),
    getTeamsDataAction(monthParam, yearParam),
  ]);

  return (
    <AppShell>
      <RhClient
        month={data.month}
        year={data.year}
        cycleInfo={data.cycleInfo}
        availableCycles={data.availableCycles}
        employees={data.employees as any}
        attendances={data.attendances as any}
        monthlyAttendances={(data as any).monthlyAttendances || []}
        leaveRequests={data.leaveRequests as any}
        salaryPayments={data.salaryPayments as any}
        commissions={data.commissions}
        usersWithoutEmployee={data.usersWithoutEmployee}
        kpis={data.kpis}
        departments={teamsData.departments as any}
        goals={teamsData.goals as any}
        employeesList={teamsData.employeesList}
        userRole={user.role}
        initialTab={resolvedSearchParams?.tab}
      />
    </AppShell>
  );
}
