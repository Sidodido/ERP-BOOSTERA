import React from "react";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { ROLES } from "@/lib/constants";

interface AppShellProps {
  children: React.ReactNode;
}

export async function AppShell({ children }: AppShellProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const roleLabel = ROLES[user.role as keyof typeof ROLES] || user.role;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex">
      {/* Fixed Sidebar */}
      <Sidebar userRole={roleLabel} rawRole={user.role} userName={user.name} />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={user.name} userRole={roleLabel} />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
