"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  SECTORS,
  WILAYAS,
  PROSPECT_STATUSES,
  CALL_RESULTS,
  OFFER_TYPES,
  APPOINTMENT_TYPES,
} from "@/lib/constants";
import {
  ProspectStatus,
  CallResult,
  OfferType,
  AppointmentType,
} from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatDate, formatDateTime, toLocalDateString, buildWhatsAppUrl } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/common/WhatsAppIcon";
import { trackCommunicationClick } from "@/lib/tracking";
import {
  updateProspect,
  updateProspectField,
  assignProspect,
  deleteProspect,
} from "@/actions/prospects";
import { logCallAction } from "@/actions/calls";
import { createAppointmentAction } from "@/actions/appointments";
import {
  PhoneCall,
  Phone,
  CheckCircle2,
  TrendingUp,
  BarChart,
  Plus,
  Search,
  Building,
  User,
  UserCheck,
  Calendar,
  FileText,
  Table,
  History,
  Trash2,
  Save,
} from "lucide-react";

interface CallItem {
  id: string;
  calledAt: Date;
  result: CallResult;
  comment: string | null;
  durationSeconds: number | null;
  user: { id: string; name: string };
  prospect: { id: string; companyName: string; phone: string; sector: string; wilaya: string } | null;
  client: { id: string; companyName: string; phone: string } | null;
}

interface CallStats {
  totalCalls: number;
  callsToday: number;
  answeredCalls: number;
  interestedCalls: number;
  appointmentsBooked: number;
  responseRate: number;
  interestedRate: number;
  bookingRate: number;
  byRep: { userId: string; name: string; count: number }[];
}

interface ProspectItem {
  id: string;
  companyName: string;
  contactName: string | null;
  phone: string;
  email: string | null;
  sector: string;
  wilaya: string;
  address: string | null;
  status: ProspectStatus;
  rawState?: string | null;
  prospectionDate?: Date | null;
  callStatus?: string | null;
  response?: string | null;
  notes: string | null;
  assignedTo: { id: string; name: string } | null;
  createdAt: Date;
  _count?: {
    calls: number;
    appointments: number;
    followUps: number;
  };
  appointments?: {
    id: string;
    startTime: Date;
    title: string;
    status: string;
  }[];
  calls?: {
    id: string;
    result: CallResult;
    calledAt: Date;
    comment: string | null;
  }[];
}

interface UserOption {
  id: string;
  name: string;
}

interface Props {
  calls: CallItem[];
  stats: CallStats;
  calledProspects: ProspectItem[];
  prospectsList: { id: string; companyName: string; phone: string }[];
  salesUsers: UserOption[];
  currentUserId: string;
  canDelete: boolean;
}

export function CallsClient({
  calls,
  stats: initialStats,
  calledProspects,
  prospectsList,
  salesUsers,
  currentUserId,
  canDelete,
}: Props) {
  const router = useRouter();
  const [stats, setStats] = useState<CallStats>(initialStats);
  const [activeTab, setActiveTab] = useState<"prospects10" | "history">("prospects10");
  const [prospects, setProspects] = useState<ProspectItem[]>(calledProspects);

  useEffect(() => {
    setStats(initialStats);
  }, [initialStats]);

  useEffect(() => {
    setProspects(calledProspects);
  }, [calledProspects]);

  // Filters for the 10-column table
  const [search, setSearch] = useState("");
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedWilaya, setSelectedWilaya] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedCommercial, setSelectedCommercial] = useState("");
  const [selectedCallStatus, setSelectedCallStatus] = useState("");

  // Modals state
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const [activeProspect, setActiveProspect] = useState<ProspectItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit Prospect Form State
  const [editForm, setEditForm] = useState({
    id: "",
    companyName: "",
    contactName: "",
    phone: "",
    email: "",
    sector: "",
    wilaya: "",
    address: "",
    callStatus: "",
    rawState: "",
    callResult: "",
    response: "",
    notes: "",
    assignedToId: "",
    prospectionDate: "",
  });

  // Call Log Form State
  const [callForm, setCallForm] = useState<{
    prospectId: string;
    result: CallResult;
    comment: string;
    durationSeconds: number;
    autoScheduleFollowUp: boolean;
  }>({
    prospectId: prospectsList[0]?.id || "",
    result: CallResult.INTERESTED,
    comment: "",
    durationSeconds: 120,
    autoScheduleFollowUp: true,
  });

  // Appointment Form State
  const [appointmentForm, setAppointmentForm] = useState({
    title: "",
    type: "COMMERCIAL_VISIT" as AppointmentType,
    date: toLocalDateString(new Date()),
    startTime: "14:00",
    endTime: "15:00",
    location: "Chez le client",
    notes: "",
  });

  // Open Edit Modal for a Prospect
  const openEditModal = (p: ProspectItem) => {
    setActiveProspect(p);
    const initialCallResult =
      p.calls?.[0]?.result ||
      (p.status === ProspectStatus.INTERESTED || p.rawState === "INTERESSE"
        ? CallResult.INTERESTED
        : p.status === ProspectStatus.MEETING_SCHEDULED || p.rawState === "RDV PRIS"
        ? CallResult.APPOINTMENT_BOOKED
        : p.status === ProspectStatus.NOT_INTERESTED || p.rawState === "PAS INTERESSE"
        ? CallResult.NOT_INTERESTED
        : p.rawState === "A RAPPELER" || p.callStatus === "A RAPPELER"
        ? CallResult.CALLBACK_REQUESTED
        : p.callStatus === "PAS DE REPONSE" || p.rawState === "PAS DE CONTACT"
        ? CallResult.NO_ANSWER
        : p.callStatus === "INJOIGNABLE" || p.callStatus === "OCCUPE"
        ? CallResult.UNREACHABLE
        : "");

    setEditForm({
      id: p.id,
      companyName: p.companyName || "",
      contactName: p.contactName || "",
      phone: p.phone || "",
      email: p.email || "",
      sector: p.sector || SECTORS[0],
      wilaya: p.wilaya || "Alger",
      address: p.address || "",
      callStatus: p.callStatus || "",
      rawState: p.rawState || "",
      callResult: initialCallResult,
      response: p.response || "",
      notes: p.notes || "",
      assignedToId: p.assignedTo?.id || "",
      prospectionDate: toLocalDateString(p.prospectionDate),
    });
    setEditModalOpen(true);
  };

  // Direct Inline Cell Modification from the table
  const handleInlineFieldChange = async (
    prospectId: string,
    field: "callStatus" | "rawState" | "response" | "notes" | "callResult",
    value: string
  ) => {
    const today = new Date();
    // Optimistic UI update on prospect rows
    setProspects((prev) =>
      prev.map((p) => {
        if (p.id !== prospectId) return p;
        if (field === "callResult") {
          const callRes = value as CallResult;
          const isContactMade = Boolean(value && value.trim());
          return {
            ...p,
            prospectionDate: isContactMade ? today : (!p.callStatus ? null : p.prospectionDate),
            calls: value
              ? [{ id: "temp", result: callRes, calledAt: today, comment: null }]
              : [],
            status:
              callRes === CallResult.INTERESTED
                ? ProspectStatus.INTERESTED
                : callRes === CallResult.APPOINTMENT_BOOKED
                ? ProspectStatus.MEETING_SCHEDULED
                : callRes === CallResult.NOT_INTERESTED
                ? ProspectStatus.NOT_INTERESTED
                : p.status,
            callStatus:
              callRes === CallResult.NO_ANSWER
                ? "PAS DE REPONSE"
                : callRes === CallResult.UNREACHABLE
                ? "INJOIGNABLE"
                : callRes === CallResult.CALLBACK_REQUESTED
                ? "A RAPPELER"
                : (value ? "EFFECTUE" : p.callStatus),
          };
        }
        if (field === "callStatus") {
          const isContactMade = Boolean(value && value.trim() && value.trim().toUpperCase() !== "NON EFFECTUE");
          return {
            ...p,
            callStatus: value || null,
            prospectionDate: isContactMade ? today : (value === "" && !p.calls?.length ? null : p.prospectionDate),
          };
        }
        if (field === "response" && value && value.trim()) {
          return {
            ...p,
            response: value,
            prospectionDate: p.prospectionDate || today,
          };
        }
        return { ...p, [field]: value || null };
      })
    );

    // Optimistic UI update on Call Stats KPI cards when callResult changes
    if (field === "callResult") {
      const currentProspect = prospects.find((p) => p.id === prospectId);
      const oldResult = currentProspect?.calls?.[0]?.result;
      const newResult = value as CallResult;

      const answeredResults: CallResult[] = [
        CallResult.INTERESTED,
        CallResult.APPOINTMENT_BOOKED,
        CallResult.CALLBACK_REQUESTED,
        CallResult.NOT_INTERESTED,
      ];

      const wasAnswered = Boolean(oldResult && answeredResults.includes(oldResult));
      const isAnswered = Boolean(newResult && answeredResults.includes(newResult));

      setStats((prev) => {
        let totalDelta = 0;
        if (!oldResult && newResult) totalDelta = 1;
        else if (oldResult && !newResult) totalDelta = -1;

        let answeredDelta = 0;
        if (!wasAnswered && isAnswered) answeredDelta = 1;
        else if (wasAnswered && !isAnswered) answeredDelta = -1;

        let interestedDelta = 0;
        if (oldResult !== CallResult.INTERESTED && newResult === CallResult.INTERESTED) interestedDelta = 1;
        else if (oldResult === CallResult.INTERESTED && newResult !== CallResult.INTERESTED) interestedDelta = -1;

        const newTotal = Math.max(0, prev.totalCalls + totalDelta);
        const newAnswered = Math.max(0, Math.min(newTotal, prev.answeredCalls + answeredDelta));
        const newResponseRate = newTotal > 0 ? Math.round((newAnswered / newTotal) * 100) : 0;
        const newInterested = Math.max(0, prev.interestedCalls + interestedDelta);
        const newInterestedRate = newTotal > 0 ? Math.round((newInterested / newTotal) * 100) : 0;

        return {
          ...prev,
          totalCalls: newTotal,
          answeredCalls: newAnswered,
          responseRate: newResponseRate,
          interestedCalls: newInterested,
          interestedRate: newInterestedRate,
        };
      });
    }

    // Optimistic UI update on Call Stats KPI cards when callStatus changes
    if (field === "callStatus") {
      const currentProspect = prospects.find((p) => p.id === prospectId);
      const oldVal = (currentProspect?.callStatus || "").toUpperCase().trim();
      const newVal = (value || "").toUpperCase().trim();

      const wasAnswered =
        oldVal === "EFFECTUE" ||
        oldVal.includes("EFFECTU") ||
        oldVal.includes("RAPPEL");
      const hadAttempt = Boolean(oldVal && oldVal !== "NON EFFECTUE");

      const isAnswered =
        newVal === "EFFECTUE" ||
        newVal.includes("EFFECTU") ||
        newVal.includes("RAPPEL");
      const hasAttempt = Boolean(newVal && newVal !== "NON EFFECTUE");

      setStats((prev) => {
        let totalDelta = 0;
        if (!hadAttempt && hasAttempt) totalDelta = 1;
        else if (hadAttempt && !hasAttempt) totalDelta = -1;

        let answeredDelta = 0;
        if (!wasAnswered && isAnswered) answeredDelta = 1;
        else if (wasAnswered && !isAnswered) answeredDelta = -1;

        let interestedDelta = 0;
        if (!oldVal.includes("EFFECTU") && newVal.includes("EFFECTU")) interestedDelta = 1;
        else if (oldVal.includes("EFFECTU") && !newVal.includes("EFFECTU")) interestedDelta = -1;

        const newTotal = Math.max(0, prev.totalCalls + totalDelta);
        const newAnswered = Math.max(0, Math.min(newTotal, prev.answeredCalls + answeredDelta));
        const newResponseRate = newTotal > 0 ? Math.round((newAnswered / newTotal) * 100) : 0;
        const newInterested = Math.max(0, prev.interestedCalls + interestedDelta);
        const newInterestedRate = newTotal > 0 ? Math.round((newInterested / newTotal) * 100) : 0;

        return {
          ...prev,
          totalCalls: newTotal,
          answeredCalls: newAnswered,
          responseRate: newResponseRate,
          interestedCalls: newInterested,
          interestedRate: newInterestedRate,
        };
      });
    }

    try {
      await updateProspectField(prospectId, field, value || null);
      setFeedbackMessage({
        type: "success",
        text: `Modification enregistrée : ${field} mis à jour !`,
      });
      router.refresh();
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Erreur lors de la modification en direct.",
      });
    }
  };

  // Quick Commercial Reassignment from Table
  const handleQuickAssign = async (prospectId: string, newUserId: string) => {
    const targetUser = salesUsers.find((u) => u.id === newUserId);
    // Optimistic UI update
    setProspects((prev) =>
      prev.map((p) =>
        p.id === prospectId
          ? {
              ...p,
              assignedTo: targetUser ? { id: targetUser.id, name: targetUser.name } : null,
            }
          : p
      )
    );

    try {
      await assignProspect(prospectId, newUserId || null);
      setFeedbackMessage({
        type: "success",
        text: targetUser
          ? `Prospect synchronisé avec ${targetUser.name} !`
          : "Prospect désassigné.",
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Erreur lors de l'assignation du commercial.",
      });
    }
  };

  // Full Edit Modal Save
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFeedbackMessage(null);

    const isContactMade = Boolean(
      (editForm.callStatus && editForm.callStatus.trim().toUpperCase() !== "NON EFFECTUE") ||
      editForm.callResult
    );
    const resolvedDate = editForm.prospectionDate
      ? editForm.prospectionDate
      : isContactMade
      ? toLocalDateString(new Date())
      : null;

    try {
      const res = await updateProspect(editForm.id, {
        companyName: editForm.companyName,
        contactName: editForm.contactName || undefined,
        phone: editForm.phone,
        email: editForm.email || undefined,
        sector: editForm.sector,
        wilaya: editForm.wilaya,
        address: editForm.address || undefined,
        callStatus: editForm.callStatus || undefined,
        rawState: editForm.rawState || undefined,
        callResult: (editForm.callResult as CallResult) || undefined,
        response: editForm.response || undefined,
        notes: editForm.notes || undefined,
        assignedToId: editForm.assignedToId || null,
        prospectionDate: resolvedDate,
      });

      const targetUser = salesUsers.find((u) => u.id === editForm.assignedToId);
      setProspects((prev) =>
        prev.map((p) =>
          p.id === editForm.id
            ? {
                ...p,
                companyName: editForm.companyName,
                contactName: editForm.contactName || null,
                phone: editForm.phone,
                email: editForm.email || null,
                sector: editForm.sector,
                wilaya: editForm.wilaya,
                address: editForm.address,
                callStatus: editForm.callStatus,
                rawState: editForm.rawState,
                calls: editForm.callResult
                  ? [{ id: "temp", result: editForm.callResult as CallResult, calledAt: new Date(), comment: null }]
                  : p.calls,
                response: editForm.response,
                notes: editForm.notes,
                prospectionDate: resolvedDate ? new Date(resolvedDate) : null,
                assignedTo: targetUser ? { id: targetUser.id, name: targetUser.name } : null,
              }
            : p
        )
      );

      setEditModalOpen(false);
      setFeedbackMessage({
        type: "success",
        text: `Fiche de "${editForm.companyName}" mise à jour et synchronisée avec succès !`,
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Erreur lors de la mise à jour de la fiche prospect.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Prospect
  const handleDeleteProspect = async (prospectId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce prospect ?")) return;
    setIsLoading(true);
    const res = await deleteProspect(prospectId);
    setIsLoading(false);

    if (res.error) {
      setFeedbackMessage({ type: "error", text: res.error });
      return;
    }

    setProspects((prev) => prev.filter((p) => p.id !== prospectId));
    setEditModalOpen(false);
    setFeedbackMessage({ type: "success", text: "Prospect supprimé avec succès." });
  };

  // Handle Call Submit
  const handleCallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    await logCallAction({
      prospectId: activeProspect ? activeProspect.id : callForm.prospectId,
      result: callForm.result,
      comment: callForm.comment,
      durationSeconds: Number(callForm.durationSeconds),
      autoScheduleFollowUp: callForm.autoScheduleFollowUp,
    });

    setIsLoading(false);
    setCallModalOpen(false);
    window.location.reload();
  };

  // Handle Appointment Submit
  const handleAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProspect) return;
    setIsLoading(true);

    const startDateTime = `${appointmentForm.date}T${appointmentForm.startTime}:00`;
    const endDateTime = `${appointmentForm.date}T${appointmentForm.endTime}:00`;

    await createAppointmentAction({
      title: appointmentForm.title || `RDV avec ${activeProspect.companyName}`,
      type: appointmentForm.type,
      startTime: startDateTime,
      endTime: endDateTime,
      location: appointmentForm.location,
      notes: appointmentForm.notes,
      prospectId: activeProspect.id,
    });

    // Optimistic UI update: turn the RDV icon green immediately!
    setProspects((prev) =>
      prev.map((p) =>
        p.id === activeProspect.id
          ? {
              ...p,
              status: ProspectStatus.MEETING_SCHEDULED,
              rawState: "RDV PRIS",
              _count: {
                calls: p._count?.calls ?? 0,
                followUps: p._count?.followUps ?? 0,
                appointments: (p._count?.appointments ?? 0) + 1,
              },
            }
          : p
      )
    );

    setIsLoading(false);
    setAppointmentModalOpen(false);
    setFeedbackMessage({
      type: "success",
      text: `Rendez-vous programmé avec succès pour ${activeProspect.companyName} ! L'indicateur RDV est passé au vert.`,
    });
  };

  // Filter prospects
  const filtered = prospects.filter((p) => {
    const matchesSearch =
      !search ||
      p.companyName.toLowerCase().includes(search.toLowerCase()) ||
      (p.contactName && p.contactName.toLowerCase().includes(search.toLowerCase())) ||
      p.phone.includes(search) ||
      (p.email && p.email.toLowerCase().includes(search.toLowerCase())) ||
      (p.response && p.response.toLowerCase().includes(search.toLowerCase())) ||
      (p.notes && p.notes.toLowerCase().includes(search.toLowerCase())) ||
      (p.assignedTo?.name && p.assignedTo.name.toLowerCase().includes(search.toLowerCase()));

    const matchesSector = !selectedSector || p.sector === selectedSector;
    const matchesWilaya = !selectedWilaya || p.wilaya === selectedWilaya;
    const matchesStatus = !selectedStatus || p.status === selectedStatus;
    const matchesCommercial =
      !selectedCommercial ||
      (selectedCommercial === "unassigned" ? !p.assignedTo : p.assignedTo?.id === selectedCommercial);
    const matchesCallStatus =
      !selectedCallStatus ||
      (selectedCallStatus === "NON EFFECTUE"
        ? !p.callStatus || p.callStatus === "NON EFFECTUE" || p.callStatus.trim() === ""
        : p.callStatus === selectedCallStatus);

    return matchesSearch && matchesSector && matchesWilaya && matchesStatus && matchesCommercial && matchesCallStatus;
  });

  // Client Pagination (50 par page par défaut pour des performances instantanées)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(50);

  // Revenir à la première page quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedSector, selectedWilaya, selectedStatus, selectedCommercial, selectedCallStatus]);

  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedProspects = useMemo(() => {
    if (pageSize === "all") return filtered;
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
            Journal & Suivi des Appels Téléphoniques
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              {filtered.length} prospects appelés
            </span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Visualisez et modifiez directement les prospects appelés (Tableau 10 colonnes) et l'historique des communications
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          {/* View Mode Toggle */}
          <div className="flex flex-wrap bg-neutral-900 border border-neutral-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setActiveTab("prospects10")}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === "prospects10"
                  ? "bg-neutral-800 text-white shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Tableau (10 Col)</span>
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === "history"
                  ? "bg-neutral-800 text-white shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Historique ({calls.length})</span>
            </button>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setActiveProspect(null);
              setCallModalOpen(true);
            }}
            className="gap-1.5 shadow-md shadow-blue-500/20 text-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Appel</span>
          </Button>
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
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* KPI Cards for Call Center */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Appels Aujourd'hui</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <PhoneCall className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-100 mt-3">{stats.callsToday}</p>
          <p className="text-[11px] text-neutral-500 mt-1">{stats.totalCalls} appels au total</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Taux de Contactabilité</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-3">{stats.responseRate}%</p>
          <p className="text-[11px] text-neutral-500 mt-1">{stats.answeredCalls} appels répondus</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Taux d'Intérêt</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-3">{stats.interestedRate}%</p>
          <p className="text-[11px] text-neutral-500 mt-1">{stats.interestedCalls} prospects intéressés</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Rendez-vous Décrochés</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <BarChart className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-400 mt-3">{stats.appointmentsBooked}</p>
          <p className="text-[11px] text-neutral-500 mt-1">{stats.bookingRate}% de conversion en RDV</p>
        </div>
      </div>

      {/* VIEW 1: TABLEAU 10 COLONNES DES PROSPECTS APPELÉS (EXACT SAME AS PROSPECTION) */}
      {activeTab === "prospects10" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 bg-neutral-900/60 border border-neutral-800 p-3 rounded-2xl">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Recherche (Client, numéro, réponse, remarque)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">Tous les types / secteurs</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={selectedWilaya}
              onChange={(e) => setSelectedWilaya(e.target.value)}
              className="h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">Toutes les adresses / zones</option>
              {WILAYAS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">Tous les états</option>
              {Object.entries(PROSPECT_STATUSES).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>

            {/* FILTRE APPEL (POUR TOUS LES UTILISATEURS) */}
            <select
              value={selectedCallStatus}
              onChange={(e) => setSelectedCallStatus(e.target.value)}
              className={`h-9 px-3 text-xs bg-neutral-900 border rounded-xl focus:outline-none transition-colors cursor-pointer font-medium ${
                selectedCallStatus
                  ? "text-emerald-400 border-emerald-500/50 bg-emerald-950/30"
                  : "text-neutral-200 border-neutral-800 focus:border-blue-500"
              }`}
              title="Filtrer par statut d'appel"
            >
              <option value="" className="bg-neutral-950 text-neutral-100">Tous les appels</option>
              <option value="EFFECTUE" className="bg-neutral-950 text-emerald-400 font-bold">✓ EFFECTUE</option>
              <option value="NON EFFECTUE" className="bg-neutral-950 text-neutral-300">NON EFFECTUE</option>
              <option value="A RAPPELER" className="bg-neutral-950 text-blue-400">A RAPPELER</option>
              <option value="PAS DE REPONSE" className="bg-neutral-950 text-amber-400">PAS DE REPONSE</option>
              <option value="OCCUPE" className="bg-neutral-950 text-amber-400">OCCUPE</option>
              <option value="INJOIGNABLE" className="bg-neutral-950 text-rose-400">INJOIGNABLE</option>
              <option value="PAS DE CONTACT" className="bg-neutral-950 text-neutral-400">PAS DE CONTACT</option>
            </select>

            <select
              value={selectedCommercial}
              onChange={(e) => setSelectedCommercial(e.target.value)}
              className="h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">Tous les commerciaux</option>
              <option value="unassigned">Non assigné</option>
              {salesUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* TABLEAU EXACTEMENT IDENTIQUE A PROSPECTION */}
          <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-2xl overflow-hidden shadow-xl w-full min-w-0">
            <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700 min-w-0">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-neutral-950/90 border-b border-neutral-800 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">CLIENT</th>
                    <th className="py-3 px-3">NUMERO</th>
                    <th className="py-3 px-2 text-center text-emerald-400 w-12" title="WhatsApp direct">WA</th>
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
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-neutral-500 font-normal">
                        Aucun prospect dans les appels. Marquez un appel comme "EFFECTUE" depuis la prospection pour le transférer ici.
                      </td>
                    </tr>
                  )}

                  {paginatedProspects.map((prospect) => (
                    <tr key={prospect.id} className="hover:bg-neutral-800/40 transition-colors">
                      {/* 1. CLIENT (Cliquable pour ouvrir la fiche) */}
                      <td
                        onClick={() => openEditModal(prospect)}
                        className="py-2.5 px-3 font-semibold text-neutral-100 flex items-center gap-1.5 max-w-[200px] truncate cursor-pointer hover:text-blue-400 group"
                        title="Cliquer pour ouvrir la fiche détaillée"
                      >
                        <Building className="w-3.5 h-3.5 text-blue-400 shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="truncate group-hover:underline">{prospect.companyName}</span>
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

                      {/* WHATSAPP DIRECT (Automatique après la colonne NUMERO) */}
                      <td className="py-2.5 px-2 text-center">
                        {prospect.phone ? (
                          <a
                            href={buildWhatsAppUrl(prospect.phone, prospect.companyName, prospect.contactName)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              trackCommunicationClick({
                                type: "WHATSAPP",
                                targetName: prospect.companyName || prospect.contactName,
                                phone: prospect.phone,
                                entityType: "PROSPECT",
                                entityId: prospect.id,
                              });
                            }}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/15 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-emerald-500/30 hover:border-[#25D366] transition-all shadow-xs hover:scale-110 cursor-pointer"
                            title={`Envoyer un message WhatsApp standard à ${prospect.companyName}`}
                          >
                            <WhatsAppIcon className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-neutral-600 text-xs">—</span>
                        )}
                      </td>

                      {/* 3. DATE (Vide au début, se marque automatiquement à la date du jour lors du contact) */}
                      <td className="py-2.5 px-3 text-[11px]">
                        {prospect.prospectionDate ? (
                          <span className="text-neutral-300 font-mono">
                            {formatDate(prospect.prospectionDate)}
                          </span>
                        ) : (
                          <span className="text-neutral-600 font-mono">—</span>
                        )}
                      </td>

                      {/* 4. TYPE */}
                      <td className="py-2.5 px-3">
                        <span className="text-blue-400 font-medium">{prospect.sector}</span>
                      </td>

                      {/* 5. ADRESS */}
                      <td className="py-2.5 px-3 text-neutral-300 max-w-[150px] truncate">
                        {prospect.address || prospect.wilaya || "—"}
                      </td>

                      {/* 6. APPEL (Liste déroulante interactive) */}
                      <td className="py-2 px-2">
                        <select
                          value={prospect.callStatus || "EFFECTUE"}
                          onChange={(e) => handleInlineFieldChange(prospect.id, "callStatus", e.target.value)}
                          className={`h-7 px-2 text-[11px] font-semibold rounded-lg border focus:outline-none cursor-pointer transition-all ${
                            prospect.callStatus === "EFFECTUE"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : prospect.callStatus?.includes("PAS") || prospect.callStatus?.includes("OCCUPE")
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

                      {/* 7. RÉSULTAT D'APPEL (Modification directe par liste déroulante) */}
                      <td className="py-2 px-2">
                        {(() => {
                          const latestResult =
                            prospect.calls?.[0]?.result ||
                            (prospect.status === ProspectStatus.INTERESTED || prospect.rawState === "INTERESSE"
                              ? CallResult.INTERESTED
                              : prospect.status === ProspectStatus.MEETING_SCHEDULED || prospect.rawState === "RDV PRIS"
                              ? CallResult.APPOINTMENT_BOOKED
                              : prospect.status === ProspectStatus.NOT_INTERESTED || prospect.rawState === "PAS INTERESSE"
                              ? CallResult.NOT_INTERESTED
                              : prospect.rawState === "A RAPPELER" || prospect.callStatus === "A RAPPELER"
                              ? CallResult.CALLBACK_REQUESTED
                              : prospect.callStatus === "PAS DE REPONSE" || prospect.rawState === "PAS DE CONTACT"
                              ? CallResult.NO_ANSWER
                              : prospect.callStatus === "INJOIGNABLE" || prospect.callStatus === "OCCUPE"
                              ? CallResult.UNREACHABLE
                              : "");

                          return (
                            <select
                              value={latestResult || ""}
                              onChange={(e) => handleInlineFieldChange(prospect.id, "callResult", e.target.value)}
                              className={`h-7 px-2 text-[10px] font-semibold rounded-lg border focus:outline-none cursor-pointer transition-all max-w-[140px] ${
                                latestResult === CallResult.INTERESTED
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold"
                                  : latestResult === CallResult.APPOINTMENT_BOOKED
                                  ? "bg-purple-500/20 text-purple-400 border-purple-500/40 font-bold"
                                  : latestResult === CallResult.CALLBACK_REQUESTED
                                  ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                                  : latestResult === CallResult.NOT_INTERESTED
                                  ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                                  : latestResult === CallResult.NO_ANSWER
                                  ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                                  : latestResult === CallResult.UNREACHABLE
                                  ? "bg-red-500/20 text-red-400 border-red-500/40"
                                  : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700"
                              }`}
                              title="Modifier le résultat de l'appel directement"
                            >
                              <option value="" className="bg-neutral-950 text-neutral-400">— Résultat —</option>
                              <option value="INTERESTED" className="bg-neutral-950 text-emerald-400 font-bold">Intéressé</option>
                              <option value="APPOINTMENT_BOOKED" className="bg-neutral-950 text-purple-400 font-bold">RDV fixé</option>
                              <option value="CALLBACK_REQUESTED" className="bg-neutral-950 text-blue-400">Rappel demandé</option>
                              <option value="NOT_INTERESTED" className="bg-neutral-950 text-rose-400">Pas intéressé</option>
                              <option value="NO_ANSWER" className="bg-neutral-950 text-amber-400">Ne répond pas</option>
                              <option value="UNREACHABLE" className="bg-neutral-950 text-red-400">Injoignable</option>
                            </select>
                          );
                        })()}
                      </td>

                      {/* 8. MAIL */}
                      <td className="py-2.5 px-3 text-neutral-400 text-[11px] max-w-[140px] truncate">
                        {prospect.email || "—"}
                      </td>

                      {/* 9. REPENSE (Édition directe en ligne) */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          defaultValue={prospect.response || ""}
                          onBlur={(e) => {
                            if (e.target.value !== (prospect.response || "")) {
                              handleInlineFieldChange(prospect.id, "response", e.target.value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          placeholder="Réponse..."
                          className="w-32 h-7 px-2 text-[11px] bg-neutral-950/70 border border-transparent hover:border-neutral-700 focus:border-blue-500 focus:bg-neutral-900 rounded-lg text-amber-400/90 placeholder:text-neutral-600 focus:outline-none font-sans truncate transition-colors"
                          title="Modifier directement la réponse (Entrée pour valider)"
                        />
                      </td>

                      {/* 10. REMARQUE (Édition directe en ligne) */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          defaultValue={prospect.notes || ""}
                          onBlur={(e) => {
                            if (e.target.value !== (prospect.notes || "")) {
                              handleInlineFieldChange(prospect.id, "notes", e.target.value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          placeholder="Remarque..."
                          className="w-32 h-7 px-2 text-[11px] bg-neutral-950/70 border border-transparent hover:border-neutral-700 focus:border-blue-500 focus:bg-neutral-900 rounded-lg text-neutral-300 placeholder:text-neutral-600 focus:outline-none font-sans truncate transition-colors"
                          title="Modifier directement la remarque (Entrée pour valider)"
                        />
                      </td>

                      {/* 11. COLONNE COMMERCIALE (Synchronisation directe) */}
                      <td className="py-2.5 px-3 bg-blue-950/10">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-blue-400 shrink-0" />
                          <select
                            value={prospect.assignedTo?.id || ""}
                            onChange={(e) => handleQuickAssign(prospect.id, e.target.value)}
                            className="h-7 px-2 text-[11px] font-medium bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:border-blue-500 focus:outline-none cursor-pointer hover:border-neutral-700 max-w-[130px]"
                            title="Changer le commercial assigné"
                          >
                            <option value="" className="text-neutral-500">Non assigné</option>
                            {salesUsers.map((u) => (
                              <option key={u.id} value={u.id} className="text-neutral-200">
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* 12. ACTIONS */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(prospect)}
                            className="px-2 py-1 bg-neutral-800 hover:bg-blue-600 hover:text-white rounded-lg text-neutral-300 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-medium border border-neutral-700/60"
                            title="Ouvrir la fiche et modifier"
                          >
                            <FileText className="w-3 h-3 text-blue-400 group-hover:text-white" />
                            <span>Fiche</span>
                          </button>

                          {(() => {
                            const hasAppointment =
                              (prospect._count?.appointments ?? 0) > 0 ||
                              prospect.status === ProspectStatus.MEETING_SCHEDULED ||
                              prospect.rawState === "RDV PRIS" ||
                              (prospect.appointments && prospect.appointments.length > 0);

                            return (
                              <button
                                onClick={() => {
                                  setActiveProspect(prospect);
                                  setAppointmentForm((prev) => ({
                                    ...prev,
                                    title: `RDV — ${prospect.companyName}`,
                                  }));
                                  setAppointmentModalOpen(true);
                                }}
                                className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                                  hasAppointment
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-600 hover:text-white shadow-xs shadow-emerald-500/20"
                                    : "bg-neutral-800 hover:bg-purple-600 hover:text-white text-neutral-300 border border-neutral-700/60 shadow-xs"
                                }`}
                                title={hasAppointment ? "✓ Rendez-vous Planifié (Cliquer pour voir/replanifier)" : "Planifier RDV"}
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                {hasAppointment && (
                                  <span className="text-[10px] font-bold px-0.5 text-emerald-400">RDV</span>
                                )}
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Barre de Pagination Optimisée */}
          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl text-xs shadow-lg">
              <div className="flex flex-wrap items-center gap-3 text-neutral-400">
                <span>
                  Affichage de <strong className="text-neutral-100">{pageSize === "all" ? 1 : (currentPage - 1) * pageSize + 1}</strong> à{" "}
                  <strong className="text-neutral-100">{pageSize === "all" ? filtered.length : Math.min(currentPage * pageSize, filtered.length)}</strong> sur{" "}
                  <strong className="text-blue-400">{filtered.length.toLocaleString("fr-FR")}</strong> prospects
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
                    <option value="all">Tous ({filtered.length})</option>
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
        </div>
      )}

      {/* VIEW 2: HISTORIQUE RÉCENT DES COMMUNICATIONS & STATS */}
      {activeTab === "history" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Calls Log Table */}
          <div className="lg:col-span-3 bg-neutral-900/80 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-200">Journal Chronologique des Communications</h3>
              <span className="text-[11px] text-neutral-500">{calls.length} entrées</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950/80 border-b border-neutral-800 text-neutral-400">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Date & Heure</th>
                    <th className="py-3 px-4 font-semibold">Cible (Prospect / Client)</th>
                    <th className="py-3 px-4 font-semibold">Commercial</th>
                    <th className="py-3 px-4 font-semibold">Résultat</th>
                    <th className="py-3 px-4 font-semibold">Durée</th>
                    <th className="py-3 px-4 font-semibold">Commentaire</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {calls.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-neutral-500">
                        Aucun appel enregistré pour l'instant.
                      </td>
                    </tr>
                  )}

                  {calls.map((call) => {
                    const targetName = call.prospect?.companyName || call.client?.companyName || "Inconnu";
                    const targetPhone = call.prospect?.phone || call.client?.phone || "";
                    const resultConfig = CALL_RESULTS[call.result] || {
                      label: call.result,
                      color: "bg-neutral-800 text-neutral-300",
                    };

                    return (
                      <tr key={call.id} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="py-3 px-4 text-neutral-400 shrink-0">
                          {formatDateTime(call.calledAt)}
                        </td>
                        <td className="py-3 px-4 font-medium text-neutral-200">
                          <p className="font-semibold text-neutral-100">{targetName}</p>
                          <p className="text-[10px] text-neutral-500 font-mono">{targetPhone}</p>
                        </td>
                        <td className="py-3 px-4 text-neutral-300">{call.user.name}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${resultConfig.color}`}>
                            {resultConfig.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-neutral-400 font-mono">
                          {call.durationSeconds ? `${Math.floor(call.durationSeconds / 60)}m ${call.durationSeconds % 60}s` : "0s"}
                        </td>
                        <td className="py-3 px-4 text-neutral-400 max-w-xs truncate">
                          {call.comment || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Breakdown by Rep */}
          <div className="lg:col-span-1 bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-neutral-200">Volume par Commercial</h3>
            <div className="space-y-3">
              {stats.byRep.map((rep) => (
                <div
                  key={rep.userId}
                  className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-medium text-neutral-200">{rep.name}</p>
                    <p className="text-[10px] text-neutral-500">Commercial actif</p>
                  </div>
                  <span className="text-sm font-bold text-blue-400">{rep.count} appels</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 1. MODAL: FICHE PROSPECT & MODIFICATION DES DÉTAILS */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Fiche Prospect : ${editForm.companyName}`}
        description="Consultez et modifiez les détails du prospect, ou synchronisez le commercial assigné"
        maxWidth="2xl"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {/* Quick Actions Bar inside the sheet */}
          <div className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-xl flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-300">Actions rapides :</span>
              <button
                type="button"
                onClick={() => {
                  setEditModalOpen(false);
                  if (activeProspect) {
                    setCallForm((prev) => ({ ...prev, prospectId: activeProspect.id }));
                    setCallModalOpen(true);
                  }
                }}
                className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <PhoneCall className="w-3 h-3" />
                <span>Enregistrer un appel</span>
              </button>

              {editForm.phone && (
                <a
                  href={buildWhatsAppUrl(editForm.phone, editForm.companyName, editForm.contactName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackCommunicationClick({
                      type: "WHATSAPP",
                      targetName: editForm.companyName || editForm.contactName,
                      phone: editForm.phone,
                      entityType: "PROSPECT",
                      entityId: activeProspect?.id,
                    });
                  }}
                  className="px-2.5 py-1 bg-emerald-500/15 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-emerald-500/30 hover:border-[#25D366] rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="Envoyer un message WhatsApp standard"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              )}

              {(() => {
                const hasAppointment =
                  (activeProspect?._count?.appointments ?? 0) > 0 ||
                  activeProspect?.status === ProspectStatus.MEETING_SCHEDULED ||
                  activeProspect?.rawState === "RDV PRIS" ||
                  (activeProspect?.appointments && activeProspect.appointments.length > 0);

                return (
                  <button
                    type="button"
                    onClick={() => {
                      setEditModalOpen(false);
                      if (activeProspect) {
                        setAppointmentForm((prev) => ({ ...prev, title: `RDV — ${activeProspect.companyName}` }));
                        setAppointmentModalOpen(true);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                      hasAppointment
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-600 hover:text-white"
                        : "bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    }`}
                  >
                    <Calendar className="w-3 h-3" />
                    <span>{hasAppointment ? "✓ RDV Planifié" : "Planifier un RDV"}</span>
                  </button>
                );
              })()}
            </div>

            {canDelete && activeProspect && (
              <button
                type="button"
                onClick={() => handleDeleteProspect(activeProspect.id)}
                className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Supprimer</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="CLIENT (Nom de l'entreprise) *"
              value={editForm.companyName}
              onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
              required
            />

            <Input
              label="NUMERO (Téléphone) *"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              label="DATE de prospection"
              type="date"
              value={editForm.prospectionDate}
              onChange={(e) => setEditForm({ ...editForm, prospectionDate: e.target.value })}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">TYPE (Secteur d'activité) *</label>
              <select
                value={editForm.sector}
                onChange={(e) => setEditForm({ ...editForm, sector: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">ADRESS (Wilaya / Localisation) *</label>
              <select
                value={editForm.wilaya}
                onChange={(e) => setEditForm({ ...editForm, wilaya: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
              >
                {WILAYAS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">APPEL (Statut d'appel)</label>
              <select
                value={editForm.callStatus}
                onChange={(e) => {
                  const val = e.target.value;
                  const isContact = val && val.trim() && val.trim().toUpperCase() !== "NON EFFECTUE";
                  setEditForm({
                    ...editForm,
                    callStatus: val,
                    prospectionDate: editForm.prospectionDate || (isContact ? toLocalDateString(new Date()) : editForm.prospectionDate),
                  });
                }}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
              >
                <option value="">— Sélectionner —</option>
                <option value="EFFECTUE">EFFECTUE</option>
                <option value="PAS DE REPONSE">PAS DE REPONSE</option>
                <option value="OCCUPE">OCCUPE</option>
                <option value="INJOIGNABLE">INJOIGNABLE</option>
                <option value="A RAPPELER">A RAPPELER</option>
                <option value="PAS DE CONTACT">PAS DE CONTACT</option>
                <option value="NON EFFECTUE">NON EFFECTUE</option>
              </select>
            </div>

            {/* 7. RÉSULTAT D'APPEL */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Résultat d'Appel (RÉSULTAT D'APPEL)</label>
              <select
                value={editForm.callResult || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditForm({
                    ...editForm,
                    callResult: val,
                    prospectionDate: editForm.prospectionDate || (val ? toLocalDateString(new Date()) : editForm.prospectionDate),
                  });
                }}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="">— Aucun résultat d'appel —</option>
                <option value="INTERESTED">Intéressé</option>
                <option value="APPOINTMENT_BOOKED">RDV fixé</option>
                <option value="CALLBACK_REQUESTED">Rappel demandé</option>
                <option value="NOT_INTERESTED">Pas intéressé</option>
                <option value="NO_ANSWER">Ne répond pas</option>
                <option value="UNREACHABLE">Injoignable</option>
              </select>
            </div>

            {/* COMMERCIAL ASSIGNÉ */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-blue-400 flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                <span>COMMERCIAL Assigné</span>
              </label>
              <select
                value={editForm.assignedToId}
                onChange={(e) => setEditForm({ ...editForm, assignedToId: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-blue-950/20 border border-blue-500/40 rounded-xl text-blue-200 focus:border-blue-400"
              >
                <option value="" className="text-neutral-500">Non assigné</option>
                {salesUsers.map((u) => (
                  <option key={u.id} value={u.id} className="text-neutral-200">
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="MAIL (Adresse email)"
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              placeholder="contact@entreprise.dz"
            />

            <Input
              label="REPENSE (Réponse du client)"
              value={editForm.response}
              onChange={(e) => setEditForm({ ...editForm, response: e.target.value })}
              placeholder="Réponse reçue lors de la prospection..."
            />
          </div>

          <Input
            label="REMARQUE & Notes complémentaires"
            value={editForm.notes}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            placeholder="Détails, besoins, retours d'échanges..."
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isLoading} className="gap-1.5 bg-blue-600 hover:bg-blue-500">
              <Save className="w-3.5 h-3.5" />
              <span>Enregistrer les modifications</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* 2. MODAL: ENREGISTRER UN APPEL */}
      <Modal
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        title={`Journaliser un appel : ${activeProspect?.companyName || "Nouveau Prospect"}`}
        description="Renseignez le prospect contacté et l'issue de l'échange"
        maxWidth="md"
      >
        <form onSubmit={handleCallSubmit} className="space-y-4">
          {!activeProspect && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Sélectionner le prospect *</label>
              <select
                value={callForm.prospectId}
                onChange={(e) => setCallForm({ ...callForm, prospectId: e.target.value })}
                className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
                required
              >
                {prospectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.companyName} ({p.phone})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300">Résultat de l'appel *</label>
            <select
              value={callForm.result}
              onChange={(e) => setCallForm({ ...callForm, result: e.target.value as CallResult })}
              className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
            >
              {Object.entries(CALL_RESULTS).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Durée de l'appel (secondes)"
            type="number"
            value={callForm.durationSeconds}
            onChange={(e) => setCallForm({ ...callForm, durationSeconds: Number(e.target.value) })}
          />

          <Input
            label="Notes / Commentaires (REPENSE)"
            value={callForm.comment}
            onChange={(e) => setCallForm({ ...callForm, comment: e.target.value })}
            placeholder="Objections, points d'accord, devis attendu..."
          />

          <div className="flex items-center gap-2 p-3 bg-neutral-800/40 border border-neutral-700/60 rounded-xl text-xs">
            <input
              type="checkbox"
              id="followupCheck"
              checked={callForm.autoScheduleFollowUp}
              onChange={(e) => setCallForm({ ...callForm, autoScheduleFollowUp: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="followupCheck" className="text-neutral-300 cursor-pointer">
              Programmer la séquence de relances (J+3, J+7, J+15)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setCallModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Enregistrer l'appel
            </Button>
          </div>
        </form>
      </Modal>

      {/* 3. MODAL: PLANIFIER UN RENDEZ-VOUS */}
      <Modal
        isOpen={appointmentModalOpen}
        onClose={() => setAppointmentModalOpen(false)}
        title={`Planifier un RDV : ${activeProspect?.companyName}`}
        description="Programmez une visite commerciale ou démo avec synchronisation agenda"
        maxWidth="md"
      >
        <form onSubmit={handleAppointmentSubmit} className="space-y-4">
          <Input
            label="Intitulé du RDV *"
            value={appointmentForm.title}
            onChange={(e) => setAppointmentForm({ ...appointmentForm, title: e.target.value })}
            placeholder="ex: Démo Solution ERP Boostera"
            required
          />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300">Type de rendez-vous *</label>
            <select
              value={appointmentForm.type}
              onChange={(e) =>
                setAppointmentForm({ ...appointmentForm, type: e.target.value as AppointmentType })
              }
              className="w-full h-10 px-3 text-sm bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100"
            >
              {Object.entries(APPOINTMENT_TYPES).map(([key, val]) => (
                <option key={key} value={key}>
                  {val}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Input
              label="Date *"
              type="date"
              value={appointmentForm.date}
              onChange={(e) => setAppointmentForm({ ...appointmentForm, date: e.target.value })}
              required
            />
            <Input
              label="Début *"
              type="time"
              value={appointmentForm.startTime}
              onChange={(e) => setAppointmentForm({ ...appointmentForm, startTime: e.target.value })}
              required
            />
            <Input
              label="Fin *"
              type="time"
              value={appointmentForm.endTime}
              onChange={(e) => setAppointmentForm({ ...appointmentForm, endTime: e.target.value })}
              required
            />
          </div>

          <Input
            label="Lieu / Lien Visio"
            value={appointmentForm.location}
            onChange={(e) => setAppointmentForm({ ...appointmentForm, location: e.target.value })}
            placeholder="Siège du client, Google Meet..."
          />

          <Input
            label="Ordre du jour / Préparation"
            value={appointmentForm.notes}
            onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
            placeholder="Besoins identifiés lors de l'appel téléphonique..."
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setAppointmentModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isLoading} className="bg-purple-600 hover:bg-purple-500">
              Valider le Rendez-vous
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
