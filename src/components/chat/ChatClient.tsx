"use client";

import React, { useState, useEffect, useRef, useTransition, useCallback } from "react";
import Link from "next/link";
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
  Building,
  AtSign,
  Tag,
  X,
  Phone,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import {
  ChatMessageItem,
  ChatUserItem,
  ChatTagEntities,
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
  tagEntities?: ChatTagEntities;
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
  tagEntities,
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

  // State pour le popover de Tag
  const [tagModalType, setTagModalType] = useState<"collaborator" | "client" | "prospect" | null>(
    null
  );
  const [tagSearch, setTagSearch] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tagSearchInputRef = useRef<HTMLInputElement>(null);

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

  // Focus sur la recherche de tag à l'ouverture du popover
  useEffect(() => {
    if (tagModalType) {
      setTimeout(() => {
        tagSearchInputRef.current?.focus();
      }, 50);
    }
  }, [tagModalType]);

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

  // Insérer un tag dans le champ de saisie
  const handleInsertTag = (tagStr: string) => {
    setInputText((prev) => (prev ? `${prev.trim()} ${tagStr} ` : `${tagStr} `));
    setTagModalType(null);
    setTagSearch("");
    inputRef.current?.focus();
  };

  // Envoyer un message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInputText("");
    setTagModalType(null);

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
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        alert(res.error);
      } else if (res.message) {
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

  // Filtrage des membres pour la colonne latérale
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

  // Rendu de texte enrichi avec tags interactifs (@Collaborateur, [Client:...], [Prospect:...], liens)
  const renderMessageContent = (text: string) => {
    const tokenRegex =
      /(\[Client:\s*[^\]]+\]|\[Prospect:\s*[^\]]+\]|@[A-Za-zÀ-ÿ0-9_.-]+|https?:\/\/[^\s]+|\/(?:prospection|clients|rendez-vous|projets|appels|dashboard)[^\s]*)/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, index) => {
      if (!part) return null;

      // Tag Client
      if (part.startsWith("[Client:")) {
        const clientName = part.replace(/^\[Client:\s*/, "").replace(/\]$/, "").trim();
        return (
          <Link
            key={index}
            href={`/clients?search=${encodeURIComponent(clientName)}`}
            target="_blank"
            className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/35 hover:text-white transition-all font-semibold text-[11px] align-middle shadow-2xs"
            title={`Ouvrir la fiche de ${clientName} dans Clients`}
          >
            <Building className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Client : {clientName}</span>
          </Link>
        );
      }

      // Tag Prospect
      if (part.startsWith("[Prospect:")) {
        const prospectName = part.replace(/^\[Prospect:\s*/, "").replace(/\]$/, "").trim();
        return (
          <Link
            key={index}
            href={`/prospection?search=${encodeURIComponent(prospectName)}`}
            target="_blank"
            className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/35 hover:text-white transition-all font-semibold text-[11px] align-middle shadow-2xs"
            title={`Ouvrir la prospection de ${prospectName}`}
          >
            <Target className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Prospect : {prospectName}</span>
          </Link>
        );
      }

      // Tag Collaborateur (@Nom)
      if (part.startsWith("@")) {
        const memberName = part.slice(1);
        const isMe =
          currentUser.name.toLowerCase().includes(memberName.toLowerCase()) ||
          memberName.toLowerCase().includes(currentUser.name.split(" ")[0].toLowerCase());
        return (
          <span
            key={index}
            className={`inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-full border text-[11px] font-bold align-middle ${
              isMe
                ? "bg-blue-500/30 text-blue-200 border-blue-400/50 ring-1 ring-blue-400/40"
                : "bg-blue-500/15 text-blue-300 border-blue-500/30"
            }`}
          >
            <AtSign className="w-2.5 h-2.5 text-blue-400 shrink-0" />
            <span>{memberName}</span>
          </span>
        );
      }

      // URLs / Liens internes
      if (
        part.match(
          /^(https?:\/\/[^\s]+|\/(?:prospection|clients|rendez-vous|projets|appels|dashboard)[^\s]*)/
        )
      ) {
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

  // Listes pour le sélecteur de tags rapides
  const collaboratorTags = (tagEntities?.collaborators || initialMembers).filter((c) =>
    c.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const clientTags = (tagEntities?.clients || []).filter((cl) =>
    cl.companyName.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const prospectTags = (tagEntities?.prospects || []).filter((p) =>
    p.companyName.toLowerCase().includes(tagSearch.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-5.5rem)] flex flex-col md:flex-row bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl relative">
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
      <div className="flex-1 flex flex-col min-w-0 bg-neutral-950/40 relative">
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

                  <div
                    className={`max-w-[85%] sm:max-w-xl flex flex-col ${
                      isMine ? "items-end" : "items-start"
                    }`}
                  >
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

        {/* POPOVER DE SÉLECTION DE TAG (@COLLABORATEUR, CLIENT, PROSPECT) */}
        {tagModalType && (
          <div className="absolute bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 bg-neutral-900/95 border border-neutral-700/80 rounded-2xl p-3 shadow-2xl backdrop-blur-md z-30 animate-in fade-in zoom-in-95 space-y-2.5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div className="flex items-center gap-2">
                {tagModalType === "collaborator" && (
                  <>
                    <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center">
                      <AtSign className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-neutral-100">Mentionner un Collaborateur</span>
                  </>
                )}
                {tagModalType === "client" && (
                  <>
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                      <Building className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-neutral-100">Taguer un Client</span>
                  </>
                )}
                {tagModalType === "prospect" && (
                  <>
                    <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center">
                      <Target className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-neutral-100">Taguer un Prospect</span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setTagModalType(null)}
                className="text-neutral-400 hover:text-neutral-200 p-1 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Barre de recherche dans le tag picker */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                ref={tagSearchInputRef}
                type="text"
                placeholder={
                  tagModalType === "collaborator"
                    ? "Nom du collaborateur..."
                    : tagModalType === "client"
                    ? "Nom du client..."
                    : "Nom du prospect..."
                }
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Liste des résultats filtrés */}
            <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar pr-1">
              {tagModalType === "collaborator" && (
                <>
                  {collaboratorTags.length === 0 ? (
                    <p className="text-xs text-neutral-500 py-3 text-center">Aucun collaborateur trouvé</p>
                  ) : (
                    collaboratorTags.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleInsertTag(`@${c.name}`)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs hover:bg-blue-600/20 text-neutral-200 hover:text-blue-200 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <AtSign className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="font-semibold truncate">{c.name}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 shrink-0">
                          {formatRoleLabel(c.role)}
                        </span>
                      </button>
                    ))
                  )}
                </>
              )}

              {tagModalType === "client" && (
                <>
                  {clientTags.length === 0 ? (
                    <p className="text-xs text-neutral-500 py-3 text-center">Aucun client trouvé</p>
                  ) : (
                    clientTags.map((cl) => (
                      <button
                        key={cl.id}
                        type="button"
                        onClick={() => handleInsertTag(`[Client: ${cl.companyName}]`)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs hover:bg-emerald-600/20 text-neutral-200 hover:text-emerald-200 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Building className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="font-semibold truncate">{cl.companyName}</span>
                        </div>
                        <span className="text-[10px] text-emerald-400/80 shrink-0">Client</span>
                      </button>
                    ))
                  )}
                </>
              )}

              {tagModalType === "prospect" && (
                <>
                  {prospectTags.length === 0 ? (
                    <p className="text-xs text-neutral-500 py-3 text-center">Aucun prospect trouvé</p>
                  ) : (
                    prospectTags.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleInsertTag(`[Prospect: ${p.companyName}]`)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs hover:bg-amber-600/20 text-neutral-200 hover:text-amber-200 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="font-semibold truncate">{p.companyName}</span>
                        </div>
                        <span className="text-[10px] text-amber-400/80 shrink-0">Prospect</span>
                      </button>
                    ))
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Barre de composition et envoi */}
        <div className="p-3 sm:p-4 border-t border-neutral-800/80 bg-neutral-900/50 space-y-2.5 shrink-0">
          {/* BARRE D'OUTILS : TAGS RAPIDES & ÉMOJIS */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
            {/* Boutons de Tag (@Collaborateur, Client, Prospect) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-bold text-neutral-400 flex items-center gap-1 mr-1">
                <Tag className="w-3 h-3 text-neutral-400" />
                <span>Taguer :</span>
              </span>

              {/* Tag Collaborateur */}
              <button
                type="button"
                onClick={() => {
                  setTagModalType(tagModalType === "collaborator" ? null : "collaborator");
                  setTagSearch("");
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  tagModalType === "collaborator"
                    ? "bg-blue-600 text-white border-blue-500 shadow-xs"
                    : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30"
                }`}
                title="Mentionner un collaborateur de l'équipe"
              >
                <AtSign className="w-3 h-3" />
                <span>Collaborateur</span>
              </button>

              {/* Tag Client */}
              <button
                type="button"
                onClick={() => {
                  setTagModalType(tagModalType === "client" ? null : "client");
                  setTagSearch("");
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  tagModalType === "client"
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-xs"
                    : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                }`}
                title="Taguer un client et lier sa fiche"
              >
                <Building className="w-3 h-3" />
                <span>Client</span>
              </button>

              {/* Tag Prospect */}
              <button
                type="button"
                onClick={() => {
                  setTagModalType(tagModalType === "prospect" ? null : "prospect");
                  setTagSearch("");
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  tagModalType === "prospect"
                    ? "bg-amber-600 text-white border-amber-500 shadow-xs"
                    : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30"
                }`}
                title="Taguer un prospect et lier sa fiche"
              >
                <Target className="w-3 h-3" />
                <span>Prospect</span>
              </button>
            </div>

            {/* Raccourcis émojis rapides */}
            <div className="flex items-center gap-1 shrink-0">
              <Smile className="w-3.5 h-3.5 text-neutral-500 mr-0.5" />
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleAddEmoji(emoji)}
                  className="px-1.5 py-0.5 rounded-lg bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/40 text-xs transition-transform active:scale-95 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Formulaire d'envoi */}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder={
                activeType === "channel"
                  ? `Écrire dans #${activeChannel.label} (utilisez @ pour mentionner, ou les boutons ci-dessus)...`
                  : `Message privé pour ${activeDmUser?.name || "ce collaborateur"}...`
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 h-11 px-4 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
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
