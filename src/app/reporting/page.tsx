import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getReportingDataAction } from "@/actions/reporting";
import { ReportingClient } from "@/components/reporting/ReportingClient";

export default async function ReportingPage() {
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

  const data = await getReportingDataAction("MONTH");

  return (
    <AppShell>
      <ReportingClient initialData={data} />
    </AppShell>
  );
}
