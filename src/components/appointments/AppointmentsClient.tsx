"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  APPOINTMENT_TYPES,
  APPOINTMENT_STATUSES,
  OFFER_TYPES,
  OFFER_DETAILS,
  CALL_RESULTS,
} from "@/lib/constants";
import {
  AppointmentType,
  AppointmentStatus,
  OfferType,
  CallResult,
} from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatDateTime, formatDate, toLocalDateString, formatCurrency, buildWhatsAppUrl } from "@/lib/utils";
import { trackCommunicationClick } from "@/lib/tracking";
import { WhatsAppIcon } from "@/components/common/WhatsAppIcon";
import {
  createAppointmentAction,
  updateAppointmentStatus,
  rescheduleAppointmentAction,
  deleteAppointmentAction,
} from "@/actions/appointments";
import { processFollowUpAction, rescheduleFollowUpAction, logFollowUpCallAction } from "@/actions/followups";
import { convertProspectToClient } from "@/actions/prospects";
import {
  CustomOfferConfigurator,
  CustomOfferCalculationResult,
  mergeRemarkWithSummary,
} from "@/components/clients/CustomOfferConfigurator";
import { buildGoogleCalendarUrl, downloadIcsFile } from "@/lib/googleCalendar";
import {
  Calendar as CalendarIcon,
  Calendar,
  Clock,
  MapPin,
  Plus,
  Building,
  Phone,
  PhoneCall,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  UserCheck,
  User,
  List,
  CalendarDays,
  Sparkles,
  Search,
  RefreshCw,
  Globe,
  Check,
  CreditCard,
  AlertTriangle,
  Users,
  Trash2,
  ExternalLink,
  Download,
} from "lucide-react";

const getCommercialBadgeStyle = (name?: string, id?: string) => {
  const palettes = [
    { bg: "bg-blue-500/15", text: "text-blue-300", border: "border-blue-500/30", dot: "bg-blue-400" },
    { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30", dot: "bg-emerald-400" },
    { bg: "bg-purple-500/15", text: "text-purple-300", border: "border-purple-500/30", dot: "bg-purple-400" },
    { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/30", dot: "bg-amber-400" },
    { bg: "bg-rose-500/15", text: "text-rose-300", border: "border-rose-500/30", dot: "bg-rose-400" },
    { bg: "bg-cyan-500/15", text: "text-cyan-300", border: "border-cyan-500/30", dot: "bg-cyan-400" },
    { bg: "bg-indigo-500/15", text: "text-indigo-300", border: "border-indigo-500/30", dot: "bg-indigo-400" },
  ];
  if (!name && !id) return palettes[0];
  const str = name || id || "";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palettes.length;
  return palettes[index];
};

interface AppointmentItem {
  id: string;
  title: string;
  type: AppointmentType;
  status: AppointmentStatus;
  startTime: Date;
  endTime: Date;
  durationMin: number;
  location: string | null;
  notes: string | null;
  user: { id: string; name: string };
  prospect: {
    id: string;
    companyName: string;
    phone: string;
    sector: string;
    status: string;
    address?: string | null;
    email?: string | null;
    notes?: string | null;
    response?: string | null;
    callStatus?: string | null;
  } | null;
  client: { id: string; companyName: string; phone: string } | null;
}

interface Props {
  initialAppointments: AppointmentItem[];
  initialFollowUps?: any[];
  prospectsList: {
    id: string;
    companyName: string;
    phone?: string;
    sector?: string;
    status?: string;
  }[];
  clientsList: { id: string; companyName: string; phone?: string }[];
  salesUsers?: { id: string; name: string; role?: string }[];
  currentUserId?: string;
}

const MONTH_NAMES = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const WEEK_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function AppointmentsClient({
  initialAppointments,
  initialFollowUps = [],
  prospectsList,
  clientsList,
  salesUsers = [],
  currentUserId,
}: Props) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentItem[]>(initialAppointments);
  const [followUps, setFollowUps] = useState<any[]>(initialFollowUps);
  const [viewMode, setViewMode] = useState<"calendar" | "list" | "relances_rdv">("calendar");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("crm_appointments_view_mode");
      if (saved === "calendar" || saved === "list" || saved === "relances_rdv") {
        setViewMode(saved as any);
      } else if (typeof window !== "undefined" && window.innerWidth < 768) {
        setViewMode("list");
      }
    } catch {}
  }, []);

  const handleSetViewMode = (mode: "calendar" | "list" | "relances_rdv") => {
    setViewMode(mode);
    try {
      localStorage.setItem("crm_appointments_view_mode", mode);
    } catch {}
  };

  // Filters for Relances Post-RDV
  const [relanceSearch, setRelanceSearch] = useState("");
  const [relanceStepFilter, setRelanceStepFilter] = useState("");
  const [relanceStatusFilter, setRelanceStatusFilter] = useState("");

  // Commercial Filter: "ALL" for all commercials, or specific user ID
  const [selectedCommercialId, setSelectedCommercialId] = useState<string>("ALL");

  // Current Calendar Month & Year
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Modals state
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentItem | null>(null);

  // Reschedule inline state in detail modal
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleStartTime, setRescheduleStartTime] = useState("14:00");
  const [rescheduleEndTime, setRescheduleEndTime] = useState("15:00");

  // Remark / Cancellation reason in detail modal
  const [statusRemark, setStatusRemark] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Follow-up Reschedule Modal State (Post-RDV)
  const [rescheduleFollowUpModalOpen, setRescheduleFollowUpModalOpen] = useState(false);
  const [targetFollowUp, setTargetFollowUp] = useState<any | null>(null);
  const [followUpRescheduleDate, setFollowUpRescheduleDate] = useState("");
  const [followUpRescheduleNotes, setFollowUpRescheduleNotes] = useState("");
  const [followUpRescheduleBase, setFollowUpRescheduleBase] = useState<"today" | "initial">("today");
  const [followUpModalError, setFollowUpModalError] = useState<string | null>(null);
  const [isFollowUpRescheduling, setIsFollowUpRescheduling] = useState(false);

  // Follow-up Call Modal State (+ APPEL)
  const [followUpCallModalOpen, setFollowUpCallModalOpen] = useState(false);
  const [targetFollowUpCall, setTargetFollowUpCall] = useState<any | null>(null);
  const [followUpCallResult, setFollowUpCallResult] = useState<CallResult>(CallResult.INTERESTED);
  const [followUpCallComment, setFollowUpCallComment] = useState("");
  const [followUpCallDuration, setFollowUpCallDuration] = useState("60");
  const [isLoggingFollowUpCall, setIsLoggingFollowUpCall] = useState(false);

  // New Appointment Form State
  const [form, setForm] = useState({
    title: "",
    type: "COMMERCIAL_VISIT" as AppointmentType,
    targetType: "prospect" as "prospect" | "client",
    targetId: prospectsList[0]?.id || "",
    assignedUserId: currentUserId || salesUsers[0]?.id || "",
    date: toLocalDateString(new Date()),
    startTime: "14:00",
    endTime: "15:00",
    location: "",
    notes: "",
  });

  // Google Calendar Auto-sync option
  const [syncGoogleCalendar, setSyncGoogleCalendar] = useState(true);

  // Search state for prospect/client selection in New Appointment modal
  const [targetSearchQuery, setTargetSearchQuery] = useState("");
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
  const targetDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        targetDropdownRef.current &&
        !targetDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTargetDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedTarget = useMemo(() => {
    if (form.targetType === "prospect") {
      return prospectsList.find((p) => p.id === form.targetId);
    }
    return clientsList.find((c) => c.id === form.targetId);
  }, [form.targetType, form.targetId, prospectsList, clientsList]);

  const filteredTargets = useMemo(() => {
    const list = form.targetType === "prospect" ? prospectsList : clientsList;
    if (!targetSearchQuery.trim()) {
      return list.slice(0, 60);
    }
    const q = targetSearchQuery.toLowerCase().trim();
    return list.filter((item) => {
      const name = (item.companyName || "").toLowerCase();
      const phone = (item.phone || "").toLowerCase();
      const sector = ((item as any).sector || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || sector.includes(q);
    }).slice(0, 60);
  }, [form.targetType, prospectsList, clientsList, targetSearchQuery]);

  // Helper to calculate end date from start date and duration
  const calculateEndDate = (startDate: string, months: number) => {
    if (!startDate) return "";
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + months);
    return toLocalDateString(d);
  };

  // Conversion Form State (Only in Rendez-vous section!)
  const [baseRemark, setBaseRemark] = useState("");
  const [customQuoteSummary, setCustomQuoteSummary] = useState("");

  const [convertForm, setConvertForm] = useState({
    offerType: "STARTER" as OfferType,
    hasWebsite: true,
    durationMonths: 6,
    monthlyFee: 9000,
    contractValue: 9000 * 6,
    contractStart: toLocalDateString(new Date()),
    contractEnd: calculateEndDate(toLocalDateString(new Date()), 6),
    notes: "Conversion suite à rendez-vous commercial",
  });

  const openConvertModal = (appt: AppointmentItem) => {
    setSelectedAppointment(appt);

    // Synchronisation automatique avec la remarque existante du prospect et du RDV
    const remarksParts: string[] = [];
    if (appt.prospect?.notes?.trim()) {
      remarksParts.push(`[Remarque Prospection] : ${appt.prospect.notes.trim()}`);
    }
    if (appt.notes?.trim() && appt.notes.trim() !== appt.prospect?.notes?.trim()) {
      remarksParts.push(`[Remarque RDV] : ${appt.notes.trim()}`);
    }
    const initialRemark =
      remarksParts.length > 0
        ? remarksParts.join("\n\n")
        : `Accord validé lors du rendez-vous "${appt.title}"`;

    setBaseRemark(initialRemark);
    setCustomQuoteSummary("");

    setConvertForm({
      offerType: "STARTER",
      hasWebsite: true,
      monthlyFee: 9000,
      durationMonths: 6,
      contractValue: 54000,
      contractStart: toLocalDateString(new Date()),
      contractEnd: calculateEndDate(toLocalDateString(new Date()), 6),
      notes: initialRemark,
    });
    setConvertModalOpen(true);
  };

  const handleCustomCalculationChange = (result: CustomOfferCalculationResult) => {
    setCustomQuoteSummary(result.summaryText);
    setConvertForm((prev) => {
      const combinedNotes = mergeRemarkWithSummary(baseRemark || prev.notes, result.summaryText);
      const fee = result.monthlyRecurring > 0 ? result.monthlyRecurring : result.recommendedMonthlyFee;

      return {
        ...prev,
        monthlyFee: fee,
        contractValue: result.totalContractValue,
        hasWebsite: result.hasWebsite,
        notes: combinedNotes,
      };
    });
  };

  const handleConvertOfferSelect = (newOffer: OfferType) => {
    let fee = 9000;
    let websiteOpt = false;
    if (newOffer === "STARTER") {
      fee = 9000;
      websiteOpt = true; // Inclus
    } else if (newOffer === "SILVER") {
      fee = 26000;
      websiteOpt = false;
    } else if (newOffer === "GOLD") {
      fee = 36000;
      websiteOpt = false;
    } else {
      // CUSTOM: initialisé ou calculé par le configurateur
      fee = convertForm.monthlyFee || 0;
      websiteOpt = false;
    }

    setConvertForm((prev) => ({
      ...prev,
      offerType: newOffer,
      hasWebsite: websiteOpt,
      monthlyFee: fee,
      contractValue: fee * prev.durationMonths,
      notes: newOffer === "CUSTOM" && customQuoteSummary
        ? mergeRemarkWithSummary(baseRemark || prev.notes, customQuoteSummary)
        : baseRemark || prev.notes,
    }));
  };

  const handleConvertWebsiteToggle = (checked: boolean) => {
    setConvertForm((prev) => {
      let baseFee = 0;
      if (prev.offerType === "SILVER") baseFee = 26000;
      else if (prev.offerType === "GOLD") baseFee = 36000;
      else if (prev.offerType === "STARTER") baseFee = 9000;
      else baseFee = prev.monthlyFee;

      const finalFee =
        prev.offerType === "SILVER" || prev.offerType === "GOLD"
          ? checked
            ? baseFee + 2000
            : baseFee
          : prev.monthlyFee;

      return {
        ...prev,
        hasWebsite: checked,
        monthlyFee: finalFee,
        contractValue: finalFee * prev.durationMonths,
      };
    });
  };

  const handleConvertDurationChange = (months: number) => {
    setConvertForm((prev) => ({
      ...prev,
      durationMonths: months,
      contractValue: prev.monthlyFee * months,
      contractEnd: calculateEndDate(prev.contractStart, months),
    }));
  };

  const handleConvertMonthlyFeeChange = (fee: number) => {
    setConvertForm((prev) => ({
      ...prev,
      monthlyFee: fee,
      contractValue: fee * prev.durationMonths,
    }));
  };

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Open modal prefilled with specific date
  const openNewForDate = (dateStr: string) => {
    setForm((prev) => ({
      ...prev,
      date: dateStr,
      title: "",
    }));
    setNewModalOpen(true);
  };

  // Open Appointment detail modal with prefilled data
  const openAppointmentDetail = (appt: AppointmentItem) => {
    setSelectedAppointment(appt);
    setIsRescheduling(false);
    setStatusRemark(appt.notes || "");
    const d = new Date(appt.startTime);
    setRescheduleDate(toLocalDateString(d));
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    setRescheduleStartTime(`${h}:${m}`);
    const endD = new Date(appt.endTime);
    const endH = String(endD.getHours()).padStart(2, "0");
    const endM = String(endD.getMinutes()).padStart(2, "0");
    setRescheduleEndTime(`${endH}:${endM}`);
    setDetailModalOpen(true);
  };

  // Handle Reschedule submit
  const handleRescheduleSubmit = async () => {
    if (!selectedAppointment) return;
    setIsLoading(true);
    try {
      const res = await rescheduleAppointmentAction({
        id: selectedAppointment.id,
        date: rescheduleDate,
        startTime: rescheduleStartTime,
        endTime: rescheduleEndTime,
        notes: statusRemark.trim() !== "" ? statusRemark.trim() : selectedAppointment.notes || undefined,
      });
      if (res.success && res.appointment) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === selectedAppointment.id ? (res.appointment as any) : a))
        );
        setSelectedAppointment(res.appointment as any);
        setIsRescheduling(false);
        setFeedbackMessage({
          type: "success",
          text: `Rendez-vous reporté avec succès au ${formatDate(res.appointment.startTime)} !`,
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Erreur lors du report du rendez-vous",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Create Appointment
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const startDateTime = `${form.date}T${form.startTime}:00`;
    const endDateTime = `${form.date}T${form.endTime}:00`;

    const res = await createAppointmentAction({
      title: form.title,
      type: form.type,
      startTime: startDateTime,
      endTime: endDateTime,
      location: form.location,
      notes: form.notes,
      prospectId: form.targetType === "prospect" ? form.targetId : undefined,
      clientId: form.targetType === "client" ? form.targetId : undefined,
      assignedUserId: form.assignedUserId,
    });

    setIsLoading(false);
    setNewModalOpen(false);

    if (res.success && res.appointment) {
      if (syncGoogleCalendar) {
        const calUrl =
          (res as any).googleCalendarUrl ||
          buildGoogleCalendarUrl({
            title: form.title,
            startTime: startDateTime,
            endTime: endDateTime,
            location: form.location,
            description: form.notes,
            targetName: selectedTarget?.companyName,
            targetPhone: (selectedTarget as any)?.phone,
            assignedUserName: salesUsers.find((u) => u.id === form.assignedUserId)?.name,
          });
        window.open(calUrl, "_blank", "noopener,noreferrer");
      }

      setAppointments((prev) => [...prev, res.appointment as any]);
      setFeedbackMessage({
        type: "success",
        text: `Rendez-vous "${form.title}" planifié avec succès ${syncGoogleCalendar ? "et ouvert dans Google Calendar" : ""} ! L'indicateur RDV est passé au vert.`,
      });
      router.refresh();
    }
  };

  // Update Status with remark & automatic follow-up creation
  const handleStatusChange = async (
    id: string,
    newStatus: AppointmentStatus,
    customRemark?: string
  ) => {
    setIsLoading(true);
    try {
      const remarkToSave = customRemark !== undefined ? customRemark : statusRemark;
      await updateAppointmentStatus(id, newStatus, remarkToSave);
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: newStatus, notes: remarkToSave || a.notes } : a))
      );
      if (selectedAppointment && selectedAppointment.id === id) {
        setSelectedAppointment((prev) =>
          prev ? { ...prev, status: newStatus, notes: remarkToSave || prev.notes } : null
        );
      }

      const isCompleted = newStatus === AppointmentStatus.COMPLETED;
      const isCancelled = newStatus === AppointmentStatus.CANCELLED;

      setFeedbackMessage({
        type: "success",
        text: isCompleted
          ? `Rendez-vous marqué "Effectué" ! Les relances automatiques à +3j, +7j et +15j ont été programmées.`
          : isCancelled
          ? `Rendez-vous Annulé (Motif enregistré). Les relances automatiques à +3j, +7j et +15j ont été programmées.`
          : `Statut du rendez-vous mis à jour : ${APPOINTMENT_STATUSES[newStatus]?.label}`,
      });
      router.refresh();
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Erreur lors de la mise à jour du statut",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAppointment = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const confirmed = window.confirm("Voulez-vous vraiment supprimer définitivement ce rendez-vous ?");
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const res = await deleteAppointmentAction(id);
      if (res && "error" in res && res.error) {
        setFeedbackMessage({
          type: "error",
          text: res.error,
        });
        return;
      }
      setAppointments((prev) => prev.filter((a) => a.id !== id));
      if (selectedAppointment && selectedAppointment.id === id) {
        setDetailModalOpen(false);
        setSelectedAppointment(null);
      }
      setFeedbackMessage({
        type: "success",
        text: "Rendez-vous supprimé avec succès.",
      });
      router.refresh();
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Erreur lors de la suppression du rendez-vous",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Follow-up action buttons handler
  const handleFollowUpDecision = async (
    followUpId: string,
    decision: "NOT_INTERESTED" | "INTERESTED" | "RETRY" | "RETRY_15"
  ) => {
    setIsLoading(true);
    try {
      const res = await processFollowUpAction({
        followUpId,
        decision,
      });
      if (res.success) {
        setFeedbackMessage({
          type: "success",
          text:
            decision === "NOT_INTERESTED"
              ? "Relance clôturée : Prospect marqué non intéressé."
              : decision === "INTERESTED"
              ? "Relance validée ! Nouvelle relance programmée à J+3 dans le calendrier."
              : decision === "RETRY_15"
              ? "Relance reportée : Nouvelle relance programmée à J+15 dans le calendrier."
              : "Relance reportée : Nouvelle relance programmée à J+7 dans le calendrier.",
        });
        window.location.reload();
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Erreur lors du traitement de la relance",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openFollowUpReschedule = (item: any) => {
    setTargetFollowUp(item);
    setFollowUpModalError(null);
    const itemDate = new Date(item.scheduledAt);
    const isFuture = !isNaN(itemDate.getTime()) && itemDate > new Date();
    const defaultBase: "today" | "initial" = isFuture ? "initial" : "today";
    setFollowUpRescheduleBase(defaultBase);

    const baseDate = defaultBase === "initial" ? itemDate : new Date();
    const nextDay = new Date(baseDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const targetStr = toLocalDateString(nextDay);
    setFollowUpRescheduleDate(targetStr);
    setFollowUpRescheduleNotes(item.notes || `Relance reportée au ${formatDate(nextDay)} (+1j)`);
    setRescheduleFollowUpModalOpen(true);
  };

  const handleFollowUpQuickAddDays = (days: number, forceBase?: "today" | "initial", executeNow = false) => {
    const baseChoice = forceBase || followUpRescheduleBase;
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
    setFollowUpRescheduleDate(dateStr);

    const label = days === 1 ? "Demain (+1j)" : `+${days} jours`;
    const newNote = `Relance reportée de ${days} jour${days > 1 ? "s" : ""} au ${formatDate(target)} (${label})`;
    setFollowUpRescheduleNotes(newNote);

    if (executeNow) {
      handleExecuteFollowUpReschedule(dateStr, newNote);
    }
  };

  const handleExecuteFollowUpReschedule = async (targetDate: string, targetNotes: string) => {
    if (!targetFollowUp || !targetDate) return;
    setIsFollowUpRescheduling(true);
    setFollowUpModalError(null);
    try {
      const res = await rescheduleFollowUpAction({
        followUpId: targetFollowUp.id,
        scheduledAt: targetDate,
        notes: targetNotes,
      });
      if (res.success) {
        setFeedbackMessage({
          type: "success",
          text: `Relance reportée avec succès au ${formatDate(targetDate)} et programmée dans le calendrier.`,
        });
        setRescheduleFollowUpModalOpen(false);
        setTargetFollowUp(null);
        window.location.reload();
      }
    } catch (err: any) {
      setFollowUpModalError(err?.message || "Erreur lors du report de la relance");
    } finally {
      setIsFollowUpRescheduling(false);
    }
  };

  const handleFollowUpRescheduleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetFollowUp || !followUpRescheduleDate) return;
    await handleExecuteFollowUpReschedule(followUpRescheduleDate, followUpRescheduleNotes);
  };

  const openFollowUpCallModal = (item: any) => {
    setTargetFollowUpCall(item);
    setFollowUpCallResult(CallResult.INTERESTED);
    setFollowUpCallComment(item.notes || "");
    setFollowUpCallDuration("60");
    setFollowUpCallModalOpen(true);
  };

  const handleFollowUpCallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetFollowUpCall) return;

    setIsLoggingFollowUpCall(true);
    try {
      const res = await logFollowUpCallAction({
        followUpId: targetFollowUpCall.id,
        result: followUpCallResult,
        comment: followUpCallComment,
        durationSeconds: Number(followUpCallDuration) || 60,
      });

      if (res.success) {
        setFeedbackMessage({
          type: "success",
          text: `✓ Appel enregistré avec succès ! Le prospect "${targetFollowUpCall.prospect?.companyName || "Prospect"}" a été ajouté dans la section Appels.`,
        });
        setFollowUpCallModalOpen(false);
        setTargetFollowUpCall(null);
        window.location.reload();
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Erreur lors de l'enregistrement de l'appel",
      });
    } finally {
      setIsLoggingFollowUpCall(false);
    }
  };

  // Convert Prospect to Client (Directly from Rendez-vous!)
  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment?.prospect) return;
    setIsLoading(true);

    const res = await convertProspectToClient({
      prospectId: selectedAppointment.prospect.id,
      offerType: convertForm.offerType,
      hasWebsite: convertForm.hasWebsite,
      contractValue: Number(convertForm.contractValue),
      monthlyFee: Number(convertForm.monthlyFee),
      contractStart: convertForm.contractStart,
      contractEnd: convertForm.contractEnd,
      notes: convertForm.notes,
    });

    setIsLoading(false);
    if (res.error) {
      setFeedbackMessage({ type: "error", text: res.error });
      return;
    }

    // Mark appointment completed
    await updateAppointmentStatus(selectedAppointment.id, AppointmentStatus.COMPLETED);

    setConvertModalOpen(false);
    setDetailModalOpen(false);
    setFeedbackMessage({
      type: "success",
      text: `Félicitations ! Le prospect "${selectedAppointment.prospect.companyName}" a été officiellement converti en client avec succès !`,
    });
    window.location.reload();
  };

  // Filtered follow-ups for post-RDV relances
  const filteredFollowUps = useMemo(() => {
    return followUps.filter((item: any) => {
      const prospect = item.prospect;
      if (!prospect) return false;

      const matchesCommercial =
        !selectedCommercialId ||
        selectedCommercialId === "ALL" ||
        item.userId === selectedCommercialId ||
        item.user?.id === selectedCommercialId;

      const matchesSearch =
        !relanceSearch ||
        prospect.companyName?.toLowerCase().includes(relanceSearch.toLowerCase()) ||
        prospect.phone?.includes(relanceSearch) ||
        item.user?.name?.toLowerCase().includes(relanceSearch.toLowerCase());

      const matchesStep = !relanceStepFilter || String(item.stepNumber) === relanceStepFilter;

      const lastAppt = prospect.appointments?.[0];
      const matchesStatus =
        !relanceStatusFilter ||
        (relanceStatusFilter === "COMPLETED" && lastAppt?.status === "COMPLETED") ||
        (relanceStatusFilter === "CANCELLED" && lastAppt?.status === "CANCELLED");

      return matchesCommercial && matchesSearch && matchesStep && matchesStatus;
    });
  }, [followUps, selectedCommercialId, relanceSearch, relanceStepFilter, relanceStatusFilter]);

  const filteredAppointments = useMemo(() => {
    if (!selectedCommercialId || selectedCommercialId === "ALL") {
      return appointments;
    }
    return appointments.filter((a) => a.user?.id === selectedCommercialId);
  }, [appointments, selectedCommercialId]);

  // Today's Appointments Computation
  const todayStr = toLocalDateString(new Date());

  const todayFormatted = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date());
    } catch {
      return "Aujourd'hui";
    }
  }, []);

  const todayAppointments = useMemo(() => {
    return filteredAppointments
      .filter((a) => toLocalDateString(a.startTime) === todayStr)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [filteredAppointments, todayStr]);

  // Calendar Grid Computations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday-based index: 0 = Mon, 6 = Sun
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: {
      date: Date;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      appointments: AppointmentItem[];
    }[] = [];

    // Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const dateStr = toLocalDateString(d);
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        appointments: filteredAppointments.filter(
          (a) => toLocalDateString(a.startTime) === dateStr
        ),
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= lastDayOfMonth.getDate(); dayNum++) {
      const d = new Date(year, month, dayNum);
      const dateStr = toLocalDateString(d);
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        appointments: filteredAppointments.filter(
          (a) => toLocalDateString(a.startTime) === dateStr
        ),
      });
    }

    // Next month padding days to complete grid (multiples of 7)
    const remainingDays = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = toLocalDateString(d);
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        appointments: filteredAppointments.filter(
          (a) => toLocalDateString(a.startTime) === dateStr
        ),
      });
    }

    return days;
  }, [year, month, filteredAppointments]);

  const monthAppointmentsCount = useMemo(() => {
    return filteredAppointments.filter((a) => {
      const d = new Date(a.startTime);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length;
  }, [filteredAppointments, year, month]);

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
              Gestion & Organisation des Rendez-vous
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                {filteredAppointments.length} RDV {selectedCommercialId === "ALL" ? "au total" : "filtré(s)"}
              </span>
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Agenda commercial interactif : visualisez, planifiez et convertissez vos prospects en clients officiels
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            {/* View Toggle */}
            <div className="flex flex-wrap bg-neutral-900 border border-neutral-800 rounded-xl p-1 text-xs">
              <button
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 font-semibold rounded-lg transition-colors cursor-pointer ${
                  viewMode === "calendar"
                    ? "bg-neutral-800 text-white shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Calendrier</span>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 font-semibold rounded-lg transition-colors cursor-pointer ${
                  viewMode === "list"
                    ? "bg-neutral-800 text-white shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Liste ({filteredAppointments.length})</span>
              </button>
              <button
                onClick={() => setViewMode("relances_rdv")}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 font-semibold rounded-lg transition-colors cursor-pointer ${
                  viewMode === "relances_rdv"
                    ? "bg-neutral-800 text-white shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Relances ({filteredFollowUps.length})</span>
              </button>
            </div>

            <Button
              size="sm"
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  date: toLocalDateString(new Date()),
                  title: "",
                }));
                setNewModalOpen(true);
              }}
              className="gap-1.5 shadow-md shadow-blue-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau RDV</span>
            </Button>
          </div>
        </div>

        {/* Commercial Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-neutral-900/60 border border-neutral-800 rounded-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs shadow-xs">
              <Users className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="text-neutral-400 font-medium whitespace-nowrap">Filtrer par commercial :</span>
              <select
                value={selectedCommercialId}
                onChange={(e) => setSelectedCommercialId(e.target.value)}
                className="bg-transparent text-neutral-100 font-semibold focus:outline-none cursor-pointer pr-1"
              >
                <option value="ALL" className="bg-neutral-900 text-neutral-100">
                  Tous les commerciaux ({appointments.length} RDV)
                </option>
                {salesUsers.map((u) => {
                  const count = appointments.filter((a) => a.user?.id === u.id).length;
                  return (
                    <option key={u.id} value={u.id} className="bg-neutral-900 text-neutral-100">
                      {u.name} {u.id === currentUserId ? "(Moi)" : ""} ({count} RDV)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Quick Filter Shortcuts */}
            <div className="flex items-center bg-neutral-950/80 border border-neutral-800 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedCommercialId("ALL")}
                className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  selectedCommercialId === "ALL"
                    ? "bg-purple-600 text-white shadow-sm font-semibold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Tous ({appointments.length})
              </button>
              {currentUserId && (
                <button
                  type="button"
                  onClick={() => setSelectedCommercialId(currentUserId)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    selectedCommercialId === currentUserId
                      ? "bg-purple-600 text-white shadow-sm font-semibold"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  Mes RDV ({appointments.filter((a) => a.user?.id === currentUserId).length})
                </button>
              )}
            </div>
          </div>

          {/* Active filter indication */}
          <div className="text-xs text-neutral-400 flex items-center gap-1.5 px-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Affichage :{" "}
              <strong className="text-neutral-200">
                {selectedCommercialId === "ALL"
                  ? "Tous les commerciaux réunis"
                  : salesUsers.find((u) => u.id === selectedCommercialId)?.name || "Commercial sélectionné"}
              </strong>
            </span>
          </div>
        </div>
      </div>

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

      {/* SECTION RENDEZ-VOUS DU JOUR */}
      <div className="bg-gradient-to-br from-neutral-900/90 via-neutral-900/80 to-neutral-950 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
        {/* En-tête de la section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 shadow-xs">
              <CalendarDays className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-neutral-100 flex items-center gap-2">
                  <span>Rendez-vous du jour</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {todayAppointments.length} RDV aujourd'hui
                  </span>
                </h3>
              </div>
              <p className="text-xs text-neutral-400 capitalize mt-0.5">
                {todayFormatted}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => openNewForDate(todayStr)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Planifier un RDV aujourd'hui</span>
            </button>
          </div>
        </div>

        {/* Liste des rendez-vous du jour ou état vide */}
        {todayAppointments.length === 0 ? (
          <div className="py-6 px-4 text-center rounded-xl bg-neutral-950/40 border border-dashed border-neutral-800/80 flex flex-col items-center justify-center gap-2">
            <div className="w-9 h-9 rounded-full bg-neutral-800/60 text-neutral-400 flex items-center justify-center">
              <Clock className="w-4 h-4 text-neutral-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-300">
                Aucun rendez-vous planifié pour aujourd'hui
              </p>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Tous vos créneaux du jour sont libres pour la prospection ou le suivi client.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openNewForDate(todayStr)}
              className="mt-1 text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer underline"
            >
              + Planifier un rendez-vous maintenant
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {todayAppointments.map((appt) => {
              const d = new Date(appt.startTime);
              const endD = new Date(appt.endTime);
              const startH = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
              const endH = `${String(endD.getHours()).padStart(2, "0")}:${String(endD.getMinutes()).padStart(2, "0")}`;
              const targetName = appt.prospect?.companyName || appt.client?.companyName || appt.title;
              const phone = appt.prospect?.phone || appt.client?.phone;
              const sector = appt.prospect?.sector;
              const badge = getCommercialBadgeStyle(appt.user?.name, appt.user?.id);

              const statusBadge =
                appt.status === "COMPLETED"
                  ? { bg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", label: "✓ Effectué" }
                  : appt.status === "CANCELLED"
                  ? { bg: "bg-rose-500/15 text-rose-300 border-rose-500/30", label: "✗ Annulé" }
                  : { bg: "bg-blue-500/15 text-blue-300 border-blue-500/30", label: "⏳ Planifié" };

              return (
                <div
                  key={appt.id}
                  onClick={() => openAppointmentDetail(appt)}
                  className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800 hover:border-blue-500/50 hover:bg-neutral-900/90 transition-all cursor-pointer shadow-sm group flex flex-col justify-between relative space-y-3"
                >
                  {/* Ligne 1 : Horaires + Badge statut */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-750 text-blue-400 font-mono text-xs font-bold shrink-0">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      <span>{startH} - {endH}</span>
                    </div>

                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${statusBadge.bg}`}>
                      {statusBadge.label}
                    </span>
                  </div>

                  {/* Ligne 2 : Informations Prospect / Client */}
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-neutral-100 group-hover:text-blue-300 transition-colors line-clamp-1 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span>{targetName}</span>
                    </h4>

                    {appt.title && appt.title !== targetName && (
                      <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                        {appt.title}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {sector && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 border border-neutral-750 font-medium">
                          {sector}
                        </span>
                      )}

                      {appt.location && (
                        <span className="text-[10px] text-neutral-400 flex items-center gap-1 truncate max-w-[180px]">
                          <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
                          <span className="truncate">{appt.location}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ligne 3 : Commercial + Actions directes (Appel, WhatsApp, Gérer) */}
                  <div className="pt-2 border-t border-neutral-850 flex items-center justify-between gap-2 text-xs">
                    {/* Badge commercial */}
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium ${badge.bg} ${badge.border} ${badge.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      <span className="truncate max-w-[110px]">{appt.user?.name || "Assigné"}</span>
                    </div>

                    {/* Raccourcis d'appel & détails */}
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {phone && (
                        <>
                          <a
                            href={`tel:${phone}`}
                            className="p-1.5 rounded-lg bg-neutral-850 hover:bg-emerald-600/20 text-neutral-300 hover:text-emerald-400 transition"
                            title={`Appeler ${phone}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={`https://wa.me/${phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-neutral-850 hover:bg-emerald-600/20 text-neutral-300 hover:text-emerald-400 transition"
                            title="Message WhatsApp"
                          >
                            <Globe className="w-3.5 h-3.5 text-emerald-400" />
                          </a>
                        </>
                      )}
                      <a
                        href={buildGoogleCalendarUrl({
                          title: appt.title,
                          startTime: appt.startTime,
                          endTime: appt.endTime,
                          location: appt.location,
                          description: appt.notes,
                          targetName: appt.prospect?.companyName || appt.client?.companyName || null,
                          targetPhone: phone || null,
                          assignedUserName: appt.user?.name || null,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-neutral-850 hover:bg-blue-600/20 text-neutral-400 hover:text-blue-400 transition"
                        title="Ajouter à Google Agenda (Google Calendar)"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => openAppointmentDetail(appt)}
                        className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-semibold transition cursor-pointer"
                      >
                        Gérer →
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteAppointment(appt.id, e)}
                        className="p-1.5 rounded-lg bg-neutral-850 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 transition cursor-pointer"
                        title="Supprimer ce rendez-vous"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 1. VUE CALENDRIER INTERACTIF */}
      {viewMode === "calendar" && (
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          {/* Calendar Header: Month/Year navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-neutral-100 capitalize flex items-center gap-2">
                <span>{MONTH_NAMES[month]} {year}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-normal">
                  {monthAppointmentsCount} RDV ce mois-ci
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                title="Mois précédent"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={handleToday}
                className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Aujourd'hui
              </button>

              <button
                onClick={handleNextMonth}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                title="Mois suivant"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calendar Day Grid Scroll Wrapper */}
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700 pb-2 w-full min-w-0">
            <div className="min-w-[620px] space-y-2">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEK_DAYS.map((wDay) => (
                  <div
                    key={wDay}
                    className="py-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400 bg-neutral-950/60 rounded-lg border border-neutral-800/50"
                  >
                    {wDay}
                  </div>
                ))}
              </div>

              {/* Calendar Day Cells Grid */}
              <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((dayItem, idx) => {
              const dayNum = dayItem.date.getDate();

              return (
                <div
                  key={idx}
                  className={`min-h-[115px] p-2 rounded-xl border flex flex-col justify-between transition-all group ${
                    dayItem.isCurrentMonth
                      ? dayItem.isToday
                        ? "bg-blue-950/20 border-blue-500/60 shadow-md shadow-blue-500/10"
                        : "bg-neutral-950/70 border-neutral-800/80 hover:border-neutral-700"
                      : "bg-neutral-950/30 border-neutral-900/60 opacity-40 hover:opacity-75"
                  }`}
                >
                  {/* Top Day Header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        dayItem.isToday
                          ? "bg-blue-600 text-white shadow-xs"
                          : dayItem.isCurrentMonth
                          ? "text-neutral-200"
                          : "text-neutral-500"
                      }`}
                    >
                      {dayNum}
                    </span>

                    {/* Quick Add Button on Hover */}
                    <button
                      onClick={() => openNewForDate(dayItem.dateStr)}
                      className="opacity-0 group-hover:opacity-100 p-1 bg-neutral-800 hover:bg-blue-600 hover:text-white rounded-md text-neutral-400 transition-all cursor-pointer"
                      title="Planifier un RDV ce jour"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Appointments list inside cell */}
                  <div className="space-y-1.5 my-1 overflow-hidden">
                    {dayItem.appointments.slice(0, 4).map((appt) => {
                      const startTimeStr = new Date(appt.startTime).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      const targetName =
                        appt.prospect?.companyName || appt.client?.companyName || appt.title;

                      const isCompleted = appt.status === "COMPLETED";
                      const isCancelled = appt.status === "CANCELLED";
                      const isRelance = appt.type === "PHONE" || appt.title.toLowerCase().includes("relance");
                      const commBadge = getCommercialBadgeStyle(appt.user?.name, appt.user?.id);

                      return (
                        <div
                          key={appt.id}
                          onClick={() => openAppointmentDetail(appt)}
                          className={`group/item relative px-1.5 py-1 rounded-md text-[10px] font-medium border cursor-pointer transition-all hover:scale-[1.02] flex flex-col gap-0.5 ${
                            isCompleted
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : isCancelled
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30 line-through"
                              : isRelance
                              ? "bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25"
                              : "bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30"
                          }`}
                          title={`${isRelance ? "📞 Relance : " : ""}${startTimeStr} - ${targetName} (${appt.title}) — Commercial : ${appt.user?.name || "Non assigné"}`}
                        >
                          <div className="flex items-center justify-between gap-1 w-full min-w-0">
                            <span className="font-mono font-bold shrink-0 flex items-center gap-1">
                              {isRelance && <Phone className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                              {startTimeStr}
                            </span>
                            <span className="truncate font-semibold text-neutral-100">{targetName}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => handleDeleteAppointment(appt.id, e)}
                                className="opacity-0 group-hover/item:opacity-100 p-0.5 rounded hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 transition"
                                title="Supprimer ce rendez-vous"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                              {isRelance ? (
                                <span className="text-[8px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold shrink-0">
                                  Relance
                                </span>
                              ) : appt.prospect ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-[9px] truncate">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${commBadge.dot}`} />
                            <span className={`truncate ${commBadge.text} font-medium`}>
                              {appt.user?.name ? appt.user.name.replace(/ \([^)]*\)/, "") : "Commercial"}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {dayItem.appointments.length > 4 && (
                      <p
                        onClick={() => openNewForDate(dayItem.dateStr)}
                        className="text-[9px] font-semibold text-blue-400 cursor-pointer hover:underline text-center"
                      >
                        +{dayItem.appointments.length - 4} autres
                      </p>
                    )}
                  </div>

                  {/* Empty state bottom hint */}
                  {dayItem.appointments.length === 0 && (
                    <div className="h-4" />
                  )}
                </div>
              );
            })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. VUE LISTE DETAILLEE */}
      {viewMode === "list" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAppointments.length === 0 && (
            <div className="col-span-full py-16 text-center text-neutral-500 bg-neutral-900/40 rounded-2xl border border-neutral-800">
              Aucun rendez-vous trouvé pour les filtres sélectionnés.
            </div>
          )}

          {filteredAppointments.map((appt) => {
            const statusConfig = APPOINTMENT_STATUSES[appt.status] || {
              label: appt.status,
              color: "bg-neutral-800 text-neutral-300",
            };
            const commBadge = getCommercialBadgeStyle(appt.user?.name, appt.user?.id);

            const targetName = appt.prospect?.companyName || appt.client?.companyName || "Entreprise";
            const isProspect = !!appt.prospect;
            const isConverted = appt.prospect?.status === "CONVERTED";

            return (
              <div
                key={appt.id}
                className="bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 space-y-4 flex flex-col justify-between transition-all shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border flex items-center gap-1 ${commBadge.bg} ${commBadge.text} ${commBadge.border}`}>
                          <User className="w-2.5 h-2.5 shrink-0" />
                          <span>{appt.user?.name || "Commercial"}</span>
                        </span>
                        {isProspect && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Prospect
                          </span>
                        )}
                        {isConverted && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ✓ Client Signé
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-semibold text-neutral-100 mt-2">
                        {appt.title}
                      </h3>
                      <p className="text-xs text-blue-400 font-medium flex items-center gap-1 mt-0.5">
                        <Building className="w-3.5 h-3.5" />
                        <span>{targetName}</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-neutral-300">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <CalendarIcon className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{formatDateTime(appt.startTime)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-neutral-400">
                      <Clock className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{appt.durationMin} minutes ({APPOINTMENT_TYPES[appt.type]})</span>
                    </div>

                    {appt.location && (
                      <div className="flex items-center gap-2 text-neutral-400">
                        <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{appt.location}</span>
                      </div>
                    )}
                  </div>

                  {appt.notes && (
                    <p className="p-2.5 bg-neutral-950/60 border border-neutral-800/80 rounded-xl text-[11px] text-neutral-400">
                      {appt.notes}
                    </p>
                  )}
                </div>

                {/* Actions Bar: Status & Convert to Client */}
                <div className="pt-3 border-t border-neutral-800 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-neutral-500">Par {appt.user.name}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openAppointmentDetail(appt)}
                        className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        Fiche RDV
                      </button>
                      <a
                        href={buildGoogleCalendarUrl({
                          title: appt.title,
                          startTime: appt.startTime,
                          endTime: appt.endTime,
                          location: appt.location,
                          description: appt.notes,
                          targetName: targetName,
                          targetPhone: appt.prospect?.phone || appt.client?.phone || null,
                          assignedUserName: appt.user.name,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/20 rounded-lg text-[10px] font-semibold transition-colors flex items-center gap-1"
                        title="Ajouter à Google Agenda"
                      >
                        <Calendar className="w-3 h-3" />
                        <span>Agenda</span>
                      </a>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteAppointment(appt.id, e)}
                        className="p-1.5 bg-neutral-800 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 border border-neutral-700 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                        title="Supprimer définitivement ce rendez-vous"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {appt.status === "SCHEDULED" && (
                        <>
                          <button
                            onClick={() => {
                              openAppointmentDetail(appt);
                              setIsRescheduling(true);
                            }}
                            className="px-2 py-1 bg-amber-500/15 text-amber-300 hover:bg-amber-600 hover:text-white border border-amber-500/30 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                            title="Reporter la date ou l'heure de ce rendez-vous"
                          >
                            Reporter
                          </button>
                          <button
                            onClick={() => handleStatusChange(appt.id, AppointmentStatus.COMPLETED)}
                            className="px-2 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                          >
                            Effectué
                          </button>
                          <button
                            onClick={() => handleStatusChange(appt.id, AppointmentStatus.CANCELLED)}
                            className="px-2 py-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                          >
                            Annuler
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* CONVERTIR EN CLIENT BUTTON (DANS LA SECTION RENDEZ-VOUS) */}
                  {isProspect && !isConverted && (
                    <button
                      onClick={() => openConvertModal(appt)}
                      className="w-full py-1.5 px-3 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Convertir en Client Officiel</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. VUE RELANCES POST-RDV (EFFECTUES & ANNULES : +3J, +7J, +15J) */}
      {viewMode === "relances_rdv" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-neutral-900/60 border border-neutral-800 p-3 rounded-2xl">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Rechercher prospect, téléphone..."
                value={relanceSearch}
                onChange={(e) => setRelanceSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <select
              value={relanceStepFilter}
              onChange={(e) => setRelanceStepFilter(e.target.value)}
              className="h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-purple-500"
            >
              <option value="">Toutes les étapes (+3j, +7j, +15j)</option>
              <option value="1">Étape 1 (+3 jours)</option>
              <option value="2">Étape 2 (+7 jours)</option>
              <option value="3">Étape 3 (+15 jours)</option>
            </select>

            <select
              value={relanceStatusFilter}
              onChange={(e) => setRelanceStatusFilter(e.target.value)}
              className="h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-purple-500"
            >
              <option value="">Tous les types de RDV</option>
              <option value="COMPLETED">RDV Effectués (✓)</option>
              <option value="CANCELLED">RDV Annulés (✗)</option>
            </select>

            <div className="flex items-center justify-between px-3 py-1 bg-neutral-950/60 border border-neutral-800/80 rounded-xl text-xs text-neutral-400">
              <span>Total relances :</span>
              <span className="font-bold text-purple-400 text-sm">
                {filteredFollowUps.length} relance(s)
              </span>
            </div>
          </div>

          {/* TABLEAU 10 COLONNES DE PROSPECTION */}
          <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-neutral-950/90 border-b border-neutral-800 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">CLIENT</th>
                    <th className="py-3 px-3">NUMERO</th>
                    <th className="py-3 px-3">DATE</th>
                    <th className="py-3 px-3">TYPE</th>
                    <th className="py-3 px-3">ADRESS</th>
                    <th className="py-3 px-3">APPEL</th>
                    <th className="py-3 px-3 text-emerald-400">RÉSULTAT D'APPEL</th>
                    <th className="py-3 px-3">MAIL</th>
                    <th className="py-3 px-3">REPENSE</th>
                    <th className="py-3 px-3">REMARQUE</th>
                    <th className="py-3 px-3 text-blue-400 bg-blue-950/20">COMMERCIAL</th>
                    <th className="py-3 px-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-medium text-neutral-300">
                  {filteredFollowUps.length === 0 && (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-neutral-500 font-normal">
                        Aucune relance post-rendez-vous enregistrée. Dès qu'un RDV est marqué "Effectué" ou "Annulé", ses relances automatiques à +3j, +7j et +15j apparaîtront directement ici.
                      </td>
                    </tr>
                  )}

                  {filteredFollowUps.map((item: any) => {
                    const prospect = item.prospect;
                    if (!prospect) return null;

                    const lastAppt = prospect.appointments?.[0];
                    const isCompleted = lastAppt?.status === "COMPLETED";
                    const isCancelled = lastAppt?.status === "CANCELLED";

                    const stepBadge =
                      item.stepNumber === 1
                        ? "+3j"
                        : item.stepNumber === 2
                        ? "+7j"
                        : "+15j";

                    return (
                      <tr key={item.id} className="hover:bg-neutral-800/40 transition-colors">
                        {/* 1. CLIENT */}
                        <td className="py-2.5 px-3 font-semibold text-neutral-100 max-w-[200px]">
                          <div className="flex items-center gap-1.5 truncate">
                            <Building className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="truncate">{prospect.companyName}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {isCompleted && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                                ✓ RDV Effectué
                              </span>
                            )}
                            {isCancelled && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold">
                                ✗ RDV Annulé
                              </span>
                            )}
                            {!isCompleted && !isCancelled && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                                RDV
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. NUMERO */}
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          <a
                            href={`tel:${prospect.phone}`}
                            onClick={() => {
                              trackCommunicationClick({
                                type: "PHONE",
                                targetName: prospect.companyName || prospect.contactName,
                                phone: prospect.phone,
                                entityType: "PROSPECT",
                                entityId: prospect.id,
                              });
                            }}
                            className="text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{prospect.phone}</span>
                          </a>
                        </td>

                        {/* 3. DATE */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-neutral-200 font-medium">
                              {formatDate(item.scheduledAt)}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold font-mono">
                              {stepBadge}
                            </span>
                          </div>
                        </td>

                        {/* 4. TYPE */}
                        <td className="py-2.5 px-3">
                          <span className="text-blue-400 font-medium">{prospect.sector || "Général"}</span>
                        </td>

                        {/* 5. ADRESS */}
                        <td className="py-2.5 px-3 text-neutral-400">
                          {prospect.wilaya || prospect.address || "Alger"}
                        </td>

                        {/* 6. APPEL */}
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-800 text-neutral-300 border border-neutral-700 font-medium">
                            {prospect.callStatus || "EFFECTUE"}
                          </span>
                        </td>

                        {/* 7. RÉSULTAT D'APPEL */}
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {isCompleted ? "Intéressé (Post-RDV)" : isCancelled ? "À rappeler" : "RDV Fixé"}
                          </span>
                        </td>

                        {/* 8. MAIL */}
                        <td className="py-2.5 px-3 text-neutral-400 font-mono text-[11px]">
                          {prospect.email || "—"}
                        </td>

                        {/* 9. REPENSE */}
                        <td className="py-2.5 px-3 text-neutral-300 max-w-[140px] truncate" title={prospect.response || ""}>
                          {prospect.response || (isCompleted ? "RDV effectué" : isCancelled ? "RDV non honoré" : "En attente")}
                        </td>

                        {/* 10. REMARQUE (Raison d'annulation ou Remarque post-RDV) */}
                        <td className="py-2.5 px-3 text-neutral-200 max-w-[220px] truncate" title={item.notes || lastAppt?.notes || ""}>
                          {item.notes || lastAppt?.notes || "Aucune remarque"}
                        </td>

                        {/* 11. COMMERCIAL */}
                        <td className="py-2.5 px-3 text-neutral-300 font-medium bg-blue-950/10">
                          {prospect.assignedTo?.name || item.user?.name || "Non assigné"}
                        </td>

                        {/* 12. ACTIONS */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* REPORTER */}
                            <button
                              type="button"
                              onClick={() => openFollowUpReschedule(item)}
                              className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-400 border border-amber-500/20 rounded-md text-[10px] font-semibold transition-colors cursor-pointer"
                              title="Reporter la relance à une date personnalisée"
                            >
                              Reporter
                            </button>

                            {/* + APPEL (AJOUTER DANS LES APPELS) */}
                            <button
                              type="button"
                              onClick={() => openFollowUpCallModal(item)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm active:scale-[0.98]"
                              title="Enregistrer un appel et ajouter dans les appels"
                            >
                              <PhoneCall className="w-3 h-3" />
                              <span>+ APPEL</span>
                            </button>

                            {prospect.status !== "CONVERTED" && (
                              <button
                                type="button"
                                onClick={() => {
                                  openConvertModal({
                                    id: lastAppt?.id || item.id,
                                    title: `RDV - ${prospect.companyName}`,
                                    type: "COMMERCIAL_VISIT",
                                    status: "COMPLETED",
                                    startTime: new Date(),
                                    endTime: new Date(),
                                    durationMin: 60,
                                    location: null,
                                    notes: item.notes,
                                    user: item.user,
                                    prospect: prospect,
                                    client: null,
                                  });
                                }}
                                className="px-2 py-1 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white rounded-md text-[10px] font-bold transition-colors cursor-pointer"
                                title="Convertir ce prospect en client officiel"
                              >
                                Convertir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: DETAIL DU RENDEZ-VOUS (AU CLIC DEPUIS LE CALENDRIER) */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={selectedAppointment?.title || "Détail du Rendez-vous"}
        description="Fiche complète du rendez-vous, modification du statut et conversion commerciale"
        maxWidth="lg"
      >
        {selectedAppointment && (
          <div className="space-y-4">
            {/* Target Header Card */}
            <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400">Entreprise concernée :</p>
                <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2 mt-0.5">
                  <Building className="w-4 h-4 text-blue-400" />
                  <span>
                    {selectedAppointment.prospect?.companyName ||
                      selectedAppointment.client?.companyName}
                  </span>
                  {selectedAppointment.prospect && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                      Prospect
                    </span>
                  )}
                </h3>
                {(selectedAppointment.prospect?.phone || selectedAppointment.client?.phone) && (
                  <a
                    href={`tel:${selectedAppointment.prospect?.phone || selectedAppointment.client?.phone}`}
                    onClick={() => {
                      const phone = selectedAppointment.prospect?.phone || selectedAppointment.client?.phone;
                      const targetName = selectedAppointment.prospect?.companyName || selectedAppointment.client?.companyName;
                      trackCommunicationClick({
                        type: "PHONE",
                        targetName,
                        phone,
                        entityType: selectedAppointment.client ? "CLIENT" : "PROSPECT",
                        entityId: selectedAppointment.id,
                      });
                    }}
                    className="text-xs text-emerald-400 hover:underline flex items-center gap-1 mt-1 font-mono"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{selectedAppointment.prospect?.phone || selectedAppointment.client?.phone}</span>
                  </a>
                )}
              </div>

              <div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    APPOINTMENT_STATUSES[selectedAppointment.status]?.color
                  }`}
                >
                  {APPOINTMENT_STATUSES[selectedAppointment.status]?.label}
                </span>
              </div>
            </div>

            {/* Appointment Meta info */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-neutral-900/60 p-3.5 rounded-xl border border-neutral-800">
              <div className="space-y-1">
                <span className="text-neutral-400 font-medium">Commercial assigné :</span>
                <p className="font-semibold text-neutral-200 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>{selectedAppointment.user?.name || "Non assigné"}</span>
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-neutral-400 font-medium">Type & Durée :</span>
                <p className="font-semibold text-neutral-200">
                  {APPOINTMENT_TYPES[selectedAppointment.type]} ({selectedAppointment.durationMin} min)
                </p>
              </div>

              <div className="space-y-1 col-span-2">
                <span className="text-neutral-400 font-medium">Date & Heure :</span>
                <p className="font-semibold text-neutral-200 text-sm">
                  {formatDateTime(selectedAppointment.startTime)}
                </p>
              </div>

              {/* Formulaire inline de report / modification de date */}
              {isRescheduling && (
                <div className="col-span-2 p-3 bg-neutral-950 border border-blue-500/40 rounded-xl space-y-3 mt-1 shadow-inner">
                  <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Reporter ce rendez-vous à une nouvelle date :</span>
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      label="Nouvelle Date"
                      type="date"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      required
                    />
                    <Input
                      label="Heure Début"
                      type="time"
                      value={rescheduleStartTime}
                      onChange={(e) => setRescheduleStartTime(e.target.value)}
                      required
                    />
                    <Input
                      label="Heure Fin"
                      type="time"
                      value={rescheduleEndTime}
                      onChange={(e) => setRescheduleEndTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => setIsRescheduling(false)}
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      isLoading={isLoading}
                      onClick={handleRescheduleSubmit}
                      className="bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      Enregistrer la nouvelle date
                    </Button>
                  </div>
                </div>
              )}

              {selectedAppointment.location && (
                <div className="space-y-1 col-span-2">
                  <span className="text-neutral-400 font-medium">Lieu / Visio :</span>
                  <p className="font-semibold text-neutral-200">{selectedAppointment.location}</p>
                </div>
              )}

              {selectedAppointment.notes && !isRescheduling && (
                <div className="space-y-1 col-span-2">
                  <span className="text-neutral-400 font-medium">Remarques & Historique :</span>
                  <p className="text-neutral-300 italic p-2 bg-neutral-950 rounded-lg">
                    "{selectedAppointment.notes}"
                  </p>
                </div>
              )}
            </div>

            {/* Quick Status Buttons & Reason/Remark Space */}
            <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300 font-medium">Changer le statut du RDV :</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => setIsRescheduling((prev) => !prev)}
                    className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-400 border border-amber-500/20 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1"
                    title="Reporter ce rendez-vous à une autre date"
                  >
                    📅 Reporter
                  </button>
                  {selectedAppointment.status !== "COMPLETED" && (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleStatusChange(selectedAppointment.id, AppointmentStatus.COMPLETED, statusRemark)}
                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-400 border border-emerald-500/20 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      ✓ Marquer Effectué
                    </button>
                  )}
                  {selectedAppointment.status !== "CANCELLED" && (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleStatusChange(selectedAppointment.id, AppointmentStatus.CANCELLED, statusRemark)}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 border border-rose-500/20 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      ✗ Annuler
                    </button>
                  )}
                </div>
              </div>

              {/* User requirement: "EN DESSOUS DE LA PARTIE Changer le statut du RDV : MET UN ESPACE POUR LA RAISON DE LANNULATION DU RENDEZ VOUS OU la remarque apres le passage du rendez vous" */}
              <div className="pt-2.5 border-t border-neutral-800/80 space-y-1.5">
                <label className="text-neutral-300 font-medium text-xs block">
                  Raison de l'annulation OU Remarque après le passage du rendez-vous :
                </label>
                <textarea
                  rows={3}
                  value={statusRemark}
                  onChange={(e) => setStatusRemark(e.target.value)}
                  placeholder="Indiquez ici le motif d'annulation (ex: client injoignable, empêchement) OU le compte-rendu après le passage du rendez-vous..."
                  className="w-full p-2.5 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                  <span>💡 Cette remarque sera enregistrée et alimentera les relances automatiques à +3j, +7j et +15j.</span>
                  {selectedAppointment.notes !== statusRemark && statusRemark.trim() !== "" && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedAppointment.id, selectedAppointment.status, statusRemark)}
                      className="text-blue-400 hover:underline font-semibold cursor-pointer"
                    >
                      Enregistrer la remarque
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* CONVERSION BUTTON IN MODAL (SECTION RENDEZ-VOUS EXCLUSIVITÉ) */}
            {selectedAppointment.prospect && selectedAppointment.prospect.status !== "CONVERTED" && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/50 via-neutral-900 to-neutral-900 border border-emerald-500/30 shadow-lg space-y-3 transition-all">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-2xs">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-300">
                        Clôture Commerciale & Signature
                      </h4>
                      <p className="text-[10px] text-emerald-400/80 font-medium">
                        Transformation directe en client officiel
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30 shrink-0">
                    Section Rendez-vous
                  </span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Le rendez-vous a abouti à un accord commercial ? Convertissez ce prospect en client officiel et activez son contrat dans le CRM.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDetailModalOpen(false);
                    openConvertModal(selectedAppointment);
                  }}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Convertir ce prospect en client officiel</span>
                </button>
              </div>
            )}

            {/* GOOGLE CALENDAR & ICAL EXPORT */}
            <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 shadow-2xs">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                    <span>Synchroniser avec votre agenda</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 font-normal border border-blue-500/20">
                      Google Calendar
                    </span>
                  </h4>
                  <p className="text-[10px] text-neutral-400">
                    Ajoutez ce rendez-vous dans Google Agenda ou exportez au format .ics
                  </p>
                  <p className="text-[10px] text-blue-300/80 mt-0.5">
                    👥 Invités inclus : zidanesidahmed18@gmail.com, toufikzidane325@gmail.com
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={buildGoogleCalendarUrl({
                    title: selectedAppointment.title,
                    startTime: selectedAppointment.startTime,
                    endTime: selectedAppointment.endTime,
                    location: selectedAppointment.location,
                    description: selectedAppointment.notes,
                    targetName: selectedAppointment.prospect?.companyName || selectedAppointment.client?.companyName || null,
                    targetPhone: selectedAppointment.prospect?.phone || selectedAppointment.client?.phone || null,
                    targetEmail: selectedAppointment.prospect?.email || null,
                    assignedUserName: selectedAppointment.user?.name || null,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Google Agenda</span>
                </a>
                <button
                  type="button"
                  onClick={() =>
                    downloadIcsFile({
                      title: selectedAppointment.title,
                      startTime: selectedAppointment.startTime,
                      endTime: selectedAppointment.endTime,
                      location: selectedAppointment.location,
                      description: selectedAppointment.notes,
                      targetName: selectedAppointment.prospect?.companyName || selectedAppointment.client?.companyName || null,
                      targetPhone: selectedAppointment.prospect?.phone || selectedAppointment.client?.phone || null,
                      targetEmail: selectedAppointment.prospect?.email || null,
                      assignedUserName: selectedAppointment.user?.name || null,
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium border border-neutral-700 transition-all cursor-pointer"
                  title="Télécharger fichier .ics standard pour Outlook ou Apple Calendar"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.ics</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => handleDeleteAppointment(selectedAppointment.id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer ce rendez-vous</span>
              </button>
              <Button variant="outline" onClick={() => setDetailModalOpen(false)}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: NOUVEAU RENDEZ-VOUS */}
      <Modal
        isOpen={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        title="Planifier un nouveau rendez-vous"
        description="Fixez une rencontre commerciale ou une séance de travail"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Objet du rendez-vous *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="ex: Présentation Pack Gold — Vigie Voyages"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Commercial assigné *</label>
              <select
                value={form.assignedUserId}
                onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
                required
              >
                {salesUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.id === currentUserId ? "(Moi)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Type de RDV</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as AppointmentType })}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
              >
                {Object.entries(APPOINTMENT_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300">Type de contact</label>
            <select
              value={form.targetType}
              onChange={(e) => {
                const newType = e.target.value as "prospect" | "client";
                const defaultId = newType === "prospect" ? (prospectsList[0]?.id || "") : (clientsList[0]?.id || "");
                setForm({ ...form, targetType: newType, targetId: defaultId });
                setTargetSearchQuery("");
                setIsTargetDropdownOpen(false);
              }}
              className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
            >
              <option value="prospect">Prospect</option>
              <option value="client">Client Officiel</option>
            </select>
          </div>

          <div className="space-y-1.5" ref={targetDropdownRef}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-400" />
                <span>{form.targetType === "prospect" ? "Sélectionner le prospect *" : "Sélectionner le client *"}</span>
              </label>
              <span className="text-[11px] text-neutral-500">
                {form.targetType === "prospect"
                  ? `${prospectsList.length} prospects disponibles`
                  : `${clientsList.length} clients disponibles`}
              </span>
            </div>

            {/* Selected Target Card */}
            {selectedTarget && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-600/10 border border-blue-500/30 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <div className="font-bold text-neutral-100 truncate flex items-center gap-2">
                      <span className="truncate">{selectedTarget.companyName}</span>
                      {(selectedTarget as any).sector && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 shrink-0 font-normal">
                          {(selectedTarget as any).sector}
                        </span>
                      )}
                    </div>
                    {selectedTarget.phone && (
                      <div className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5 font-mono">
                        <Phone className="w-3 h-3 text-emerald-400" />
                        <span>{selectedTarget.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsTargetDropdownOpen((prev) => !prev);
                    setTargetSearchQuery("");
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold px-2.5 py-1 rounded-lg hover:bg-blue-600/20 transition cursor-pointer shrink-0 ml-2"
                >
                  {isTargetDropdownOpen ? "Fermer recherche" : "🔍 Rechercher / Changer"}
                </button>
              </div>
            )}

            {/* Search Input & Dropdown Panel */}
            {(!selectedTarget || isTargetDropdownOpen) && (
              <div className="relative animate-in fade-in slide-in-from-top-1">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-blue-400" />
                  <input
                    type="text"
                    value={targetSearchQuery}
                    onChange={(e) => {
                      setTargetSearchQuery(e.target.value);
                      setIsTargetDropdownOpen(true);
                    }}
                    onFocus={() => setIsTargetDropdownOpen(true)}
                    placeholder={
                      form.targetType === "prospect"
                        ? "🔍 Tapez pour chercher par nom ou téléphone (ex: AnyTime, 0542...)"
                        : "🔍 Tapez pour chercher un client par nom ou téléphone..."
                    }
                    className="w-full h-10 pl-9 pr-8 text-xs bg-neutral-900 border border-blue-500/50 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                    autoFocus={isTargetDropdownOpen}
                  />
                  {targetSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTargetSearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-200 cursor-pointer text-xs p-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Dropdown list */}
                <div className="mt-1 max-h-60 overflow-y-auto rounded-xl bg-neutral-900 border border-neutral-750 shadow-2xl divide-y divide-neutral-800">
                  <div className="p-2 bg-neutral-950/90 sticky top-0 flex items-center justify-between text-[11px] text-neutral-400 border-b border-neutral-800 z-10">
                    <span className="font-semibold text-neutral-300">
                      {filteredTargets.length} {form.targetType === "prospect" ? "prospect(s)" : "client(s)"} disponible(s)
                      {targetSearchQuery && ` pour "${targetSearchQuery}"`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsTargetDropdownOpen(false)}
                      className="text-neutral-400 hover:text-white cursor-pointer px-1 py-0.5 rounded hover:bg-neutral-800 text-[10px]"
                    >
                      Fermer ✕
                    </button>
                  </div>

                  {filteredTargets.length === 0 ? (
                    <div className="p-4 text-center text-xs text-neutral-500">
                      Aucun {form.targetType === "prospect" ? "prospect" : "client"} trouvé pour « {targetSearchQuery} »
                    </div>
                  ) : (
                    filteredTargets.map((item) => {
                      const isSelected = item.id === form.targetId;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              targetId: item.id,
                              title: prev.title ? prev.title : `RDV Commercial — ${item.companyName}`,
                            }));
                            setIsTargetDropdownOpen(false);
                            setTargetSearchQuery("");
                          }}
                          className={`w-full p-2.5 text-left transition flex items-center justify-between cursor-pointer hover:bg-neutral-800/80 ${
                            isSelected ? "bg-blue-600/15 border-l-2 border-blue-500" : ""
                          }`}
                        >
                          <div className="truncate pr-2">
                            <div className="font-semibold text-xs text-neutral-100 flex items-center gap-2">
                              <span className="truncate">{item.companyName}</span>
                              {(item as any).sector && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 font-normal shrink-0">
                                  {(item as any).sector}
                                </span>
                              )}
                            </div>
                            {item.phone && (
                              <div className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5 font-mono">
                                <Phone className="w-3 h-3 text-emerald-500" />
                                <span>{item.phone}</span>
                              </div>
                            )}
                          </div>

                          {isSelected ? (
                            <span className="text-blue-400 font-bold text-xs shrink-0 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Sélectionné</span>
                            </span>
                          ) : (
                            <span className="text-neutral-500 text-xs hover:text-blue-400 shrink-0">
                              Choisir →
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Hidden native input for form validation */}
            <input type="hidden" name="targetId" value={form.targetId} required />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Input
              label="Date *"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
            <Input
              label="Heure début *"
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              required
            />
            <Input
              label="Heure fin *"
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              required
            />
          </div>

          <Input
            label="Lieu / Lien visio"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Bureau client, Agence BOOSTERA, Google Meet..."
          />

          <Input
            label="Notes & Préparation"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Contrat à signer, portfolio à présenter..."
          />

          {/* Option Synchronisation Google Calendar */}
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-neutral-100 block">
                  Ajouter à Google Agenda (Google Calendar)
                </span>
                <span className="text-[11px] text-neutral-400 block">
                  Ouvre et pré-remplit automatiquement l&apos;événement Google Agenda dès la confirmation.
                </span>
                <span className="text-[10px] text-blue-300/80 block mt-0.5">
                  👥 Invités automatiques : zidanesidahmed18@gmail.com, toufikzidane325@gmail.com
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={syncGoogleCalendar}
                onChange={(e) => setSyncGoogleCalendar(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setNewModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isLoading} className="bg-purple-600 hover:bg-purple-500">
              Confirmer le RDV
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: CONVERTIR PROSPECT EN CLIENT (SECTION RENDEZ-VOUS) */}
      <Modal
        isOpen={convertModalOpen}
        onClose={() => setConvertModalOpen(false)}
        title={`Signature & Conversion Client : ${selectedAppointment?.prospect?.companyName}`}
        description="Officialisez ce prospect en client actif en choisissant son pack d'accompagnement digital"
        maxWidth="3xl"
      >
        <form onSubmit={handleConvertSubmit} className="space-y-4">
          {/* SÉLECTEUR DE PACKS DIGITAUX */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-200">
                Pack / Offre Commerciale *
              </label>
              <span className="text-[11px] text-neutral-400">
                Sélectionnez l'offre convenue lors du RDV
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(["STARTER", "SILVER", "GOLD", "CUSTOM"] as (keyof typeof OFFER_DETAILS)[]).map((key) => {
                const pack = OFFER_DETAILS[key];
                const isSelected = convertForm.offerType === key;

                return (
                  <div
                    key={key}
                    onClick={() => handleConvertOfferSelect(key as OfferType)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? `${pack.theme.activeBg} ${pack.theme.border} ring-2 ring-blue-500/40 shadow-lg`
                        : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-xs text-neutral-100">{pack.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                      </div>
                      <p className="text-[10px] text-neutral-400 line-clamp-1">{pack.tagline}</p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-neutral-800/80">
                      <div className="font-bold text-xs text-neutral-100">
                        {pack.monthlyPrice > 0 ? (
                          <>
                            {pack.monthlyPrice.toLocaleString("fr-FR")}{" "}
                            <span className="text-[10px] text-emerald-400 font-normal">DA/m</span>
                          </>
                        ) : (
                          <span className="text-purple-400 text-[11px]">Sur mesure</span>
                        )}
                      </div>
                      <span className="text-[10px] text-neutral-500 block truncate">
                        {pack.views}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* OPTION SITE VITRINE (+2 000 DA) - UNIQUEMENT POUR SILVER ET GOLD */}
          {(convertForm.offerType === "SILVER" || convertForm.offerType === "GOLD") ? (
            <div
              onClick={() => handleConvertWebsiteToggle(!convertForm.hasWebsite)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                convertForm.hasWebsite
                  ? "bg-emerald-950/30 border-emerald-500/50 shadow-sm"
                  : "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                    convertForm.hasWebsite
                      ? "bg-emerald-500 border-emerald-400 text-neutral-950 font-bold"
                      : "border-neutral-700 bg-neutral-900"
                  }`}
                >
                  {convertForm.hasWebsite && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-bold text-neutral-100">
                      Ajouter l'option Site Vitrine
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      +2 000 DA / mois
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Création et hébergement d'un site web vitrine dédié pour valoriser l'établissement.
                  </p>
                </div>
              </div>

              <span className={`text-xs font-bold font-mono shrink-0 ${convertForm.hasWebsite ? "text-emerald-400" : "text-neutral-500"}`}>
                {convertForm.hasWebsite ? "+ 2 000 DA" : "+ 0 DA"}
              </span>
            </div>
          ) : convertForm.offerType === "STARTER" ? (
            <div className="p-2.5 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-center gap-2 text-xs text-blue-300">
              <Check className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                <strong>Site web professionnel inclus :</strong> Ce service est déjà compris dans le pack Starter à 9 000 DA / mois.
              </span>
            </div>
          ) : null}

          {/* DÉTAIL DES LIVRABLES DU PACK */}
          {convertForm.offerType === "CUSTOM" ? (
            <CustomOfferConfigurator
              durationMonths={convertForm.durationMonths}
              onCalculationChange={handleCustomCalculationChange}
            />
          ) : (
            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-1.5">
              <span className="text-[11px] font-semibold text-neutral-400">
                Inclus dans le {OFFER_DETAILS[convertForm.offerType as keyof typeof OFFER_DETAILS]?.name} :
              </span>
              <div className="flex flex-wrap gap-1.5">
                {OFFER_DETAILS[convertForm.offerType as keyof typeof OFFER_DETAILS]?.features.map((feat, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-300 font-medium flex items-center gap-1"
                  >
                    <span className="text-blue-400">•</span>
                    <span>{feat}</span>
                  </span>
                ))}
                {convertForm.hasWebsite && (convertForm.offerType === "SILVER" || convertForm.offerType === "GOLD") && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-300 font-bold flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Site vitrine professionnel inclus (+2 000 DA)</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* CONDITIONS FINANCIÈRES & DURÉE */}
          <div className="p-3.5 bg-neutral-900/80 border border-neutral-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                <span>Modalités de Contrat & Paiement</span>
              </span>
              <span className="text-[11px] text-neutral-400">
                Total calculé :{" "}
                <strong className="text-emerald-400 text-sm font-bold">
                  {formatCurrency(convertForm.contractValue)}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Forfait Mensuel (DA / mois) *"
                type="number"
                value={convertForm.monthlyFee}
                onChange={(e) => handleConvertMonthlyFeeChange(Number(e.target.value))}
                required
              />

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">Durée d'engagement</label>
                <select
                  value={convertForm.durationMonths}
                  onChange={(e) => handleConvertDurationChange(Number(e.target.value))}
                  className="w-full h-10 px-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 focus:outline-none focus:border-blue-500"
                >
                  <option value={1}>1 mois (Sans engagement)</option>
                  <option value={3}>3 mois (Trimestriel)</option>
                  <option value={6}>6 mois (Semestriel)</option>
                  <option value={12}>12 mois (1 an annuel)</option>
                  <option value={24}>24 mois (2 ans)</option>
                </select>
              </div>

              <Input
                label="Valeur Totale Contrat (DA) *"
                type="number"
                value={convertForm.contractValue}
                onChange={(e) =>
                  setConvertForm({ ...convertForm, contractValue: Number(e.target.value) })
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Date de début"
                type="date"
                value={convertForm.contractStart}
                onChange={(e) => {
                  const val = e.target.value;
                  setConvertForm({
                    ...convertForm,
                    contractStart: val,
                    contractEnd: calculateEndDate(val, convertForm.durationMonths),
                  });
                }}
              />
              <Input
                label="Date de fin estimée"
                type="date"
                value={convertForm.contractEnd}
                onChange={(e) => setConvertForm({ ...convertForm, contractEnd: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-200">
                Remarques & Notes du Dossier (Synchronisé)
              </label>
              <span className="text-[10px] text-emerald-400 font-semibold">
                ✓ Remarque préalable & devis synchronisés
              </span>
            </div>
            <textarea
              rows={4}
              value={convertForm.notes}
              onChange={(e) => setConvertForm({ ...convertForm, notes: e.target.value })}
              placeholder="Remarques préalables du prospect, détails du devis, spécifications..."
              className="w-full p-2.5 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setConvertModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isLoading} className="bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/20">
              Valider la Signature & Convertir
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: REPORTER UNE RELANCE POST-RDV */}
      <Modal
        isOpen={rescheduleFollowUpModalOpen}
        onClose={() => {
          setRescheduleFollowUpModalOpen(false);
          setTargetFollowUp(null);
        }}
        title="Reporter la relance post-RDV"
        description={
          targetFollowUp
            ? `Fixez une nouvelle date d'échéance pour ${targetFollowUp.prospect?.companyName || "le prospect"}`
            : "Fixez une nouvelle date d'échéance"
        }
        maxWidth="md"
      >
        {targetFollowUp && (
          <form onSubmit={handleFollowUpRescheduleSubmit} className="space-y-4">
            {/* Prospect Info Card */}
            <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Entreprise :</span>
                <span className="font-bold text-neutral-100">
                  {targetFollowUp.prospect?.companyName || "Prospect"}
                </span>
              </div>
              {targetFollowUp.prospect?.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Téléphone :</span>
                  <span className="font-mono text-emerald-400">
                    {targetFollowUp.prospect.phone}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Date initiale :</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-200 font-semibold">
                    {formatDate(targetFollowUp.scheduledAt)}
                  </span>
                  {new Date(targetFollowUp.scheduledAt) < new Date() ? (
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
            {followUpModalError && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{followUpModalError}</span>
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
                    onClick={() => setFollowUpRescheduleBase("today")}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                      followUpRescheduleBase === "today"
                        ? "bg-amber-500 text-neutral-950 font-bold shadow-xs"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    Depuis Aujourd'hui ({formatDate(new Date())})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowUpRescheduleBase("initial")}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                      followUpRescheduleBase === "initial"
                        ? "bg-amber-500 text-neutral-950 font-bold shadow-xs"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    Depuis Date Initiale ({formatDate(targetFollowUp.scheduledAt)})
                  </button>
                </div>
              </div>

              {/* Context notification */}
              {new Date(targetFollowUp.scheduledAt) < new Date() && followUpRescheduleBase === "today" && (
                <div className="px-2.5 py-1 rounded-lg bg-blue-950/30 border border-blue-500/30 text-[11px] text-blue-300 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-blue-400 shrink-0" />
                  <span>
                    La date initiale ({formatDate(targetFollowUp.scheduledAt)}) étant déjà passée, les délais ci-dessous sont calculés à partir <strong>d'aujourd'hui ({formatDate(new Date())})</strong>.
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
                  if (followUpRescheduleBase === "initial" && targetFollowUp?.scheduledAt) {
                    const dInit = new Date(targetFollowUp.scheduledAt);
                    if (!isNaN(dInit.getTime())) base = dInit;
                  }
                  const target = new Date(base);
                  target.setDate(target.getDate() + s.days);
                  const sDateStr = toLocalDateString(target);
                  const isSelected = followUpRescheduleDate === sDateStr;

                  return (
                    <div
                      key={s.days}
                      onClick={() => handleFollowUpQuickAddDays(s.days)}
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
                          disabled={isFollowUpRescheduling}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFollowUpQuickAddDays(s.days, undefined, true);
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
                {followUpRescheduleDate && (
                  <span className="text-[11px] font-mono text-amber-400 font-semibold">
                    Échéance : {formatDate(followUpRescheduleDate)}
                  </span>
                )}
              </div>
              <Input
                type="date"
                value={followUpRescheduleDate}
                onChange={(e) => {
                  setFollowUpRescheduleDate(e.target.value);
                  setFollowUpRescheduleNotes(
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
                value={followUpRescheduleNotes}
                onChange={(e) => setFollowUpRescheduleNotes(e.target.value)}
                placeholder="ex: Client demande un délai supplémentaire..."
                className="w-full p-2.5 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRescheduleFollowUpModalOpen(false);
                  setTargetFollowUp(null);
                  setFollowUpModalError(null);
                }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                isLoading={isFollowUpRescheduling}
                className="bg-amber-600 hover:bg-amber-500 text-white font-semibold"
              >
                {followUpRescheduleDate
                  ? `✓ Confirmer le report au ${formatDate(followUpRescheduleDate)}`
                  : "Confirmer le report"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: + APPEL (JOURNALISER L'APPEL ET AJOUTER DANS LES APPELS) */}
      <Modal
        isOpen={followUpCallModalOpen}
        onClose={() => {
          setFollowUpCallModalOpen(false);
          setTargetFollowUpCall(null);
        }}
        title={`+ APPEL : ${targetFollowUpCall?.prospect?.companyName || "Prospect"}`}
        description="Enregistrez l'appel et ajoutez automatiquement le prospect dans la section Appels"
        maxWidth="lg"
      >
        {targetFollowUpCall && (
          <form onSubmit={handleFollowUpCallSubmit} className="space-y-4">
            {/* Prospect summary banner */}
            <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                    <Building className="w-4 h-4 text-emerald-400" />
                    {targetFollowUpCall.prospect?.companyName}
                  </h4>
                  <p className="text-xs text-neutral-400">
                    {targetFollowUpCall.prospect?.contactName
                      ? `${targetFollowUpCall.prospect.contactName} • `
                      : ""}
                    {targetFollowUpCall.prospect?.sector} ({targetFollowUpCall.prospect?.wilaya || "Alger"})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${targetFollowUpCall.prospect?.phone}`}
                    onClick={() => {
                      trackCommunicationClick({
                        type: "PHONE",
                        targetName: targetFollowUpCall.prospect?.companyName,
                        phone: targetFollowUpCall.prospect?.phone,
                        entityType: "PROSPECT",
                        entityId: targetFollowUpCall.prospect?.id,
                      });
                    }}
                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{targetFollowUpCall.prospect?.phone}</span>
                  </a>

                  {targetFollowUpCall.prospect?.phone && (
                    <a
                      href={buildWhatsAppUrl(
                        targetFollowUpCall.prospect.phone,
                        targetFollowUpCall.prospect.companyName,
                        targetFollowUpCall.prospect.contactName
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        trackCommunicationClick({
                          type: "WHATSAPP",
                          targetName: targetFollowUpCall.prospect.companyName,
                          phone: targetFollowUpCall.prospect.phone,
                          entityType: "PROSPECT",
                          entityId: targetFollowUpCall.prospect.id,
                        });
                      }}
                      className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-emerald-500/30 hover:border-[#25D366] rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                      title="Envoyer message WhatsApp"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>

              {targetFollowUpCall.notes && (
                <div className="pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-400 flex items-center gap-1.5">
                  <span className="font-semibold text-neutral-300">Note précédente :</span>
                  <span className="italic truncate">{targetFollowUpCall.notes}</span>
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
                  const isSelected = followUpCallResult === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setFollowUpCallResult(item.value)}
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
                    onClick={() => setFollowUpCallDuration(d.val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      followUpCallDuration === d.val
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
                    value={followUpCallDuration}
                    onChange={(e) => setFollowUpCallDuration(e.target.value)}
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
                value={followUpCallComment}
                onChange={(e) => setFollowUpCallComment(e.target.value)}
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
                  setFollowUpCallModalOpen(false);
                  setTargetFollowUpCall(null);
                }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                isLoading={isLoggingFollowUpCall}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 shadow-lg shadow-emerald-600/20"
              >
                <PhoneCall className="w-4 h-4" />
                <span>+ Enregistrer & Transférer dans les Appels</span>
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
