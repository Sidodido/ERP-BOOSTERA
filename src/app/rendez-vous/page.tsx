import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getAppointments, getPostAppointmentFollowUps } from "@/actions/appointments";
import { prisma } from "@/lib/prisma";
import { AppointmentsClient } from "@/components/appointments/AppointmentsClient";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RendezVousPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [appointments, followUps] = await Promise.all([
    getAppointments(),
    getPostAppointmentFollowUps(),
  ]);

  const prospectsList = await prisma.prospect.findMany({
    select: { id: true, companyName: true, phone: true, sector: true, status: true },
    orderBy: { companyName: "asc" },
  });

  const clientsList = await prisma.client.findMany({
    select: { id: true, companyName: true, phone: true },
    orderBy: { companyName: "asc" },
  });

  const salesUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <AppointmentsClient
        initialAppointments={appointments}
        initialFollowUps={followUps}
        prospectsList={prospectsList}
        clientsList={clientsList}
        salesUsers={salesUsers}
        currentUserId={user.id}
      />
    </AppShell>
  );
}
