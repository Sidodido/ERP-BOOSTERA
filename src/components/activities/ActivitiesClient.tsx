"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import {
  Activity,
  Phone,
  PhoneCall,
  Calendar,
  Clock,
  Coffee,
  CheckCircle2,
  Users,
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Building,
  DollarSign,
  Briefcase,
  Play,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Award,
  Sparkles,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/common/WhatsAppIcon";
import { getActivitiesDataAction } from "@/actions/activities";

interface ActivityItem {
  id: string;
  action: string;
  module: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl: string | null;
    position: string;
    department: string;
  } | null;
}

interface BreakTourItem {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  avatarUrl: string | null;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
  reason: string;
  status: "EN_COURS" | "TERMINEE";
}

interface TeamPerformanceItem {
  userId: string;
  name: string;
  email: string;
  role: string;
  position: string;
  avatarUrl: string | null;
  totalActions: number;
  phoneCalls: number;
  whatsApp: number;
  appointments: number;
  clientsSigned: number;
  pausesCount: number;
  breakMinutes: number;
  workMinutes: number;
  isCurrentlyClockedIn: boolean;
  isCurrentlyOnBreak: boolean;
}

interface ActivitiesData {
  activities: ActivityItem[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  kpis: {
    totalActions: number;
    phoneClicks: number;
    whatsAppClicks: number;
    appointments: number;
    clientsSigned: number;
    totalBreakMinutesTeam: number;
    activeClockedInCount: number;
    currentlyOnBreakCount: number;
  };
  currentlyOnBreakUsers: {
    userId: string;
    userName: string;
    userRole: string;
    avatarUrl: string | null;
    reason: string;
    startTime: string;
    elapsedMinutes: number;
  }[];
  breakToursHistory: BreakTourItem[];
  teamPerformance: TeamPerformanceItem[];
  usersList: {
    id: string;
    name: string;
    role: string;
    position: string;
  }[];
}

interface ActivitiesClientProps {
  initialData: ActivitiesData;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

const CATEGORIES = [
  { id: "ALL", label: "Toutes les activités", icon: Activity },
  { id: "CALLS", label: "Appels téléphoniques", icon: PhoneCall },
  { id: "WHATSAPP", label: "Échanges WhatsApp", icon: WhatsAppIcon },
  { id: "BREAKS", label: "Pauses & Repos", icon: Coffee },
  { id: "CLIENTS", label: "Signatures & Ventes", icon: Award },
  { id: "APPOINTMENTS", label: "Rendez-vous", icon: Calendar },
  { id: "ATTENDANCE", label: "Pointages Présence", icon: Clock },
  { id: "PRODUCTION", label: "Tâches & Projets", icon: Briefcase },
];

const DATE_PRESETS = [
  { id: "TODAY", label: "Aujourd'hui" },
  { id: "YESTERDAY", label: "Hier" },
  { id: "WEEK", label: "7 derniers jours" },
  { id: "MONTH", label: "Ce mois-ci" },
  { id: "ALL", label: "Toutes les dates" },
] as const;

export function ActivitiesClient({ initialData, currentUser }: ActivitiesClientProps) {
  const [data, setData] = useState<ActivitiesData>(initialData);
  const [activeTab, setActiveTab] = useState<"timeline" | "breaks" | "performance">("timeline");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedUser, setSelectedUser] = useState<string>("ALL");
  const [selectedDateRange, setSelectedDateRange] = useState<
    "TODAY" | "YESTERDAY" | "WEEK" | "MONTH" | "ALL"
  >("TODAY");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Digital clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch updated data on filter change
  const loadData = (newPage: number = page) => {
    startTransition(async () => {
      try {
        const res = await getActivitiesDataAction({
          page: newPage,
          limit: 30,
          userId: selectedUser,
          category: selectedCategory,
          dateRange: selectedDateRange,
          search: searchQuery,
        });
        setData(res);
        setPage(newPage);
      } catch (err) {
        console.error("Erreur lors du chargement des activités:", err);
      }
    });
  };

  // Trigger fetch when category, user, or dateRange changes
  useEffect(() => {
    loadData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedUser, selectedDateRange]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(1);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Format relative & absolute time
  const formatFullDateTime = (iso: string) => {
    const d = new Date(iso);
    const dateStr = d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timeStr = d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return `${dateStr} à ${timeStr}`;
  };

  const formatHoursMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} min`;
    return `${h}h ${String(m).padStart(2, "0")}m`;
  };

  // Parse activity details and get human-readable badge & label
  const parseActivityInfo = (item: ActivityItem) => {
    let detailsObj: Record<string, any> = {};
    try {
      if (item.details) {
        detailsObj = typeof item.details === "string" ? JSON.parse(item.details) : item.details;
      }
    } catch {
      detailsObj = { raw: item.details };
    }

    switch (item.action) {
      case "COMMUNICATION_PHONE":
      case "PHONE_CLICK":
        return {
          title: "Appel Téléphonique Initié",
          badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          icon: Phone,
          targetName: detailsObj.targetName || "Contact Prospect / Client",
          phone: detailsObj.phone,
          summary: `Clic pour appel vers ${detailsObj.targetName || "le contact"} (${detailsObj.phone || "sans numéro"})`,
          type: "PHONE",
        };

      case "COMMUNICATION_WHATSAPP":
      case "WHATSAPP_CLICK":
        return {
          title: "Échange WhatsApp Initié",
          badgeColor: "bg-green-500/10 text-[#25D366] border-green-500/20",
          icon: WhatsAppIcon,
          targetName: detailsObj.targetName || "Contact WhatsApp",
          phone: detailsObj.phone,
          summary: `Ouverture de discussion WhatsApp avec ${detailsObj.targetName || "le contact"} (${detailsObj.phone || "sans numéro"})`,
          type: "WHATSAPP",
        };

      case "PAUSE_START":
        return {
          title: "Départ en Pause",
          badgeColor: "bg-amber-500/10 text-amber-300 border-amber-500/20",
          icon: Coffee,
          targetName: detailsObj.employeeName || item.user?.name,
          summary: `Début de la pause : « ${detailsObj.reason || "Pause standard"} »`,
          type: "BREAK",
        };

      case "PAUSE_END":
        return {
          title: "Retour de Pause",
          badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
          icon: Play,
          targetName: detailsObj.employeeName || item.user?.name,
          summary: `Fin de la pause « ${detailsObj.reason || "Standard"} » • Durée totale : ${detailsObj.durationMinutes || 0} min`,
          type: "BREAK",
        };

      case "ATTENDANCE_CLOCK_IN":
        return {
          title: "Pointage d'Arrivée",
          badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
          icon: Clock,
          targetName: detailsObj.employeeName || item.user?.name,
          summary: `Arrivée enregistrée à ${detailsObj.clockIn ? new Date(detailsObj.clockIn).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"} (${detailsObj.status === "LATE" ? "En retard" : "À l'heure"})`,
          type: "ATTENDANCE",
        };

      case "ATTENDANCE_CLOCK_OUT":
        return {
          title: "Pointage de Sortie",
          badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
          icon: Clock,
          targetName: detailsObj.employeeName || item.user?.name,
          summary: `Fin de journée enregistrée • Temps de présence total : ${formatHoursMins(detailsObj.durationMinutes || 0)}`,
          type: "ATTENDANCE",
        };

      case "COMMISSION_CLIENT_SIGNED":
      case "CONVERT_TO_CLIENT":
        return {
          title: "Signature Client & Vente Conclue",
          badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
          icon: Award,
          targetName: detailsObj.clientName || detailsObj.companyName || "Nouveau Client",
          summary: `Nouveau contrat signé ! Formule : ${detailsObj.offer || "Pack"} ${detailsObj.commission ? `• Commission : +${detailsObj.commission} DA` : ""}`,
          type: "CLIENT",
        };

      case "LOG_CALL":
      case "CREATE_CLIENT_CALL":
        return {
          title: "Compte-Rendu d'Appel",
          badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          icon: PhoneCall,
          targetName: detailsObj.contactName || detailsObj.companyName || "Prospect",
          summary: `Appel consigné • Résultat : ${detailsObj.result || "Terminé"} ${detailsObj.notes ? `• « ${detailsObj.notes} »` : ""}`,
          type: "CALL",
        };

      case "CREATE_APPOINTMENT":
      case "RESCHEDULE_APPOINTMENT":
        return {
          title: "Rendez-vous Planifié",
          badgeColor: "bg-violet-500/10 text-violet-400 border-violet-500/20",
          icon: Calendar,
          targetName: detailsObj.prospectName || detailsObj.clientName || "Contact",
          summary: `Rendez-vous fixé pour le ${detailsObj.date || detailsObj.scheduledAt ? new Date(detailsObj.date || detailsObj.scheduledAt).toLocaleDateString("fr-FR") : "prochainement"}`,
          type: "APPOINTMENT",
        };

      case "RECORD_CLIENT_PAYMENT":
        return {
          title: "Encaissement Règlement",
          badgeColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
          icon: DollarSign,
          targetName: detailsObj.clientName || "Client",
          summary: `Paiement enregistré de ${detailsObj.amount ? `${detailsObj.amount} DA` : "montant reçu"} (${detailsObj.paymentMethod || "Virement"})`,
          type: "FINANCE",
        };

      case "CREATE_TASK":
      case "UPDATE_TASK_STATUS":
        return {
          title: "Action de Production",
          badgeColor: "bg-sky-500/10 text-sky-400 border-sky-500/20",
          icon: Briefcase,
          targetName: detailsObj.title || detailsObj.taskTitle || "Tâche",
          summary: `Mise à jour tâche de production • Statut : ${detailsObj.status || "En cours"}`,
          type: "PRODUCTION",
        };

      case "LOGIN":
        return {
          title: "Connexion Collaborateur",
          badgeColor: "bg-neutral-800 text-neutral-300 border-neutral-700",
          icon: UserCheck,
          targetName: item.user?.name || "Utilisateur",
          summary: `Session ouverte par ${item.user?.email || "collaborateur"}`,
          type: "AUTH",
        };

      default:
        return {
          title: item.action.replace(/_/g, " "),
          badgeColor: "bg-neutral-800 text-neutral-400 border-neutral-700",
          icon: Activity,
          targetName: item.module,
          summary: detailsObj.notes || detailsObj.message || item.details || "Action enregistrée",
          type: "OTHER",
        };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER & LIVE STATUS */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-neutral-900/90 border border-neutral-800/90 p-5 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-neutral-100 tracking-tight">
              Centre d'Activités & Performance Équipe
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Feed
            </span>
          </div>
          <p className="text-xs text-neutral-400">
            Traçabilité exhaustive de toutes les actions : clics WhatsApp, appels passés, tours des
            pauses et performances de vos équipes.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          {/* Digital Clock */}
          <div className="bg-neutral-950/80 border border-neutral-800 px-3.5 py-2 rounded-xl flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span className="font-mono text-sm font-bold text-neutral-200 tracking-wider">
              {currentTime || "--:--:--"}
            </span>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => loadData(page)}
            disabled={isPending}
            className="p-2.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors border border-neutral-700 cursor-pointer disabled:opacity-50"
            title="Actualiser les activités en direct"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* 2. REAL-TIME PAUSE STATUS ALERT BAR */}
      {data.currentlyOnBreakUsers.length > 0 ? (
        <div className="bg-amber-950/40 border border-amber-800/60 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md shadow-amber-950/20 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
              <Coffee className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {data.currentlyOnBreakUsers.length} Collaborateur(s) actuellement en pause
                </span>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {data.currentlyOnBreakUsers.map((b) => (
                  <span
                    key={b.userId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-900/60 border border-amber-700/60 text-amber-200 text-xs font-medium"
                  >
                    <strong>{b.userName}</strong>
                    <span className="text-amber-400/80">({b.reason})</span>
                    <span className="text-[11px] font-mono text-amber-300 bg-amber-950/80 px-1.5 py-0.2 rounded">
                      {b.elapsedMinutes} min
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab("breaks")}
            className="text-xs font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-900/40 hover:bg-amber-900/60 border border-amber-700/50 transition cursor-pointer self-start sm:self-auto shrink-0"
          >
            <span>Voir les tours de pause</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="bg-neutral-900/50 border border-neutral-800/80 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              Toute l'équipe active est actuellement en poste • Aucun collaborateur en pause.
            </span>
          </div>
          <span className="text-neutral-500 font-mono">
            {data.kpis.activeClockedInCount} collaborateur(s) pointé(s)
          </span>
        </div>
      )}

      {/* 3. KPI CARDS BANNER */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Actions */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            Actions ERP
          </span>
          <div className="font-bold text-2xl text-neutral-100 font-mono">
            {data.kpis.totalActions}
          </div>
          <span className="text-[10px] text-neutral-500">
            {selectedDateRange === "TODAY" ? "Aujourd'hui" : "Sur la période"}
          </span>
        </div>

        {/* Phone Calls */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
            Appels Téléphoniques
          </span>
          <div className="font-bold text-2xl text-emerald-400 font-mono">
            {data.kpis.phoneClicks}
          </div>
          <span className="text-[10px] text-neutral-500">Clics & consignations</span>
        </div>

        {/* WhatsApp */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <WhatsAppIcon className="w-3.5 h-3.5" />
            Échanges WhatsApp
          </span>
          <div className="font-bold text-2xl text-[#25D366] font-mono">
            {data.kpis.whatsAppClicks}
          </div>
          <span className="text-[10px] text-neutral-500">Discussions initiées</span>
        </div>

        {/* Signatures & Clients */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-purple-400" />
            Ventes Conclues
          </span>
          <div className="font-bold text-2xl text-purple-400 font-mono">
            {data.kpis.clientsSigned}
          </div>
          <span className="text-[10px] text-neutral-500">Signatures contrats</span>
        </div>

        {/* Team Break Total */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <Coffee className="w-3.5 h-3.5 text-amber-400" />
            Temps de Pause
          </span>
          <div className="font-bold text-2xl text-amber-400 font-mono">
            {formatHoursMins(data.kpis.totalBreakMinutesTeam)}
          </div>
          <span className="text-[10px] text-neutral-500">
            {data.breakToursHistory.length} pause(s) aujourd'hui
          </span>
        </div>

        {/* Active Collaborators */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            En Poste
          </span>
          <div className="font-bold text-2xl text-blue-400 font-mono">
            {data.kpis.activeClockedInCount}
          </div>
          <span className="text-[10px] text-neutral-500">Pointés aujourd'hui</span>
        </div>
      </div>

      {/* 4. NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("timeline")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "timeline"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>1. Journal des Activités (Audit en Direct)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/30">
            {data.pagination.totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("breaks")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "breaks"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
              : "bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
          }`}
        >
          <Coffee className="w-4 h-4" />
          <span>2. Suivi & Tours des Pauses</span>
          {data.currentlyOnBreakUsers.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/30">
            {data.breakToursHistory.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("performance")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === "performance"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>3. Performance & Classement de l'Équipe</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/30">
            {data.teamPerformance.length}
          </span>
        </button>
      </div>

      {/* 5. SEARCH & FILTER TOOLBAR (for Timeline & Breaks) */}
      <div className="bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search Query */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Rechercher par collaborateur, prospect, mot-clé..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Collaborator Selector */}
          <div>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="ALL">👤 Tous les collaborateurs</option>
              {data.usersList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.position})
                </option>
              ))}
            </select>
          </div>

          {/* Date Presets */}
          <div>
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
            >
              {DATE_PRESETS.map((d) => (
                <option key={d.id} value={d.id}>
                  📅 {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const isSelected = selectedCategory === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  isSelected
                    ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                    : "bg-neutral-950/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800/80"
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: TIMELINE / ACTIVITES JOURNAL                       */}
      {/* ========================================================= */}
      {activeTab === "timeline" && (
        <div className="space-y-3">
          {data.activities.length === 0 ? (
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-12 text-center space-y-3">
              <Activity className="w-10 h-10 text-neutral-600 mx-auto" />
              <h3 className="text-sm font-semibold text-neutral-300">
                Aucune activité trouvée pour ces critères
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                Modifiez la période, réinitialisez les filtres ou attendez les prochaines actions
                des collaborateurs.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.activities.map((item) => {
                const info = parseActivityInfo(item);
                const Icon = info.icon;
                const isExpanded = expandedLogId === item.id;

                return (
                  <div
                    key={item.id}
                    className="bg-neutral-900/80 hover:bg-neutral-850/90 border border-neutral-800/90 rounded-2xl p-4 transition shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Left: Timestamp + Collaborator + Action badge */}
                    <div className="flex items-start sm:items-center gap-3.5">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-sm font-bold text-neutral-200 uppercase shrink-0">
                        {item.user?.name ? item.user.name.substring(0, 2) : "SY"}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-neutral-200">
                            {item.user?.name || "Système Automatique"}
                          </span>
                          <span className="text-[11px] text-neutral-500 font-medium">
                            • {item.user?.position || item.user?.role || "ERP"}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1 ${info.badgeColor}`}
                          >
                            <Icon className="w-3 h-3" />
                            <span>{info.title}</span>
                          </span>
                        </div>

                        {/* Summary */}
                        <p className="text-xs text-neutral-300 font-medium">{info.summary}</p>
                      </div>
                    </div>

                    {/* Right: Exact Time & Expand details button */}
                    <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                      <div className="text-right">
                        <div className="font-mono text-xs font-bold text-neutral-200">
                          {formatFullDateTime(item.createdAt)}
                        </div>
                        <div className="text-[10px] text-neutral-500 capitalize">
                          {item.module}
                        </div>
                      </div>

                      {item.details && (
                        <button
                          type="button"
                          onClick={() => setExpandedLogId(isExpanded ? null : item.id)}
                          className="p-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition cursor-pointer"
                          title="Détails techniques"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Expanded Technical Details */}
                    {isExpanded && item.details && (
                      <div className="w-full mt-2 pt-3 border-t border-neutral-800/80">
                        <pre className="p-3 rounded-xl bg-neutral-950 text-[11px] font-mono text-neutral-300 overflow-x-auto border border-neutral-850">
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(item.details), null, 2);
                            } catch {
                              return item.details;
                            }
                          })()}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
              <span className="text-xs text-neutral-400">
                Page <strong className="text-neutral-200">{data.pagination.page}</strong> sur{" "}
                <strong className="text-neutral-200">{data.pagination.totalPages}</strong> (
                {data.pagination.totalCount} activités)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadData(data.pagination.page - 1)}
                  disabled={data.pagination.page <= 1 || isPending}
                  className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium border border-neutral-800 transition disabled:opacity-50 cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Précédent</span>
                </button>

                <button
                  type="button"
                  onClick={() => loadData(data.pagination.page + 1)}
                  disabled={data.pagination.page >= data.pagination.totalPages || isPending}
                  className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium border border-neutral-800 transition disabled:opacity-50 cursor-pointer flex items-center gap-1"
                >
                  <span>Suivant</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: SUIVI & TOURS DES PAUSES                          */}
      {/* ========================================================= */}
      {activeTab === "breaks" && (
        <div className="space-y-4">
          {/* Information & Summary Banner */}
          <div className="bg-amber-950/20 border border-amber-800/40 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-200">
                  Régulation & Tours des Pauses de l'Équipe
                </h3>
                <p className="text-xs text-neutral-400">
                  Chaque pause est horodatée avec l'heure exacte de départ et de reprise du travail.
                  Durée standard maximale recommandée : 45 min / jour.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="px-3 py-1.5 rounded-xl bg-amber-900/40 border border-amber-700/40 text-amber-300">
                Total : <strong>{formatHoursMins(data.kpis.totalBreakMinutesTeam)}</strong>
              </span>
            </div>
          </div>

          {/* Break Tours List */}
          {data.breakToursHistory.length === 0 ? (
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-12 text-center space-y-2">
              <Coffee className="w-8 h-8 text-neutral-600 mx-auto" />
              <h4 className="text-sm font-semibold text-neutral-300">
                Aucun tour de pause enregistré aujourd'hui
              </h4>
              <p className="text-xs text-neutral-500">
                Les pauses prises via le widget de pointage apparaîtront ici automatiquement en temps
                réel.
              </p>
            </div>
          ) : (
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 bg-neutral-950/60 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Collaborateur</th>
                      <th className="py-3 px-4">Motif de la pause</th>
                      <th className="py-3 px-4">Heure de Début</th>
                      <th className="py-3 px-4">Heure de Fin</th>
                      <th className="py-3 px-4 text-center">Durée</th>
                      <th className="py-3 px-4 text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 text-xs">
                    {data.breakToursHistory.map((tour) => {
                      const isAlert = tour.durationMinutes > 45;
                      return (
                        <tr
                          key={tour.id}
                          className="hover:bg-neutral-850/50 transition-colors"
                        >
                          {/* Collaborateur */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-300 uppercase">
                                {tour.userName.substring(0, 2)}
                              </div>
                              <div>
                                <div className="font-bold text-neutral-200">{tour.userName}</div>
                                <div className="text-[11px] text-neutral-500">{tour.userRole}</div>
                              </div>
                            </div>
                          </td>

                          {/* Motif */}
                          <td className="py-3.5 px-4 font-medium text-neutral-300">
                            {tour.reason}
                          </td>

                          {/* Heure Début */}
                          <td className="py-3.5 px-4 font-mono text-neutral-300">
                            {new Date(tour.startTime).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>

                          {/* Heure Fin */}
                          <td className="py-3.5 px-4 font-mono text-neutral-400">
                            {tour.endTime ? (
                              new Date(tour.endTime).toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })
                            ) : (
                              <span className="text-amber-400 italic">En cours...</span>
                            )}
                          </td>

                          {/* Durée */}
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                                isAlert
                                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                  : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                              }`}
                            >
                              {tour.durationMinutes} min
                            </span>
                          </td>

                          {/* Statut */}
                          <td className="py-3.5 px-4 text-right">
                            {tour.status === "EN_COURS" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                                <Coffee className="w-3 h-3" />
                                <span>En Pause</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Terminée</span>
                              </span>
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
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: PERFORMANCE & CLASSEMENT DE L'ÉQUIPE              */}
      {/* ========================================================= */}
      {activeTab === "performance" && (
        <div className="space-y-4">
          {/* Performance Header Summary */}
          <div className="bg-neutral-900/90 border border-neutral-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" />
                Tableau de Bord & Productivité des Collaborateurs
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Classement basé sur le volume total des actions ERP, appels, échanges WhatsApp et
                respect des temps de présence.
              </p>
            </div>
            <span className="text-xs font-mono text-neutral-500">
              Période : {DATE_PRESETS.find((d) => d.id === selectedDateRange)?.label}
            </span>
          </div>

          {/* Performance Table */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/60 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Rang & Collaborateur</th>
                    <th className="py-3 px-4 text-center">Total Actions</th>
                    <th className="py-3 px-4 text-center">Appels Passés</th>
                    <th className="py-3 px-4 text-center">WhatsApp</th>
                    <th className="py-3 px-4 text-center">Rendez-vous</th>
                    <th className="py-3 px-4 text-center">Ventes Signées</th>
                    <th className="py-3 px-4 text-center">Temps Travail</th>
                    <th className="py-3 px-4 text-center">Temps Pause</th>
                    <th className="py-3 px-4 text-right">Statut Actuel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-xs">
                  {data.teamPerformance.map((emp, index) => {
                    const isTop1 = index === 0;
                    return (
                      <tr
                        key={emp.userId}
                        className={`hover:bg-neutral-850/50 transition-colors ${
                          isTop1 ? "bg-amber-500/[0.03]" : ""
                        }`}
                      >
                        {/* Rang + Collaborateur */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-xs ${
                                isTop1
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                  : index === 1
                                  ? "bg-neutral-700 text-neutral-300"
                                  : index === 2
                                  ? "bg-neutral-800 text-neutral-400"
                                  : "text-neutral-600"
                              }`}
                            >
                              {index + 1}
                            </span>
                            <div className="w-8 h-8 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-300 uppercase shrink-0">
                              {emp.name.substring(0, 2)}
                            </div>
                            <div>
                              <div className="font-bold text-neutral-200 flex items-center gap-1.5">
                                <span>{emp.name}</span>
                                {isTop1 && (
                                  <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                )}
                              </div>
                              <div className="text-[11px] text-neutral-500">{emp.position}</div>
                            </div>
                          </div>
                        </td>

                        {/* Total Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-mono font-bold text-sm text-neutral-100 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800">
                            {emp.totalActions}
                          </span>
                        </td>

                        {/* Appels */}
                        <td className="py-3.5 px-4 text-center font-mono text-emerald-400 font-semibold">
                          {emp.phoneCalls}
                        </td>

                        {/* WhatsApp */}
                        <td className="py-3.5 px-4 text-center font-mono text-[#25D366] font-semibold">
                          {emp.whatsApp}
                        </td>

                        {/* RDV */}
                        <td className="py-3.5 px-4 text-center font-mono text-violet-400 font-semibold">
                          {emp.appointments}
                        </td>

                        {/* Ventes */}
                        <td className="py-3.5 px-4 text-center font-mono text-purple-400 font-bold">
                          {emp.clientsSigned}
                        </td>

                        {/* Temps de travail pointé */}
                        <td className="py-3.5 px-4 text-center font-mono text-neutral-300">
                          {formatHoursMins(emp.workMinutes)}
                        </td>

                        {/* Temps de pause */}
                        <td className="py-3.5 px-4 text-center font-mono text-amber-400">
                          {emp.breakMinutes} min
                        </td>

                        {/* Statut actuel */}
                        <td className="py-3.5 px-4 text-right">
                          {emp.isCurrentlyOnBreak ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                              <Coffee className="w-2.5 h-2.5" />
                              <span>En Pause</span>
                            </span>
                          ) : emp.isCurrentlyClockedIn ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span>En Poste</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-neutral-500 font-mono">
                              Non pointé
                            </span>
                          )}
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
    </div>
  );
}
