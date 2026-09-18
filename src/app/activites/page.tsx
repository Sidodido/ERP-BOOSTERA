import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActivitiesDataAction } from "@/actions/activities";
import { ActivitiesClient } from "@/components/activities/ActivitiesClient";

export const metadata = {
  title: "Activités & Performance Équipe | CRM Boostera",
  description: "Journal en direct de toutes les actions, clics WhatsApp/Téléphone, tours des pauses et performances de l'équipe",
};

export default async function ActivitesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Preload initial data for Today
  const initialData = await getActivitiesDataAction({
    page: 1,
    limit: 30,
    dateRange: "TODAY",
  });

  return (
    <ActivitiesClient
      initialData={initialData}
      currentUser={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }}
    />
  );
}
