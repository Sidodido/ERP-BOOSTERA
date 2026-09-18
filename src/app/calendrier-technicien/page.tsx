import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/lib/auth";
import { getTechnicianCalendarData } from "@/actions/production";
import { TechnicianCalendarClient } from "@/components/production/TechnicianCalendarClient";

export const metadata = {
  title: "Calendrier Tâches Technicien | BOOSTERA CRM",
  description: "Calendrier mensuel des tâches de production issues des packs signés et en préparation.",
};

export default async function TechnicianCalendarPage() {
  await requireAuth();

  const data = await getTechnicianCalendarData();

  return (
    <AppShell>
      <TechnicianCalendarClient
        initialTasks={data.tasks as any}
        users={data.users}
        activeClients={data.activeClients as any}
        currentUserId={data.currentUserId}
        initialMonth={data.month}
        initialYear={data.year}
      />
    </AppShell>
  );
}
