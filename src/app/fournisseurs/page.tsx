import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSuppliersAction } from "@/actions/suppliers";
import { FournisseursClient } from "@/components/suppliers/FournisseursClient";

export default async function FournisseursPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Restrictions RBAC
  if (user.role === "SALES_REP") {
    redirect("/dashboard");
  }

  const suppliers = await getSuppliersAction();

  return (
    <AppShell>
      <FournisseursClient suppliers={suppliers as any} />
    </AppShell>
  );
}
