"use client";

import React, { useState, useTransition } from "react";
import {
  CommercialAiContext,
  askCommercialAiAction,
  generateColdPitchAction,
  generateObjectionResponseAction,
  generateFollowUpMessageAction,
  generateMeetingPrepAction,
  generateClientUpsellAction,
} from "@/actions/commercialAi";
import { trackCommunicationClick } from "@/lib/tracking";
import {
  Bot,
  Sparkles,
  Send,
  Loader2,
  Copy,
  Check,
  PhoneCall,
  Calendar,
  Clock,
  Users,
  Building2,
  ShieldCheck,
  MessageSquare,
  Flame,
  ArrowRight,
  ExternalLink,
  HelpCircle,
  TrendingUp,
  Award,
  RefreshCw,
} from "lucide-react";

interface CommercialAiHubProps {
  initialContext: CommercialAiContext;
}

type TabType =
  | "chat"
  | "prospection"
  | "base"
  | "appels"
  | "rdv"
  | "relances"
  | "clients";

export function CommercialAiHub({ initialContext }: CommercialAiHubProps) {
  const [context, setContext] = useState<CommercialAiContext>(initialContext);
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [isPending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --- 1. State Chat Copilote ---
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      source?: string;
      model?: string;
      time: string;
    }>
  >([
    {
      id: "welcome-msg",
      role: "assistant",
      content: `Bonjour **${initialContext.userName}** ! Je suis ton **Assistant IA Commercial BOOSTERA**.

Je suis directement connecté en temps réel à tes **6 sections de vente** :
• **Prospection** : ${initialContext.stats.virginProspectsCount} prospects vierges à démarcher
• **Base Prospects** : ${initialContext.stats.totalAssignedProspects} prospects (${initialContext.stats.interestedProspectsCount} qualifiés intéressés)
• **Appels** : ${initialContext.stats.todayCallsCount} appel(s) passés aujourd'hui
• **Rendez-vous** : ${initialContext.stats.upcomingAppointmentsCount} RDV(s) programmés
• **Relances** : ${initialContext.stats.pendingFollowUpsCount} relance(s) en attente
• **Clients** : ${initialContext.stats.activeClientsCount} client(s) signés sous contrat

Comment puis-je t'aider à maximiser tes signatures aujourd'hui ? Tu peux me poser n'importe quelle question ou utiliser les modules spécialisés ci-dessus.`,
      source: initialContext.aiConnected.gemini ? "GEMINI_AI" : "OPENAI_CHATGPT",
      model: initialContext.aiConnected.gemini ? "Google Gemini" : "ChatGPT",
      time: new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
    },
  ]);

  // --- 2. State Prospection (Cold Calling) ---
  const [pitchSector, setPitchSector] = useState(initialContext.sectorsList[0] || "Cabinet médical");
  const [pitchWilaya, setPitchWilaya] = useState(initialContext.wilayasList[0] || "Alger");
  const [selectedVirginId, setSelectedVirginId] = useState<string>("");
  const [pitchResult, setPitchResult] = useState<string | null>(null);

  // --- 3. State Appels (Désamorceur d'Objections) ---
  const [selectedObjection, setSelectedObjection] = useState<string>("trop cher");
  const [customObjection, setCustomObjection] = useState("");
  const [objectionResult, setObjectionResult] = useState<string | null>(null);

  // --- 4. State Rendez-vous (Closing Prep) ---
  const [selectedRdvId, setSelectedRdvId] = useState<string>(
    initialContext.upcomingAppointments[0]?.id || ""
  );
  const [rdvPrepResult, setRdvPrepResult] = useState<string | null>(null);

  // --- 5. State Relances (WhatsApp 1-clic) ---
  const [selectedFollowUpId, setSelectedFollowUpId] = useState<string>(
    initialContext.pendingFollowUps[0]?.id || ""
  );
  const [followUpChannel, setFollowUpChannel] = useState<"WHATSAPP" | "SMS" | "EMAIL">("WHATSAPP");
  const [followUpResult, setFollowUpResult] = useState<string | null>(null);

  // --- 6. State Clients (Upsell) ---
  const [selectedClientId, setSelectedClientId] = useState<string>(
    initialContext.activeClients[0]?.id || ""
  );
  const [upsellResult, setUpsellResult] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // --- Chat Submit ---
  const handleSendMessage = (textToSend?: string) => {
    const prompt = textToSend || chatInput;
    if (!prompt.trim() || isPending) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg = {
      id: userMsgId,
      role: "user" as const,
      content: prompt.trim(),
      time: new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setChatInput("");

    startTransition(async () => {
      try {
        const res = await askCommercialAiAction({
          prompt: prompt.trim(),
          section: activeTab,
        });

        const assistantMsg = {
          id: `ai-${Date.now()}`,
          role: "assistant" as const,
          content: res.reply,
          source: res.source,
          model: res.modelUsed,
          time: new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        const errorMsg = {
          id: `ai-err-${Date.now()}`,
          role: "assistant" as const,
          content: "Désolé, une erreur est survenue lors de la communication avec l'assistant. Veuillez réessayer.",
          time: new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    });
  };

  // --- Prospection Script Submit ---
  const handleGeneratePitch = () => {
    startTransition(async () => {
      const virgin = initialContext.topVirginProspects.find((v) => v.id === selectedVirginId);
      const res = await generateColdPitchAction({
        sector: virgin ? virgin.sector : pitchSector,
        wilaya: virgin ? virgin.wilaya : pitchWilaya,
        prospectName: virgin?.companyName,
        prospectPhone: virgin?.phone,
      });
      setPitchResult(res.reply);
    });
  };

  // --- Objection Submit ---
  const handleGenerateObjection = (key?: string) => {
    const objKey = key || selectedObjection;
    startTransition(async () => {
      const res = await generateObjectionResponseAction({
        objectionKey: objKey,
        customObjection: customObjection.trim() || undefined,
        sector: pitchSector,
      });
      setObjectionResult(res.reply);
    });
  };

  // --- RDV Prep Submit ---
  const handleGenerateRdvPrep = () => {
    const appt = initialContext.upcomingAppointments.find((a) => a.id === selectedRdvId);
    if (!appt) return;

    startTransition(async () => {
      const res = await generateMeetingPrepAction({
        appointmentId: appt.id,
        companyName: appt.targetName,
        sector: "Entreprise & Commerce",
        meetingType: appt.type,
        notes: appt.notes || undefined,
      });
      setRdvPrepResult(res.reply);
    });
  };

  // --- Relance Submit ---
  const handleGenerateFollowUp = () => {
    const fu = initialContext.pendingFollowUps.find((f) => f.id === selectedFollowUpId);
    if (!fu) return;

    startTransition(async () => {
      const res = await generateFollowUpMessageAction({
        prospectId: fu.prospectId,
        companyName: fu.prospectName,
        phone: fu.phone,
        stepNumber: fu.stepNumber,
        channel: followUpChannel,
        lastNotes: fu.notes || undefined,
      });
      setFollowUpResult(res.reply);
    });
  };

  // --- Upsell Submit ---
  const handleGenerateUpsell = () => {
    const client = initialContext.activeClients.find((c) => c.id === selectedClientId);
    if (!client) return;

    startTransition(async () => {
      const res = await generateClientUpsellAction({
        clientName: client.companyName,
        currentOffer: client.offerType as any,
        sector: client.sector,
      });
      setUpsellResult(res.reply);
    });
  };

  const selectedFollowUpObj = initialContext.pendingFollowUps.find(
    (f) => f.id === selectedFollowUpId
  );

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & AI Status Bar */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight">
                  Assistant IA Commercial BOOSTERA
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 text-[11px] font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Espace Commercial ({context.userName})
                </span>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                Intelligence artificielle connectée en direct à vos 6 sections de vente (Prospection, Base, Appels, Rendez-vous, Relances, Clients).
              </p>
            </div>
          </div>

          {/* Badges de connexion IA */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Gemini Connecté</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-xs font-semibold text-purple-700 dark:text-purple-400">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <span>ChatGPT Connecté</span>
            </div>
          </div>
        </div>

        {/* 2. Key Metrics Bar (6 sections data) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800 text-xs">
          <div
            onClick={() => setActiveTab("prospection")}
            className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800/80 hover:border-blue-500/40 cursor-pointer transition-all"
          >
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">1. Prospection</span>
            <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center justify-between mt-0.5">
              <span>{context.stats.virginProspectsCount}</span>
              <span className="text-[10px] font-normal text-blue-600 dark:text-blue-400">Vierges</span>
            </div>
          </div>

          <div
            onClick={() => setActiveTab("base")}
            className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800/80 hover:border-blue-500/40 cursor-pointer transition-all"
          >
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">2. Base Prospects</span>
            <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center justify-between mt-0.5">
              <span>{context.stats.totalAssignedProspects}</span>
              <span className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400">{context.stats.interestedProspectsCount} chauds</span>
            </div>
          </div>

          <div
            onClick={() => setActiveTab("appels")}
            className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800/80 hover:border-blue-500/40 cursor-pointer transition-all"
          >
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">3. Appels</span>
            <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center justify-between mt-0.5">
              <span>{context.stats.todayCallsCount}</span>
              <span className="text-[10px] font-normal text-purple-600 dark:text-purple-400">Aujourd'hui</span>
            </div>
          </div>

          <div
            onClick={() => setActiveTab("rdv")}
            className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800/80 hover:border-blue-500/40 cursor-pointer transition-all"
          >
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">4. Rendez-vous</span>
            <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center justify-between mt-0.5">
              <span>{context.stats.upcomingAppointmentsCount}</span>
              <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">Programmés</span>
            </div>
          </div>

          <div
            onClick={() => setActiveTab("relances")}
            className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800/80 hover:border-blue-500/40 cursor-pointer transition-all"
          >
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">5. Relances</span>
            <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center justify-between mt-0.5">
              <span>{context.stats.pendingFollowUpsCount}</span>
              <span className="text-[10px] font-normal text-rose-600 dark:text-rose-400">À faire</span>
            </div>
          </div>

          <div
            onClick={() => setActiveTab("clients")}
            className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800/80 hover:border-blue-500/40 cursor-pointer transition-all"
          >
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">6. Clients Signés</span>
            <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center justify-between mt-0.5">
              <span>{context.stats.activeClientsCount}</span>
              <span className="text-[10px] font-normal text-indigo-600 dark:text-indigo-400">Actifs</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Section Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-neutral-200 dark:border-neutral-800">
        {[
          { id: "chat", label: "Copilote Chat Global", icon: MessageSquare, badge: "Interactif" },
          { id: "prospection", label: "1. Prospection", icon: Flame, badge: `${context.stats.virginProspectsCount}` },
          { id: "base", label: "2. Base Prospects", icon: Building2, badge: `${context.stats.totalAssignedProspects}` },
          { id: "appels", label: "3. Appels & Objections", icon: PhoneCall, badge: "Désamorceur" },
          { id: "rdv", label: "4. Rendez-vous", icon: Calendar, badge: `${context.stats.upcomingAppointmentsCount}` },
          { id: "relances", label: "5. Relances WhatsApp", icon: Clock, badge: "1-Clic" },
          { id: "clients", label: "6. Clients & Upsell", icon: Award, badge: `${context.stats.activeClientsCount}` },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as TabType)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                }`}
              >
                {t.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. Tab Contents */}

      {/* === TAB 1: COPILOTE CHAT GLOBAL === */}
      {activeTab === "chat" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Quick Prompts Sidebar */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
              Actions Rapides en 1 Clic
            </h3>
            <div className="space-y-2">
              {[
                "Quelles sont mes priorités de la journée pour closer ?",
                "Donne-moi un script d'appel pour une clinique médicale à Alger.",
                "Comment répondre à un prospect qui dit que 35 000 DA c'est trop cher ?",
                "Rédige un message WhatsApp pour relancer un prospect pas encore convaincu.",
                "Quels sont les arguments pour faire passer un client Starter vers Silver ?",
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(suggestion)}
                  className="w-full text-left p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-blue-500/40 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-neutral-700 dark:text-neutral-300 text-xs transition-all cursor-pointer flex items-start gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <span className="leading-snug">{suggestion}</span>
                </button>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-500/30 text-xs space-y-1 text-neutral-700 dark:text-neutral-300">
              <p className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Mémoire Commerciale</span>
              </p>
              <p className="text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                L'assistant connaît vos {context.stats.totalAssignedProspects} prospects, vos {context.stats.todayCallsCount} appels du jour et vos {context.stats.pendingFollowUpsCount} relances.
              </p>
            </div>
          </div>

          {/* Main Chat Stream */}
          <div className="lg:col-span-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col h-[650px] shadow-xs">
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed space-y-2 relative group ${
                      m.role === "user"
                        ? "bg-blue-600 text-white rounded-br-xs"
                        : "bg-neutral-50 dark:bg-neutral-950/80 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-bl-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 border-b border-black/5 dark:border-white/5 pb-1 text-[10px] opacity-75">
                      <span>{m.role === "user" ? "Vous" : m.model || "Assistant BOOSTERA"}</span>
                      <div className="flex items-center gap-2">
                        <span>{m.time}</span>
                        {m.role === "assistant" && (
                          <button
                            onClick={() => copyToClipboard(m.content, m.id)}
                            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                            title="Copier la réponse"
                          >
                            {copiedId === m.id ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="whitespace-pre-wrap font-sans break-words prose-xs">
                      {m.content}
                    </div>
                  </div>
                </div>
              ))}

              {isPending && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    <span>L'IA analyse vos données commerciales...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 rounded-b-2xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Posez votre question (ex: Rédige une relance WhatsApp pour Dental Center...)"
                  className="flex-1 h-10 px-4 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isPending || !chatInput.trim()}
                  className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Envoyer</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* === TAB 2: PROSPECTION (COLD CALLING) === */}
      {activeTab === "prospection" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Générateur de Pitch d'Appel à Froid
                </h3>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Générez instantanément 3 scripts d'appel téléphonique percutants adaptés au secteur et à la wilaya ciblée.
              </p>

              {/* Sélection parmi les prospects vierges réels */}
              {context.topVirginProspects.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                    Cibler un de vos prospects vierges réels :
                  </label>
                  <select
                    value={selectedVirginId}
                    onChange={(e) => {
                      setSelectedVirginId(e.target.value);
                      const found = context.topVirginProspects.find((v) => v.id === e.target.value);
                      if (found) {
                        setPitchSector(found.sector);
                        setPitchWilaya(found.wilaya);
                      }
                    }}
                    className="w-full h-9 px-3 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="">-- Saisie libre ou sélectionner un prospect --</option>
                    {context.topVirginProspects.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.companyName} ({v.sector} - {v.wilaya})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Secteur */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                  Secteur d'activité :
                </label>
                <input
                  type="text"
                  value={pitchSector}
                  onChange={(e) => setPitchSector(e.target.value)}
                  placeholder="ex: Cabinet Médical, Agence de Voyage, Restaurant..."
                  className="w-full h-9 px-3 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-neutral-100"
                />
              </div>

              {/* Wilaya */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                  Wilaya :
                </label>
                <input
                  type="text"
                  value={pitchWilaya}
                  onChange={(e) => setPitchWilaya(e.target.value)}
                  placeholder="ex: Alger, Oran, Constantine, Sétif..."
                  className="w-full h-9 px-3 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <button
                type="button"
                onClick={handleGeneratePitch}
                disabled={isPending || !pitchSector.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Générer les 3 Scripts IA</span>
              </button>
            </div>
          </div>

          {/* Résultat Scripts */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs min-h-[420px] flex flex-col">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-500" />
                  <span>Scripts de Prospection Recommandés</span>
                </h3>
                {pitchResult && (
                  <button
                    onClick={() => copyToClipboard(pitchResult, "pitch-all")}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    {copiedId === "pitch-all" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>Copier l'ensemble</span>
                  </button>
                )}
              </div>

              <div className="mt-4 flex-1">
                {pitchResult ? (
                  <div className="text-xs leading-relaxed text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
                    {pitchResult}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                      <PhoneCall className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      Préparez vos appels de prospection en quelques secondes
                    </p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 max-w-sm">
                      Sélectionnez un secteur ou un prospect vierge à gauche et cliquez sur « Générer les 3 Scripts IA » pour obtenir des approches sur-mesure.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === TAB 3: BASE PROSPECTS === */}
      {activeTab === "base" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-500" />
                  <span>Analyse Intelligente du Portefeuille ({context.stats.totalAssignedProspects} Prospects)</span>
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                  Détection des opportunités chaudes et des prospects à rappeler en priorité.
                </p>
              </div>
              <button
                onClick={() =>
                  handleSendMessage(
                    "Analyse mes 10 prospects qualifiés intéressés et dis-moi pour chacun quel pack (Starter, Silver ou Gold) leur proposer en priorité."
                  )
                }
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Auditer les Leads Chauds avec l'IA</span>
              </button>
            </div>

            {/* Prospects Chauds Liste */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5">
              {context.topInterestedProspects.length === 0 ? (
                <p className="text-xs text-neutral-500 p-4 col-span-full">
                  Aucun prospect qualifié « Intéressé » pour l'instant. Qualifiez vos prospects vierges dans la section Prospection.
                </p>
              ) : (
                context.topInterestedProspects.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 space-y-2 hover:border-emerald-500/40 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-xs text-neutral-900 dark:text-neutral-100">
                          {p.companyName}
                        </h4>
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          {p.sector} • {p.wilaya}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                        Intéressé
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-600 dark:text-neutral-400 line-clamp-2">
                      {p.response || p.notes || "Prospect réceptif lors du premier appel, à transformer en rendez-vous."}
                    </p>

                    <div className="pt-2 border-t border-neutral-200 dark:border-neutral-850 flex items-center justify-between">
                      <span className="text-[10px] text-neutral-500">{p.phone}</span>
                      <button
                        onClick={() =>
                          handleSendMessage(
                            `Rédige une stratégie de closing pour ${p.companyName} (${p.sector} à ${p.wilaya}, téléphone ${p.phone}).`
                          )
                        }
                        className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Stratégie IA</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* === TAB 4: APPELS & OBJECTIONS === */}
      {activeTab === "appels" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-500" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Désamorceur d'Objections
                </h3>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Cliquez sur l'objection entendue au téléphone pour obtenir immédiatement la parade exacte mot-à-mot.
              </p>

              <div className="space-y-2">
                {[
                  { key: "trop cher", label: "« C'est trop cher / Pas de budget »" },
                  { key: "devis whatsapp", label: "« Envoyez-moi un devis sur WhatsApp »" },
                  { key: "deja une agence", label: "« On a déjà une agence ou un CM »" },
                  { key: "rappelez plus tard", label: "« Rappelez le mois prochain / Pas le temps »" },
                  { key: "pas besoin", label: "« Pas intéressé / On marche au bouche-à-oreille »" },
                ].map((obj) => (
                  <button
                    key={obj.key}
                    type="button"
                    onClick={() => {
                      setSelectedObjection(obj.key);
                      handleGenerateObjection(obj.key);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                      selectedObjection === obj.key
                        ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                        : "bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:border-purple-500/40"
                    }`}
                  >
                    <span>{obj.label}</span>
                    <ArrowRight className="w-3 h-3 shrink-0" />
                  </button>
                ))}
              </div>

              {/* Objection personnalisée */}
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <label className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                  Autre objection spécifique entendue :
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customObjection}
                    onChange={(e) => setCustomObjection(e.target.value)}
                    placeholder="ex: Le patron est en voyage..."
                    className="flex-1 h-9 px-3 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-900 dark:text-neutral-100"
                  />
                  <button
                    onClick={() => handleGenerateObjection("custom")}
                    disabled={isPending || !customObjection.trim()}
                    className="px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold disabled:opacity-50 transition-all cursor-pointer"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Résultat Objection */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs min-h-[420px] flex flex-col">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-500" />
                  <span>Script de Réponse Mot-à-Mot & Question de Rebond</span>
                </h3>
                {objectionResult && (
                  <button
                    onClick={() => copyToClipboard(objectionResult, "objection-copy")}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    {copiedId === "objection-copy" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>Copier la parade</span>
                  </button>
                )}
              </div>

              <div className="mt-4 flex-1">
                {objectionResult ? (
                  <div className="text-xs leading-relaxed text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
                    {objectionResult}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      Prêt pour vos appels téléphoniques
                    </p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 max-w-sm">
                      Cliquez sur une objection à gauche pour afficher instantanément les arguments psychologiques et le script exact à réciter.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === TAB 5: RENDEZ-VOUS (CLOSING SHEETS) === */}
      {activeTab === "rdv" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Fiche de Préparation au Closing
                </h3>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Sélectionnez l'un de vos rendez-vous programmés pour que l'IA génère la stratégie de négociation et le pack recommandé.
              </p>

              {context.upcomingAppointments.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20">
                  Aucun rendez-vous futur programmé dans votre calendrier.
                </p>
              ) : (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                    Choisir le rendez-vous :
                  </label>
                  {context.upcomingAppointments.map((appt) => (
                    <button
                      key={appt.id}
                      type="button"
                      onClick={() => setSelectedRdvId(appt.id)}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                        selectedRdvId === appt.id
                          ? "bg-amber-500/10 border-amber-500 text-amber-800 dark:text-amber-200 font-bold"
                          : "bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-amber-500/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{appt.targetName}</span>
                        <span className="text-[10px] font-normal text-neutral-500">
                          {new Date(appt.startTime).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                      <p className="text-[10px] font-normal text-neutral-500 mt-1">
                        {appt.title} • {appt.type}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerateRdvPrep}
                disabled={isPending || !selectedRdvId}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Générer la Fiche Stratégique IA</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs min-h-[420px] flex flex-col">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                  <Bot className="w-4 h-4 text-amber-500" />
                  <span>Fiche de Closing (Pack & Questions Clés)</span>
                </h3>
                {rdvPrepResult && (
                  <button
                    onClick={() => copyToClipboard(rdvPrepResult, "rdv-copy")}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    {copiedId === "rdv-copy" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>Copier la fiche</span>
                  </button>
                )}
              </div>

              <div className="mt-4 flex-1">
                {rdvPrepResult ? (
                  <div className="text-xs leading-relaxed text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
                    {rdvPrepResult}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      Préparez vos rendez-vous de closing
                    </p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 max-w-sm">
                      Générez une fiche complète avec les questions de découverte pour cerner les besoins du prospect et signer le pack Starter, Silver ou Gold.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === TAB 6: RELANCES (WHATSAPP 1-CLIC) === */}
      {activeTab === "relances" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Relances en 1-Clic
                </h3>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Sélectionnez un prospect en attente de relance pour générer un message personnalisé prêt à partir.
              </p>

              {/* Choix du canal */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                  Canal d'envoi :
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["WHATSAPP", "SMS", "EMAIL"] as const).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setFollowUpChannel(ch)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        followUpChannel === ch
                          ? "bg-rose-600 text-white border-rose-600"
                          : "bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300"
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sélection parmi les relances réelles */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                  Prospect à relancer :
                </label>
                {context.pendingFollowUps.length === 0 ? (
                  <p className="text-xs text-neutral-500 p-3 bg-neutral-50 dark:bg-neutral-950 rounded-xl">
                    Aucune relance en attente pour le moment.
                  </p>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {context.pendingFollowUps.map((fu) => (
                      <button
                        key={fu.id}
                        type="button"
                        onClick={() => setSelectedFollowUpId(fu.id)}
                        className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                          selectedFollowUpId === fu.id
                            ? "bg-rose-500/10 border-rose-500 text-rose-800 dark:text-rose-200 font-bold"
                            : "bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-rose-500/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{fu.prospectName}</span>
                          {fu.isOverdue && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500 text-white font-bold">
                              En retard
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-normal text-neutral-500 mt-0.5">
                          Étape {fu.stepNumber} • {fu.phone}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleGenerateFollowUp}
                disabled={isPending || !selectedFollowUpId}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Rédiger le Message {followUpChannel}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs min-h-[420px] flex flex-col">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                  <Bot className="w-4 h-4 text-rose-500" />
                  <span>Message Prêt à l'Envoi ({followUpChannel})</span>
                </h3>
                {followUpResult && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => copyToClipboard(followUpResult, "followup-copy")}
                      className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                    >
                      {copiedId === "followup-copy" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>Copier</span>
                    </button>
                    {followUpChannel === "WHATSAPP" && selectedFollowUpObj?.phone && (
                      <a
                        href={`https://wa.me/${selectedFollowUpObj.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                          followUpResult
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          trackCommunicationClick({
                            type: "WHATSAPP",
                            targetName: selectedFollowUpObj.prospectName,
                            phone: selectedFollowUpObj.phone,
                            entityType: "PROSPECT",
                            notes: "Relance IA 1-clic WhatsApp",
                          });
                        }}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Ouvrir WhatsApp</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 flex-1">
                {followUpResult ? (
                  <div className="text-xs leading-relaxed text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 font-sans">
                    {followUpResult}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                      <Clock className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      Ne perdez plus aucun prospect tiède
                    </p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 max-w-sm">
                      Sélectionnez une relance à gauche pour obtenir un message captivant avec émoticônes et bouton direct pour ouvrir WhatsApp.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === TAB 7: CLIENTS & UPSELL === */}
      {activeTab === "clients" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Stratégie d'Upsell Client
                </h3>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Transformez vos clients existants en comptes à plus forte valeur ajoutée (Starter → Silver → Gold).
              </p>

              {context.activeClients.length === 0 ? (
                <p className="text-xs text-neutral-500 p-3 bg-neutral-50 dark:bg-neutral-950 rounded-xl">
                  Aucun client signé actif pour le moment.
                </p>
              ) : (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                    Sélectionner le client :
                  </label>
                  {context.activeClients.map((cl) => (
                    <button
                      key={cl.id}
                      type="button"
                      onClick={() => setSelectedClientId(cl.id)}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                        selectedClientId === cl.id
                          ? "bg-indigo-500/10 border-indigo-500 text-indigo-800 dark:text-indigo-200 font-bold"
                          : "bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-indigo-500/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{cl.companyName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold">
                          {cl.offerType}
                        </span>
                      </div>
                      <p className="text-[10px] font-normal text-neutral-500 mt-1">
                        {cl.sector} • {cl.phone}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerateUpsell}
                disabled={isPending || !selectedClientId}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                <span>Générer Proposition d'Upsell IA</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-xs min-h-[420px] flex flex-col">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-500" />
                  <span>Proposition d'Évolution & Pitch de Renouvellement</span>
                </h3>
                {upsellResult && (
                  <button
                    onClick={() => copyToClipboard(upsellResult, "upsell-copy")}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    {copiedId === "upsell-copy" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>Copier la proposition</span>
                  </button>
                )}
              </div>

              <div className="mt-4 flex-1">
                {upsellResult ? (
                  <div className="text-xs leading-relaxed text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
                    {upsellResult}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                      <Award className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      Développez le chiffre d'affaires de vos clients actifs
                    </p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 max-w-sm">
                      Générez des argumentaires d'upsell pour faire monter vos clients en gamme vers des packs plus rentables (ex: ajout de vidéos Reels et Voix-off).
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
