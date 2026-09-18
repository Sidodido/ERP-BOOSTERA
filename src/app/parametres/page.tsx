import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSettingsDataAction } from "@/actions/settings";
import { ParametresClient } from "@/components/settings/ParametresClient";

export default async function ParametresPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Restrictions RBAC : Seuls ADMIN et SALES_DIRECTOR
  if (user.role !== "ADMIN" && user.role !== "SALES_DIRECTOR") {
    redirect("/dashboard");
  }

  const data = await getSettingsDataAction();

  return (
    <AppShell>
      <ParametresClient
        users={data.users as any}
        commissionRules={data.commissionRules as any}
        auditLogs={data.auditLogs as any}
        agencyConfig={data.agencyConfig}
        attendances={data.attendances as any}
        employees={data.employees}
        attendanceStats={data.attendanceStats}
      />
    </AppShell>
  );
}
