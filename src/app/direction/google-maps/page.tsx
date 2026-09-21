import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { GoogleMapsImporterClient } from "@/components/direction/GoogleMapsImporterClient";

export const metadata = {
  title: "Import Google Maps | Direction BOOSTERA CRM",
  description: "Extraction et importation directe de prospects depuis Google Maps et les annuaires d'entreprises en Algérie.",
};

export default async function GoogleMapsDirectionPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Direction and Sales users can view & import
  const salesUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto py-4 px-2 sm:px-4">
        <GoogleMapsImporterClient salesUsers={salesUsers} currentUserId={user.id} />
      </div>
    </AppShell>
  );
}
