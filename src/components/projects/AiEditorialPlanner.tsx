"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Sparkles,
  Calendar,
  Layers,
  Film,
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Plus,
  Clock,
  Flame,
  Check,
  Zap,
  Tag,
  Target,
  RotateCcw,
  Key,
  Eye,
  Camera,
  Video,
  Mic,
  Globe,
  ExternalLink,
  Bot,
  Cpu,
  Edit2,
  Edit3,
  Trash2,
  Save,
  X,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import {
  EditorialPlanResult,
  PublicationProposal,
  WEEKLY_QUOTAS_BY_OFFER,
  STRATEGIC_GOALS,
} from "@/lib/aiContentGenerator";
import {
  generateEditorialPlanAction,
  convertProposalToTaskAction,
  sendWeeklyContentNotificationAction,
  saveGeminiApiKeyAction,
  getGeminiApiKeyStatusAction,
  saveOpenAiApiKeyAction,
  getOpenAiApiKeyStatusAction,
  updateClientSocialNetworksAction,
  regenerateSinglePublicationAction,
  updatePublicationThemeAction,
  updatePublicationDetailsAction,
} from "@/actions/contentAi";
import { useRouter } from "next/navigation";
import { OfferType } from "@prisma/client";
import { parseClientMedia, normalizeMediaUrl, formatSocialLabel } from "@/lib/utils";

interface AiEditorialPlannerProps {
  project?: any;
  client?: any;
  users: { id: string; name: string; role: string }[];
  onTaskCreated?: () => void;
}

export function AiEditorialPlanner({
  project,
  client: directClient,
  users,
  onTaskCreated,
}: AiEditorialPlannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const client = directClient || project?.client || {};
  const offerType = (client.offerType as OfferType) || "STARTER";
  const quotaConfig = WEEKLY_QUOTAS_BY_OFFER[offerType] || WEEKLY_QUOTAS_BY_OFFER.STARTER;

  // État local du plan
  const [plan, setPlan] = useState<EditorialPlanResult | null>(null);
  const [seed, setSeed] = useState<number>(0);
  const [regenerationNotice, setRegenerationNotice] = useState<string | null>(null);
  const [showThemes, setShowThemes] = useState<boolean>(false);
  const [showPackDetails, setShowPackDetails] = useState<boolean>(true);
  const [selectedGoal, setSelectedGoal] = useState<string>("ALL_ROUND");
  const [selectedWeek, setSelectedWeek] = useState<number | "ALL">("ALL");
  const [expandedPubId, setExpandedPubId] = useState<string | null>(null);
  const [isConvertingId, setIsConvertingId] = useState<string | null>(null);
  const [createdTaskIds, setCreatedTaskIds] = useState<Record<string, boolean>>({});

  // Technicien assigné par défaut (Sidahmed en priorité, ou profil technique)
  const defaultTechnician =
    users.find((u) => u.name.toLowerCase().includes("sidahmed")) ||
    users.find((u) =>
      ["TECH_LEAD", "DEVELOPER", "DESIGNER", "VIDEO_EDITOR"].includes(u.role)
    ) ||
    users.find((u) => u.name.toLowerCase().includes("tech")) ||
    users[0];

  // État de régénération unitaire par publication
  const [regeneratingPubId, setRegeneratingPubId] = useState<string | null>(null);

  // État de modification manuelle du thème par publication
  const [editingThemePubId, setEditingThemePubId] = useState<string | null>(null);
  const [customThemeValue, setCustomThemeValue] = useState<string>("");

  // État de modification manuelle complète d'une publication (tous les détails)
  const [editingPub, setEditingPub] = useState<PublicationProposal | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isSavingPubDetails, setIsSavingPubDetails] = useState<boolean>(false);

  // État Clés API & Fournisseurs IA
  const [geminiApiKey, setGeminiApiKey] = useState<string>("");
  const [hasServerGeminiKey, setHasServerGeminiKey] = useState<boolean>(false);
  const [maskedGeminiKey, setMaskedGeminiKey] = useState<string>("");
  const [geminiInputValue, setGeminiInputValue] = useState<string>("");

  const [openAiApiKey, setOpenAiApiKey] = useState<string>("");
  const [hasServerOpenAiKey, setHasServerOpenAiKey] = useState<boolean>(false);
  const [maskedOpenAiKey, setMaskedOpenAiKey] = useState<string>("");
  const [openAiInputValue, setOpenAiInputValue] = useState<string>("");

  const [selectedProvider, setSelectedProvider] = useState<"AUTO" | "GEMINI" | "OPENAI">("AUTO");
  const [activeKeyTab, setActiveKeyTab] = useState<"GEMINI" | "OPENAI">("GEMINI");
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);
  const [keySaveMessage, setKeySaveMessage] = useState<string | null>(null);

  const [aiSource, setAiSource] = useState<"GEMINI_AI" | "OPENAI_CHATGPT" | "LOCAL_ENGINE">("LOCAL_ENGINE");
  const [modelUsed, setModelUsed] = useState<string>("");

  // Extraction des réseaux sociaux réels du client (champs natifs + métadonnées [CLIENT_MEDIA:...])
  const initialMediaInfo = parseClientMedia(client?.notes, client);
  const [clientMedia, setClientMedia] = useState(initialMediaInfo.media);
  const [clientCleanNotes, setClientCleanNotes] = useState(initialMediaInfo.cleanNotes);

  useEffect(() => {
    const parsed = parseClientMedia(client?.notes, client);
    setClientMedia(parsed.media);
    setClientCleanNotes(parsed.cleanNotes);
  }, [client?.notes, client?.facebook, client?.instagram]);

  const activeInstagram = clientMedia.instagram || client?.instagram || "";
  const activeFacebook = clientMedia.facebook || client?.facebook || "";
  const activeTiktok = clientMedia.tiktok || "";
  const activePhone = client?.phone || "";

  // État Réseaux Sociaux Client
  const [isSocialModalOpen, setIsSocialModalOpen] = useState<boolean>(false);
  const [socialForm, setSocialForm] = useState({
    instagram: activeInstagram,
    facebook: activeFacebook,
    tiktok: activeTiktok,
    phone: activePhone,
    notes: clientCleanNotes,
  });

  const openSocialConfigModal = () => {
    setSocialForm({
      instagram: activeInstagram,
      facebook: activeFacebook,
      tiktok: activeTiktok,
      phone: activePhone,
      notes: clientCleanNotes,
    });
    setIsSocialModalOpen(true);
  };

  // Notification feedback state
  const [notificationStatus, setNotificationStatus] = useState<{
    type: "idle" | "sending" | "success" | "error";
    message?: string;
  }>({ type: "idle" });

  // Initialisation au montage : Charger le plan enregistré du mois ou le générer automatiquement une seule fois
  useEffect(() => {
    async function initKeyAndPlan() {
      let activeGeminiKey = "";
      let activeOpenAiKey = "";
      try {
        const savedGemini = localStorage.getItem("boostera_gemini_api_key") || "";
        if (savedGemini) {
          activeGeminiKey = savedGemini;
          setGeminiApiKey(savedGemini);
          setGeminiInputValue(savedGemini);
        }
        const savedOpenAi = localStorage.getItem("boostera_openai_api_key") || "";
        if (savedOpenAi) {
          activeOpenAiKey = savedOpenAi;
          setOpenAiApiKey(savedOpenAi);
          setOpenAiInputValue(savedOpenAi);
        }
      } catch {}

      try {
        const [geminiStatus, openAiStatus] = await Promise.all([
          getGeminiApiKeyStatusAction(),
          getOpenAiApiKeyStatusAction(),
        ]);

        if (geminiStatus.hasKey) {
          setHasServerGeminiKey(true);
          if (geminiStatus.maskedKey) setMaskedGeminiKey(geminiStatus.maskedKey);
        }
        if (openAiStatus.hasKey) {
          setHasServerOpenAiKey(true);
          if (openAiStatus.maskedKey) setMaskedOpenAiKey(openAiStatus.maskedKey);
        }
      } catch {}

      // Chargement automatique : charge le plan enregistré du mois ou le génère 1 seule fois
      handleGeneratePlan(
        undefined,
        undefined,
        {
          geminiKey: activeGeminiKey || undefined,
          openAiKey: activeOpenAiKey || undefined,
        },
        undefined,
        false
      );
    }

    initKeyAndPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, client?.id]);

  const handleGeneratePlan = (
    goalOverride?: string,
    seedOverride?: number,
    keysOverride?: { geminiKey?: string; openAiKey?: string },
    providerOverride?: "AUTO" | "GEMINI" | "OPENAI",
    forceRegenerate?: boolean
  ) => {
    const currentSeed = seedOverride !== undefined ? seedOverride : seed;
    const currentGeminiKey = keysOverride?.geminiKey !== undefined ? keysOverride.geminiKey : geminiApiKey;
    const currentOpenAiKey = keysOverride?.openAiKey !== undefined ? keysOverride.openAiKey : openAiApiKey;
    const currentProvider = providerOverride || selectedProvider;

    startTransition(async () => {
      const res = await generateEditorialPlanAction({
        projectId: project?.id,
        clientId: client?.id,
        goal: goalOverride || selectedGoal,
        seed: currentSeed,
        apiKey: currentGeminiKey || undefined,
        openAiApiKey: currentOpenAiKey || undefined,
        provider: currentProvider,
        forceRegenerate: forceRegenerate || false,
      });

      if (res.success && res.plan) {
        setPlan(res.plan);
        if (res.source) setAiSource(res.source);
        if (res.modelUsed) setModelUsed(res.modelUsed);

        // Initialiser l'état des tâches déjà existantes
        const createdMap: Record<string, boolean> = {};
        res.plan.publications.forEach((pub) => {
          if (pub.isCreatedAsTask) {
            createdMap[pub.id] = true;
          }
        });
        setCreatedTaskIds((prev) => ({ ...prev, ...createdMap }));

        if (seedOverride !== undefined && seedOverride > 0) {
          let sourceText = "✨ Nouveaux sujets régénérés (Lot #" + (seedOverride + 1) + ") !";
          if (res.source === "GEMINI_AI") {
            sourceText = "✨ Sujets générés en direct par Google Gemini avec les réseaux du client !";
          } else if (res.source === "OPENAI_CHATGPT") {
            sourceText = "🤖 Sujets générés en direct par OpenAI ChatGPT avec les réseaux du client !";
          }
          setRegenerationNotice(
            `${sourceText} Calibré sur ${quotaConfig.label} (${quotaConfig.details}).`
          );
          setTimeout(() => setRegenerationNotice(null), 6000);
        }
      }
    });
  };

  const handleRegenerate = () => {
    const nextSeed = seed + 1;
    setSeed(nextSeed);
    handleGeneratePlan(selectedGoal, nextSeed, undefined, undefined, true);
  };

  const handleRegenerateSinglePublication = (pub: PublicationProposal) => {
    setRegeneratingPubId(pub.id);
    startTransition(async () => {
      const res = await regenerateSinglePublicationAction({
        projectId: project?.id,
        clientId: client?.id,
        publication: pub,
        goal: selectedGoal,
        provider: selectedProvider,
        apiKey: geminiApiKey || undefined,
        openAiApiKey: openAiApiKey || undefined,
      });

      setRegeneratingPubId(null);
      if (res.success && res.publication) {
        setPlan((prevPlan) => {
          if (!prevPlan) return prevPlan;
          return {
            ...prevPlan,
            publications: prevPlan.publications.map((p) =>
              p.id === pub.id ? res.publication! : p
            ),
          };
        });
        setRegenerationNotice(
          `✨ Sujet & Thème régénérés pour la ${pub.weekLabel} : "${res.publication.title}" !`
        );
        setTimeout(() => setRegenerationNotice(null), 5000);
      }
    });
  };

  const handleStartEditTheme = (pub: PublicationProposal) => {
    setEditingThemePubId(pub.id);
    setCustomThemeValue(pub.theme);
  };

  const handleSaveTheme = (pubId: string, newTheme: string) => {
    const cleanTheme = newTheme.trim();
    if (!cleanTheme) {
      setEditingThemePubId(null);
      return;
    }

    setPlan((prevPlan) => {
      if (!prevPlan) return prevPlan;
      return {
        ...prevPlan,
        publications: prevPlan.publications.map((p) =>
          p.id === pubId ? { ...p, theme: cleanTheme } : p
        ),
      };
    });
    setEditingThemePubId(null);

    startTransition(async () => {
      await updatePublicationThemeAction({
        projectId: project?.id,
        clientId: client?.id,
        publicationId: pubId,
        newTheme: cleanTheme,
      });
      setRegenerationNotice(`Thème mis à jour pour la publication : "${cleanTheme}"`);
      setTimeout(() => setRegenerationNotice(null), 4000);
    });
  };

  // Ouvrir le modal d'édition manuelle de tous les détails
  const handleOpenEditModal = (pub: PublicationProposal) => {
    setEditingPub(JSON.parse(JSON.stringify(pub)));
    setIsEditModalOpen(true);
  };

  // Mettre à jour une scène / slide spécifique
  const handleUpdateSlide = (
    index: number,
    field: "step" | "description" | "visualTip",
    value: string
  ) => {
    setEditingPub((prev) => {
      if (!prev) return prev;
      const updatedSlides = [...prev.scriptOrSlides];
      if (updatedSlides[index]) {
        updatedSlides[index] = {
          ...updatedSlides[index],
          [field]: value,
        };
      }
      return { ...prev, scriptOrSlides: updatedSlides };
    });
  };

  // Ajouter une nouvelle scène / slide
  const handleAddSlide = () => {
    setEditingPub((prev) => {
      if (!prev) return prev;
      const newIndex = prev.scriptOrSlides.length + 1;
      const isReel = prev.format === "REEL_9_16";
      const stepName = isReel ? `Scène ${newIndex}` : `Planche ${newIndex}`;
      return {
        ...prev,
        scriptOrSlides: [
          ...prev.scriptOrSlides,
          {
            step: stepName,
            description: "",
            visualTip: "",
          },
        ],
      };
    });
  };

  // Supprimer une scène / slide
  const handleRemoveSlide = (index: number) => {
    setEditingPub((prev) => {
      if (!prev) return prev;
      if (prev.scriptOrSlides.length <= 1) return prev;
      const updatedSlides = prev.scriptOrSlides.filter((_, i) => i !== index);
      return { ...prev, scriptOrSlides: updatedSlides };
    });
  };

  // Enregistrer toutes les modifications manuelles de la publication
  const handleSavePublicationDetails = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingPub || !plan) return;

    setIsSavingPubDetails(true);
    try {
      const hashtagsClean = Array.isArray(editingPub.hashtags)
        ? editingPub.hashtags
            .flatMap((h) => (typeof h === "string" ? h.split(/[\s,]+/) : []))
            .map((h) => h.replace(/^#/, "").trim())
            .filter(Boolean)
        : [];

      let formatLabel = editingPub.formatLabel;
      if (editingPub.format === "REEL_9_16") formatLabel = "Reel Vidéo";
      else if (editingPub.format === "CAROUSEL") formatLabel = "Carrousel Multi-Planches";
      else if (editingPub.format === "STATIC_POST") formatLabel = "Maquette Design";
      else if (editingPub.format === "STORY_INTERACTIVE") formatLabel = "Story Interactive";

      const cleanedPub: PublicationProposal = {
        ...editingPub,
        title: editingPub.title.trim() || "Sans titre",
        theme: editingPub.theme.trim() || "Axe éditorial",
        formatLabel,
        hook: editingPub.hook.trim(),
        caption: editingPub.caption.trim(),
        cta: editingPub.cta.trim(),
        hashtags: hashtagsClean,
        scriptOrSlides: editingPub.scriptOrSlides.map((s, idx) => ({
          step: s.step.trim() || (editingPub.format === "REEL_9_16" ? `Scène ${idx + 1}` : `Planche ${idx + 1}`),
          description: s.description.trim(),
          visualTip: s.visualTip?.trim() || undefined,
        })),
      };

      // 1. Mise à jour instantanée du state UI local
      setPlan((prevPlan) => {
        if (!prevPlan) return prevPlan;
        return {
          ...prevPlan,
          publications: prevPlan.publications.map((p) =>
            p.id === cleanedPub.id ? cleanedPub : p
          ),
        };
      });

      // 2. Persistance serveur en base de données
      const res = await updatePublicationDetailsAction({
        clientId: client?.id,
        projectId: project?.id,
        publicationId: cleanedPub.id,
        updatedPublication: cleanedPub,
      });

      if (res.success) {
        setRegenerationNotice(`Publication "${cleanedPub.title}" enregistrée avec succès !`);
        setTimeout(() => setRegenerationNotice(null), 4000);
        setIsEditModalOpen(false);
        setEditingPub(null);
      } else {
        alert(res.error || "Erreur lors de l'enregistrement des modifications.");
      }
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setIsSavingPubDetails(false);
    }
  };

  const handleSaveGeminiKey = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = geminiInputValue.trim();
    startTransition(async () => {
      if (cleanKey) {
        const res = await saveGeminiApiKeyAction(cleanKey);
        try {
          localStorage.setItem("boostera_gemini_api_key", cleanKey);
        } catch {}
        setGeminiApiKey(cleanKey);
        setHasServerGeminiKey(true);
        if (res.maskedKey) setMaskedGeminiKey(res.maskedKey);
        setKeySaveMessage("Clé Google Gemini enregistrée avec succès !");
        setTimeout(() => setKeySaveMessage(null), 4000);
      }
      handleGeneratePlan(selectedGoal, seed, { geminiKey: cleanKey }, "GEMINI", true);
    });
  };

  const handleSaveOpenAiKey = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = openAiInputValue.trim();
    startTransition(async () => {
      if (cleanKey) {
        const res = await saveOpenAiApiKeyAction(cleanKey);
        try {
          localStorage.setItem("boostera_openai_api_key", cleanKey);
        } catch {}
        setOpenAiApiKey(cleanKey);
        setHasServerOpenAiKey(true);
        if (res.maskedKey) setMaskedOpenAiKey(res.maskedKey);
        setKeySaveMessage("Clé OpenAI ChatGPT enregistrée avec succès !");
        setTimeout(() => setKeySaveMessage(null), 4000);
      }
      handleGeneratePlan(selectedGoal, seed, { openAiKey: cleanKey }, "OPENAI", true);
    });
  };

  const handleSaveSocial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!client?.id) return;
    startTransition(async () => {
      const res = await updateClientSocialNetworksAction(client.id, socialForm);
      if (res.success) {
        if (res.client) {
          const parsed = parseClientMedia(res.client.notes, res.client);
          setClientMedia(parsed.media);
          setClientCleanNotes(parsed.cleanNotes);
          client.notes = res.client.notes;
        } else {
          setClientMedia((prev) => ({
            ...prev,
            instagram: socialForm.instagram,
            facebook: socialForm.facebook,
            tiktok: socialForm.tiktok,
          }));
        }
        client.instagram = socialForm.instagram;
        client.facebook = socialForm.facebook;
        client.phone = socialForm.phone;
        setIsSocialModalOpen(false);
        router.refresh();
        handleGeneratePlan(selectedGoal, seed, undefined, undefined, true);
      }
    });
  };

  const handleConvert = (proposal: PublicationProposal) => {
    setIsConvertingId(proposal.id);
    const chosenAssignee = defaultTechnician?.id || users[0]?.id;

    startTransition(async () => {
      const res = await convertProposalToTaskAction({
        projectId: project?.id,
        clientId: client?.id,
        proposal,
        assigneeId: chosenAssignee,
      });

      setIsConvertingId(null);
      if (res.success) {
        setCreatedTaskIds((prev) => ({ ...prev, [proposal.id]: true }));
        router.refresh();
        if (onTaskCreated) onTaskCreated();
      }
    });
  };

  const handleSendWeeklyNotification = (weekNum: number) => {
    if (!plan) return;
    setNotificationStatus({ type: "sending" });

    startTransition(async () => {
      const res = await sendWeeklyContentNotificationAction({
        projectId: project?.id,
        clientId: client?.id,
        weekNumber: weekNum,
        posts: plan.publications,
      });

      if (res.success) {
        setNotificationStatus({
          type: "success",
          message: `Notification envoyée avec succès pour la Semaine ${weekNum} (${quotaConfig.weekly} publication(s)) !`,
        });
        setTimeout(() => {
          setNotificationStatus({ type: "idle" });
        }, 5000);
      } else {
        setNotificationStatus({
          type: "error",
          message: res.error || "Échec de l'envoi de la notification",
        });
      }
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedPubId((prev) => (prev === id ? null : id));
  };

  // Filtrer par semaine
  const filteredPublications =
    plan?.publications.filter((p) => {
      if (selectedWeek === "ALL") return true;
      return p.week === selectedWeek;
    }) || [];

  return (
    <div className="space-y-5">
      {/* HEADER IA & BADGES QUOTAS */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-neutral-900 to-blue-950/30 border border-purple-500/20 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                  Studio Éditorial IA
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    Abonnement & Marketing
                  </span>
                </h3>

                {/* Badges IA Connection Permanente */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Badge Google Gemini */}
                  {(hasServerGeminiKey || !!geminiApiKey) && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveKeyTab("GEMINI");
                        setIsKeyModalOpen(true);
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                        aiSource === "GEMINI_AI"
                          ? "bg-emerald-500/25 border border-emerald-400/60 text-emerald-200 ring-1 ring-emerald-400/40 shadow-sm"
                          : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
                      }`}
                      title="Google Gemini connecté en permanence à l'ERP (Cliquez pour configurer)"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span>Gemini Connecté</span>
                      {aiSource === "GEMINI_AI" && modelUsed && (
                        <span className="text-[10px] text-emerald-300/90 font-mono bg-emerald-950/70 px-1.5 py-0.2 rounded border border-emerald-500/30">
                          {modelUsed.replace("gemini-", "")}
                        </span>
                      )}
                    </button>
                  )}

                  {/* Badge OpenAI ChatGPT */}
                  {(hasServerOpenAiKey || !!openAiApiKey) && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveKeyTab("OPENAI");
                        setIsKeyModalOpen(true);
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                        aiSource === "OPENAI_CHATGPT"
                          ? "bg-teal-500/25 border border-teal-400/60 text-teal-200 ring-1 ring-teal-400/40 shadow-sm"
                          : "bg-teal-500/15 border border-teal-500/30 text-teal-300 hover:bg-teal-500/25"
                      }`}
                      title="OpenAI ChatGPT connecté en permanence à l'ERP (Cliquez pour configurer)"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                      </span>
                      <span>ChatGPT Connecté</span>
                      {aiSource === "OPENAI_CHATGPT" && modelUsed && (
                        <span className="text-[10px] text-teal-300/90 font-mono bg-teal-950/70 px-1.5 py-0.2 rounded border border-teal-500/30">
                          {modelUsed}
                        </span>
                      )}
                    </button>
                  )}

                  {/* Bouton de secours si aucune clé n'est encore configurée */}
                  {!hasServerGeminiKey && !geminiApiKey && !hasServerOpenAiKey && !openAiApiKey && (
                    <button
                      type="button"
                      onClick={() => setIsKeyModalOpen(true)}
                      className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-semibold hover:bg-amber-500/25 transition-colors cursor-pointer"
                      title="Cliquez pour configurer vos clés Google Gemini ou OpenAI ChatGPT"
                    >
                      <Key className="w-3 h-3 text-amber-400" />
                      <span>Relier Gemini / ChatGPT</span>
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Génération automatique des thèmes, sujets percutants, hooks et scripts de tournage/montage selon le contrat officiel de votre client.
              </p>
            </div>
          </div>

          {/* Quota Badge selon l'Offre */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            <div
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${quotaConfig.badgeColor}`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>{quotaConfig.label}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
              <span>{quotaConfig.details}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-neutral-800/80 border border-neutral-700/60 text-neutral-300 text-xs font-medium flex items-center gap-1.5">
              <Tag className="w-3 h-3 text-neutral-400" />
              <span>{client.sector || "Secteur général"}</span>
              {client.wilaya && <span className="text-neutral-500">• {client.wilaya}</span>}
            </div>
          </div>
        </div>

        {/* BANDEAU RÉSEAUX SOCIAUX DU CLIENT INJECTÉS DANS L'IA */}
        <div className="pt-3 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              <span>Réseaux du client pris en compte par l'IA :</span>
            </span>

            {/* INSTAGRAM */}
            {activeInstagram ? (
              <a
                href={normalizeMediaUrl(activeInstagram, "instagram")}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-0.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 hover:bg-pink-500/25 transition-colors flex items-center gap-1 font-mono text-[11px]"
                title="Compte Instagram du client (cliquez pour ouvrir)"
              >
                <span>Instagram: {formatSocialLabel(activeInstagram, "instagram")}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ) : (
              <button
                type="button"
                onClick={openSocialConfigModal}
                className="px-2.5 py-0.5 rounded-full bg-neutral-800/80 border border-neutral-700/60 text-neutral-400 hover:text-neutral-200 text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <span>+ Ajouter Instagram</span>
              </button>
            )}

            {/* FACEBOOK */}
            {activeFacebook ? (
              <a
                href={normalizeMediaUrl(activeFacebook, "facebook")}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25 transition-colors flex items-center gap-1 font-mono text-[11px]"
                title="Page Facebook du client (cliquez pour ouvrir)"
              >
                <span>Facebook: {formatSocialLabel(activeFacebook, "facebook")}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ) : (
              <button
                type="button"
                onClick={openSocialConfigModal}
                className="px-2.5 py-0.5 rounded-full bg-neutral-800/80 border border-neutral-700/60 text-neutral-400 hover:text-neutral-200 text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <span>+ Ajouter Facebook</span>
              </button>
            )}

            {/* TIKTOK */}
            {activeTiktok && (
              <a
                href={normalizeMediaUrl(activeTiktok, "tiktok")}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition-colors flex items-center gap-1 font-mono text-[11px]"
                title="Compte TikTok du client (cliquez pour ouvrir)"
              >
                <span>TikTok: {formatSocialLabel(activeTiktok, "tiktok")}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}

            {/* WHATSAPP */}
            {activePhone && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[11px]">
                WhatsApp: {activePhone}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={openSocialConfigModal}
            className="text-[11px] text-purple-400 hover:text-purple-300 underline font-medium cursor-pointer"
          >
            Modifier réseaux & notes client
          </button>
        </div>

        {/* Action Controls : Objectif, Moteur IA & Boutons */}
        <div className="pt-3 border-t border-neutral-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="flex items-center gap-2 min-w-[200px] flex-1">
              <Target className="w-4 h-4 text-purple-400 shrink-0" />
              <select
                value={selectedGoal}
                onChange={(e) => {
                  const newGoal = e.target.value;
                  setSelectedGoal(newGoal);
                  handleGeneratePlan(newGoal);
                }}
                className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                {Object.entries(STRATEGIC_GOALS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Choix du fournisseur IA */}
            <div className="flex items-center gap-2 min-w-[175px]">
              <Cpu className="w-4 h-4 text-blue-400 shrink-0" />
              <select
                value={selectedProvider}
                onChange={(e) => {
                  const newProvider = e.target.value as "AUTO" | "GEMINI" | "OPENAI";
                  setSelectedProvider(newProvider);
                  handleGeneratePlan(selectedGoal, seed, undefined, newProvider, true);
                }}
                className="text-xs bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="AUTO">✨ Moteur Auto (Gemini / GPT)</option>
                <option value="GEMINI">Google Gemini</option>
                <option value="OPENAI">OpenAI ChatGPT</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRegenerate}
              disabled={isPending}
              className="gap-1.5 text-xs border-purple-500/40 text-purple-300 hover:bg-purple-500/10 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
              <span>{isPending ? "Génération en cours..." : "Régénérer les Sujets IA"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* FICHE CONTRACTUELLE DU PACK OFFICIEL (STARTER, SILVER, GOLD) */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
              Contrat & Prestations Officielles : {quotaConfig.label}
              <span className="text-[10px] lowercase font-normal text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                {quotaConfig.features.tagline}
              </span>
            </h4>
          </div>

          <button
            onClick={() => setShowPackDetails(!showPackDetails)}
            className="text-[11px] text-neutral-400 hover:text-neutral-200 flex items-center gap-1 cursor-pointer"
          >
            <span>{showPackDetails ? "Masquer détails" : "Afficher détails"}</span>
            {showPackDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showPackDetails && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-neutral-800/80">
            {/* Vues garanties */}
            <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 flex flex-col justify-between">
              <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                <Eye className="w-3 h-3 text-amber-400" /> Objectif Vues
              </span>
              <span className="text-sm font-extrabold text-amber-300 mt-1">
                {quotaConfig.features.viewsTarget}
              </span>
            </div>

            {/* Carrousels & Maquettes */}
            <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 flex flex-col justify-between">
              <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                <Layers className="w-3 h-3 text-blue-400" /> Carrousels & Maquettes
              </span>
              <span className="text-xs font-bold text-neutral-200 mt-1">
                {quotaConfig.deliverables.carousels} Carrousels • {quotaConfig.deliverables.maquettes} Maquettes
              </span>
            </div>

            {/* Vidéos Reels & Voix Off */}
            <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 flex flex-col justify-between">
              <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                <Film className="w-3 h-3 text-rose-400" /> Reels & Voix Off
              </span>
              <span className="text-xs font-bold text-neutral-200 mt-1">
                {quotaConfig.deliverables.reels > 0 ? (
                  <>
                    {quotaConfig.deliverables.reels} Reels (
                    {quotaConfig.deliverables.voiceOver > 0
                      ? `${quotaConfig.deliverables.voiceOver} Voix off`
                      : "Sans voix off"}
                    )
                  </>
                ) : (
                  <span className="text-neutral-500">0 Reels (Sans Reels)</span>
                )}
              </span>
            </div>

            {/* Shootings / an */}
            <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 flex flex-col justify-between">
              <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                <Camera className="w-3 h-3 text-emerald-400" /> Shootings Photo
              </span>
              <span className="text-xs font-bold text-emerald-300 mt-1">
                {quotaConfig.features.shootingsPerYear} Shooting{quotaConfig.features.shootingsPerYear > 1 ? "s" : ""} / an
              </span>
            </div>

            {/* Vidéo Pro & Sponsor */}
            <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 flex flex-col justify-between">
              <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                <Video className="w-3 h-3 text-purple-400" /> Vidéo Pro + Sponsor
              </span>
              <span className="text-xs font-bold text-purple-300 mt-1">
                {quotaConfig.features.videoProPerYear} Vidéo{quotaConfig.features.videoProPerYear > 1 ? "s" : ""} Pro / an
              </span>
            </div>

            {/* SEO & Certification */}
            <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 flex flex-col justify-between">
              <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                <Globe className="w-3 h-3 text-cyan-400" /> SEO & Google
              </span>
              <span className="text-xs font-bold text-cyan-300 mt-1">
                Certif. Google & SEO
                {quotaConfig.features.proWebsite && " + Site Web"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Message de succès lors de la régénération */}
      {regenerationNotice && (
        <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-200 text-xs font-medium flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{regenerationNotice}</span>
          </div>
          <span className="text-[10px] font-mono font-bold bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full shrink-0">
            {quotaConfig.details}
          </span>
        </div>
      )}

      {/* BANNIÈRE NOTIFICATION DE DÉBUT DE SEMAINE */}
      <div className="p-4 rounded-2xl bg-neutral-900/90 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-neutral-200">
              Notification Début de Semaine (Planning de Publication)
            </h4>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Rappeler à l'équipe le quota de la semaine ({quotaConfig.weekly} publication{quotaConfig.weekly > 1 ? "s" : ""} pour l'offre {offerType}) et les sujets à préparer.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {[1, 2, 3, 4].map((wk) => (
            <Button
              key={wk}
              size="sm"
              variant="outline"
              disabled={notificationStatus.type === "sending"}
              onClick={() => handleSendWeeklyNotification(wk)}
              className="text-[11px] h-8 px-2.5 border-neutral-700 hover:border-blue-500 text-neutral-300 hover:text-white cursor-pointer"
              title={`Envoyer les notifications pour la Semaine ${wk}`}
            >
              <span>Notif S{wk}</span>
            </Button>
          ))}
        </div>
      </div>

      {notificationStatus.type !== "idle" && notificationStatus.message && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            notificationStatus.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-200"
              : notificationStatus.type === "error"
              ? "bg-rose-500/15 border-rose-500/30 text-rose-200"
              : "bg-blue-500/15 border-blue-500/30 text-blue-200"
          }`}
        >
          {notificationStatus.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Clock className="w-4 h-4 text-blue-400 shrink-0 animate-spin" />
          )}
          <span>{notificationStatus.message}</span>
        </div>
      )}

      {/* PILIERS ÉDITORIAUX MENSUELS (ACCORDÉON COMPACT) */}
      {plan && plan.themes.length > 0 && (
        <div className="rounded-2xl bg-neutral-900/40 border border-neutral-800/80 p-4 space-y-3">
          <div
            onClick={() => setShowThemes(!showThemes)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-200 group-hover:text-purple-300 transition-colors">
                🏛️ Les 4 Piliers Stratégiques du Mois
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">
                {plan.themes.length} thèmes
              </span>
            </div>
            <span className="text-xs text-neutral-500 group-hover:text-neutral-300 flex items-center gap-1">
              {showThemes ? "Réduire" : "Afficher"}
              {showThemes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </div>

          {showThemes && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {plan.themes.map((th) => (
                <div
                  key={th.id}
                  className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 hover:border-neutral-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 font-semibold">
                      {th.pillar}
                    </span>
                    <h5 className="text-xs font-bold text-neutral-200 mt-2 line-clamp-1">{th.title}</h5>
                    <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                      {th.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SÉLECTEUR D'ONGLETS PAR SEMAINE */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSelectedWeek("ALL")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            selectedWeek === "ALL"
              ? "bg-purple-600 text-white shadow-md"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Vue Complète ({plan?.publications.length || 0})
        </button>

        {[1, 2, 3, 4].map((wk) => {
          const countInWeek = plan?.publications.filter((p) => p.week === wk).length || 0;
          return (
            <button
              key={wk}
              type="button"
              onClick={() => setSelectedWeek(wk)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedWeek === wk
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
              }`}
            >
              <span>Semaine {wk}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  selectedWeek === wk
                    ? "bg-purple-900 text-purple-200"
                    : "bg-neutral-800 text-neutral-400"
                }`}
              >
                {countInWeek} pub{countInWeek > 1 ? "s" : ""}
              </span>
            </button>
          );
        })}
      </div>

      {/* LISTE DES PUBLICATIONS PROPOSÉES */}
      <div className="space-y-3.5">
        {filteredPublications.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800/60 text-neutral-400 text-xs">
            Aucune publication générée pour cette semaine. Cliquez sur "Régénérer" ci-dessus.
          </div>
        ) : (
          filteredPublications.map((pub) => {
            const isExpanded = expandedPubId === pub.id;
            const isCreated = createdTaskIds[pub.id] || pub.isCreatedAsTask;
            const isConverting = isConvertingId === pub.id;

            return (
              <div
                key={pub.id}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isCreated
                    ? "bg-neutral-900/40 border-emerald-500/30"
                    : "bg-neutral-900/70 border-neutral-800/90 hover:border-neutral-700 shadow-md"
                }`}
              >
                {/* LIGNE PRINCIPALE DE LA PUBLICATION */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        pub.format === "REEL_9_16"
                          ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                          : pub.format === "CAROUSEL"
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          : "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                      }`}
                    >
                      {pub.format === "REEL_9_16" ? (
                        <Film className="w-4 h-4" />
                      ) : pub.format === "CAROUSEL" ? (
                        <Layers className="w-4 h-4" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                          {pub.weekLabel}
                        </span>

                        {/* Format badge */}
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            pub.format === "REEL_9_16"
                              ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
                              : pub.format === "CAROUSEL"
                              ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                              : "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                          }`}
                        >
                          {pub.format === "REEL_9_16"
                            ? "🎬 Reel 9:16"
                            : pub.format === "CAROUSEL"
                            ? "📑 Carrousel Réseaux"
                            : "🖼️ Maquette Design"}
                        </span>

                        {/* Voix Off badge */}
                        {pub.hasVoiceOver && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                            <Mic className="w-3 h-3 text-purple-400" />
                            Voix Off Incluse
                          </span>
                        )}

                        <span className="text-[11px] text-neutral-400 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-neutral-500" />
                          {pub.daySuggestion}
                        </span>

                        {isCreated && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Tâche créée
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1.5">
                        <h4 className="text-sm font-bold text-neutral-100 leading-snug">
                          {pub.title}
                        </h4>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(pub)}
                          className="text-neutral-400 hover:text-purple-300 transition-colors p-1 rounded-lg hover:bg-neutral-800/80 cursor-pointer shrink-0"
                          title="Modifier manuellement tous les détails de cette publication"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* CHANGEMENT MANUEL DU THÈME */}
                      {editingThemePubId === pub.id ? (
                        <div className="mt-2 p-2.5 rounded-xl bg-neutral-900/90 border border-purple-500/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1">
                              <Target className="w-3.5 h-3.5 text-purple-400" />
                              <span>Modifier le thème / axe éditorial :</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingThemePubId(null)}
                              className="text-neutral-400 hover:text-neutral-200 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Thèmes du client disponibles en un clic */}
                          {plan?.themes && plan.themes.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {plan.themes.map((th) => (
                                <button
                                  key={th.id}
                                  type="button"
                                  onClick={() => handleSaveTheme(pub.id, th.title)}
                                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                                    customThemeValue === th.title
                                      ? "bg-purple-600 text-white border-purple-500 font-bold shadow-sm"
                                      : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700"
                                  }`}
                                >
                                  {th.title}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Saisie personnalisée libre */}
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={customThemeValue}
                              onChange={(e) => setCustomThemeValue(e.target.value)}
                              placeholder="Ou tapez un nouveau thème..."
                              className="flex-1 text-xs bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1 text-neutral-200 focus:outline-none focus:border-purple-500"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSaveTheme(pub.id, customThemeValue);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              type="button"
                              onClick={() => handleSaveTheme(pub.id, customThemeValue)}
                              className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-2.5 py-1 h-auto cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Valider</span>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-purple-300/90 font-medium line-clamp-1">
                            🎯 Axe : {pub.theme}
                          </p>
                          {!isCreated && (
                            <button
                              type="button"
                              onClick={() => handleStartEditTheme(pub)}
                              className="text-[10px] text-neutral-400 hover:text-purple-300 underline inline-flex items-center gap-0.5 cursor-pointer ml-1"
                              title="Modifier manuellement le thème de cette publication"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                              <span>Modifier thème</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Rapides */}
                  <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                    {/* Technicien assigné par défaut */}
                    {!isCreated && (
                      <span
                        className="text-[11px] text-neutral-400 bg-neutral-900/90 border border-neutral-800 px-2 py-1.5 rounded-xl hidden sm:flex items-center gap-1.5 font-medium"
                        title="Assigné automatiquement au technicien"
                      >
                        <Wrench className="w-3 h-3 text-indigo-400" />
                        <span>{defaultTechnician?.name ? defaultTechnician.name.split(" ")[0] : "Technicien"}</span>
                      </span>
                    )}

                    {/* Bouton Modifier tous les détails manuellement */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEditModal(pub)}
                      className="gap-1.5 text-xs border-neutral-700 hover:border-purple-500/60 text-neutral-300 hover:text-purple-300 hover:bg-purple-500/10 cursor-pointer"
                      title="Modifier manuellement tous les détails de cette publication"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                      <span>Modifier détails</span>
                    </Button>

                    {/* Bouton Régénérer le sujet ou le thème */}
                    {!isCreated && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRegenerateSinglePublication(pub)}
                        disabled={regeneratingPubId === pub.id || isPending}
                        className="gap-1.5 text-xs border-purple-500/30 hover:border-purple-500 text-purple-300 hover:bg-purple-500/10 cursor-pointer"
                        title="Régénérer uniquement ce sujet ou ce thème avec l'IA"
                      >
                        <RotateCcw
                          className={`w-3.5 h-3.5 ${
                            regeneratingPubId === pub.id ? "animate-spin text-purple-400" : "text-purple-400"
                          }`}
                        />
                        <span>{regeneratingPubId === pub.id ? "Régénération..." : "Régénérer le sujet"}</span>
                      </Button>
                    )}

                    {/* Bouton Convertir en Tâche */}
                    {isCreated ? (
                      <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>✓ En production ({defaultTechnician?.name ? defaultTechnician.name.split(" ")[0] : "Tech"})</span>
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleConvert(pub)}
                        disabled={isConverting}
                        className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white shadow-md cursor-pointer"
                        title={`Créer la tâche et l'assigner à ${defaultTechnician?.name || "Technicien"}`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isConverting ? "Création..." : "+ Créer la tâche"}</span>
                      </Button>
                    )}

                    {/* Bouton Déplier/Replier */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(pub.id)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
                      title={isExpanded ? "Replier" : "Voir le script détaillé"}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* CONTENU DÉPLIABLE : HOOK, SCRIPT, LÉGENDE */}
                {isExpanded && (
                  <div className="p-4 bg-neutral-950/60 border-t border-neutral-800/80 space-y-4 text-xs">
                    {/* ACCROCHE / HOOK */}
                    <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20">
                      <div className="flex items-center justify-between text-[11px] font-bold text-purple-300 mb-1">
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-purple-400" />
                          <span>Accroche (Hook 0-3s / Slide 1)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(pub)}
                          className="text-[10px] text-neutral-400 hover:text-purple-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
                          title="Modifier l'accroche et les détails"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>Modifier</span>
                        </button>
                      </div>
                      <p className="text-neutral-200 italic font-medium leading-relaxed">
                        {pub.hook}
                      </p>
                    </div>

                    {/* DÉROULÉ VISUEL (SLIDES OU SCÈNES) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                          {pub.format === "REEL_9_16" ? "🎬 Découpage Scènes Reel :" : "📑 Planches du Carrousel :"}
                        </h5>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(pub)}
                          className="text-[10px] text-neutral-400 hover:text-purple-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
                          title="Modifier ou ajouter des scènes/planches"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>Modifier les scènes</span>
                        </button>
                      </div>
                      <div className="space-y-2">
                        {pub.scriptOrSlides.map((step, sIdx) => (
                          <div
                            key={sIdx}
                            className="p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800 flex items-start gap-2.5"
                          >
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-purple-300 font-bold shrink-0">
                              {step.step}
                            </span>
                            <div className="flex-1">
                              <p className="text-neutral-300 text-[11px]">{step.description}</p>
                              {step.visualTip && (
                                <p className="text-[10px] text-neutral-500 mt-1 italic">
                                  💡 Astuce Visuelle : {step.visualTip}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* LÉGENDE & CALL TO ACTION */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-neutral-800">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                            Légende / Caption Proposée :
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(pub)}
                            className="text-[10px] text-neutral-400 hover:text-purple-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
                            title="Modifier le copywriting de la légende"
                          >
                            <Edit3 className="w-2.5 h-2.5" />
                            <span>Modifier</span>
                          </button>
                        </div>
                        <p className="text-[11px] text-neutral-300 bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800 leading-relaxed whitespace-pre-line">
                          {pub.caption}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                              Appel à l'Action (CTA) :
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(pub)}
                              className="text-[10px] text-neutral-400 hover:text-purple-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
                              title="Modifier le CTA"
                            >
                              <Edit3 className="w-2.5 h-2.5" />
                              <span>Modifier</span>
                            </button>
                          </div>
                          <p className="text-[11px] text-purple-300 font-medium bg-purple-950/20 p-2 rounded-lg border border-purple-500/20">
                            {pub.cta}
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                              Hashtags Ciblés :
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(pub)}
                              className="text-[10px] text-neutral-400 hover:text-purple-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
                              title="Modifier les hashtags"
                            >
                              <Edit3 className="w-2.5 h-2.5" />
                              <span>Modifier</span>
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {pub.hashtags.map((h, hIdx) => (
                              <span
                                key={hIdx}
                                className="text-[10px] font-mono text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800"
                              >
                                #{h}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL CONFIGURATION CLÉS IA (GEMINI & CHATGPT) */}
      <Modal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        title="Configuration des Moteurs IA (Gemini & ChatGPT)"
      >
        <div className="space-y-4">
          {/* Statut Global de Connexion ERP */}
          <div className="p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-neutral-200 font-medium">Connexions ERP Actives :</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
                hasServerGeminiKey || geminiApiKey
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-neutral-800 border-neutral-700 text-neutral-400"
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Gemini: {hasServerGeminiKey || geminiApiKey ? "Connecté" : "Non configuré"}
              </span>
              <span className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
                hasServerOpenAiKey || openAiApiKey
                  ? "bg-teal-500/10 border-teal-500/30 text-teal-300"
                  : "bg-neutral-800 border-neutral-700 text-neutral-400"
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                ChatGPT: {hasServerOpenAiKey || openAiApiKey ? "Connecté" : "Non configuré"}
              </span>
            </div>
          </div>

          {/* Navigation Onglets */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-950 border border-neutral-800 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveKeyTab("GEMINI")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeKeyTab === "GEMINI"
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Google Gemini</span>
              {(hasServerGeminiKey || geminiApiKey) && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveKeyTab("OPENAI")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeKeyTab === "OPENAI"
                  ? "bg-teal-600 text-white shadow-md"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>OpenAI ChatGPT</span>
              {(hasServerOpenAiKey || openAiApiKey) && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
          </div>

          {keySaveMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 shrink-0" />
              <span>{keySaveMessage}</span>
            </div>
          )}

          {/* ONGLET 1 : GOOGLE GEMINI */}
          {activeKeyTab === "GEMINI" && (
            <form onSubmit={handleSaveGeminiKey} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-purple-300">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Moteur Google Gemini (Recommandé & Rapide)</span>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  Utilise les modèles <code className="text-purple-300 bg-purple-950/60 px-1 py-0.5 rounded">gemini-flash-lite-latest</code> avec basculement automatique sur <code className="text-purple-300 bg-purple-950/60 px-1 py-0.5 rounded">gemini-flash-latest</code>. Idéal pour des propositions riches et illimitées.
                </p>
                <p className="text-[10px] text-purple-400">
                  Clé API gratuite disponible en 30 secondes sur{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-bold text-purple-300 hover:text-white inline-flex items-center gap-1"
                  >
                    Google AI Studio <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-neutral-300">
                    Clé API Google Gemini (GEMINI_API_KEY)
                  </label>
                  {maskedGeminiKey && (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Serveur: {maskedGeminiKey}
                    </span>
                  )}
                </div>
                <Input
                  type="password"
                  placeholder="AIzaSy... ou AQ.Ab8RN6..."
                  value={geminiInputValue}
                  onChange={(e) => setGeminiInputValue(e.target.value)}
                  className="text-xs font-mono"
                />
                <p className="text-[10px] text-neutral-500 mt-1">
                  Sauvegardée dans le fichier <code className="text-neutral-400">.env</code> du serveur et dans votre navigateur.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsKeyModalOpen(false)}
                  className="cursor-pointer"
                >
                  Fermer
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="bg-purple-600 hover:bg-purple-500 text-white cursor-pointer"
                >
                  {isPending ? "Activation..." : "Enregistrer & Activer Gemini"}
                </Button>
              </div>
            </form>
          )}

          {/* ONGLET 2 : OPENAI CHATGPT */}
          {activeKeyTab === "OPENAI" && (
            <form onSubmit={handleSaveOpenAiKey} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-teal-950/20 border border-teal-500/30 text-xs text-teal-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-teal-300">
                  <Bot className="w-4 h-4 text-teal-400" />
                  <span>Moteur OpenAI ChatGPT (GPT-4o / GPT-4o-mini)</span>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  Génère le plan éditorial via l'API OpenAI officielle avec les modèles <code className="text-teal-300 bg-teal-950/60 px-1 py-0.5 rounded">gpt-4o-mini</code> et <code className="text-teal-300 bg-teal-950/60 px-1 py-0.5 rounded">gpt-4o</code> en format JSON structuré.
                </p>
                <p className="text-[10px] text-teal-400">
                  Obtenez votre clé API OpenAI sur{" "}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-bold text-teal-300 hover:text-white inline-flex items-center gap-1"
                  >
                    platform.openai.com/api-keys <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-neutral-300">
                    Clé API OpenAI ChatGPT (OPENAI_API_KEY)
                  </label>
                  {maskedOpenAiKey && (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Serveur: {maskedOpenAiKey}
                    </span>
                  )}
                </div>
                <Input
                  type="password"
                  placeholder="sk-proj-..."
                  value={openAiInputValue}
                  onChange={(e) => setOpenAiInputValue(e.target.value)}
                  className="text-xs font-mono"
                />
                <p className="text-[10px] text-neutral-500 mt-1">
                  Sauvegardée dans le fichier <code className="text-neutral-400">.env</code> (OPENAI_API_KEY) et dans votre navigateur.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsKeyModalOpen(false)}
                  className="cursor-pointer"
                >
                  Fermer
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
                >
                  {isPending ? "Activation..." : "Enregistrer & Activer ChatGPT"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* MODAL CONFIGURATION RÉSEAUX SOCIAUX CLIENT */}
      <Modal
        isOpen={isSocialModalOpen}
        onClose={() => setIsSocialModalOpen(false)}
        title="Réseaux Sociaux & Informations du Client pour l'IA"
      >
        <form onSubmit={handleSaveSocial} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-purple-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Personnalisation avancée IA (Gemini & ChatGPT)</span>
            </p>
            <p className="text-[11px] text-neutral-300 leading-relaxed">
              Ces données sont transmises directement à Gemini et ChatGPT pour adapter les formats de posts, le ton des légendes, les hashtags et les appels à l'action aux canaux réels de votre client.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Compte Instagram (@compte ou lien)
            </label>
            <Input
              type="text"
              placeholder="@nom_compte ou https://instagram.com/..."
              value={socialForm.instagram}
              onChange={(e) => setSocialForm({ ...socialForm, instagram: e.target.value })}
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Page Facebook (nom ou lien)
            </label>
            <Input
              type="text"
              placeholder="Nom de la page ou https://facebook.com/..."
              value={socialForm.facebook}
              onChange={(e) => setSocialForm({ ...socialForm, facebook: e.target.value })}
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Compte TikTok (@compte ou lien)
            </label>
            <Input
              type="text"
              placeholder="@nom_compte ou https://tiktok.com/@..."
              value={socialForm.tiktok || ""}
              onChange={(e) => setSocialForm({ ...socialForm, tiktok: e.target.value })}
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Numéro de Contact WhatsApp / Téléphone
            </label>
            <Input
              type="text"
              placeholder="0550 00 00 00"
              value={socialForm.phone}
              onChange={(e) => setSocialForm({ ...socialForm, phone: e.target.value })}
              className="text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Directives & Spécificités Client (produits phares, style, cible)
            </label>
            <textarea
              rows={3}
              placeholder="Ex: Mettre en valeur les spécialités faites maison, cibler les familles et les jeunes, livraison rapide à Alger..."
              value={socialForm.notes}
              onChange={(e) => setSocialForm({ ...socialForm, notes: e.target.value })}
              className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-neutral-200 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSocialModalOpen(false)}
              className="cursor-pointer"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="bg-purple-600 hover:bg-purple-500 text-white cursor-pointer"
            >
              {isPending ? "Enregistrement..." : "Enregistrer & Régénérer avec l'IA"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL DE MODIFICATION COMPLÈTE DE TOUS LES DÉTAILS D'UNE PUBLICATION */}
      <Modal
        isOpen={isEditModalOpen && Boolean(editingPub)}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingPub(null);
        }}
        title="Modifier manuellement la publication"
        description="Personnalisez tous les détails : titre, axe, format, planning, accroche, scènes/planches, légende, CTA et hashtags."
        maxWidth="3xl"
      >
        {editingPub && (
          <form onSubmit={handleSavePublicationDetails} className="space-y-4">
            {/* 1. TITRE DE LA PUBLICATION */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-200 flex items-center justify-between">
                <span>Titre principal de la publication</span>
                <span className="text-[10px] text-neutral-500 font-normal">Obligatoire</span>
              </label>
              <Input
                type="text"
                value={editingPub.title}
                onChange={(e) => setEditingPub({ ...editingPub, title: e.target.value })}
                placeholder="ex: Le tartre invisible : Ce qui se cache vraiment derrière vos gencives..."
                className="w-full text-xs font-bold text-neutral-100 bg-neutral-950 border-neutral-800"
                required
              />
            </div>

            {/* 2. AXE ÉDITORIAL & THÈME */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-purple-400" />
                <span>Axe Stratégique / Thème</span>
              </label>
              <div className="space-y-2">
                {plan?.themes && plan.themes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {plan.themes.map((th) => (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => setEditingPub({ ...editingPub, theme: th.title })}
                        className={`text-[10px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                          editingPub.theme === th.title
                            ? "bg-purple-600 text-white border-purple-500 font-bold shadow-sm"
                            : "bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border-neutral-800"
                        }`}
                      >
                        {th.title}
                      </button>
                    ))}
                  </div>
                )}
                <Input
                  type="text"
                  value={editingPub.theme}
                  onChange={(e) => setEditingPub({ ...editingPub, theme: e.target.value })}
                  placeholder="Ou tapez un thème personnalisé..."
                  className="w-full text-xs bg-neutral-950 border-neutral-800 text-neutral-200"
                  required
                />
              </div>
            </div>

            {/* 3. FORMAT, SEMAINE & PLANNING */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* FORMAT */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Format</label>
                <select
                  value={editingPub.format}
                  onChange={(e) => {
                    const newFormat = e.target.value as PublicationProposal["format"];
                    let newLabel = "Maquette Design";
                    if (newFormat === "REEL_9_16") newLabel = "Reel Vidéo";
                    else if (newFormat === "CAROUSEL") newLabel = "Carrousel Multi-Planches";
                    else if (newFormat === "STATIC_POST") newLabel = "Maquette Design";
                    else if (newFormat === "STORY_INTERACTIVE") newLabel = "Story Interactive";
                    setEditingPub({ ...editingPub, format: newFormat, formatLabel: newLabel });
                  }}
                  className="w-full h-9 px-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="STATIC_POST">🖼️ Maquette Design / Post</option>
                  <option value="REEL_9_16">🎬 Reel Vidéo (9:16)</option>
                  <option value="CAROUSEL">📑 Carrousel Multi-Planches</option>
                  <option value="STORY_INTERACTIVE">📱 Story Interactive</option>
                </select>
              </div>

              {/* SEMAINE */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Semaine</label>
                <select
                  value={editingPub.week}
                  onChange={(e) => {
                    const w = Number(e.target.value);
                    setEditingPub({ ...editingPub, week: w, weekLabel: `Semaine ${w}/4` });
                  }}
                  className="w-full h-9 px-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value={1}>Semaine 1 (Semaine 1/4)</option>
                  <option value={2}>Semaine 2 (Semaine 2/4)</option>
                  <option value={3}>Semaine 3 (Semaine 3/4)</option>
                  <option value={4}>Semaine 4 (Semaine 4/4)</option>
                </select>
              </div>

              {/* JOUR & HEURE */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Jour & Heure</label>
                <Input
                  type="text"
                  value={editingPub.daySuggestion}
                  onChange={(e) => setEditingPub({ ...editingPub, daySuggestion: e.target.value })}
                  placeholder="ex: Mardi (18h)"
                  className="h-9 text-xs bg-neutral-950 border-neutral-800 text-neutral-200 font-mono"
                />
              </div>
            </div>

            {/* 4. ACCROCHE / HOOK */}
            <div className="space-y-1.5 p-3 rounded-xl bg-purple-950/20 border border-purple-500/20">
              <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                <span>Accroche (Hook 0-3s / Slide 1)</span>
              </label>
              <textarea
                value={editingPub.hook}
                onChange={(e) => setEditingPub({ ...editingPub, hook: e.target.value })}
                rows={2}
                placeholder="ex: Tu penses que tes dents sont propres juste parce qu'elles sont blanches ? Grosse erreur ! 🔴"
                className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-purple-500 italic leading-relaxed"
              />
            </div>

            {/* 5. SCÈNES OU PLANCHES */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>
                    {editingPub.format === "REEL_9_16" ? "Scènes du Reel" : "Planches du Carrousel"} ({editingPub.scriptOrSlides.length})
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handleAddSlide}
                  className="text-xs text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Ajouter une {editingPub.format === "REEL_9_16" ? "scène" : "planche"}</span>
                </button>
              </div>

              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {editingPub.scriptOrSlides.map((step, sIdx) => (
                  <div
                    key={sIdx}
                    className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/90 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={step.step}
                        onChange={(e) => handleUpdateSlide(sIdx, "step", e.target.value)}
                        placeholder="Étape / Scène"
                        className="w-28 text-[11px] font-mono font-bold bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-purple-300 focus:outline-none focus:border-purple-500"
                      />
                      {editingPub.scriptOrSlides.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSlide(sIdx)}
                          className="text-neutral-500 hover:text-rose-400 p-1 rounded-md hover:bg-neutral-900 transition-colors cursor-pointer"
                          title="Supprimer cette étape"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <textarea
                      value={step.description}
                      onChange={(e) => handleUpdateSlide(sIdx, "description", e.target.value)}
                      rows={2}
                      placeholder="Description visuelle ou script audio de cette scène..."
                      className="w-full text-xs bg-neutral-900/80 border border-neutral-800 rounded-lg p-2 text-neutral-200 focus:outline-none focus:border-purple-500 leading-relaxed"
                    />

                    <input
                      type="text"
                      value={step.visualTip || ""}
                      onChange={(e) => handleUpdateSlide(sIdx, "visualTip", e.target.value)}
                      placeholder="💡 Astuce Visuelle (ex: Zoom dynamique, fond médical, logo Draria...)"
                      className="w-full text-[11px] bg-neutral-900/60 border border-neutral-800/80 rounded-lg px-2.5 py-1 text-neutral-400 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 6. LÉGENDE & CTA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-neutral-800">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">
                  Légende / Caption Proposée
                </label>
                <textarea
                  value={editingPub.caption}
                  onChange={(e) => setEditingPub({ ...editingPub, caption: e.target.value })}
                  rows={6}
                  placeholder="Texte complet de la publication..."
                  className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-neutral-200 focus:outline-none focus:border-purple-500 leading-relaxed custom-scrollbar"
                />
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-purple-300">
                    Appel à l'Action (CTA)
                  </label>
                  <textarea
                    value={editingPub.cta}
                    onChange={(e) => setEditingPub({ ...editingPub, cta: e.target.value })}
                    rows={2}
                    placeholder="ex: Écris 'TARTRE' en commentaire ou contacte-nous sur WhatsApp au 0552535541 !"
                    className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-neutral-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">
                    Hashtags Ciblés
                  </label>
                  <input
                    type="text"
                    value={Array.isArray(editingPub.hashtags) ? editingPub.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(" ") : ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const tags = raw.split(/[\s,]+/).map(t => t.replace(/^#/, "").trim()).filter(Boolean);
                      setEditingPub({ ...editingPub, hashtags: tags });
                    }}
                    placeholder="#dentalcenterdraria #dentistedraria #detartrage..."
                    className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-purple-500 font-mono"
                  />
                  <p className="text-[10px] text-neutral-500">
                    Séparez par un espace ou une virgule. Le préfixe # est automatique.
                  </p>
                </div>
              </div>
            </div>

            {/* BOUTONS D'ACTION */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-neutral-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingPub(null);
                }}
                disabled={isSavingPubDetails}
                className="cursor-pointer"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingPubDetails}
                className="gap-1.5 bg-purple-600 hover:bg-purple-500 text-white cursor-pointer shadow-md"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingPubDetails ? "Enregistrement..." : "Enregistrer toutes les modifications"}</span>
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
