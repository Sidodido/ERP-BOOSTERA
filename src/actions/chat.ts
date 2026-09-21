"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface ChatUserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  phone: string | null;
}

export interface ChatMessageItem {
  id: string;
  content: string;
  senderId: string;
  recipientId: string | null;
  channel: string;
  fileUrl: string | null;
  isPinned: boolean;
  createdAt: Date;
  sender: {
    id: string;
    name: string;
    role: string;
    avatarUrl: string | null;
  };
}

/**
 * Récupère tous les membres actifs de l'équipe
 */
export async function getTeamMembersAction(): Promise<ChatUserItem[]> {
  await requireAuth();

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      phone: true,
    },
    orderBy: { name: "asc" },
  });

  return users;
}

/**
 * Récupère les messages d'un canal ou d'une conversation privée
 */
export async function getChatMessagesAction(params: {
  channel?: string;
  recipientId?: string;
  limit?: number;
}): Promise<ChatMessageItem[]> {
  const user = await requireAuth();
  const limit = params.limit || 80;

  if (params.recipientId) {
    // Conversation directe (1-à-1) entre l'utilisateur connecté et le destinataire
    const messages = await prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: user.id, recipientId: params.recipientId },
          { senderId: params.recipientId, recipientId: user.id },
        ],
      },
      include: {
        sender: {
          select: { id: true, name: true, role: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    return messages;
  }

  // Canal public (par défaut: "general")
  const targetChannel = (params.channel || "general").toLowerCase();

  const messages = await prisma.chatMessage.findMany({
    where: {
      channel: targetChannel,
      recipientId: null,
    },
    include: {
      sender: {
        select: { id: true, name: true, role: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return messages;
}

/**
 * Envoie un nouveau message dans le chat
 */
export async function sendMessageAction(data: {
  content: string;
  channel?: string;
  recipientId?: string;
}) {
  const user = await requireAuth();
  const cleanContent = (data.content || "").trim();

  if (!cleanContent) {
    return { error: "Le contenu du message ne peut pas être vide." };
  }

  if (data.recipientId) {
    // Message direct privé
    const msg = await prisma.chatMessage.create({
      data: {
        content: cleanContent,
        senderId: user.id,
        recipientId: data.recipientId,
        channel: "",
      },
      include: {
        sender: {
          select: { id: true, name: true, role: true, avatarUrl: true },
        },
      },
    });

    // Envoyer une notification directe au destinataire
    try {
      if (data.recipientId !== user.id) {
        await prisma.notification.create({
          data: {
            userId: data.recipientId,
            title: `💬 Message privé de ${user.name}`,
            message: cleanContent.length > 80 ? cleanContent.slice(0, 77) + "..." : cleanContent,
            type: "CHAT",
            link: `/chat?dm=${user.id}`,
          },
        });
      }
    } catch (err) {
      console.warn("Erreur notification chat privé:", err);
    }

    revalidatePath("/chat");
    return { success: true, message: msg };
  }

  // Message dans un canal
  const targetChannel = (data.channel || "general").toLowerCase();

  const msg = await prisma.chatMessage.create({
    data: {
      content: cleanContent,
      senderId: user.id,
      recipientId: null,
      channel: targetChannel,
    },
    include: {
      sender: {
        select: { id: true, name: true, role: true, avatarUrl: true },
      },
    },
  });

  // Détecter les mentions @Nom et notifier les collaborateurs concernés
  try {
    const activeUsers = await prisma.user.findMany({
      where: { isActive: true, id: { not: user.id } },
      select: { id: true, name: true },
    });

    const mentionedUsers = activeUsers.filter((u) => {
      const atTag = `@${u.name.toLowerCase()}`;
      const atFirstName = `@${u.name.split(" ")[0].toLowerCase()}`;
      const lowerContent = cleanContent.toLowerCase();
      return lowerContent.includes(atTag) || lowerContent.includes(atFirstName);
    });

    if (mentionedUsers.length > 0) {
      await prisma.notification.createMany({
        data: mentionedUsers.map((u) => ({
          userId: u.id,
          title: `📌 Mentionné(e) par ${user.name} dans #${targetChannel}`,
          message: cleanContent.length > 85 ? cleanContent.slice(0, 82) + "..." : cleanContent,
          type: "CHAT",
          link: `/chat?channel=${targetChannel}`,
        })),
      });
    }
  } catch (err) {
    console.warn("Erreur notifications mentions:", err);
  }

  revalidatePath("/chat");
  return { success: true, message: msg };
}

export interface ChatTagEntities {
  collaborators: { id: string; name: string; role: string }[];
  clients: { id: string; companyName: string }[];
  prospects: { id: string; companyName: string }[];
}

/**
 * Récupère les entités pour les tags rapides (collaborateurs, clients, prospects)
 */
export async function getChatTagEntitiesAction(): Promise<ChatTagEntities> {
  await requireAuth();

  const [collaborators, clients, prospects] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
      take: 200,
    }),
    prisma.prospect.findMany({
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
      take: 300,
    }),
  ]);

  return { collaborators, clients, prospects };
}

/**
 * Supprime un message de chat
 */
export async function deleteChatMessageAction(messageId: string) {
  const user = await requireAuth();

  const msg = await prisma.chatMessage.findUnique({
    where: { id: messageId },
  });

  if (!msg) {
    return { error: "Message introuvable." };
  }

  // Autorisé si auteur ou admin
  if (msg.senderId !== user.id && user.role !== "ADMIN") {
    return { error: "Vous n'avez pas l'autorisation de supprimer ce message." };
  }

  await prisma.chatMessage.delete({
    where: { id: messageId },
  });

  revalidatePath("/chat");
  return { success: true };
}

/**
 * Épingle ou désépingle un message
 */
export async function togglePinChatMessageAction(messageId: string) {
  const user = await requireAuth();

  const msg = await prisma.chatMessage.findUnique({
    where: { id: messageId },
  });

  if (!msg) return { error: "Message introuvable." };

  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { isPinned: !msg.isPinned },
  });

  revalidatePath("/chat");
  return { success: true };
}
