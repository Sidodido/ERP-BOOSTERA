"use client";

import React, { useState, useEffect, useMemo } from "react";
import { FOLLOWUP_STATUSES } from "@/lib/constants";
import { FollowUpStatus } from "@prisma/client";
import { formatDate, toLocalDateString } from "@/lib/utils";
import { trackCommunicationClick } from "@/lib/tracking";
import { processFollowUpAction, rescheduleFollowUpAction } from "@/actions/followups";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Building,
  Phone,
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

  // Reschedule Follow-up Modal State
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [targetFollowUp, setTargetFollowUp] = useState<FollowUpItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleNotes, setRescheduleNotes] = useState("");
  const [rescheduleBase, setRescheduleBase] = useState<"today" | "initial">("today");
  const [modalError, setModalError] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);

  const now = new Date();
  const todayStr = toLocalDateString(now);

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

    // 2. Search Filter
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      f.prospect.companyName.toLowerCase().includes(q) ||
      (f.prospect.contactName && f.prospect.contactName.toLowerCase().includes(q)) ||
      f.prospect.phone.includes(q) ||
      f.prospect.sector.toLowerCase().includes(q) ||
      f.prospect.wilaya.toLowerCase().includes(q) ||
      f.user.name.toLowerCase().includes(q) ||
      (f.notes && f.notes.toLowerCase().includes(q))
    );
  });

  // Client Pagination (50 par page par défaut pour des performances instantanées)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(50);

  // Revenir à la première page quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedFilter]);

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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-900/80 border border-neutral-800 p-2.5 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par entreprise, contact, téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs pb-1 sm:pb-0 scrollbar-none">
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
        </div>
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
                    </div>
                  </div>

                  {/* Notes */}
                  {item.notes && (
                    <p className="text-[11px] text-neutral-400 italic bg-neutral-950/40 p-2 rounded-lg border border-neutral-850">
                      "{item.notes}"
                    </p>
                  )}
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                      {/* 0. REPORTER */}
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => openRescheduleModal(item)}
                        className="px-2 py-2 bg-amber-500/15 hover:bg-amber-600 hover:text-white text-amber-300 border border-amber-500/30 rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm shadow-amber-500/10 disabled:opacity-50"
                        title="Reporter la relance à une date personnalisée"
                      >
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                        <span className="truncate">Reporter</span>
                      </button>

                      {/* 1. PAS INTÉRESSÉ */}
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleProcess(item.id, "NOT_INTERESTED")}
                        className="px-2 py-2 bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-400 border border-rose-500/30 rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                        title="Marquer comme pas intéressé (clôture la relance)"
                      >
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Pas intéressé</span>
                      </button>

                      {/* 2. INTÉRESSÉ (+3j) */}
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleProcess(item.id, "INTERESTED")}
                        className="px-2 py-2 bg-emerald-500/20 hover:bg-emerald-600 hover:text-white text-emerald-300 border border-emerald-500/40 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm shadow-emerald-500/10 disabled:opacity-50"
                        title="Marquer intéressé et programmer la prochaine relance à J+3"
                      >
                        <Sparkles className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        <span className="truncate">Intéressé (+3j)</span>
                      </button>

                      {/* 3. À RELANCER (+7j ou +15j selon étape) */}
                      {isRelance7J ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleProcess(item.id, "RETRY_15")}
                          className="px-2 py-2 bg-purple-500/15 hover:bg-purple-600 hover:text-white text-purple-300 border border-purple-500/30 rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50 shadow-sm shadow-purple-500/10"
                          title="Client en relance après 7 jours : reporter la relance à J+15"
                        >
                          <RotateCw className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                          <span className="truncate">À relancer (+15j)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleProcess(item.id, "RETRY")}
                          className="px-2 py-2 bg-blue-500/15 hover:bg-blue-600 hover:text-white text-blue-300 border border-blue-500/30 rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                          title="Reporter la relance à J+7"
                        >
                          <RotateCw className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                          <span className="truncate">À relancer (+7j)</span>
                        </button>
                      )}
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
                  <th className="py-3 px-3">SECTEUR</th>
                  <th className="py-3 px-3">DATE PRÉVUE</th>
                  <th className="py-3 px-3 text-center">ÉTAPE</th>
                  <th className="py-3 px-3">STATUT</th>
                  <th className="py-3 px-3 text-blue-400">COMMERCIAL</th>
                  <th className="py-3 px-3 text-center min-w-[390px]">ACTIONS (DÉCISION RELANCE)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-medium text-neutral-300">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-neutral-500 font-normal">
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

                      {/* 2. Téléphone */}
                      <td className="py-3 px-3 font-mono text-[11px]">
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
                          className="text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{item.prospect.phone}</span>
                        </a>
                      </td>

                      {/* 3. Secteur */}
                      <td className="py-3 px-3 text-neutral-300 max-w-[140px] truncate">
                        {item.prospect.sector}
                      </td>

                      {/* 4. Date Prévue */}
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

                      {/* 8. ACTIONS: 3 BOUTONS */}
                      <td className="py-2.5 px-3">
                        {item.status === "SCHEDULED" ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {/* REPORTER */}
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => openRescheduleModal(item)}
                              className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-600 hover:text-white text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                              title="Reporter la relance à une date personnalisée"
                            >
                              <Calendar className="w-3 h-3 text-amber-400" />
                              <span>Reporter</span>
                            </button>

                            {/* PAS INTÉRESSÉ */}
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleProcess(item.id, "NOT_INTERESTED")}
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-400 border border-rose-500/30 rounded-lg text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                              title="Marquer comme pas intéressé (clôture)"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Pas intéressé</span>
                            </button>

                            {/* INTÉRESSÉ (+3j) */}
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleProcess(item.id, "INTERESTED")}
                              className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-600 hover:text-white text-emerald-300 border border-emerald-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50 shadow-xs"
                              title="Intéressé : Programmer automatiquement la prochaine relance à J+3"
                            >
                              <Sparkles className="w-3 h-3 text-emerald-400" />
                              <span>Intéressé (+3j)</span>
                            </button>

                            {/* 3. À RELANCER (+7j ou +15j selon étape) */}
                            {isRelance7J ? (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleProcess(item.id, "RETRY_15")}
                                className="px-2.5 py-1 bg-purple-500/15 hover:bg-purple-600 hover:text-white text-purple-300 border border-purple-500/30 rounded-lg text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50 shadow-xs"
                                title="Client en relance après 7 jours : reporter la relance à J+15"
                              >
                                <RotateCw className="w-3 h-3 text-purple-400" />
                                <span>À relancer (+15j)</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleProcess(item.id, "RETRY")}
                                className="px-2.5 py-1 bg-blue-500/15 hover:bg-blue-600 hover:text-white text-blue-300 border border-blue-500/30 rounded-lg text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                title="Reporter la relance à J+7"
                              >
                                <RotateCw className="w-3 h-3 text-blue-400" />
                                <span>À relancer (+7j)</span>
                              </button>
                            )}
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
                <span className="font-mono text-emerald-400">{targetFollowUp.prospect.phone}</span>
              </div>
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
    </div>
  );
}
