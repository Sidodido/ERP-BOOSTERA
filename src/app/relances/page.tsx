import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getFollowUps } from "@/actions/followups";
import { FollowUpsClient } from "@/components/followups/FollowUpsClient";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RelancesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const followUps = await getFollowUps();

  return (
    <AppShell>
      <FollowUpsClient initialFollowUps={followUps} />
    </AppShell>
  );
}
