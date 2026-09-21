import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatClient } from "@/components/chat/ChatClient";
import { getTeamMembersAction, getChatMessagesAction } from "@/actions/chat";

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

  const [members, messages] = await Promise.all([
    getTeamMembersAction(),
    getChatMessagesAction(
      dmUserId
        ? { recipientId: dmUserId }
        : { channel }
    ),
  ]);

  return (
    <AppShell>
      <ChatClient
        currentUser={{
          id: user.id,
          name: user.name,
          role: user.role,
          email: user.email,
        }}
        initialMembers={members}
        initialMessages={messages}
        defaultChannel={channel}
        defaultDmUserId={dmUserId}
      />
    </AppShell>
  );
}
