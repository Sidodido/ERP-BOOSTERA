import React, { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatClient } from "@/components/chat/ChatClient";
import { getTeamMembersAction, getChatMessagesAction, getChatTagEntitiesAction } from "@/actions/chat";

interface ChatPageProps {
  searchParams?: Promise<{
    channel?: string;
    dm?: string;
  }>;
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const channel = resolvedSearchParams.channel || "general";
  const dmUserId = resolvedSearchParams.dm || null;

  const [members, messages, tagEntities] = await Promise.all([
    getTeamMembersAction(),
    getChatMessagesAction(
      dmUserId
        ? { recipientId: dmUserId }
        : { channel }
    ),
    getChatTagEntitiesAction(),
  ]);

  return (
    <AppShell>
      <Suspense fallback={<div className="h-[calc(100vh-5.5rem)] bg-neutral-950 border border-neutral-800 rounded-3xl animate-pulse" />}>
        <ChatClient
          currentUser={{
            id: user.id,
            name: user.name,
            role: user.role,
            email: user.email,
          }}
          initialMembers={members}
          initialMessages={messages}
          tagEntities={tagEntities}
          defaultChannel={channel}
          defaultDmUserId={dmUserId}
        />
      </Suspense>
    </AppShell>
  );
}
