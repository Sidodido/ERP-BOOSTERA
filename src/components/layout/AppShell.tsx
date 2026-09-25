import React from "react";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { ROLES } from "@/lib/constants";
import { cookies } from "next/headers";
import { SidebarProvider } from "./SidebarContext";

interface AppShellProps {
  children: React.ReactNode;
}

export async function AppShell({ children }: AppShellProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get("sidebar_collapsed")?.value === "true";
  const roleLabel = ROLES[user.role as keyof typeof ROLES] || user.role;

  return (
    <SidebarProvider>
      <div className="h-screen bg-neutral-950 text-neutral-100 flex overflow-hidden w-full max-w-[100vw]">
        {/* Fixed Sidebar */}
        <Sidebar
          userRole={roleLabel}
          rawRole={user.role}
          userName={user.name}
          initialCollapsed={initialCollapsed}
        />

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden w-full">
          <Header userName={user.name} userRole={roleLabel} />
          <main className="flex-1 p-3 sm:p-6 md:p-8 overflow-y-auto min-w-0 w-full custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 min-w-0 w-full">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

