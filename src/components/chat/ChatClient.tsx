"use client";

import React, { useState, useEffect, useRef, useTransition, useCallback } from "react";
import {
  Hash,
  Send,
  User,
  Users,
  Search,
  MessageSquare,
  Sparkles,
  Smile,
  CheckCheck,
  Clock,
  Trash2,
  Pin,
  Megaphone,
  Target,
  Code2,
  Shield,
  Briefcase,
  Layers,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  ChatMessageItem,
  ChatUserItem,
  getChatMessagesAction,
  sendMessageAction,
  deleteChatMessageAction,
  togglePinChatMessageAction,
} from "@/actions/chat";

interface ChatClientProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
  initialMembers: ChatUserItem[];
  initialMessages: ChatMessageItem[];
  defaultChannel?: string;
  defaultDmUserId?: string | null;
}

const CHANNELS = [
  {
    id: "general",
    label: "général",
    title: "Canal Général",
    description: "Échanges libres et communication générale pour toute l'équipe",
    icon: Hash,
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  {
    id: "commercial",
    label: "commercial",
    title: "Ventes & Prospection",
    description: "Points sur les leads, prospects chauds, closing et rendez-vous",
    icon: Target,
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  {
    id: "technique-production",
    label: "technique-production",
    title: "Technique & Production",
    description: "Développement web & mobile, montages vidéos, tournages et design",
    icon: Code2,
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  {
    id: "annonces",
    label: "annonces",
    title: "Annonces Officielles",
    description: "Directives, plannings, informations RH et annonces de la Direction",
    icon: Megaphone,
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
];

const QUICK_EMOJIS = ["👍", "🔥", "✅", "🚀", "🎯", "👏", "🤝", "🎉"];

export function ChatClient({
  currentUser,
  initialMembers,
  initialMessages,
  defaultChannel = "general",
  defaultDmUserId = null,
}: ChatClientProps) {
  const [activeType, setActiveType] = useState<"channel" | "dm">(
    defaultDmUserId ? "dm" : "channel"
  );
  const [activeChannelId, setActiveChannelId] = useState<string>(defaultChannel);
  const [activeDmUserId, setActiveDmUserId] = useState<string | null>(defaultDmUserId);

  const [messages, setMessages] = useState<ChatMessageItem[]>(initialMessages);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [searchMember, setSearchMember] = useState("");
  const [isPending, startTransition] = useTransition();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Déterminer le contact actif en mode DM
  const activeDmUser = initialMembers.find((m) => m.id === activeDmUserId);
  const activeChannel = CHANNELS.find((c) => c.id === activeChannelId) || CHANNELS[0];

  // Auto-scroll vers le bas
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [activeChannelId, activeDmUserId, activeType]);

  // Fonction pour rafraîchir les messages
  const fetchMessages = useCallback(async () => {
    try {
      if (activeType === "channel") {
        const res = await getChatMessagesAction({ channel: activeChannelId });
        setMessages(res);
      } else if (activeType === "dm" && activeDmUserId) {
        const res = await getChatMessagesAction({ recipientId: activeDmUserId });
        setMessages(res);
      }
    } catch {
      // Ignoré lors des pertes de connexion momentanées
    }
  }, [activeType, activeChannelId, activeDmUserId]);

  // Recharger lors d'un changement de salon ou de DM
  useEffect(() => {
    startTransition(() => {
      fetchMessages();
    });
  }, [fetchMessages]);

  // Polling automatique toutes les 3.5 secondes pour le temps réel
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMessages();
    }, 3500);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Envoyer un message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInputText("");

    // Ajout optimiste
    const optimisticMsg: ChatMessageItem = {
      id: "temp-" + Date.now(),
      content: text,
      senderId: currentUser.id,
      recipientId: activeType === "dm" ? activeDmUserId : null,
      channel: activeType === "channel" ? activeChannelId : "",
      fileUrl: null,
      isPinned: false,
      createdAt: new Date(),
      sender: {
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
        avatarUrl: null,
      },
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom(true), 50);

    try {
      const res = await sendMessageAction({
        content: text,
        channel: activeType === "channel" ? activeChannelId : undefined,
        recipientId: activeType === "dm" ? activeDmUserId || undefined : undefined,
      });

      if (res.error) {
        // En cas d'erreur, retirer le message optimiste
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        alert(res.error);
      } else if (res.message) {
        // Remplacer avec le message validé par la base
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticMsg.id ? (res.message as ChatMessageItem) : m))
        );
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleAddEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleDeleteMessage = async (id: string) => {
    if (!confirm("Voulez-vous supprimer ce message ?")) return;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    await deleteChatMessageAction(id);
  };

  const handleTogglePin = async (id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isPinned: !m.isPinned } : m))
    );
    await togglePinChatMessageAction(id);
  };

  // Filtrage des membres pour la recherche
  const filteredMembers = initialMembers.filter(
    (m) =>
      m.id !== currentUser.id &&
      (m.name.toLowerCase().includes(searchMember.toLowerCase()) ||
        m.role.toLowerCase().includes(searchMember.toLowerCase()))
  );

  // Formattage du rôle
  const formatRoleLabel = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "Direction";
      case "SALES_DIRECTOR":
        return "Dir. Commercial";
      case "SALES_REP":
        return "Commercial";
      case "TECH_LEAD":
        return "Tech Lead";
      case "DEVELOPER":
        return "Développeur";
      case "DESIGNER":
        return "Designer";
      case "VIDEO_EDITOR":
        return "Monteur Vidéo";
      case "ACCOUNTANT":
        return "Comptabilité";
      case "HR":
        return "RH";
      default:
        return role;
    }
  };

  // Rendu de texte avec liens cliquables
  const renderMessageContent = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+|\/(?:prospection|clients|rendez-vous|projets|appels|dashboard)[^\s]*)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target={part.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            className="text-blue-300 hover:text-blue-200 underline font-medium break-all"
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="h-[calc(100vh-5.5rem)] flex flex-col md:flex-row bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
      {/* 1. PANNEAU LATÉRAL GAUCHE : CANAUX & COLLABORATEURS */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-neutral-800 bg-neutral-900/60 flex flex-col shrink-0">
        {/* Header panneau */}
        <div className="p-4 border-b border-neutral-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-100">Chat d'Équipe</h2>
              <p className="text-[11px] text-neutral-400">Communication interne en direct</p>
            </div>
          </div>
        </div>

        {/* Liste scrollable des Salons & Collègues */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5 custom-scrollbar">
          {/* Section 1 : Canaux Publics */}
          <div className="space-y-1">
            <div className="px-2 py-1 text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Hash className="w-3 h-3 text-neutral-400" />
              <span>Salons thématiques</span>
            </div>
            {CHANNELS.map((ch) => {
              const Icon = ch.icon;
              const isActive = activeType === "channel" && activeChannelId === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => {
                    setActiveType("channel");
                    setActiveChannelId(ch.id);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all cursor-pointer group ${
                    isActive
                      ? "bg-blue-600/15 border border-blue-500/30 text-blue-300 font-semibold shadow-xs"
                      : "text-neutral-300 hover:bg-neutral-800/60 hover:text-neutral-100 border border-transparent"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                      isActive
                        ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                        : "bg-neutral-800/80 border-neutral-700/50 text-neutral-400 group-hover:text-neutral-200"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs truncate font-medium">{ch.title}</p>
                    <p className="text-[10px] text-neutral-400 truncate">#{ch.label}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Section 2 : Messages Directs (Collègues) */}
          <div className="space-y-2 pt-2 border-t border-neutral-800/70">
            <div className="px-2 flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3 h-3 text-neutral-400" />
                <span>Messages Directs ({filteredMembers.length})</span>
              </span>
            </div>

            {/* Barre de recherche de collègue */}
            <div className="relative px-1">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Rechercher un collègue..."
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                className="w-full h-8 pl-8 pr-2.5 text-xs bg-neutral-950/80 border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Liste des membres */}
            <div className="space-y-0.5 max-h-56 overflow-y-auto pr-1">
              {filteredMembers.map((member) => {
                const isActive = activeType === "dm" && activeDmUserId === member.id;
                const initials = member.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <button
                    key={member.id}
                    onClick={() => {
                      setActiveType("dm");
                      setActiveDmUserId(member.id);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all cursor-pointer group ${
                      isActive
                        ? "bg-emerald-600/15 border border-emerald-500/30 text-emerald-300 font-semibold shadow-xs"
                        : "text-neutral-300 hover:bg-neutral-800/60 hover:text-neutral-100 border border-transparent"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 text-[10px] font-bold text-neutral-200 flex items-center justify-center">
                        {initials}
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -bottom-0.5 -right-0.5 ring-2 ring-neutral-900"></span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs truncate font-medium">{member.name}</p>
                      <p className="text-[10px] text-neutral-400 truncate">
                        {formatRoleLabel(member.role)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Profil de l'utilisateur connecté en bas */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-950/50 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 font-bold text-xs flex items-center justify-center shrink-0">
            {currentUser.name[0]?.toUpperCase() || "M"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-neutral-100 truncate">{currentUser.name}</p>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>En ligne • {formatRoleLabel(currentUser.role)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* 2. ZONE CENTRALE : FLUX DE DISCUSSION & COMPOSITION */}
      <div className="flex-1 flex flex-col min-w-0 bg-neutral-950/40">
        {/* Header de la discussion active */}
        <div className="p-4 border-b border-neutral-800/80 bg-neutral-900/40 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {activeType === "channel" ? (
              <>
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <Hash className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                    <span>{activeChannel.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                      #{activeChannel.label}
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    {activeChannel.description}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs">
                  {activeDmUser?.name[0]?.toUpperCase() || "C"}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                    <span>{activeDmUser?.name || "Collaborateur"}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 font-medium">
                      {formatRoleLabel(activeDmUser?.role || "")}
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    Discussion privée et directe • {activeDmUser?.email}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-neutral-400 hidden sm:inline-block">
              {messages.length} message{messages.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Flux des Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="max-w-sm space-y-1">
                <h4 className="text-sm font-bold text-neutral-200">
                  {activeType === "channel"
                    ? `Bienvenue sur #${activeChannel.label}`
                    : `Discussion privée avec ${activeDmUser?.name || "ce collaborateur"}`}
                </h4>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Aucun message pour le moment. Démarrez la conversation en envoyant un premier
                  message ci-dessous !
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderId === currentUser.id;
              const initials = (msg.sender?.name || "Anonyme")
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();

              const formattedTime = new Date(msg.createdAt).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 group transition-all ${
                    isMine ? "justify-end" : "justify-start"
                  }`}
                >
                  {/* Avatar de l'interlocuteur */}
                  {!isMine && (
                    <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-200 text-[10px] font-bold flex items-center justify-center shrink-0 mt-1">
                      {initials}
                    </div>
                  )}

                  <div className={`max-w-[85%] sm:max-w-xl flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                    {/* Nom et heure */}
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[11px] font-bold text-neutral-300">
                        {isMine ? "Vous" : msg.sender?.name}
                      </span>
                      {!isMine && msg.sender?.role && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-neutral-800 text-neutral-400 border border-neutral-700/60">
                          {formatRoleLabel(msg.sender.role)}
                        </span>
                      )}
                      <span className="text-[10px] text-neutral-400">{formattedTime}</span>

                      {/* Bouton supprimer (pour ses messages ou admin) */}
                      {(isMine || currentUser.role === "ADMIN") && !msg.id.startsWith("temp-") && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-rose-400 transition-opacity p-0.5"
                          title="Supprimer le message"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Bulle de texte */}
                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                        isMine
                          ? "bg-blue-600 text-white rounded-tr-xs"
                          : "bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-xs"
                      }`}
                    >
                      {renderMessageContent(msg.content)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Barre de composition et envoi */}
        <div className="p-3 sm:p-4 border-t border-neutral-800/80 bg-neutral-900/50 space-y-2 shrink-0">
          {/* Raccourcis émojis rapides */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-sm scrollbar-none">
            <span className="text-[11px] font-semibold text-neutral-400 mr-1 flex items-center gap-1 shrink-0">
              <Smile className="w-3.5 h-3.5" />
              <span>Réactions :</span>
            </span>
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleAddEmoji(emoji)}
                className="px-2 py-0.5 rounded-lg bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/40 text-xs transition-transform active:scale-95 cursor-pointer shrink-0"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Formulaire d'envoi */}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder={
                activeType === "channel"
                  ? `Écrire un message dans #${activeChannel.label}...`
                  : `Message privé pour ${activeDmUser?.name || "ce collaborateur"}...`
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 h-11 px-4 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <span>Envoyer</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
