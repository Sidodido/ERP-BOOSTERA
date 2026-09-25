import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/lib/auth";
import { getTechnicianCalendarData } from "@/actions/production";
import { TechnicianCalendarClient } from "@/components/production/TechnicianCalendarClient";

export const metadata = {
  title: "Calendrier Tâches Technicien | BOOSTERA CRM",
  description: "Calendrier mensuel des tâches de production issues des packs signés et en préparation.",
};

export default async function TechnicianCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  await requireAuth();

  const params = await searchParams;
  const month = params.month ? parseInt(params.month, 10) : undefined;
  const year = params.year ? parseInt(params.year, 10) : undefined;

  const data = await getTechnicianCalendarData({ month, year });

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
