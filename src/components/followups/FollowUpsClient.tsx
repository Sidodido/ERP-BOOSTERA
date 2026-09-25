"use client";

import React, { useState, useEffect, useMemo } from "react";
import { FOLLOWUP_STATUSES } from "@/lib/constants";
import { FollowUpStatus, CallResult } from "@prisma/client";
import { formatDate, toLocalDateString, buildWhatsAppUrl } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/common/WhatsAppIcon";
import { trackCommunicationClick } from "@/lib/tracking";
import {
  processFollowUpAction,
  rescheduleFollowUpAction,
  logFollowUpCallAction,
  updateFollowUpRemarksAndNotesAction,
} from "@/actions/followups";
import { updateProspectField } from "@/actions/prospects";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Building,
  Phone,
  PhoneCall,
  Plus,
  LayoutGrid,
  List,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCw,
  AlertTriangle,
  User,
  Sparkles,
  Edit3,
  SlidersHorizontal,
  Filter,
  X,
  MessageSquare,
  RotateCcw,
  Tag,
  ChevronDown,
  Check,
} from "lucide-react";

interface FollowUpItem {
  id: string;
  stepNumber: number;
  scheduledAt: Date;
  status: FollowUpStatus;
  notes: string | null;
  completedAt: Date | null;
  prospect: {
    id: string;
    companyName: string;
    contactName: string | null;
    phone: string;
    sector: string;
    wilaya: string;
    address?: string | null;
    notes?: string | null;
    response?: string | null;
    rawState?: string | null;
    callStatus?: string | null;
  };
  user: { id: string; name: string };
}

interface Props {
  initialFollowUps: FollowUpItem[];
}

export function FollowUpsClient({ initialFollowUps }: Props) {
  const [followUps, setFollowUps] = useState<FollowUpItem[]>(initialFollowUps);
  const [viewMode, setViewMode] = useState<"cards" | "list">("list");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("crm_followups_view_mode");
      if (saved === "cards" || saved === "list") {
        setViewMode(saved);
      } else if (typeof window !== "undefined" && window.innerWidth < 768) {
        setViewMode("cards");
      }
    } catch {}
  }, []);

  const handleSetViewMode = (mode: "cards" | "list") => {
    setViewMode(mode);
    try {
      localStorage.setItem("crm_followups_view_mode", mode);
    } catch {}
  };

  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Filtres avancés supplémentaires
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterCommercial, setFilterCommercial] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterCallStatus, setFilterCallStatus] = useState<string>("ALL");
  const [filterRawState, setFilterRawState] = useState<string>("ALL");
  const [filterStep, setFilterStep] = useState<string>("ALL");
  const [filterWilaya, setFilterWilaya] = useState<string>("ALL");
  const [filterHasRemarks, setFilterHasRemarks] = useState<string>("ALL"); // "ALL" | "WITH" | "WITHOUT"

  // Modale d'édition des Remarques et Réponses
  const [remarksModalOpen, setRemarksModalOpen] = useState(false);
  const [targetRemarksItem, setTargetRemarksItem] = useState<FollowUpItem | null>(null);
  const [editProspectNotes, setEditProspectNotes] = useState("");
  const [editProspectResponse, setEditProspectResponse] = useState("");
  const [editFollowUpNotes, setEditFollowUpNotes] = useState("");
  const [isSavingRemarks, setIsSavingRemarks] = useState(false);
  const [remarksError, setRemarksError] = useState<string | null>(null);

  // Options uniques pour les filtres
  const availableCommercials = useMemo(() => {
    const map = new Map<string, string>();
    followUps.forEach((f) => {
      if (f.user?.id) {
        map.set(f.user.id, f.user.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [followUps]);

  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    followUps.forEach((f) => {
      if (f.prospect.sector && f.prospect.sector.trim()) {
        set.add(f.prospect.sector.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }, [followUps]);

  const availableWilayas = useMemo(() => {
    const set = new Set<string>();
    followUps.forEach((f) => {
      if (f.prospect.wilaya && f.prospect.wilaya.trim()) {
        set.add(f.prospect.wilaya.trim());
      }
    });
    return Array.from(set).sort();
  }, [followUps]);

  const activeExtraFiltersCount = useMemo(() => {
    let count = 0;
    if (filterCommercial !== "ALL") count++;
    if (filterType !== "ALL") count++;
    if (filterCallStatus !== "ALL") count++;
    if (filterRawState !== "ALL") count++;
    if (filterStep !== "ALL") count++;
    if (filterWilaya !== "ALL") count++;
    if (filterHasRemarks !== "ALL") count++;
    return count;
  }, [filterCommercial, filterType, filterCallStatus, filterRawState, filterStep, filterWilaya, filterHasRemarks]);

  const resetAllFilters = () => {
    setSelectedFilter("ALL");
    setSearch("");
    setFilterCommercial("ALL");
    setFilterType("ALL");
    setFilterCallStatus("ALL");
    setFilterRawState("ALL");
    setFilterStep("ALL");
    setFilterWilaya("ALL");
    setFilterHasRemarks("ALL");
    setCurrentPage(1);
  };

  // Reschedule Follow-up Modal State
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [targetFollowUp, setTargetFollowUp] = useState<FollowUpItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleNotes, setRescheduleNotes] = useState("");
  const [rescheduleBase, setRescheduleBase] = useState<"today" | "initial">("today");
  const [modalError, setModalError] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Call Modal State (+ APPEL)
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callTargetFollowUp, setCallTargetFollowUp] = useState<FollowUpItem | null>(null);
  const [callResult, setCallResult] = useState<CallResult>(CallResult.INTERESTED);
  const [callComment, setCallComment] = useState("");
  const [callDuration, setCallDuration] = useState("60");
  const [isLoggingCall, setIsLoggingCall] = useState(false);

  const now = new Date();
  const todayStr = toLocalDateString(now);

  // Open Remarks Modal
  const openRemarksModal = (item: FollowUpItem) => {
    setTargetRemarksItem(item);
    setEditProspectNotes(item.prospect.notes || "");
    setEditProspectResponse(item.prospect.response || "");
    setEditFollowUpNotes(item.notes && !item.notes.startsWith("Relance Étape") ? item.notes : "");
    setRemarksError(null);
    setRemarksModalOpen(true);
  };

  // Save Remarks & Response Handler
  const handleSaveRemarksSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRemarksItem) return;

    setIsSavingRemarks(true);
    setRemarksError(null);

    const newProspectNotes = editProspectNotes.trim() || null;
    const newProspectResponse = editProspectResponse.trim() || null;
    const newFollowUpNotes = editFollowUpNotes.trim() || null;

    // Optimistic UI Update
    setFollowUps((prev) =>
      prev.map((f) =>
        f.id === targetRemarksItem.id
          ? {
              ...f,
              notes: newFollowUpNotes || f.notes,
              prospect: {
                ...f.prospect,
                notes: newProspectNotes,
                response: newProspectResponse,
              },
            }
          : f.prospect.id === targetRemarksItem.prospect.id
          ? {
              ...f,
              prospect: {
                ...f.prospect,
                notes: newProspectNotes,
                response: newProspectResponse,
              },
            }
          : f
      )
    );

    try {
      const res = await updateFollowUpRemarksAndNotesAction({
        followUpId: targetRemarksItem.id,
        prospectId: targetRemarksItem.prospect.id,
        notes: newProspectNotes,
        response: newProspectResponse,
        followUpNotes: newFollowUpNotes,
      });

      if (res.success) {
        setFeedbackMessage({
          type: "success",
          text: `✓ Remarques et réponses pour "${targetRemarksItem.prospect.companyName}" enregistrées avec succès.`,
        });
        setRemarksModalOpen(false);
        setTargetRemarksItem(null);
      }
    } catch (err: any) {
      setRemarksError(err?.message || "Erreur lors de l'enregistrement des remarques.");
    } finally {
      setIsSavingRemarks(false);
    }
  };

  // Filtered follow-ups
  const filtered = followUps.filter((f) => {
    // 1. Status Filter
    if (selectedFilter === "TODAY") {
      const scheduledDateStr = toLocalDateString(f.scheduledAt);
      if (scheduledDateStr !== todayStr || f.status !== "SCHEDULED") return false;
    } else if (selectedFilter === "OVERDUE") {
      const isOverdue = new Date(f.scheduledAt) < now && f.status === "SCHEDULED";
      if (!isOverdue) return false;
    } else if (selectedFilter === "SCHEDULED") {
      if (f.status !== "SCHEDULED") return false;
    } else if (selectedFilter === "COMPLETED") {
      if (f.status !== "COMPLETED" && f.status !== "CONVERTED" && f.status !== "LOST") return false;
    }

    // 2. Commercial Filter
    if (filterCommercial !== "ALL" && f.user.id !== filterCommercial) {
      return false;
    }

    // 2b. Type (Secteur d'activité) Filter
    if (filterType !== "ALL") {
      if (filterType === "VIDE") {
        if (f.prospect.sector && f.prospect.sector.trim()) return false;
      } else if (f.prospect.sector !== filterType) {
        return false;
      }
    }

    // 3. Statut d'appel (APPEL)
    if (filterCallStatus !== "ALL") {
      if (filterCallStatus === "VIDE") {
        if (f.prospect.callStatus && f.prospect.callStatus.trim()) return false;
      } else if (f.prospect.callStatus !== filterCallStatus) {
        return false;
      }
    }

    // 4. Résultat d'appel (RÉSULTAT D'APPEL / RAW STATE)
    if (filterRawState !== "ALL") {
      if (filterRawState === "VIDE") {
        if (f.prospect.rawState && f.prospect.rawState.trim()) return false;
      } else if (f.prospect.rawState !== filterRawState) {
        return false;
      }
    }

    // 5. Étape de relance
    if (filterStep !== "ALL") {
      if (filterStep === "4_PLUS") {
        if (f.stepNumber < 4) return false;
      } else if (f.stepNumber !== Number(filterStep)) {
        return false;
      }
    }

    // 6. Wilaya
    if (filterWilaya !== "ALL" && f.prospect.wilaya !== filterWilaya) {
      return false;
    }

    // 7. Présence de remarques / réponses
    if (filterHasRemarks === "WITH") {
      const hasAny = Boolean(
        (f.prospect.notes && f.prospect.notes.trim()) ||
        (f.prospect.response && f.prospect.response.trim()) ||
        (f.notes && f.notes.trim() && !f.notes.startsWith("Relance Étape"))
      );
      if (!hasAny) return false;
    } else if (filterHasRemarks === "WITHOUT") {
      const hasAny = Boolean(
        (f.prospect.notes && f.prospect.notes.trim()) ||
        (f.prospect.response && f.prospect.response.trim()) ||
        (f.notes && f.notes.trim() && !f.notes.startsWith("Relance Étape"))
      );
      if (hasAny) return false;
    }

    // 8. Recherche texte
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      f.prospect.companyName.toLowerCase().includes(q) ||
      (f.prospect.contactName && f.prospect.contactName.toLowerCase().includes(q)) ||
      f.prospect.phone.includes(q) ||
      f.prospect.sector.toLowerCase().includes(q) ||
      f.prospect.wilaya.toLowerCase().includes(q) ||
      f.user.name.toLowerCase().includes(q) ||
      (f.notes && f.notes.toLowerCase().includes(q)) ||
      (f.prospect.notes && f.prospect.notes.toLowerCase().includes(q)) ||
      (f.prospect.response && f.prospect.response.toLowerCase().includes(q))
    );
  });

  // Client Pagination (50 par page par défaut pour des performances instantanées)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(50);

  // Revenir à la première page quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    selectedFilter,
    filterCommercial,
    filterType,
    filterCallStatus,
    filterRawState,
    filterStep,
    filterWilaya,
    filterHasRemarks,
  ]);

  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedFollowUps = useMemo(() => {
    if (pageSize === "all") return filtered;
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // KPI calculations
  const totalCount = followUps.length;
  const todayCount = followUps.filter(
    (f) => toLocalDateString(f.scheduledAt) === todayStr && f.status === "SCHEDULED"
  ).length;
  const overdueCount = followUps.filter(
    (f) => new Date(f.scheduledAt) < now && f.status === "SCHEDULED"
  ).length;
  const completedCount = followUps.filter(
    (f) => f.status === "COMPLETED" || f.status === "CONVERTED" || f.status === "LOST"
  ).length;

  // Handle the actions: NOT_INTERESTED, INTERESTED (+3j), RETRY (+7j), RETRY_15 (+15j)
  const handleProcess = async (
    followUpId: string,
    decision: "NOT_INTERESTED" | "INTERESTED" | "RETRY" | "RETRY_15"
  ) => {
    setLoadingId(followUpId);
    setFeedbackMessage(null);

    // Optimistic status update
    setFollowUps((prev) =>
      prev.map((item) =>
        item.id === followUpId
          ? {
              ...item,
              status: decision === "NOT_INTERESTED" ? FollowUpStatus.LOST : FollowUpStatus.COMPLETED,
              completedAt: new Date(),
              notes:
                decision === "NOT_INTERESTED"
                  ? "Prospect non intéressé"
                  : decision === "INTERESTED"
                  ? "Intéressé (Relance J+3)"
                  : decision === "RETRY_15"
                  ? "À relancer (J+15)"
                  : "À relancer (J+7)",
            }
          : item
      )
    );

    try {
      const res = await processFollowUpAction({
        followUpId,
        decision,
      });

      if (res.success) {
        setFeedbackMessage({
          type: "success",
          text: res.message,
        });

        // If a next follow-up was automatically scheduled (+3j or +7j), append it optimistically!
        if (res.nextFollowUp) {
          const currentItem = followUps.find((f) => f.id === followUpId);
          if (currentItem) {
            const newFollowUpItem: FollowUpItem = {
              id: res.nextFollowUp.id,
              stepNumber: res.nextFollowUp.stepNumber,
              scheduledAt: new Date(res.nextFollowUp.scheduledAt),
              status: FollowUpStatus.SCHEDULED,
              notes: res.nextFollowUp.notes,
              completedAt: null,
              prospect: currentItem.prospect,
              user: currentItem.user,
            };
            setFollowUps((prev) => [...prev, newFollowUpItem]);
          }
        }
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Erreur lors du traitement de la relance.",
      });
    } finally {
      setLoadingId(null);
    }
  };

  const openRescheduleModal = (item: FollowUpItem) => {
    setTargetFollowUp(item);
    setModalError(null);
    const itemDate = new Date(item.scheduledAt);
    const isFuture = !isNaN(itemDate.getTime()) && itemDate > now;
    const defaultBase: "today" | "initial" = isFuture ? "initial" : "today";
    setRescheduleBase(defaultBase);

    const baseDate = defaultBase === "initial" ? itemDate : new Date();
    const nextDay = new Date(baseDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const targetStr = toLocalDateString(nextDay);
    setRescheduleDate(targetStr);
    setRescheduleNotes(item.notes || `Relance reportée au ${formatDate(nextDay)} (+1j)`);
    setRescheduleModalOpen(true);
  };

  const openCallModal = (item: FollowUpItem) => {
    setCallTargetFollowUp(item);
    setCallResult(CallResult.INTERESTED);
    setCallComment(item.notes || "");
    setCallDuration("60");
    setCallModalOpen(true);
  };

  const handleCallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callTargetFollowUp) return;

    setIsLoggingCall(true);
    try {
      const res = await logFollowUpCallAction({
        followUpId: callTargetFollowUp.id,
        result: callResult,
        comment: callComment,
        durationSeconds: Number(callDuration) || 60,
      });

      if (res.success) {
        setFollowUps((prev) =>
          prev.map((f) =>
            f.id === callTargetFollowUp.id
              ? {
                  ...f,
                  status:
                    callResult === CallResult.NOT_INTERESTED
                      ? FollowUpStatus.LOST
                      : FollowUpStatus.COMPLETED,
                  completedAt: new Date(),
                  notes: callComment || f.notes,
                }
              : f
          )
        );

        if (res.nextFollowUp) {
          const nextItem: FollowUpItem = {
            id: res.nextFollowUp.id,
            stepNumber: res.nextFollowUp.stepNumber,
            scheduledAt: new Date(res.nextFollowUp.scheduledAt),
            status: FollowUpStatus.SCHEDULED,
            notes: res.nextFollowUp.notes,
            completedAt: null,
            prospect: callTargetFollowUp.prospect,
            user: callTargetFollowUp.user,
          };
          setFollowUps((prev) => [...prev, nextItem]);
        }

        setCallModalOpen(false);
        setFeedbackMessage({
          type: "success",
          text: `✓ Appel enregistré avec succès ! Le prospect "${callTargetFollowUp.prospect.companyName}" a été ajouté dans la section Appels.`,
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Erreur lors de l'enregistrement de l'appel.",
      });
    } finally {
      setIsLoggingCall(false);
    }
  };

  const handleQuickAddDays = (days: number, forceBase?: "today" | "initial", executeNow = false) => {
    const baseChoice = forceBase || rescheduleBase;
    let baseDate = new Date();
    if (baseChoice === "initial" && targetFollowUp?.scheduledAt) {
      const dInit = new Date(targetFollowUp.scheduledAt);
      if (!isNaN(dInit.getTime())) {
        baseDate = dInit;
      }
    }
    const target = new Date(baseDate);
    target.setDate(target.getDate() + days);
    const dateStr = toLocalDateString(target);
    setRescheduleDate(dateStr);

    const label = days === 1 ? "Demain (+1j)" : `+${days} jours`;
    const newNote = `Relance reportée de ${days} jour${days > 1 ? "s" : ""} au ${formatDate(target)} (${label})`;
    setRescheduleNotes(newNote);

    if (executeNow) {
      handleExecuteReschedule(dateStr, newNote);
    }
  };

  const handleExecuteReschedule = async (targetDate: string, targetNotes: string) => {
    if (!targetFollowUp || !targetDate) return;

    setIsRescheduling(true);
    setModalError(null);
    setFeedbackMessage(null);
    try {
      const res = await rescheduleFollowUpAction({
        followUpId: targetFollowUp.id,
        scheduledAt: targetDate,
        notes: targetNotes,
      });

      if (res.success) {
        setFollowUps((prev) =>
          prev.map((f) =>
            f.id === targetFollowUp.id
              ? {
                  ...f,
                  scheduledAt: new Date(targetDate),
                  notes: targetNotes || f.notes,
                }
              : f
          )
        );
        setFeedbackMessage({
          type: "success",
          text: `Relance pour ${targetFollowUp.prospect.companyName} reportée avec succès au ${formatDate(targetDate)} et programmée dans le calendrier.`,
        });
        setRescheduleModalOpen(false);
        setTargetFollowUp(null);
      }
    } catch (err: any) {
      setModalError(err?.message || "Erreur lors du report de la relance.");
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleRescheduleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetFollowUp || !rescheduleDate) return;
    await handleExecuteReschedule(rescheduleDate, rescheduleNotes);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with KPIs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
            Moteur des Relances Commerciales
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
              Logique Automatisée (J+3, J+7)
            </span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Traitez vos relances en 1 clic : marquez comme <strong>Pas intéressé</strong>, <strong>Intéressé (+3 jours)</strong> ou <strong>À relancer (+7 jours)</strong>
          </p>
        </div>

        {/* View Mode Toggle: Liste / Cartes */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex bg-neutral-900 border border-neutral-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => handleSetViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded-lg transition-colors cursor-pointer ${
                viewMode === "list"
                  ? "bg-neutral-800 text-white shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
              title="Affichage en tableau / liste (Défaut)"
            >
              <List className="w-3.5 h-3.5" />
              <span>Vue Liste</span>
            </button>
            <button
              onClick={() => handleSetViewMode("cards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded-lg transition-colors cursor-pointer ${
                viewMode === "cards"
                  ? "bg-neutral-800 text-white shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
              title="Affichage en cartes"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Vue Cartes</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setSelectedFilter("ALL")}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            selectedFilter === "ALL"
              ? "bg-neutral-850 border-neutral-700 shadow-md"
              : "bg-neutral-900/70 border-neutral-800/80 hover:border-neutral-700"
          }`}
        >
          <span className="text-xs text-neutral-400 font-medium">Total Relances</span>
          <p className="text-xl font-bold text-neutral-100 mt-0.5">{totalCount}</p>
        </div>

        <div
          onClick={() => setSelectedFilter("TODAY")}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            selectedFilter === "TODAY"
              ? "bg-blue-950/30 border-blue-500/50 shadow-md"
              : "bg-neutral-900/70 border-neutral-800/80 hover:border-blue-500/30"
          }`}
        >
          <span className="text-xs text-blue-400 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>À faire aujourd'hui</span>
          </span>
          <p className="text-xl font-bold text-blue-400 mt-0.5">{todayCount}</p>
        </div>

        <div
          onClick={() => setSelectedFilter("OVERDUE")}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            selectedFilter === "OVERDUE"
              ? "bg-rose-950/30 border-rose-500/50 shadow-md"
              : "bg-neutral-900/70 border-neutral-800/80 hover:border-rose-500/30"
          }`}
        >
          <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>En retard</span>
          </span>
          <p className="text-xl font-bold text-rose-400 mt-0.5">{overdueCount}</p>
        </div>

        <div
          onClick={() => setSelectedFilter("COMPLETED")}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            selectedFilter === "COMPLETED"
              ? "bg-emerald-950/30 border-emerald-500/50 shadow-md"
              : "bg-neutral-900/70 border-neutral-800/80 hover:border-emerald-500/30"
          }`}
        >
          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Terminées</span>
          </span>
          <p className="text-xl font-bold text-emerald-400 mt-0.5">{completedCount}</p>
        </div>
      </div>

      {/* Filter and Search Control Center */}
      <div className="space-y-3 bg-neutral-900/80 border border-neutral-800 p-3 rounded-2xl shadow-md">
        {/* Main Bar */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher entreprise, contact, tél, remarques..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-8 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                title="Effacer la recherche"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Status Buttons & Filter Toggles */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto text-xs pb-1 lg:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedFilter("ALL")}
              className={`px-3 py-1.5 font-semibold rounded-xl transition-colors shrink-0 cursor-pointer ${
                selectedFilter === "ALL"
                  ? "bg-neutral-800 text-white shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Toutes ({followUps.length})
            </button>
            <button
              onClick={() => setSelectedFilter("TODAY")}
              className={`px-3 py-1.5 font-semibold rounded-xl transition-colors shrink-0 cursor-pointer ${
                selectedFilter === "TODAY"
                  ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                  : "text-neutral-400 hover:text-blue-400"
              }`}
            >
              Aujourd'hui ({todayCount})
            </button>
            <button
              onClick={() => setSelectedFilter("OVERDUE")}
              className={`px-3 py-1.5 font-semibold rounded-xl transition-colors shrink-0 cursor-pointer ${
                selectedFilter === "OVERDUE"
                  ? "bg-rose-500/30 text-rose-300 border border-rose-500/40"
                  : "text-neutral-400 hover:text-rose-400"
              }`}
            >
              En retard ({overdueCount})
            </button>
            <button
              onClick={() => setSelectedFilter("SCHEDULED")}
              className={`px-3 py-1.5 font-semibold rounded-xl transition-colors shrink-0 cursor-pointer ${
                selectedFilter === "SCHEDULED"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "text-neutral-400 hover:text-amber-400"
              }`}
            >
              À venir
            </button>
            <button
              onClick={() => setSelectedFilter("COMPLETED")}
              className={`px-3 py-1.5 font-semibold rounded-xl transition-colors shrink-0 cursor-pointer ${
                selectedFilter === "COMPLETED"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-neutral-400 hover:text-emerald-400"
              }`}
            >
              Terminées ({completedCount})
            </button>

            {/* Toggle Advanced Filters Button */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded-xl border transition-all cursor-pointer shrink-0 ml-1 ${
                showAdvancedFilters || activeExtraFiltersCount > 0
                  ? "bg-blue-600/25 text-blue-300 border-blue-500/50 shadow-xs"
                  : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200"
              }`}
              title="Options de filtres par commercial, statut d'appel, résultat, étape, wilaya, remarques"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtres</span>
              {activeExtraFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-500 text-neutral-950 text-[10px] font-extrabold flex items-center justify-center">
                  {activeExtraFiltersCount}
                </span>
              )}
            </button>

            {/* Reset All Filters Button */}
            {(activeExtraFiltersCount > 0 || search || selectedFilter !== "ALL") && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-neutral-950 hover:bg-rose-500/10 text-neutral-400 hover:text-rose-400 border border-neutral-800 hover:border-rose-500/30 text-xs transition-colors cursor-pointer shrink-0"
                title="Réinitialiser tous les filtres"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Effacer ({filtered.length}/{followUps.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Panneau de filtres avancés (Déroulable) */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-neutral-800/80 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
            {/* 1. Commercial */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Commercial :
              </label>
              <select
                value={filterCommercial}
                onChange={(e) => setFilterCommercial(e.target.value)}
                className={`w-full h-8 px-2 bg-neutral-950 border rounded-lg text-xs focus:outline-none focus:border-blue-500 cursor-pointer ${
                  filterCommercial !== "ALL" ? "border-blue-500/60 text-blue-300 font-semibold" : "border-neutral-800 text-neutral-200"
                }`}
              >
                <option value="ALL">Tous ({availableCommercials.length})</option>
                {availableCommercials.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Type (Secteur d'activité) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Type :
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className={`w-full h-8 px-2 bg-neutral-950 border rounded-lg text-xs focus:outline-none focus:border-blue-500 cursor-pointer ${
                  filterType !== "ALL" ? "border-blue-500/60 text-blue-300 font-semibold" : "border-neutral-800 text-neutral-200"
                }`}
              >
                <option value="ALL">Tous les types ({availableTypes.length})</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Statut d'appel */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Statut Appel :
              </label>
              <select
                value={filterCallStatus}
                onChange={(e) => setFilterCallStatus(e.target.value)}
                className={`w-full h-8 px-2 bg-neutral-950 border rounded-lg text-xs focus:outline-none focus:border-blue-500 cursor-pointer ${
                  filterCallStatus !== "ALL" ? "border-blue-500/60 text-blue-300 font-semibold" : "border-neutral-800 text-neutral-200"
                }`}
              >
                <option value="ALL">Tous les statuts d'appel</option>
                <option value="EFFECTUE">✓ EFFECTUE</option>
                <option value="PAS DE REPONSE">PAS DE REPONSE</option>
                <option value="OCCUPE">OCCUPE</option>
                <option value="INJOIGNABLE">INJOIGNABLE</option>
                <option value="A RAPPELER">A RAPPELER</option>
                <option value="NON EFFECTUE">NON EFFECTUE</option>
                <option value="VIDE">Non renseigné</option>
              </select>
            </div>

            {/* 4. Résultat d'appel */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Résultat d'appel :
              </label>
              <select
                value={filterRawState}
                onChange={(e) => setFilterRawState(e.target.value)}
                className={`w-full h-8 px-2 bg-neutral-950 border rounded-lg text-xs focus:outline-none focus:border-blue-500 cursor-pointer ${
                  filterRawState !== "ALL" ? "border-blue-500/60 text-blue-300 font-semibold" : "border-neutral-800 text-neutral-200"
                }`}
              >
                <option value="ALL">Tous les résultats</option>
                <option value="INTERESSE">INTERESSE</option>
                <option value="RDV PRIS">RDV PRIS</option>
                <option value="A RAPPELER">A RAPPELER</option>
                <option value="PAS INTERESSE">PAS INTERESSE</option>
                <option value="PAS DE REPONSE">PAS DE REPONSE</option>
                <option value="OCCUPE">OCCUPE</option>
                <option value="INJOIGNABLE">INJOIGNABLE</option>
                <option value="VIDE">Non renseigné</option>
              </select>
            </div>

            {/* 5. Étape de relance */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Étape :
              </label>
              <select
                value={filterStep}
                onChange={(e) => setFilterStep(e.target.value)}
                className={`w-full h-8 px-2 bg-neutral-950 border rounded-lg text-xs focus:outline-none focus:border-blue-500 cursor-pointer ${
                  filterStep !== "ALL" ? "border-blue-500/60 text-blue-300 font-semibold" : "border-neutral-800 text-neutral-200"
                }`}
              >
                <option value="ALL">Toutes les étapes</option>
                <option value="1">Étape 1 (Initiale)</option>
                <option value="2">Étape 2 (J+3 / J+7)</option>
                <option value="3">Étape 3</option>
                <option value="4_PLUS">Étape 4+</option>
              </select>
            </div>

            {/* 6. Wilaya */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Wilaya :
              </label>
              <select
                value={filterWilaya}
                onChange={(e) => setFilterWilaya(e.target.value)}
                className={`w-full h-8 px-2 bg-neutral-950 border rounded-lg text-xs focus:outline-none focus:border-blue-500 cursor-pointer ${
                  filterWilaya !== "ALL" ? "border-blue-500/60 text-blue-300 font-semibold" : "border-neutral-800 text-neutral-200"
                }`}
              >
                <option value="ALL">Toutes les wilayas ({availableWilayas.length})</option>
                {availableWilayas.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            {/* 7. Remarques & Réponses */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Remarques & Réponses :
              </label>
              <select
                value={filterHasRemarks}
                onChange={(e) => setFilterHasRemarks(e.target.value)}
                className={`w-full h-8 px-2 bg-neutral-950 border rounded-lg text-xs focus:outline-none focus:border-blue-500 cursor-pointer ${
                  filterHasRemarks !== "ALL" ? "border-amber-500/60 text-amber-300 font-semibold" : "border-neutral-800 text-neutral-200"
                }`}
              >
                <option value="ALL">Toutes (avec ou sans)</option>
                <option value="WITH">💬 Avec remarques / réponses</option>
                <option value="WITHOUT">Sans remarques</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Feedback Alert */}
      {feedbackMessage && (
        <div
          className={`p-3 text-xs rounded-xl font-medium border flex items-center gap-2 ${
            feedbackMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* 1. VUE CARTES */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-neutral-500 bg-neutral-900/40 rounded-2xl border border-neutral-800">
              Aucune relance correspondant au filtre sélectionné.
            </div>
          )}

          {paginatedFollowUps.map((item) => {
            const isOverdue = new Date(item.scheduledAt) < now && item.status === "SCHEDULED";
            const isToday = toLocalDateString(item.scheduledAt) === todayStr && item.status === "SCHEDULED";
            const isPending = loadingId === item.id;

            const statusConfig = FOLLOWUP_STATUSES[item.status] || {
              label: item.status,
              color: "bg-neutral-800 text-neutral-300",
            };

            const isRelance7J =
              item.stepNumber >= 2 ||
              Boolean(
                item.notes &&
                  (item.notes.includes("+7j") ||
                    item.notes.includes("J+7") ||
                    item.notes.includes("7 jours") ||
                    item.notes.includes("7j"))
              );

            return (
              <div
                key={item.id}
                className={`bg-neutral-900/80 border rounded-2xl p-5 space-y-4 flex flex-col justify-between transition-all shadow-lg ${
                  isOverdue
                    ? "border-rose-500/40 bg-rose-950/10 shadow-rose-950/20"
                    : isToday
                    ? "border-blue-500/40 bg-blue-950/10 shadow-blue-950/20"
                    : "border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Étape {item.stepNumber}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isOverdue && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          En retard
                        </span>
                      )}
                      {isToday && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          Aujourd'hui
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>

                  {/* Prospect Header */}
                  <div>
                    <h3 className="text-base font-bold text-neutral-100 flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="truncate">{item.prospect.companyName}</span>
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {item.prospect.contactName || "Contact principal"} • {item.prospect.sector}
                    </p>
                  </div>

                  {/* Scheduled Date & Phone */}
                  <div className="p-3 bg-neutral-950/60 border border-neutral-800/80 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Date prévue :</span>
                      </span>
                      <span className={`font-semibold ${isOverdue ? "text-rose-400 font-bold" : "text-neutral-200"}`}>
                        {formatDate(item.scheduledAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>Téléphone :</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${item.prospect.phone}`}
                          onClick={() => {
                            trackCommunicationClick({
                              type: "PHONE",
                              targetName: item.prospect.companyName || item.prospect.contactName,
                              phone: item.prospect.phone,
                              entityType: "PROSPECT",
                              entityId: item.prospect.id,
                            });
                          }}
                          className="text-emerald-400 font-mono font-semibold hover:underline flex items-center gap-1"
                        >
                          {item.prospect.phone}
                        </a>
                        {item.prospect.phone && (
                          <a
                            href={buildWhatsAppUrl(item.prospect.phone, item.prospect.companyName, item.prospect.contactName)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              trackCommunicationClick({
                                type: "WHATSAPP",
                                targetName: item.prospect.companyName || item.prospect.contactName,
                                phone: item.prospect.phone,
                                entityType: "PROSPECT",
                                entityId: item.prospect.id,
                              });
                            }}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500/15 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-emerald-500/30 hover:border-[#25D366] transition-all shadow-2xs hover:scale-110 cursor-pointer shrink-0"
                            title={`Envoyer un WhatsApp à ${item.prospect.companyName}`}
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Prospect Remarks & Follow-up Notes with EDIT button */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-amber-400" />
                        <span>Remarques & Réponses</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => openRemarksModal(item)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/20 transition-all cursor-pointer"
                        title="Modifier la remarque, la réponse ou la note de relance"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>{item.prospect.notes || item.prospect.response ? "Modifier" : "+ Ajouter"}</span>
                      </button>
                    </div>

                    {item.prospect.notes && (
                      <div
                        onClick={() => openRemarksModal(item)}
                        className="bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 p-2 rounded-xl text-xs text-amber-200 cursor-pointer transition-colors group"
                        title="Cliquer pour modifier la remarque"
                      >
                        <p className="font-medium text-amber-100 whitespace-normal line-clamp-3">{item.prospect.notes}</p>
                      </div>
                    )}

                    {item.prospect.response && item.prospect.response !== item.prospect.notes && (
                      <p
                        onClick={() => openRemarksModal(item)}
                        className="text-[11px] text-neutral-300 px-1 cursor-pointer hover:text-white transition-colors"
                        title="Cliquer pour modifier la réponse"
                      >
                        <span className="text-neutral-500 font-semibold">Réponse :</span> {item.prospect.response}
                      </p>
                    )}

                    {item.notes && !item.notes.startsWith("Relance Étape") && item.notes !== item.prospect.notes && (
                      <p
                        onClick={() => openRemarksModal(item)}
                        className="text-[11px] text-neutral-400 italic bg-neutral-950/40 hover:bg-neutral-950/70 p-2 rounded-lg border border-neutral-850 hover:border-neutral-700 whitespace-normal cursor-pointer transition-colors"
                        title="Cliquer pour modifier la note"
                      >
                        Note relance : "{item.notes}"
                      </p>
                    )}

                    {!item.prospect.notes && !item.prospect.response && (!item.notes || item.notes.startsWith("Relance Étape")) && (
                      <button
                        type="button"
                        onClick={() => openRemarksModal(item)}
                        className="w-full py-2 px-2 text-[11px] text-neutral-500 hover:text-amber-300 bg-neutral-950/40 hover:bg-amber-500/5 border border-dashed border-neutral-800 hover:border-amber-500/30 rounded-xl text-center transition-all cursor-pointer"
                      >
                        + Ajouter une remarque ou réponse
                      </button>
                    )}
                  </div>
                </div>

                {/* BOTTOM ACTION BUTTONS: PAS INTÉRESSÉ | INTÉRESSÉ (+3j) | À RELANCER (+7j ou +15j) */}
                <div className="pt-3 border-t border-neutral-800 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] text-neutral-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>Commercial : {item.user.name}</span>
                    </span>
                    {item.completedAt && (
                      <span className="text-neutral-500">
                        Fait le {formatDate(item.completedAt)}
                      </span>
                    )}
                  </div>

                  {item.status === "SCHEDULED" ? (
                    <div className="flex items-center gap-2 pt-1">
                      {/* REPORTER */}
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => openRescheduleModal(item)}
                        className="px-3 py-2 bg-amber-500/15 hover:bg-amber-600 hover:text-white text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shadow-amber-500/10 disabled:opacity-50"
                        title="Reporter la relance à une date personnalisée"
                      >
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                        <span>Reporter</span>
                      </button>

                      {/* + APPEL (AJOUTER DANS LES APPELS) */}
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => openCallModal(item)}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50"
                        title="Enregistrer un appel et ajouter dans les appels"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>+ APPEL</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-1.5 px-3 rounded-xl bg-neutral-950/70 border border-neutral-800 text-[11px] text-neutral-400 font-medium">
                      {item.status === "COMPLETED"
                        ? "✓ Relance traitée avec succès"
                        : item.status === "LOST"
                        ? "✗ Prospect non intéressé"
                        : "Relance clôturée"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. VUE LISTE DETAILLEE */}
      {viewMode === "list" && (
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-neutral-950/90 border-b border-neutral-800 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3">PROSPECT / CLIENT</th>
                  <th className="py-3 px-3">TÉLÉPHONE</th>
                  <th className="py-3 px-3">TYPE</th>
                  <th className="py-3 px-3">ADRESS</th>
                  <th className="py-3 px-3">APPEL</th>
                  <th className="py-3 px-3 text-emerald-400">RÉSULTAT D'APPEL</th>
                  <th className="py-3 px-3 min-w-[220px] max-w-[320px] text-amber-700 dark:text-amber-400 font-bold">REMARQUES DU PROSPECT</th>
                  <th className="py-3 px-3">DATE PRÉVUE</th>
                  <th className="py-3 px-3 text-center">ÉTAPE</th>
                  <th className="py-3 px-3">STATUT</th>
                  <th className="py-3 px-3 text-blue-400">COMMERCIAL</th>
                  <th className="py-3 px-3 text-center min-w-[190px]">ACTIONS (+ APPEL)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-medium text-neutral-300">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-neutral-500 font-normal">
                      Aucune relance correspondant au filtre sélectionné.
                    </td>
                  </tr>
                )}

                {paginatedFollowUps.map((item) => {
                  const isOverdue = new Date(item.scheduledAt) < now && item.status === "SCHEDULED";
                  const isToday = toLocalDateString(item.scheduledAt) === todayStr && item.status === "SCHEDULED";
                  const isPending = loadingId === item.id;

                  const statusConfig = FOLLOWUP_STATUSES[item.status] || {
                    label: item.status,
                    color: "bg-neutral-800 text-neutral-300",
                  };

                  const isRelance7J =
                    item.stepNumber >= 2 ||
                    Boolean(
                      item.notes &&
                        (item.notes.includes("+7j") ||
                          item.notes.includes("J+7") ||
                          item.notes.includes("7 jours") ||
                          item.notes.includes("7j"))
                    );

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-neutral-850/50 transition-colors ${
                        isOverdue ? "bg-rose-950/10" : isToday ? "bg-blue-950/10" : ""
                      }`}
                    >
                      {/* 1. Prospect */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 max-w-[200px] truncate">
                          <Building className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="font-bold text-neutral-100 truncate">
                            {item.prospect.companyName}
                          </span>
                        </div>
                        {item.prospect.contactName && (
                          <span className="text-[10px] text-neutral-400 pl-5 block truncate">
                            {item.prospect.contactName}
                          </span>
                        )}
                      </td>

                      {/* 2. Téléphone & WhatsApp */}
                      <td className="py-3 px-3 font-mono text-[11px]">
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${item.prospect.phone}`}
                            onClick={() => {
                              trackCommunicationClick({
                                type: "PHONE",
                                targetName: item.prospect.companyName || item.prospect.contactName,
                                phone: item.prospect.phone,
                                entityType: "PROSPECT",
                                entityId: item.prospect.id,
                              });
                            }}
                            className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{item.prospect.phone}</span>
                          </a>

                          {item.prospect.phone && (
                            <a
                              href={buildWhatsAppUrl(item.prospect.phone, item.prospect.companyName, item.prospect.contactName)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                trackCommunicationClick({
                                  type: "WHATSAPP",
                                  targetName: item.prospect.companyName || item.prospect.contactName,
                                  phone: item.prospect.phone,
                                  entityType: "PROSPECT",
                                  entityId: item.prospect.id,
                                });
                              }}
                              className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500/15 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-emerald-500/30 hover:border-[#25D366] transition-all shadow-2xs hover:scale-110 cursor-pointer shrink-0"
                              title={`Envoyer un message WhatsApp à ${item.prospect.companyName}`}
                            >
                              <WhatsAppIcon className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* 3. TYPE */}
                      <td className="py-3 px-3 text-blue-400 font-medium max-w-[140px] truncate">
                        {item.prospect.sector || "—"}
                      </td>

                      {/* 4. ADRESS */}
                      <td className="py-3 px-3 text-neutral-300 max-w-[150px] truncate">
                        {item.prospect.address || item.prospect.wilaya || "—"}
                      </td>

                      {/* 5. APPEL */}
                      <td className="py-2 px-2">
                        <select
                          value={item.prospect.callStatus || ""}
                          onChange={async (e) => {
                            const val = e.target.value;
                            setFollowUps((prev) =>
                              prev.map((f) =>
                                f.prospect.id === item.prospect.id
                                  ? { ...f, prospect: { ...f.prospect, callStatus: val } }
                                  : f
                              )
                            );
                            await updateProspectField(item.prospect.id, "callStatus", val);
                          }}
                          className={`h-7 px-2 text-[11px] font-semibold rounded-lg border focus:outline-none cursor-pointer transition-all ${
                            item.prospect.callStatus === "EFFECTUE"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : item.prospect.callStatus?.includes("PAS") || item.prospect.callStatus?.includes("OCCUPE")
                              ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                              : "bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                          }`}
                          title="Changer le statut d'appel"
                        >
                          <option value="" className="bg-neutral-950 text-neutral-400">— Appel —</option>
                          <option value="EFFECTUE" className="bg-neutral-950 text-emerald-400 font-bold">✓ EFFECTUE</option>
                          <option value="PAS DE REPONSE" className="bg-neutral-950 text-amber-400">PAS DE REPONSE</option>
                          <option value="OCCUPE" className="bg-neutral-950 text-amber-400">OCCUPE</option>
                          <option value="INJOIGNABLE" className="bg-neutral-950 text-rose-400">INJOIGNABLE</option>
                          <option value="A RAPPELER" className="bg-neutral-950 text-blue-400">A RAPPELER</option>
                          <option value="PAS DE CONTACT" className="bg-neutral-950 text-neutral-400">PAS DE CONTACT</option>
                          <option value="NON EFFECTUE" className="bg-neutral-950 text-neutral-400">NON EFFECTUE</option>
                        </select>
                      </td>

                      {/* 6. RÉSULTAT D'APPEL */}
                      <td className="py-2 px-2">
                        <select
                          value={item.prospect.rawState || ""}
                          onChange={async (e) => {
                            const val = e.target.value;
                            setFollowUps((prev) =>
                              prev.map((f) =>
                                f.prospect.id === item.prospect.id
                                  ? { ...f, prospect: { ...f.prospect, rawState: val } }
                                  : f
                              )
                            );
                            await updateProspectField(item.prospect.id, "rawState", val);
                          }}
                          className={`h-7 px-2 text-[10px] font-semibold rounded-lg border focus:outline-none cursor-pointer transition-all max-w-[140px] ${
                            item.prospect.rawState === "INTERESSE"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold"
                              : item.prospect.rawState === "RDV PRIS"
                              ? "bg-purple-500/20 text-purple-400 border-purple-500/40 font-bold"
                              : item.prospect.rawState === "A RAPPELER"
                              ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                              : item.prospect.rawState === "PAS INTERESSE"
                              ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                              : item.prospect.rawState === "PAS DE REPONSE" || item.prospect.rawState === "PAS DE CONTACT"
                              ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                              : item.prospect.rawState === "INJOIGNABLE" || item.prospect.rawState === "OCCUPE"
                              ? "bg-red-500/20 text-red-400 border-red-500/40"
                              : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700"
                          }`}
                          title="Changer le résultat d'appel"
                        >
                          <option value="" className="bg-neutral-950 text-neutral-400">— Résultat —</option>
                          <option value="INTERESSE" className="bg-neutral-950 text-emerald-400 font-bold">INTERESSE</option>
                          <option value="RDV PRIS" className="bg-neutral-950 text-purple-400 font-bold">RDV PRIS</option>
                          <option value="A RAPPELER" className="bg-neutral-950 text-blue-400">A RAPPELER</option>
                          <option value="PAS INTERESSE" className="bg-neutral-950 text-rose-400">PAS INTERESSE</option>
                          <option value="OCCUPE" className="bg-neutral-950 text-amber-400">OCCUPE</option>
                          <option value="INJOIGNABLE" className="bg-neutral-950 text-red-400">INJOIGNABLE</option>
                          <option value="PAS DE CONTACT" className="bg-neutral-950 text-neutral-400">PAS DE CONTACT</option>
                        </select>
                      </td>

                      {/* 4. Remarques du prospect */}
                      <td className="py-2.5 px-3 min-w-[240px] max-w-[340px]">
                        <div className="flex items-start justify-between gap-1.5 group">
                          <div className="space-y-1 flex-1 min-w-0">
                            {item.prospect.notes ? (
                              <div
                                onClick={() => openRemarksModal(item)}
                                className="text-xs bg-amber-500/10 dark:bg-amber-950/40 hover:bg-amber-500/15 border border-amber-500/30 dark:border-amber-500/30 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors shadow-xs"
                                title="Cliquer pour modifier la remarque"
                              >
                                <span className="text-[10px] text-amber-800 dark:text-amber-300 font-black uppercase tracking-wider block">
                                  💬 Remarque :
                                </span>
                                <p className="font-semibold whitespace-normal line-clamp-2 text-neutral-900 dark:text-amber-100 leading-snug">
                                  {item.prospect.notes}
                                </p>
                              </div>
                            ) : null}

                            {item.prospect.response && item.prospect.response !== item.prospect.notes ? (
                              <p
                                onClick={() => openRemarksModal(item)}
                                className="text-[11px] text-neutral-800 dark:text-neutral-200 whitespace-normal line-clamp-1 truncate pl-1 cursor-pointer hover:text-black dark:hover:text-white transition-colors"
                                title="Cliquer pour modifier la réponse"
                              >
                                <span className="text-neutral-600 dark:text-neutral-400 font-bold">Rép :</span> {item.prospect.response}
                              </p>
                            ) : null}

                            {item.notes && !item.notes.startsWith("Relance Étape") && item.notes !== item.prospect.notes ? (
                              <p
                                onClick={() => openRemarksModal(item)}
                                className="text-[10px] text-neutral-700 dark:text-neutral-400 italic whitespace-normal line-clamp-1 pl-1 cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-300 transition-colors"
                                title="Cliquer pour modifier la note"
                              >
                                Note : {item.notes}
                              </p>
                            ) : null}

                            {!item.prospect.notes && !item.prospect.response && (!item.notes || item.notes.startsWith("Relance Étape")) ? (
                              <button
                                type="button"
                                onClick={() => openRemarksModal(item)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-neutral-400 hover:text-amber-900 dark:hover:text-amber-300 py-1 px-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-dashed border-amber-500/30 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Ajouter remarque</span>
                              </button>
                            ) : null}
                          </div>

                          {/* Bouton d'édition rapide */}
                          <button
                            type="button"
                            onClick={() => openRemarksModal(item)}
                            className="p-1.5 rounded-lg bg-neutral-200/80 dark:bg-neutral-900/80 hover:bg-amber-500/20 text-neutral-700 dark:text-neutral-400 hover:text-amber-800 dark:hover:text-amber-300 border border-neutral-300 dark:border-neutral-800 hover:border-amber-500/30 transition-all cursor-pointer shrink-0 opacity-80 group-hover:opacity-100"
                            title="Modifier les remarques et réponses"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* 5. Date Prévue */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold ${isOverdue ? "text-rose-400 font-bold" : "text-neutral-200"}`}>
                            {formatDate(item.scheduledAt)}
                          </span>
                          {isOverdue && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              Retard
                            </span>
                          )}
                          {isToday && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              Aujourd'hui
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Étape */}
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Étape {item.stepNumber}
                        </span>
                      </td>

                      {/* 6. Statut */}
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </td>

                      {/* 7. Commercial */}
                      <td className="py-3 px-3 text-blue-300 font-medium">
                        {item.user.name}
                      </td>

                      {/* 8. ACTIONS: REPORTER & + APPEL */}
                      <td className="py-2.5 px-3">
                        {item.status === "SCHEDULED" ? (
                          <div className="flex items-center justify-center gap-2">
                            {/* REPORTER */}
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => openRescheduleModal(item)}
                              className="px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-600 hover:text-white text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                              title="Reporter la relance à une date personnalisée"
                            >
                              <Calendar className="w-3 h-3 text-amber-400" />
                              <span>Reporter</span>
                            </button>

                            {/* + APPEL (AJOUTER DANS LES APPELS) */}
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => openCallModal(item)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50"
                              title="Enregistrer un appel et ajouter dans les appels"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <PhoneCall className="w-3.5 h-3.5" />
                              <span>+ APPEL</span>
                            </button>
                          </div>
                        ) : (
                          <div className="text-center text-[10px] text-neutral-500 font-medium">
                            {item.status === "COMPLETED"
                              ? "✓ Traitée"
                              : item.status === "LOST"
                              ? "✗ Pas intéressé"
                              : "Clôturée"}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Barre de Pagination Optimisée */}
      {filtered.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl text-xs shadow-lg">
          <div className="flex flex-wrap items-center gap-3 text-neutral-400">
            <span>
              Affichage de <strong className="text-neutral-100">{pageSize === "all" ? 1 : (currentPage - 1) * pageSize + 1}</strong> à{" "}
              <strong className="text-neutral-100">{pageSize === "all" ? filtered.length : Math.min(currentPage * pageSize, filtered.length)}</strong> sur{" "}
              <strong className="text-blue-400">{filtered.length.toLocaleString("fr-FR")}</strong> relances
            </span>
            <div className="flex items-center gap-1.5 ml-2 border-l border-neutral-800 pl-3">
              <span className="text-[11px] text-neutral-500">Par page :</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === "all" ? "all" : Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="h-7 px-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-blue-500 text-xs cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50 (recommandé)</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value="all">Toutes ({filtered.length})</option>
              </select>
            </div>
          </div>

          {pageSize !== "all" && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Première page"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                ‹ Précédent
              </button>

              <div className="flex items-center gap-1 mx-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;
                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && <span className="px-1 text-neutral-600">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`w-8 h-8 rounded-lg font-bold transition-all ${
                            currentPage === p
                              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                              : "bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800"
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                Suivant ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Dernière page"
              >
                »
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL: REPORTER LA RELANCE */}
      <Modal
        isOpen={rescheduleModalOpen}
        onClose={() => {
          setRescheduleModalOpen(false);
          setTargetFollowUp(null);
        }}
        title="Reporter la relance commerciale"
        description={
          targetFollowUp
            ? `Fixez une nouvelle date d'échéance pour ${targetFollowUp.prospect.companyName}`
            : "Fixez une nouvelle date d'échéance"
        }
        maxWidth="md"
      >
        {targetFollowUp && (
          <form onSubmit={handleRescheduleSubmit} className="space-y-4">
            {/* Prospect Info Card */}
            <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Entreprise :</span>
                <span className="font-bold text-neutral-100">{targetFollowUp.prospect.companyName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Téléphone :</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-emerald-400">{targetFollowUp.prospect.phone}</span>
                  {targetFollowUp.prospect.phone && (
                    <a
                      href={buildWhatsAppUrl(targetFollowUp.prospect.phone, targetFollowUp.prospect.companyName, targetFollowUp.prospect.contactName)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-500/15 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-emerald-500/30 transition-all cursor-pointer"
                      title="Ouvrir WhatsApp"
                    >
                      <WhatsAppIcon className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              {targetFollowUp.prospect.notes && (
                <div className="flex items-start justify-between gap-2 pt-1 border-t border-neutral-900">
                  <span className="text-neutral-400 shrink-0">Remarque existante :</span>
                  <span className="text-amber-300 font-medium text-right">{targetFollowUp.prospect.notes}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Date initiale :</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-200 font-semibold">{formatDate(targetFollowUp.scheduledAt)}</span>
                  {new Date(targetFollowUp.scheduledAt) < now ? (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      Échue
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      À venir
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Error in modal if any */}
            {modalError && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Raccourcis rapides */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Raccourcis rapides d'échéance :</span>
                </label>

                {/* Sélecteur de base de calcul */}
                <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-[10px] self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setRescheduleBase("today");
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                      rescheduleBase === "today"
                        ? "bg-amber-500 text-neutral-950 font-bold shadow-xs"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    Depuis Aujourd'hui ({formatDate(now)})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRescheduleBase("initial");
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                      rescheduleBase === "initial"
                        ? "bg-amber-500 text-neutral-950 font-bold shadow-xs"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    Depuis Date Initiale ({formatDate(targetFollowUp.scheduledAt)})
                  </button>
                </div>
              </div>

              {/* Context notification */}
              {new Date(targetFollowUp.scheduledAt) < now && rescheduleBase === "today" && (
                <div className="px-2.5 py-1 rounded-lg bg-blue-950/30 border border-blue-500/30 text-[11px] text-blue-300 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-blue-400 shrink-0" />
                  <span>
                    La date initiale ({formatDate(targetFollowUp.scheduledAt)}) étant déjà passée, les délais ci-dessous sont calculés à partir <strong>d'aujourd'hui ({formatDate(now)})</strong>.
                  </span>
                </div>
              )}

              {/* Grille des 4 raccourcis */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Demain", days: 1, tag: "+1j" },
                  { label: "+3 jours", days: 3, tag: "+3j" },
                  { label: "+7 jours", days: 7, tag: "+7j" },
                  { label: "+15 jours", days: 15, tag: "+15j" },
                ].map((s) => {
                  let base = new Date();
                  if (rescheduleBase === "initial" && targetFollowUp?.scheduledAt) {
                    const dInit = new Date(targetFollowUp.scheduledAt);
                    if (!isNaN(dInit.getTime())) base = dInit;
                  }
                  const target = new Date(base);
                  target.setDate(target.getDate() + s.days);
                  const sDateStr = toLocalDateString(target);
                  const isSelected = rescheduleDate === sDateStr;

                  return (
                    <div
                      key={s.days}
                      onClick={() => handleQuickAddDays(s.days)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/40 shadow-md shadow-amber-500/10"
                          : "bg-neutral-900/80 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isSelected ? "text-amber-300" : "text-neutral-200"}`}>
                          {s.label}
                        </span>
                        {isSelected ? (
                          <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center text-[10px] font-extrabold">
                            ✓
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-neutral-500 font-semibold">{s.tag}</span>
                        )}
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-neutral-800/80 flex items-center justify-between gap-1">
                        <span className={`text-[11px] font-mono font-semibold truncate ${isSelected ? "text-amber-400 font-bold" : "text-neutral-400"}`}>
                          {formatDate(target)}
                        </span>
                        <button
                          type="button"
                          disabled={isRescheduling}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickAddDays(s.days, undefined, true);
                          }}
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 hover:bg-amber-500 hover:text-neutral-950 text-amber-300 border border-amber-500/30 transition-colors shrink-0"
                          title="Appliquer et reporter immédiatement en 1 clic"
                        >
                          ⚡ 1-clic
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Date Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-300">
                  Nouvelle date de relance * :
                </label>
                {rescheduleDate && (
                  <span className="text-[11px] font-mono text-amber-400 font-semibold">
                    Échéance : {formatDate(rescheduleDate)}
                  </span>
                )}
              </div>
              <Input
                type="date"
                value={rescheduleDate}
                onChange={(e) => {
                  setRescheduleDate(e.target.value);
                  setRescheduleNotes(
                    `Relance reportée manuellement au ${formatDate(e.target.value)}`
                  );
                }}
                required
              />
            </div>

            {/* Notes / Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Note ou raison du report :</label>
              <textarea
                rows={2}
                value={rescheduleNotes}
                onChange={(e) => setRescheduleNotes(e.target.value)}
                placeholder="ex: Prospect demande d'être rappelé la semaine prochaine..."
                className="w-full p-2.5 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRescheduleModalOpen(false);
                  setTargetFollowUp(null);
                  setModalError(null);
                }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                isLoading={isRescheduling}
                className="bg-amber-600 hover:bg-amber-500 text-white font-semibold"
              >
                {rescheduleDate
                  ? `✓ Confirmer le report au ${formatDate(rescheduleDate)}`
                  : "Confirmer le report"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: + APPEL (JOURNALISER L'APPEL ET AJOUTER DANS LES APPELS) */}
      <Modal
        isOpen={callModalOpen}
        onClose={() => {
          setCallModalOpen(false);
          setCallTargetFollowUp(null);
        }}
        title={`+ APPEL : ${callTargetFollowUp?.prospect.companyName || "Prospect"}`}
        description="Enregistrez l'appel et ajoutez automatiquement le prospect dans la section Appels"
        maxWidth="lg"
      >
        {callTargetFollowUp && (
          <form onSubmit={handleCallSubmit} className="space-y-4">
            {/* Prospect summary banner */}
            <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                    <Building className="w-4 h-4 text-emerald-400" />
                    {callTargetFollowUp.prospect.companyName}
                  </h4>
                  <p className="text-xs text-neutral-400">
                    {callTargetFollowUp.prospect.contactName
                      ? `${callTargetFollowUp.prospect.contactName} • `
                      : ""}
                    {callTargetFollowUp.prospect.sector} ({callTargetFollowUp.prospect.wilaya})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${callTargetFollowUp.prospect.phone}`}
                    onClick={() => {
                      trackCommunicationClick({
                        type: "PHONE",
                        targetName: callTargetFollowUp.prospect.companyName,
                        phone: callTargetFollowUp.prospect.phone,
                        entityType: "PROSPECT",
                        entityId: callTargetFollowUp.prospect.id,
                      });
                    }}
                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{callTargetFollowUp.prospect.phone}</span>
                  </a>

                  <a
                    href={buildWhatsAppUrl(
                      callTargetFollowUp.prospect.phone,
                      callTargetFollowUp.prospect.companyName,
                      callTargetFollowUp.prospect.contactName
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      trackCommunicationClick({
                        type: "WHATSAPP",
                        targetName: callTargetFollowUp.prospect.companyName,
                        phone: callTargetFollowUp.prospect.phone,
                        entityType: "PROSPECT",
                        entityId: callTargetFollowUp.prospect.id,
                      });
                    }}
                    className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-emerald-500/30 hover:border-[#25D366] rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                    title="Envoyer message WhatsApp"
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>

              {callTargetFollowUp.notes && (
                <div className="pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-400 flex items-center gap-1.5">
                  <span className="font-semibold text-neutral-300">Note précédente :</span>
                  <span className="italic truncate">{callTargetFollowUp.notes}</span>
                </div>
              )}
            </div>

            {/* Call Result Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-200">
                Résultat de l'appel *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  {
                    value: CallResult.INTERESTED,
                    label: "Intéressé (+3j)",
                    desc: "Programmer relance J+3",
                    color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
                    activeColor: "border-emerald-500 bg-emerald-500/25 ring-1 ring-emerald-500 text-white",
                  },
                  {
                    value: CallResult.CALLBACK_REQUESTED,
                    label: "À relancer (+7j)",
                    desc: "Programmer relance J+7",
                    color: "border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20",
                    activeColor: "border-blue-500 bg-blue-500/25 ring-1 ring-blue-500 text-white",
                  },
                  {
                    value: CallResult.APPOINTMENT_BOOKED,
                    label: "RDV fixé",
                    desc: "Rendez-vous convenu",
                    color: "border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20",
                    activeColor: "border-purple-500 bg-purple-500/25 ring-1 ring-purple-500 text-white",
                  },
                  {
                    value: CallResult.NO_ANSWER,
                    label: "Pas de réponse",
                    desc: "Ne décroche pas",
                    color: "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20",
                    activeColor: "border-amber-500 bg-amber-500/25 ring-1 ring-amber-500 text-white",
                  },
                  {
                    value: CallResult.NOT_INTERESTED,
                    label: "Pas intéressé",
                    desc: "Clôturer le prospect",
                    color: "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
                    activeColor: "border-rose-500 bg-rose-500/25 ring-1 ring-rose-500 text-white",
                  },
                  {
                    value: CallResult.UNREACHABLE,
                    label: "Injoignable / Faux n°",
                    desc: "Numéro erroné ou éteint",
                    color: "border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800",
                    activeColor: "border-neutral-500 bg-neutral-800 ring-1 ring-neutral-400 text-white",
                  },
                ].map((item) => {
                  const isSelected = callResult === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setCallResult(item.value)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected ? item.activeColor : item.color
                      }`}
                    >
                      <div className="font-bold text-xs">{item.label}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">{item.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Call Duration */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-200">
                Durée de l'appel
              </label>
              <div className="flex items-center gap-2">
                {[
                  { label: "30s", val: "30" },
                  { label: "1 min", val: "60" },
                  { label: "2 min", val: "120" },
                  { label: "3 min", val: "180" },
                  { label: "5 min", val: "300" },
                ].map((d) => (
                  <button
                    key={d.val}
                    type="button"
                    onClick={() => setCallDuration(d.val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      callDuration === d.val
                        ? "bg-emerald-600 border-emerald-500 text-white"
                        : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
                <div className="flex items-center gap-1.5 ml-auto">
                  <Input
                    type="number"
                    min="0"
                    value={callDuration}
                    onChange={(e) => setCallDuration(e.target.value)}
                    className="w-20 text-center text-xs h-8"
                  />
                  <span className="text-xs text-neutral-400">sec</span>
                </div>
              </div>
            </div>

            {/* Call Comment / Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-200">
                Remarques / Compte-rendu de l'appel :
              </label>
              <textarea
                rows={3}
                value={callComment}
                onChange={(e) => setCallComment(e.target.value)}
                placeholder="Ex: Le prospect souhaite une démo mardi prochain, très intéressé par le pack Gold..."
                className="w-full p-2.5 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCallModalOpen(false);
                  setCallTargetFollowUp(null);
                }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                isLoading={isLoggingCall}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 shadow-lg shadow-emerald-600/20"
              >
                <PhoneCall className="w-4 h-4" />
                <span>+ Enregistrer & Transférer dans les Appels</span>
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: MODIFIER LES REMARQUES ET RÉPONSES */}
      <Modal
        isOpen={remarksModalOpen}
        onClose={() => {
          setRemarksModalOpen(false);
          setTargetRemarksItem(null);
        }}
        title="Modifier les remarques et réponses"
        description={
          targetRemarksItem
            ? `Mise à jour des notes commerciales et retours prospect pour ${targetRemarksItem.prospect.companyName}`
            : "Mise à jour des remarques et réponses"
        }
        maxWidth="lg"
      >
        {targetRemarksItem && (
          <form onSubmit={handleSaveRemarksSubmit} className="space-y-4">
            {/* Prospect Info Card */}
            <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Entreprise :</span>
                <span className="font-bold text-neutral-100 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-blue-400" />
                  <span>{targetRemarksItem.prospect.companyName}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Contact / Téléphone :</span>
                <span className="text-neutral-200 font-mono">
                  {targetRemarksItem.prospect.contactName || "Contact principal"} ({targetRemarksItem.prospect.phone})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Commercial en charge :</span>
                <span className="text-blue-300 font-medium">{targetRemarksItem.user.name}</span>
              </div>
            </div>

            {remarksError && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{remarksError}</span>
              </div>
            )}

            {/* 1. Remarque du prospect */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Remarque du prospect (Besoins, objections, contexte) :</span>
                </label>
                <span className="text-[10px] text-neutral-500">Visible dans tout le CRM</span>
              </div>
              <textarea
                rows={3}
                value={editProspectNotes}
                onChange={(e) => setEditProspectNotes(e.target.value)}
                placeholder="Ex: Le prospect est très intéressé par la gestion des factures et du stock. Souhaite être rappelé mardi matin..."
                className="w-full p-2.5 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
              />

              {/* Quick tags for remarks */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-neutral-400">Suggestions rapides :</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Très intéressé par l'ERP",
                    "Demande de devis détaillé",
                    "Rappeler le gérant la semaine prochaine",
                    "Décisionnaire en déplacement",
                    "Budget à valider pour le mois prochain",
                    "Déjà équipé, comparer les offres",
                    "Demande une démonstration à distance",
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setEditProspectNotes((prev) => (prev ? `${prev} • ${tag}` : tag));
                      }}
                      className="px-2 py-0.5 rounded-md bg-neutral-950 hover:bg-amber-500/15 border border-neutral-800 hover:border-amber-500/30 text-[10px] text-neutral-400 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Réponse du prospect */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Réponse du prospect (Retour immédiat ou synthèse de l'échange) :</span>
                </label>
              </div>
              <textarea
                rows={2}
                value={editProspectResponse}
                onChange={(e) => setEditProspectResponse(e.target.value)}
                placeholder="Ex: Intéressé par une présentation, envoyer catalogue sur WhatsApp"
                className="w-full p-2.5 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />

              {/* Quick tags for responses */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Intéressé, à relancer",
                  "Envoyer présentation par WhatsApp",
                  "Demande de rappel",
                  "Refus temporaire",
                  "Ne répond pas pour le moment",
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setEditProspectResponse(tag)}
                    className="px-2 py-0.5 rounded-md bg-neutral-950 hover:bg-emerald-500/15 border border-neutral-800 hover:border-emerald-500/30 text-[10px] text-neutral-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    = {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Note spécifique de la relance */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>Note interne de suivi de la relance :</span>
              </label>
              <input
                type="text"
                value={editFollowUpNotes}
                onChange={(e) => setEditFollowUpNotes(e.target.value)}
                placeholder="Ex: Relance prévue le 24/09 pour finaliser la proposition"
                className="w-full h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRemarksModalOpen(false);
                  setTargetRemarksItem(null);
                }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                isLoading={isSavingRemarks}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold gap-1.5 shadow-lg shadow-amber-600/20"
              >
                <Check className="w-4 h-4" />
                <span>Enregistrer les modifications</span>
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
