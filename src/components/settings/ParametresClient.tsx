"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Users,
  Shield,
  Percent,
  Building2,
  History,
  Plus,
  CheckCircle2,
  XCircle,
  Edit2,
  X,
  Lock,
  Save,
  Clock,
  Download,
  Trash2,
  Search,
  Filter,
  Calendar,
  UserCheck,
  UserX,
  RefreshCw,
  AlertTriangle,
  Clock3,
  CalendarDays,
  FileSpreadsheet,
  Database,
} from "lucide-react";
import {
  createUserAction,
  updateUserAction,
  createCommissionRuleAction,
  updateCommissionRuleAction,
  adminSaveAttendanceAction,
  adminDeleteAttendanceAction,
} from "@/actions/settings";
import { autoSyncDailyAbsencesAction } from "@/actions/attendance";
import { Role, CommissionRuleType, AttendanceStatus, DepartmentType } from "@prisma/client";
import { SystemUpdatesTab } from "./SystemUpdatesTab";
import { DatabaseBackupTab } from "./DatabaseBackupTab";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  isActive: boolean;
  createdAt: Date | string;
}

interface CommissionRuleItem {
  id: string;
  name: string;
  ruleType: CommissionRuleType;
  ratePercentage: number;
  isActive: boolean;
  description?: string | null;
}

interface AuditLogItem {
  id: string;
  action: string;
  module: string;
  details?: string | null;
  createdAt: Date | string;
  user?: { name: string; email: string } | null;
}

export interface AttendanceItem {
  id: string;
  employeeId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: AttendanceStatus;
  notes?: string | null;
  durationMinutes: number;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    department: DepartmentType;
    phone?: string | null;
    email?: string | null;
  };
}

export interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  department: DepartmentType;
}

export interface AttendanceStats {
  totalRecorded: number;
  todayCount: number;
  todayCompleted: number;
  todayLates: number;
  todayAbsents?: number;
}

interface ParametresClientProps {
  users: UserItem[];
  commissionRules: CommissionRuleItem[];
  auditLogs: AuditLogItem[];
  agencyConfig: {
    name: string;
    address: string;
    phone: string;
    email: string;
    currency: string;
    defaultVatRate: number;
    baridiMobRip: string;
  };
  attendances?: AttendanceItem[];
  employees?: EmployeeOption[];
  attendanceStats?: AttendanceStats;
  initialTab?: string;
}

const ROLES: { key: Role; label: string }[] = [
  { key: "ADMIN", label: "Administrateur" },
  { key: "SALES_DIRECTOR", label: "Directeur Commercial" },
  { key: "SALES_REP", label: "Commercial / Ventes" },
  { key: "TECH_LEAD", label: "Chef Technique (Tech Lead)" },
  { key: "DEVELOPER", label: "Développeur Web" },
  { key: "DESIGNER", label: "Designer UI/UX" },
  { key: "VIDEO_EDITOR", label: "Monteur Vidéo" },
  { key: "ACCOUNTANT", label: "Comptable & Finance" },
  { key: "HR", label: "Ressources Humaines" },
];

const DEPARTMENT_LABELS: Record<string, { label: string; color: string }> = {
  COMMERCIAL: { label: "Commercial", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  PROSPECTION: { label: "Prospection", color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  SALES: { label: "Ventes", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  CUSTOMER_RELATIONS: { label: "Relation Client", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  MARKETING: { label: "Marketing", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  SOCIAL_MEDIA: { label: "Social Media", color: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  ADS: { label: "Ads / Média", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  CONTENT: { label: "Création Contenu", color: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20" },
  TECHNICAL: { label: "Technique", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  DESIGN: { label: "Design UI/UX", color: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  VIDEO: { label: "Monteur Vidéo", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  DEVELOPMENT: { label: "Dév Web / IT", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  ADMINISTRATION: { label: "Direction / Admin", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  FINANCE: { label: "Finance & Compta", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  HR: { label: "Ressources Humaines", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
};

const STATUS_BADGES: Record<AttendanceStatus, { label: string; bg: string; text: string }> = {
  PRESENT: { label: "Présent", bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-400" },
  LATE: { label: "En Retard", bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-400" },
  ABSENT: { label: "Absent (Non pointé)", bg: "bg-rose-500/10 border-rose-500/30", text: "text-rose-400" },
  ON_LEAVE: { label: "En Congé", bg: "bg-blue-500/10 border-blue-500/30", text: "text-blue-400" },
  HALF_DAY: { label: "Demi-Journée", bg: "bg-purple-500/10 border-purple-500/30", text: "text-purple-400" },
};

export function ParametresClient({
  users,
  commissionRules,
  auditLogs,
  agencyConfig,
  attendances = [],
  employees = [],
  attendanceStats = { totalRecorded: 0, todayCount: 0, todayCompleted: 0, todayLates: 0 },
  initialTab,
}: ParametresClientProps) {
  const router = useRouter();
  type TabType = "USERS" | "COMMISSIONS" | "AGENCY" | "AUDIT" | "ATTENDANCE" | "UPDATES" | "BACKUP";
  const validTabs: TabType[] = ["ATTENDANCE", "USERS", "COMMISSIONS", "AGENCY", "AUDIT", "UPDATES", "BACKUP"];

  const getInitialTab = (): TabType => {
    if (initialTab && validTabs.includes(initialTab as TabType)) {
      return initialTab as TabType;
    }
    return "ATTENDANCE";
  };

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabFromUrl = params.get("tab") as any;
      if (tabFromUrl && validTabs.includes(tabFromUrl)) {
        setActiveTab(tabFromUrl);
      }
    } catch {}
  }, []);

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    } catch {}
  };

  // Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);

  // New User Form
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<Role>("SALES_REP");
  const [newUserPhone, setNewUserPhone] = useState("");

  // New Rule Form
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleType, setNewRuleType] = useState<CommissionRuleType>(
    "NEW_CLIENT_PERCENTAGE"
  );
  const [newRuleRate, setNewRuleRate] = useState<number>(10);
  const [newRuleDesc, setNewRuleDesc] = useState("");

  // Attendance Filters
  const [attSearch, setAttSearch] = useState("");
  const [attDeptFilter, setAttDeptFilter] = useState<string>("ALL");
  const [attStatusFilter, setAttStatusFilter] = useState<string>("ALL");
  const [attDateFilter, setAttDateFilter] = useState<"ALL" | "TODAY" | "THIS_WEEK" | "CUSTOM">("ALL");
  const [attCustomDate, setAttCustomDate] = useState("");

  // Attendance Modal state
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<AttendanceItem | null>(null);
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formClockIn, setFormClockIn] = useState("09:00");
  const [formClockOut, setFormClockOut] = useState("17:00");
  const [formStatus, setFormStatus] = useState<AttendanceStatus>("PRESENT");
  const [formNotes, setFormNotes] = useState("");

  // Agency Config (Local state)
  const [agencyName, setAgencyName] = useState(agencyConfig.name);
  const [agencyAddress, setAgencyAddress] = useState(agencyConfig.address);
  const [agencyPhone, setAgencyPhone] = useState(agencyConfig.phone);
  const [agencyEmail, setAgencyEmail] = useState(agencyConfig.email);
  const [agencyRip, setAgencyRip] = useState(agencyConfig.baridiMobRip);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleOpenNewAttendance = () => {
    setEditingAttendance(null);
    setFormEmployeeId(employees[0]?.id || "");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormClockIn("09:00");
    setFormClockOut("17:00");
    setFormStatus("PRESENT");
    setFormNotes("");
    setShowAttendanceModal(true);
  };

  const handleEditAttendance = (item: AttendanceItem) => {
    setEditingAttendance(item);
    setFormEmployeeId(item.employeeId);
    setFormDate(new Date(item.date).toISOString().split("T")[0]);
    setFormClockIn(
      item.clockIn
        ? new Date(item.clockIn).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : ""
    );
    setFormClockOut(
      item.clockOut
        ? new Date(item.clockOut).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : ""
    );
    setFormStatus(item.status);
    setFormNotes(item.notes || "");
    setShowAttendanceModal(true);
  };

  const handleSaveAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployeeId || !formDate) {
      alert("Veuillez sélectionner un collaborateur et une date.");
      return;
    }

    startTransition(async () => {
      try {
        await adminSaveAttendanceAction({
          employeeId: formEmployeeId,
          date: formDate,
          clockInTime: formClockIn || undefined,
          clockOutTime: formClockOut || undefined,
          status: formStatus,
          notes: formNotes,
        });
        setShowAttendanceModal(false);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur lors de l'enregistrement du pointage");
      }
    });
  };

  const handleDeleteAttendance = (id: string, name: string) => {
    if (!confirm(`Confirmer la suppression du pointage pour ${name} ?`)) {
      return;
    }

    startTransition(async () => {
      try {
        await adminDeleteAttendanceAction(id);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur lors de la suppression");
      }
    });
  };

  const handleSyncAbsences = () => {
    startTransition(async () => {
      try {
        const res = await autoSyncDailyAbsencesAction({ daysBack: 7, includeToday: true });
        alert(res.message);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur de synchronisation des absences");
      }
    });
  };

  const formatDuration = (mins: number) => {
    if (mins <= 0) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} min`;
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  };

  // Filtered attendances
  const filteredAttendances = attendances.filter((a) => {
    if (attSearch.trim()) {
      const q = attSearch.toLowerCase();
      const matchName = `${a.employee.firstName} ${a.employee.lastName}`.toLowerCase().includes(q);
      const matchPos = (a.employee.position || "").toLowerCase().includes(q);
      const matchDept = (a.employee.department || "").toLowerCase().includes(q);
      const matchNotes = (a.notes || "").toLowerCase().includes(q);
      if (!matchName && !matchPos && !matchDept && !matchNotes) return false;
    }

    if (attDeptFilter !== "ALL" && a.employee.department !== attDeptFilter) {
      return false;
    }

    if (attStatusFilter !== "ALL" && a.status !== attStatusFilter) {
      return false;
    }

    const attDateObj = new Date(a.date);
    const today = new Date();
    const todayStr = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toDateString();

    if (attDateFilter === "TODAY") {
      if (attDateObj.toDateString() !== todayStr) return false;
    } else if (attDateFilter === "THIS_WEEK") {
      const nowMs = today.getTime();
      const diffDays = (nowMs - attDateObj.getTime()) / (1000 * 3600 * 24);
      if (diffDays < 0 || diffDays > 7) return false;
    } else if (attDateFilter === "CUSTOM" && attCustomDate) {
      const cDate = new Date(attCustomDate);
      if (attDateObj.toDateString() !== cDate.toDateString()) return false;
    }

    return true;
  });

  const handleExportCSV = () => {
    if (filteredAttendances.length === 0) {
      alert("Aucune donnée de pointage à exporter selon vos critères.");
      return;
    }

    const headers = [
      "Date",
      "Collaborateur",
      "Departement",
      "Poste",
      "Heure Arrivee",
      "Heure Sortie",
      "Duree (Minutes)",
      "Duree (Heures)",
      "Statut",
      "Notes",
    ];

    const rows = filteredAttendances.map((a) => {
      const dateStr = new Date(a.date).toLocaleDateString("fr-FR");
      const fullName = `${a.employee.firstName} ${a.employee.lastName}`;
      const clockInStr = a.clockIn
        ? new Date(a.clockIn).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        : "—";
      const clockOutStr = a.clockOut
        ? new Date(a.clockOut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        : "—";
      const hours = (a.durationMinutes / 60).toFixed(2);
      const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;

      return [
        escape(dateStr),
        escape(fullName),
        escape(a.employee.department),
        escape(a.employee.position),
        escape(clockInStr),
        escape(clockOutStr),
        a.durationMinutes,
        hours,
        escape(a.status),
        escape(a.notes || ""),
      ].join(";");
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `registre_pointages_boostera_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      alert("Nom et email requis");
      return;
    }

    startTransition(async () => {
      try {
        await createUserAction({
          name: newUserName,
          email: newUserEmail,
          role: newUserRole,
          phone: newUserPhone,
        });
        setShowUserModal(false);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur de création d'utilisateur");
      }
    });
  };

  const handleUpdateUserRole = (id: string, role: Role) => {
    startTransition(async () => {
      try {
        await updateUserAction(id, { role });
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur");
      }
    });
  };

  const handleToggleUserActive = (id: string, current: boolean) => {
    startTransition(async () => {
      try {
        await updateUserAction(id, { isActive: !current });
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur");
      }
    });
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || newRuleRate <= 0) {
      alert("Champs requis manquants");
      return;
    }

    startTransition(async () => {
      try {
        await createCommissionRuleAction({
          name: newRuleName,
          ruleType: newRuleType,
          ratePercentage: newRuleRate,
          description: newRuleDesc,
        });
        setShowRuleModal(false);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur de création de règle");
      }
    });
  };

  const handleToggleRuleActive = (id: string, current: boolean) => {
    startTransition(async () => {
      try {
        await updateCommissionRuleAction(id, { isActive: !current });
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur");
      }
    });
  };

  const handleSaveAgency = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2.5">
            <Settings className="w-7 h-7 text-indigo-400" />
            Configuration Système & Paramètres Agence
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Administration des comptes RBAC, barèmes de commissions commerciales et traçabilité.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 pb-3">
        <button
          onClick={() => handleSelectTab("ATTENDANCE")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
            activeTab === "ATTENDANCE"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          <Clock className="w-4 h-4" />
          Pointages & Émargement ({attendances.length})
        </button>
        <button
          onClick={() => handleSelectTab("USERS")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
            activeTab === "USERS"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          <Users className="w-4 h-4" />
          Utilisateurs & Rôles ({users.length})
        </button>
        <button
          onClick={() => handleSelectTab("COMMISSIONS")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
            activeTab === "COMMISSIONS"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          <Percent className="w-4 h-4" />
          Barèmes de Commissions ({commissionRules.length})
        </button>
        <button
          onClick={() => handleSelectTab("AGENCY")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
            activeTab === "AGENCY"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Identité Agence & RIB
        </button>
        <button
          onClick={() => handleSelectTab("AUDIT")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
            activeTab === "AUDIT"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          <History className="w-4 h-4" />
          Journal d'Audit ({auditLogs.length})
        </button>
        <button
          onClick={() => handleSelectTab("UPDATES")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
            activeTab === "UPDATES"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Mises à jour & Déploiement
        </button>
        <button
          onClick={() => handleSelectTab("BACKUP")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
            activeTab === "BACKUP"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          <Database className="w-4 h-4" />
          Sauvegardes BD
        </button>
      </div>

      {/* TAB 0: ATTENDANCE (Registre des Pointages & Émargements) */}
      {activeTab === "ATTENDANCE" && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Pointés Présents</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-bold text-neutral-100 font-mono">{attendanceStats.todayCount}</span>
                  <span className="text-xs text-neutral-500">aujourd'hui</span>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Départs Validés</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-bold text-neutral-100 font-mono">{attendanceStats.todayCompleted}</span>
                  <span className="text-xs text-neutral-500">journées finies</span>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Absents Automatiques</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-bold text-rose-400 font-mono">{attendanceStats.todayAbsents ?? 0}</span>
                  <span className="text-xs text-neutral-500">sans pointage</span>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Retards Constatés</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-bold text-amber-400 font-mono">{attendanceStats.todayLates}</span>
                  <span className="text-xs text-neutral-500">aujourd'hui</span>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Rechercher collaborateur, poste, pôle, notes..."
                  value={attSearch}
                  onChange={(e) => setAttSearch(e.target.value)}
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl pl-10 pr-3.5 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Date Filter */}
              <select
                value={attDateFilter}
                onChange={(e) => setAttDateFilter(e.target.value as any)}
                className="bg-neutral-950/80 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Toutes les dates</option>
                <option value="TODAY">Aujourd'hui</option>
                <option value="THIS_WEEK">7 derniers jours</option>
                <option value="CUSTOM">Date spécifique...</option>
              </select>

              {attDateFilter === "CUSTOM" && (
                <input
                  type="date"
                  value={attCustomDate}
                  onChange={(e) => setAttCustomDate(e.target.value)}
                  className="bg-neutral-950/80 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              )}

              {/* Department Filter */}
              <select
                value={attDeptFilter}
                onChange={(e) => setAttDeptFilter(e.target.value)}
                className="bg-neutral-950/80 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Tous les pôles</option>
                {Object.entries(DEPARTMENT_LABELS).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={attStatusFilter}
                onChange={(e) => setAttStatusFilter(e.target.value)}
                className="bg-neutral-950/80 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Tous statuts</option>
                <option value="PRESENT">Présent</option>
                <option value="LATE">En retard</option>
                <option value="ABSENT">Absent (Non pointé)</option>
                <option value="ON_LEAVE">En congé</option>
                <option value="HALF_DAY">Demi-journée</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleSyncAbsences}
                disabled={isPending}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-sm transition border border-neutral-700/50 disabled:opacity-50"
                title="Vérifier et synchroniser immédiatement les absences pour les collaborateurs n'ayant pas pointé"
              >
                <RefreshCw className={`w-4 h-4 text-rose-400 ${isPending ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Sync Absences</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-sm transition border border-neutral-700/50"
                title="Exporter le registre en fichier Excel/CSV"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <button
                onClick={handleOpenNewAttendance}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau Pointage</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Collaborateur</th>
                    <th className="py-3.5 px-4">Pôle / Département</th>
                    <th className="py-3.5 px-4 text-center">Arrivée</th>
                    <th className="py-3.5 px-4 text-center">Sortie</th>
                    <th className="py-3.5 px-4 text-center">Durée</th>
                    <th className="py-3.5 px-4 text-center">Statut</th>
                    <th className="py-3.5 px-4">Notes / Motif</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {filteredAttendances.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-neutral-400">
                        <Clock className="w-8 h-8 text-neutral-600 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium">Aucun pointage trouvé pour ces critères.</p>
                        <p className="text-xs text-neutral-500 mt-1">
                          Les collaborateurs pointent depuis leur dashboard ou vous pouvez créer un pointage manuellement.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredAttendances.map((att) => {
                      const dept = DEPARTMENT_LABELS[att.employee.department] || {
                        label: att.employee.department,
                        color: "bg-neutral-800 text-neutral-300 border-neutral-700",
                      };
                      const statusInfo = STATUS_BADGES[att.status] || {
                        label: att.status,
                        bg: "bg-neutral-800 border-neutral-700",
                        text: "text-neutral-300",
                      };
                      const clockInDate = att.clockIn ? new Date(att.clockIn) : null;
                      const clockOutDate = att.clockOut ? new Date(att.clockOut) : null;
                      const isToday =
                        new Date(att.date).toDateString() === new Date().toDateString();

                      return (
                        <tr key={att.id} className="hover:bg-neutral-800/30 transition">
                          {/* Date */}
                          <td className="py-3.5 px-4 font-mono text-xs text-neutral-300 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                              <span>{new Date(att.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                            </div>
                          </td>

                          {/* Collaborateur */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {att.employee.firstName.charAt(0)}
                                {att.employee.lastName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold text-neutral-200">
                                  {att.employee.firstName} {att.employee.lastName}
                                </p>
                                <p className="text-xs text-neutral-400">
                                  {att.employee.position}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Pôle / Département */}
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${dept.color}`}>
                              {dept.label}
                            </span>
                          </td>

                          {/* Heure d'Arrivée */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {clockInDate ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-semibold">
                                <Clock className="w-3 h-3" />
                                {clockInDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            ) : att.status === "ABSENT" ? (
                              <span className="text-xs text-rose-400/80 font-medium italic">Non pointé</span>
                            ) : (
                              <span className="text-xs text-neutral-500">—</span>
                            )}
                          </td>

                          {/* Heure de Sortie */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {clockOutDate ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono text-xs font-semibold">
                                <Clock className="w-3 h-3" />
                                {clockOutDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            ) : clockInDate && isToday ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium animate-pulse">
                                En poste...
                              </span>
                            ) : att.status === "ABSENT" ? (
                              <span className="text-xs text-rose-400/80 font-medium italic">Non pointé</span>
                            ) : (
                              <span className="text-xs text-neutral-500">—</span>
                            )}
                          </td>

                          {/* Durée */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span
                              className={`font-mono text-xs font-bold ${
                                att.status === "ABSENT" ? "text-rose-400/60" : "text-neutral-300"
                              }`}
                            >
                              {att.status === "ABSENT" ? "0 min" : formatDuration(att.durationMinutes)}
                            </span>
                          </td>

                          {/* Statut */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.bg} ${statusInfo.text}`}>
                              {statusInfo.label}
                            </span>
                          </td>

                          {/* Notes */}
                          <td className="py-3.5 px-4 text-xs text-neutral-400 max-w-xs truncate" title={att.notes || undefined}>
                            {att.notes || <span className="text-neutral-600">—</span>}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleEditAttendance(att)}
                                className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-indigo-400 transition"
                                title="Modifier ce pointage"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteAttendance(
                                    att.id,
                                    `${att.employee.firstName} ${att.employee.lastName}`
                                  )
                                }
                                className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 transition"
                                title="Supprimer ce pointage"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: USERS */}
      {activeTab === "USERS" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowUserModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" /> Créer un Utilisateur
            </button>
          </div>

          <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                    <th className="py-3.5 px-4">Utilisateur</th>
                    <th className="py-3.5 px-4">Email</th>
                    <th className="py-3.5 px-4">Téléphone</th>
                    <th className="py-3.5 px-4">Rôle Attribué</th>
                    <th className="py-3.5 px-4 text-center">Statut</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-neutral-800/30 transition">
                      <td className="py-3 px-4 font-semibold text-neutral-200">
                        {u.name}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-neutral-300">
                        {u.email}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-neutral-400">
                        {u.phone || "—"}
                      </td>
                      <td className="py-3 px-4">
                        {u.role === "ADMIN" || u.email === "admin@boostera.dz" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-xs font-medium text-indigo-300">
                            <Shield className="w-3 h-3 text-indigo-400" /> Administrateur
                          </span>
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => handleUpdateUserRole(u.id, e.target.value as Role)}
                            className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                          >
                            {ROLES.map((r) => (
                              <option key={r.key} value={r.key}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            u.isActive
                              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                              : "bg-neutral-800 text-neutral-400"
                          }`}
                        >
                          {u.isActive ? "Actif" : "Désactivé"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {u.role === "ADMIN" || u.email === "admin@boostera.dz" ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-neutral-400 bg-neutral-800/60 border border-neutral-700/40"
                            title="Compte administrateur protégé : impossible à désactiver"
                          >
                            <Lock className="w-3 h-3 text-amber-400" />
                            Protégé
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleUserActive(u.id, u.isActive)}
                            className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                              u.isActive
                                ? "bg-rose-950/40 hover:bg-rose-900 text-rose-400 border border-rose-800/40"
                                : "bg-emerald-950/50 hover:bg-emerald-900 text-emerald-400 border border-emerald-800/40"
                            }`}
                          >
                            {u.isActive ? "Désactiver" : "Réactiver"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMMISSION RULES */}
      {activeTab === "COMMISSIONS" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4">
            <p className="text-xs text-neutral-400">
              Barèmes automatiques appliqués au calcul mensuel des commissions de l'équipe commerciale.
            </p>
            <button
              onClick={() => setShowRuleModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" /> Nouvelle Règle
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {commissionRules.map((rule) => (
              <div
                key={rule.id}
                className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-neutral-100 text-base">{rule.name}</h3>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      rule.isActive
                        ? "bg-emerald-950/60 text-emerald-400"
                        : "bg-neutral-800 text-neutral-400"
                    }`}
                  >
                    {rule.isActive ? "Active" : "Désactivée"}
                  </span>
                </div>

                <div className="text-2xl font-black font-mono text-indigo-400">
                  {rule.ratePercentage}%
                </div>

                <p className="text-xs text-neutral-400">
                  {rule.description || "Règle de commissionnement standard."}
                </p>

                <div className="pt-3 border-t border-neutral-800 flex justify-end">
                  <button
                    onClick={() => handleToggleRuleActive(rule.id, rule.isActive)}
                    className="text-xs text-neutral-400 hover:text-white transition"
                  >
                    {rule.isActive ? "Désactiver la règle" : "Activer la règle"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: AGENCY IDENTITY */}
      {activeTab === "AGENCY" && (
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-6 max-w-2xl">
          <h3 className="font-bold text-neutral-100 text-base mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            Paramètres de l'Agence & Mentions Légales
          </h3>

          <form onSubmit={handleSaveAgency} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                Raison Sociale de l'Agence
              </label>
              <input
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                Adresse du Siège
              </label>
              <input
                type="text"
                value={agencyAddress}
                onChange={(e) => setAgencyAddress(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Téléphone Standard
                </label>
                <input
                  type="text"
                  value={agencyPhone}
                  onChange={(e) => setAgencyPhone(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Email de Contact
                </label>
                <input
                  type="email"
                  value={agencyEmail}
                  onChange={(e) => setAgencyEmail(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                Coordonnées RIP BaridiMob (pour factures)
              </label>
              <input
                type="text"
                value={agencyRip}
                onChange={(e) => setAgencyRip(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 font-mono"
              />
            </div>

            <div className="pt-3 flex items-center justify-between">
              {savedSuccess && (
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Paramètres enregistrés avec succès
                </span>
              )}
              <div className="ml-auto">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"
                >
                  <Save className="w-4 h-4" /> Enregistrer les Modifications
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === "AUDIT" && (
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                  <th className="py-3 px-4">Date & Heure</th>
                  <th className="py-3 px-4">Utilisateur</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Détails de l'opération</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-neutral-400">
                      Aucune opération journalisée.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-800/30 transition">
                      <td className="py-3 px-4 font-mono text-xs text-neutral-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("fr-FR")}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-neutral-200">
                        {log.user?.name || "Système"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-neutral-800 text-neutral-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-400">
                        {log.module}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-neutral-400 max-w-md truncate">
                        {log.details || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SYSTEM UPDATES & DEPLOYMENT */}
      {activeTab === "UPDATES" && <SystemUpdatesTab />}

      {/* TAB 6: DATABASE BACKUP */}
      {activeTab === "BACKUP" && <DatabaseBackupTab />}

      {/* MODAL: CREATE USER */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Créer un Compte Collaborateur
                </h3>
              </div>
              <button
                onClick={() => setShowUserModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Nom Complet *
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Adresse Email *
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Rôle RBAC *
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as Role)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                >
                  {ROLES.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Téléphone
                </label>
                <input
                  type="text"
                  placeholder="05 / 06 / 07..."
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Création..." : "Créer le Compte"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE COMMISSION RULE */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <Percent className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Nouvelle Règle de Commission
                </h3>
              </div>
              <button
                onClick={() => setShowRuleModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Libellé de la Règle *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Nouveau Client Signé, Abonnement Récurrent..."
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Type *
                  </label>
                  <select
                    value={newRuleType}
                    onChange={(e) =>
                      setNewRuleType(e.target.value as CommissionRuleType)
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="NEW_CLIENT_PERCENTAGE">% Nouveau Client</option>
                    <option value="RECURRING_MONTHLY_PERCENTAGE">% Abonnement Mensuel</option>
                    <option value="SPONSOR_PERCENTAGE">% Sponsor Ads</option>
                    <option value="FIXED_AMOUNT">Montant Fixe</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Taux (%) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="0.5"
                    value={newRuleRate}
                    onChange={(e) => setNewRuleRate(Number(e.target.value))}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 font-mono text-center focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newRuleDesc}
                  onChange={(e) => setNewRuleDesc(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Création..." : "Ajouter Règle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AJOUTER / MODIFIER UN POINTAGE */}
      {showAttendanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  {editingAttendance ? "Modifier le Pointage Collaborateur" : "Ajouter un Pointage Collaborateur"}
                </h3>
              </div>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="text-neutral-400 hover:text-white transition p-1 hover:bg-neutral-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAttendance} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Collaborateur *
                </label>
                <select
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  required
                  disabled={editingAttendance !== null}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                >
                  <option value="">Sélectionner un collaborateur...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} — {emp.position} ({DEPARTMENT_LABELS[emp.department]?.label || emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Date du Pointage *
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Statut du Pointage *
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as AttendanceStatus)}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PRESENT">Présent (Journée standard)</option>
                    <option value="LATE">En Retard</option>
                    <option value="ABSENT">Absent Non Justifié</option>
                    <option value="ON_LEAVE">En Congé / Permission</option>
                    <option value="HALF_DAY">Demi-Journée</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Heure d'Arrivée (Clock-In)
                  </label>
                  <input
                    type="time"
                    value={formClockIn}
                    onChange={(e) => setFormClockIn(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Heure de Sortie (Clock-Out)
                  </label>
                  <input
                    type="time"
                    value={formClockOut}
                    onChange={(e) => setFormClockOut(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Notes & Justification (Optionnel)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ex: Mission extérieure chez client, retard justifié, oubli de validation..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 placeholder:text-neutral-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAttendanceModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Enregistrement..." : editingAttendance ? "Mettre à jour" : "Valider le Pointage"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
