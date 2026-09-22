import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getRegistrationRequestsAction,
  getCollaboratorsListAction,
} from "@/actions/users-management";
import { CollaborateursClient } from "@/components/collaborateurs/CollaborateursClient";

export default async function CollaborateursPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; status?: string; dept?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role !== "ADMIN" && user.role !== "SALES_DIRECTOR") {
    redirect("/dashboard");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const [requests, collaborators] = await Promise.all([
    getRegistrationRequestsAction(),
    getCollaboratorsListAction(),
  ]);

  return (
    <AppShell>
      <CollaborateursClient
        initialRequests={requests}
        initialCollaborators={collaborators}
        initialTab={resolvedParams.tab}
      />
    </AppShell>
  );
}
