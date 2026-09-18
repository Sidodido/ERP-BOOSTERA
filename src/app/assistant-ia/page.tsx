import React from "react";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getCommercialAiContextAction } from "@/actions/commercialAi";
import { CommercialAiHub } from "@/components/assistant/CommercialAiHub";

export const dynamic = "force-dynamic";

export default async function AssistantIaPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const initialContext = await getCommercialAiContextAction();

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <CommercialAiHub initialContext={initialContext} />
      </div>
    </AppShell>
  );
}
