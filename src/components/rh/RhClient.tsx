"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UserCheck,
  Users,
  Calendar,
  Clock,
  DollarSign,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileSpreadsheet,
  X,
  Edit2,
  Trash2,
  Briefcase,
  ChevronRight,
  Lock,
  RefreshCw,
} from "lucide-react";
import {
  createEmployeeAction,
  updateEmployeeAction,
  deleteEmployeeAction,
  recordAttendanceAction,
  submitLeaveRequestAction,
  updateLeaveStatusAction,
  generatePayrollAction,
  markSalaryPaidAction,
  getTodayAttendancesAction,
} from "@/actions/rh";
import { DepartmentType, AttendanceStatus, LeaveType, LeaveStatus, Role } from "@prisma/client";

interface EmployeeItem {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  position: string;
  department: DepartmentType;
  baseSalary: number;
  isActive: boolean;
  user?: { name: string; email: string; role: string } | null;
}

interface AttendanceItem {
  id: string;
  employeeId: string;
  status: AttendanceStatus;
  clockIn?: Date | string | null;
  clockOut?: Date | string | null;
  breakMinutes: number;
  notes?: string | null;
  employee: { id: string; firstName: string; lastName: string; position: string };
}

interface LeaveItem {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: Date | string;
  endDate: Date | string;
  daysCount: number;
  reason?: string | null;
  status: LeaveStatus;
  employee: { id: string; firstName: string; lastName: string; position: string; department: DepartmentType };
  approvedBy?: { id: string; name: string } | null;
}

interface SalaryItem {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  baseSalary: number;
  primes: number;
  commissions: number;
  bonuses: number;
  deductions: number;
  netSalary: number;
  status: string;
  dailyRate?: number;
  deductedDays?: number;
  paidAt?: Date | string | null;
  employee: { id: string; firstName: string; lastName: string; position: string; baseSalary: number };
}

interface CommissionItem {
  id: string;
  employeeId: string;
  clientId?: string | null;
  amount: number;
  rateApplied: number;
  status: string;
  notes?: string | null;
  earnedDate: Date | string;
  employee?: { id: string; firstName: string; lastName: string } | null;
  client?: { id: string; companyName: string } | null;
}

export interface PayrollCycleInfoClient {
  startDate: string;
  endDate: string;
  displayStartDate: string;
  displayEndDate: string;
  label: string;
  isUnlocked: boolean;
}

export interface AvailablePayrollCycleClient {
  month: number;
  year: number;
  label: string;
  displayPeriod: string;
  isCurrent: boolean;
}

interface RhClientProps {
  month: number;
  year: number;
  cycleInfo?: PayrollCycleInfoClient;
  availableCycles?: AvailablePayrollCycleClient[];
  employees: EmployeeItem[];
  attendances: AttendanceItem[];
  leaveRequests: LeaveItem[];
  salaryPayments: SalaryItem[];
  commissions: CommissionItem[];
  usersWithoutEmployee: { id: string; name: string; email: string; role: string }[];
  kpis: {
    totalEmployees: number;
    activeEmployees: number;
    presentToday: number;
    pendingLeaves: number;
    totalBaseSalaries: number;
    totalCommissions: number;
    totalDeductions?: number;
  };
  initialTab?: string;
}

const DEPARTMENTS: { key: DepartmentType; label: string }[] = [
  { key: "COMMERCIAL", label: "Commercial & Ventes" },
  { key: "DEVELOPMENT", label: "Pôle Développement Web" },
  { key: "ADMINISTRATION", label: "Direction & Administration" },
  { key: "FINANCE", label: "Finance & Comptabilité" },
  { key: "HR", label: "Ressources Humaines" },
];

export const AVAILABLE_ROLES = [
  {
    key: "COMMERCIAL",
    role: "SALES_REP" as Role,
    position: "Commercial B2B",
    label: "Commercial B2B / Ventes",
    department: "COMMERCIAL" as DepartmentType,
  },
  {
    key: "DIRECTEUR_COMMERCIAL",
    role: "SALES_DIRECTOR" as Role,
    position: "Directeur Commercial",
    label: "Directeur Commercial",
    department: "COMMERCIAL" as DepartmentType,
  },
  {
    key: "DEVELOPPEUR",
    role: "DEVELOPER" as Role,
    position: "Développeur Web & Tech",
    label: "Développeur Web & Tech",
    department: "DEVELOPMENT" as DepartmentType,
  },
  {
    key: "TECH_LEAD",
    role: "TECH_LEAD" as Role,
    position: "Tech Lead / Responsable Technique",
    label: "Tech Lead / Responsable Technique",
    department: "DEVELOPMENT" as DepartmentType,
  },
  {
    key: "TECHNICIEN",
    role: "DEVELOPER" as Role,
    position: "TECHNICIEN",
    label: "Technicien / Support",
    department: "DEVELOPMENT" as DepartmentType,
  },
  {
    key: "DESIGNER",
    role: "DESIGNER" as Role,
    position: "Designer Graphique / UI-UX",
    label: "Designer Graphique / UI-UX",
    department: "DEVELOPMENT" as DepartmentType,
  },
  {
    key: "VIDEO_EDITOR",
    role: "VIDEO_EDITOR" as Role,
    position: "Vidéaste / Monteur Vidéo",
    label: "Vidéaste / Monteur Vidéo",
    department: "DEVELOPMENT" as DepartmentType,
  },
  {
    key: "HR",
    role: "HR" as Role,
    position: "Responsable RH",
    label: "Responsable RH",
    department: "ADMINISTRATION" as DepartmentType,
  },
  {
    key: "ACCOUNTANT",
    role: "ACCOUNTANT" as Role,
    position: "Comptable / Finance",
    label: "Comptable / Finance",
    department: "ADMINISTRATION" as DepartmentType,
  },
  {
    key: "DIRECTEUR_GENERAL",
    role: "ADMIN" as Role,
    position: "Directeur Général",
    label: "Directeur Général",
    department: "ADMINISTRATION" as DepartmentType,
  },
  {
    key: "CUSTOM",
    role: "SALES_REP" as Role,
    position: "",
    label: "✏️ Autre rôle personnalisé...",
    department: "COMMERCIAL" as DepartmentType,
  },
] as const;

export function RhClient({
  month,
  year,
  cycleInfo,
  availableCycles = [],
  employees,
  attendances,
  leaveRequests,
  salaryPayments,
  commissions = [],
  usersWithoutEmployee,
  kpis,
  initialTab,
}: RhClientProps) {
  const router = useRouter();
  const getInitialTab = (): "DIRECTORY" | "ATTENDANCE" | "LEAVES" | "PAYROLL" => {
    if (initialTab && ["DIRECTORY", "ATTENDANCE", "LEAVES", "PAYROLL"].includes(initialTab)) {
      return initialTab as any;
    }
    return "DIRECTORY";
  };

  const [activeTab, setActiveTab] = useState<"DIRECTORY" | "ATTENDANCE" | "LEAVES" | "PAYROLL">(
    getInitialTab()
  );
  const [isPending, startTransition] = useTransition();

  // État local réactif pour la synchronisation automatique en temps réel des pointages
  const [attendancesList, setAttendancesList] = useState<AttendanceItem[]>(attendances);
  const [kpisState, setKpisState] = useState(kpis);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setAttendancesList(attendances);
    setKpisState(kpis);
  }, [attendances, kpis]);

  const syncAttendances = async () => {
    try {
      setIsSyncing(true);
      const res = await getTodayAttendancesAction();
      if (res.success) {
        setAttendancesList(res.attendances as any);
        setKpisState((prev) => ({
          ...prev,
          presentToday: res.kpis.presentToday,
          absentToday: res.kpis.absentToday,
        }));
      }
    } catch (err) {
      console.error("Erreur auto-sync pointages:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const handleSync = () => {
      syncAttendances();
    };

    window.addEventListener("crm:attendance-updated", handleSync);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("crm_attendance_sync");
      bc.onmessage = handleSync;
    } catch {}

    // Polling automatique dynamique : toutes les 4s sur l'onglet Pointage Quotidien, 15s sinon
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        syncAttendances();
      }
    }, activeTab === "ATTENDANCE" ? 4000 : 15000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncAttendances();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("crm:attendance-updated", handleSync);
      if (bc) bc.close();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [activeTab]);

  // Conserver l'onglet actif lors des actions et rafraîchissements
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabFromUrl = params.get("tab") as any;
      if (tabFromUrl && ["DIRECTORY", "ATTENDANCE", "LEAVES", "PAYROLL"].includes(tabFromUrl)) {
        setActiveTab(tabFromUrl);
      }
    } catch {}
  }, []);

  const handleSelectTab = (tab: "DIRECTORY" | "ATTENDANCE" | "LEAVES" | "PAYROLL") => {
    setActiveTab(tab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    } catch {}
  };

  // Modals
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null);

  // New Employee Form
  const [newUserId, setNewUserId] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>("COMMERCIAL");
  const [newPosition, setNewPosition] = useState("Commercial B2B");
  const [newDept, setNewDept] = useState<DepartmentType>("COMMERCIAL");
  const [newUserRole, setNewUserRole] = useState<Role>("SALES_REP");
  const [newSalary, setNewSalary] = useState<number>(45000);

  const handleSelectRole = (key: string) => {
    setSelectedRoleKey(key);
    const found = AVAILABLE_ROLES.find((r) => r.key === key);
    if (found && key !== "CUSTOM") {
      setNewPosition(found.position);
      setNewDept(found.department);
      setNewUserRole(found.role);
    } else if (key === "CUSTOM") {
      setNewPosition("");
    }
  };

  // New Leave Form
  const [leaveEmpId, setLeaveEmpId] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("ANNUAL");
  const [leaveStart, setLeaveStart] = useState(() => new Date().toISOString().split("T")[0]);
  const [leaveEnd, setLeaveEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [leaveDays, setLeaveDays] = useState<number>(1);
  const [leaveReason, setLeaveReason] = useState("");

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName || !newLastName || !newPosition) {
      alert("Prénom, nom et poste sont requis.");
      return;
    }

    startTransition(async () => {
      try {
        await createEmployeeAction({
          userId: newUserId || undefined,
          firstName: newFirstName,
          lastName: newLastName,
          phone: newPhone,
          email: newEmail,
          position: newPosition,
          department: newDept,
          baseSalary: newSalary,
          userRole: newUserRole,
        });
        setShowAddEmpModal(false);
        // Reset form
        setNewFirstName("");
        setNewLastName("");
        setNewPhone("");
        setNewEmail("");
        setNewUserId("");
        setSelectedRoleKey("COMMERCIAL");
        setNewPosition("Commercial B2B");
        setNewDept("COMMERCIAL");
        setNewUserRole("SALES_REP");
        setNewSalary(45000);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur lors de la création");
      }
    });
  };

  const handleDeleteEmployee = async (emp: EmployeeItem) => {
    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir supprimer définitivement le collaborateur "${emp.firstName} ${emp.lastName}" (${emp.position}) ?\n\nToutes ses données associées (pointages, congés, salaires, commissions) seront également supprimées.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      try {
        const res = await deleteEmployeeAction(emp.id);
        if (res.success) {
          if (editingEmployee?.id === emp.id) {
            setEditingEmployee(null);
          }
          router.refresh();
        }
      } catch (err: any) {
        alert(err.message || "Erreur lors de la suppression du collaborateur.");
      }
    });
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    startTransition(async () => {
      try {
        await updateEmployeeAction(editingEmployee.id, {
          firstName: editingEmployee.firstName,
          lastName: editingEmployee.lastName,
          phone: editingEmployee.phone || undefined,
          position: editingEmployee.position,
          department: editingEmployee.department,
          baseSalary: editingEmployee.baseSalary,
          isActive: editingEmployee.isActive,
        });
        setEditingEmployee(null);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur lors de la modification");
      }
    });
  };

  const handleQuickAttendance = (employeeId: string, status: AttendanceStatus) => {
    startTransition(async () => {
      try {
        await recordAttendanceAction({ employeeId, status });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("crm:attendance-updated"));
          try {
            const bc = new BroadcastChannel("crm_attendance_sync");
            bc.postMessage({ timestamp: Date.now() });
            bc.close();
          } catch {}
        }
        await syncAttendances();
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur de pointage");
      }
    });
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveEmpId) {
      alert("Veuillez sélectionner un collaborateur.");
      return;
    }

    startTransition(async () => {
      try {
        await submitLeaveRequestAction({
          employeeId: leaveEmpId,
          type: leaveType,
          startDate: leaveStart,
          endDate: leaveEnd,
          daysCount: leaveDays,
          reason: leaveReason,
        });
        setShowLeaveModal(false);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur de demande de congé");
      }
    });
  };

  const handleUpdateLeaveStatus = (id: string, status: LeaveStatus) => {
    startTransition(async () => {
      try {
        await updateLeaveStatusAction(id, status);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur");
      }
    });
  };

  const handleSelectCycle = (selectedMonth: number, selectedYear: number) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "PAYROLL");
      url.searchParams.set("month", selectedMonth.toString());
      url.searchParams.set("year", selectedYear.toString());
      router.replace(url.toString(), { scroll: false });
    } catch {}
  };

  const handleGeneratePayroll = () => {
    if (cycleInfo && !cycleInfo.isUnlocked) {
      alert(`Le calcul de la paie pour ce cycle sera accessible à partir du ${cycleInfo.displayStartDate}.`);
      return;
    }
    startTransition(async () => {
      try {
        await generatePayrollAction(month, year);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur lors de la génération de la paie");
      }
    });
  };

  const handleMarkPaid = (id: string) => {
    startTransition(async () => {
      try {
        await markSalaryPaidAction(id);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2.5">
            <UserCheck className="w-7 h-7 text-indigo-400" />
            Ressources Humaines, Pointage & Salaires
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Gestion du personnel, feuilles d'émargement quotidiennes, congés et bulletins de paie.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowLeaveModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium transition"
          >
            <Calendar className="w-4 h-4" /> Demander Congé
          </button>
          <button
            onClick={() => setShowAddEmpModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" /> Nouveau Collaborateur
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Effectif Total
            </span>
            <span className="p-2 rounded-xl bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-neutral-100 mt-2 font-mono">
            {kpis.totalEmployees}
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {kpis.activeEmployees} actifs sous contrat
          </p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Présents Aujourd'hui
            </span>
            <span className="p-2 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2 font-mono">
            {kpisState.presentToday} / {kpisState.activeEmployees}
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {kpisState.activeEmployees > 0
              ? Math.round((kpisState.presentToday / kpisState.activeEmployees) * 100)
              : 0}% de présence au poste
          </p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Congés en Attente
            </span>
            <span className="p-2 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-800/40">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2 font-mono">
            {kpis.pendingLeaves}
          </div>
          <p className="text-xs text-neutral-400 mt-1">À valider par la direction</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Masse Salariale Base
            </span>
            <span className="p-2 rounded-xl bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-neutral-100 mt-2 font-mono">
            {kpis.totalBaseSalaries.toLocaleString("fr-FR")}{" "}
            <span className="text-sm font-normal text-neutral-400">DA</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            + {kpis.totalCommissions.toLocaleString("fr-FR")} DA de commissions
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
        <button
          onClick={() => handleSelectTab("DIRECTORY")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "DIRECTORY"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Annuaire Collaborateurs ({employees.length})
        </button>
        <button
          onClick={() => handleSelectTab("ATTENDANCE")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "ATTENDANCE"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Pointage Quotidien
        </button>
        <button
          onClick={() => handleSelectTab("LEAVES")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "LEAVES"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Demandes de Congés ({leaveRequests.length})
        </button>
        <button
          onClick={() => handleSelectTab("PAYROLL")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "PAYROLL"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Salaires & Commissions ({month}/{year})
        </button>
      </div>

      {/* TAB 1: DIRECTORY */}
      {activeTab === "DIRECTORY" && (
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                  <th className="py-3.5 px-4">Collaborateur</th>
                  <th className="py-3.5 px-4">Poste</th>
                  <th className="py-3.5 px-4">Pôle / Département</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4 text-right">Salaire Base</th>
                  <th className="py-3.5 px-4 text-center">Statut</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-neutral-800/30 transition">
                    <td className="py-3 px-4 font-semibold text-neutral-200">
                      {emp.firstName} {emp.lastName}
                    </td>
                    <td className="py-3 px-4 text-neutral-300">{emp.position}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800/30">
                        {DEPARTMENTS.find((d) => d.key === emp.department)?.label ||
                          emp.department}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-neutral-400 font-mono">
                      <div>{emp.phone || "—"}</div>
                      <div className="text-neutral-500">{emp.email || emp.user?.email}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-neutral-200">
                      {emp.baseSalary.toLocaleString("fr-FR")} DA
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          emp.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/30"
                            : "bg-neutral-100 text-neutral-600 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400"
                        }`}
                      >
                        {emp.isActive ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditingEmployee(emp)}
                          className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300 dark:hover:text-white dark:border-transparent transition"
                          title="Modifier"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 dark:border-rose-800/40 transition"
                          title="Supprimer ce collaborateur"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DAILY ATTENDANCE */}
      {activeTab === "ATTENDANCE" && (
        <div className="space-y-4">
          <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-400" />
              <span className="text-sm font-semibold text-neutral-200">
                Feuille d'émargement du jour ({new Date().toLocaleDateString("fr-FR")})
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800/40 dark:text-emerald-400 text-[11px] font-medium">
                <span className={`w-2 h-2 rounded-full bg-emerald-500 ${isSyncing ? "animate-ping" : "animate-pulse"}`} />
                <span>Synchronisé en direct</span>
              </div>
              <button
                type="button"
                onClick={() => syncAttendances()}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300 dark:border-transparent text-xs font-medium transition cursor-pointer disabled:opacity-50"
                title="Actualiser maintenant"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-indigo-400" : ""}`} />
                <span>Actualiser</span>
              </button>
            </div>
          </div>

          <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                    <th className="py-3.5 px-4">Collaborateur</th>
                    <th className="py-3.5 px-4">Poste</th>
                    <th className="py-3.5 px-4">Statut Aujourd'hui</th>
                    <th className="py-3.5 px-4">Heure d'Entrée</th>
                    <th className="py-3.5 px-4">Heure de Sortie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {employees
                    .filter((e) => e.isActive)
                    .map((emp) => {
                      const att = attendancesList.find((a) => a.employeeId === emp.id);
                      const status = att ? att.status : "ABSENT";
                      return (
                        <tr key={emp.id} className="hover:bg-neutral-800/30 transition">
                          <td className="py-3 px-4 font-semibold text-neutral-200">
                            {emp.firstName} {emp.lastName}
                          </td>
                          <td className="py-3 px-4 text-neutral-400 text-xs">
                            {emp.position}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                status === "PRESENT"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/30"
                                  : status === "LATE"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/30"
                                  : status === "ON_LEAVE"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/30"
                                  : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/30"
                              }`}
                            >
                              {status === "PRESENT"
                                ? "Présent"
                                : status === "LATE"
                                ? "En retard"
                                : status === "ON_LEAVE"
                                ? "En congé"
                                : "Absent (-1j paye)"}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-neutral-400">
                            {att?.clockIn
                              ? new Date(att.clockIn).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-amber-400">
                            {att?.clockOut
                              ? new Date(att.clockOut).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
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

      {/* TAB 3: LEAVES */}
      {activeTab === "LEAVES" && (
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                  <th className="py-3.5 px-4">Collaborateur</th>
                  <th className="py-3.5 px-4">Type de Congé</th>
                  <th className="py-3.5 px-4">Période Demandée</th>
                  <th className="py-3.5 px-4 text-center">Durée</th>
                  <th className="py-3.5 px-4">Motif</th>
                  <th className="py-3.5 px-4 text-center">Statut</th>
                  <th className="py-3.5 px-4 text-right">Décision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {leaveRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-400">
                      Aucune demande de congé enregistrée.
                    </td>
                  </tr>
                ) : (
                  leaveRequests.map((l) => (
                    <tr key={l.id} className="hover:bg-neutral-800/30 transition">
                      <td className="py-3 px-4 font-semibold text-neutral-200">
                        {l.employee.firstName} {l.employee.lastName}
                      </td>
                      <td className="py-3 px-4">
                        {l.type === "ANNUAL" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                            <span>🌴 Annuel</span>
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-900/80 text-emerald-200 uppercase font-bold tracking-tight">
                              Chômé & Payé
                            </span>
                          </span>
                        )}
                        {l.type === "SICK" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-950/60 text-rose-300 border border-rose-800/40">
                            <span>🩺 Maladie</span>
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-rose-900/80 text-rose-200 uppercase font-bold tracking-tight">
                              Non Payé (CNAS)
                            </span>
                          </span>
                        )}
                        {l.type === "PERMISSION" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/40">
                            <span>⏱️ Permission</span>
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-900/80 text-amber-200 uppercase font-bold tracking-tight">
                              Non Rémunéré
                            </span>
                          </span>
                        )}
                        {l.type === "SPECIAL" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/40">
                            <span>🎉 Spécial</span>
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-900/80 text-blue-200 uppercase font-bold tracking-tight">
                              Payé
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-neutral-300">
                        {new Date(l.startDate).toLocaleDateString("fr-FR")} →{" "}
                        {new Date(l.endDate).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-neutral-200">
                        {l.daysCount} jour{l.daysCount > 1 ? "s" : ""}
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-400 max-w-xs truncate">
                        {l.reason || "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            l.status === "CONFIRMED_HR" || l.status === "APPROVED_MANAGER"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/40"
                              : l.status === "REJECTED"
                              ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800/40"
                              : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800/40"
                          }`}
                        >
                          {l.status === "CONFIRMED_HR" || l.status === "APPROVED_MANAGER"
                            ? "Validé"
                            : l.status === "REJECTED"
                            ? "Refusé"
                            : "En attente"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {l.status === "PENDING" && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() =>
                                handleUpdateLeaveStatus(l.id, LeaveStatus.CONFIRMED_HR)
                              }
                              className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-400 dark:border-emerald-800/40 transition"
                              title="Approuver"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleUpdateLeaveStatus(l.id, LeaveStatus.REJECTED)
                              }
                              className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-400 dark:border-rose-800/40 transition"
                              title="Refuser"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PAYROLL */}
      {activeTab === "PAYROLL" && (
        <div className="space-y-4">
          <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                  Bulletins de Paie & Commissions
                </h3>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-950/70 text-indigo-300 border border-indigo-800/50 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  {cycleInfo?.label || `Cycle du 10 au 10 : du 10/${month.toString().padStart(2, "0")}/${year} au 10`}
                </span>
                {cycleInfo && !cycleInfo.isUnlocked && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/70 text-amber-300 border border-amber-800/50 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    Calcul débloqué le {cycleInfo.displayStartDate}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400">
                Formule : <span className="font-mono text-neutral-200 font-semibold">Salaire Net = Salaire Fixe + Commissions - Déductions (Maladie / Absences)</span>
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 text-[11px] font-medium">
                  <span>🗓️ Règle Entreprise :</span>
                  <strong className="text-indigo-200">Cycle exact du 10 au 10</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-[11px] font-medium">
                  <span>🌴 Congé Annuel :</span>
                  <strong className="text-emerald-200">Chômé & 100% Payé</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-950/60 text-rose-300 border border-rose-800/40 text-[11px] font-medium">
                  <span>🩺 Arrêt Maladie :</span>
                  <strong className="text-rose-200">Non Rémunéré (CNAS, Déduit)</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/40 text-[11px] font-medium">
                  <span>⚠️ Retenues maladie / absences :</span>
                  <strong className="text-amber-200">Prix exact de la journée (Base / 30j)</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-950/60 text-rose-300 border border-rose-800/40 text-[11px] font-medium">
                  <span>⚡ Déduction Automatique :</span>
                  <strong className="text-rose-200">-1 jour (Base ÷ 30j) par absence</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-950/60 text-teal-300 border border-teal-800/40 text-[11px] font-medium">
                  <span>🤝 Signature Client :</span>
                  <strong className="text-teal-200">+500 DA / contrat signé dans le cycle</strong>
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              {availableCycles && availableCycles.length > 0 && (
                <div className="flex items-center gap-2 bg-neutral-950/60 border border-neutral-800 rounded-xl px-3 py-1.5">
                  <span className="text-xs text-neutral-400 whitespace-nowrap">Cycle :</span>
                  <select
                    value={`${month}-${year}`}
                    onChange={(e) => {
                      const [m, y] = e.target.value.split("-").map(Number);
                      handleSelectCycle(m, y);
                    }}
                    className="bg-transparent text-neutral-200 text-xs font-semibold outline-none cursor-pointer"
                  >
                    {availableCycles.map((c) => (
                      <option key={`${c.month}-${c.year}`} value={`${c.month}-${c.year}`} className="bg-neutral-900 text-white">
                        {c.label} ({c.displayPeriod}){c.isCurrent ? " • En cours" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={handleGeneratePayroll}
                disabled={isPending || (cycleInfo ? !cycleInfo.isUnlocked : false)}
                title={cycleInfo && !cycleInfo.isUnlocked ? `Calcul disponible à partir du ${cycleInfo.displayStartDate}` : "Calculer ou recalculer la paie de ce cycle"}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition shadow-md shrink-0 ${
                  cycleInfo && !cycleInfo.isUnlocked
                    ? "bg-neutral-800/80 text-neutral-500 border border-neutral-700/40 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                } disabled:opacity-50`}
              >
                {cycleInfo && !cycleInfo.isUnlocked ? (
                  <>
                    <Lock className="w-4 h-4 text-neutral-400" />
                    Disponible le {cycleInfo.displayStartDate}
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    Calculer / Recalculer la Paie
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                    <th className="py-3.5 px-4">Collaborateur</th>
                    <th className="py-3.5 px-4">Poste</th>
                    <th className="py-3.5 px-4 text-right">Salaire Fixe</th>
                    <th className="py-3.5 px-4 text-right">Commissions</th>
                    <th className="py-3.5 px-4 text-right">Déductions (Maladie/Abs.)</th>
                    <th className="py-3.5 px-4 text-right">Total Net à Payer</th>
                    <th className="py-3.5 px-4 text-center">Statut</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {salaryPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-neutral-400">
                        Aucun collaborateur trouvé pour ce cycle.
                      </td>
                    </tr>
                  ) : (
                    salaryPayments.map((sp) => (
                      <tr key={sp.id} className="hover:bg-neutral-800/30 transition">
                        <td className="py-3 px-4 font-semibold text-neutral-200">
                          {sp.employee.firstName} {sp.employee.lastName}
                        </td>
                        <td className="py-3 px-4 text-xs text-neutral-400">
                          {sp.employee.position}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-mono text-neutral-300">
                              {sp.baseSalary.toLocaleString("fr-FR")} DA
                            </span>
                            {sp.baseSalary > 0 && (
                              <span className="text-[10px] text-neutral-500 font-normal">
                                ~{Math.round(sp.baseSalary / 30).toLocaleString("fr-FR")} DA / j
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400 font-semibold">
                          +{sp.commissions.toLocaleString("fr-FR")} DA
                        </td>
                        <td className="py-3 px-4 text-right">
                          {sp.deductions > 0 ? (
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-rose-400 font-mono">
                                -{sp.deductions.toLocaleString("fr-FR")} DA
                              </span>
                              <span className="text-[10px] text-rose-300/80 font-medium">
                                {sp.deductedDays && sp.deductedDays > 0
                                  ? `${sp.deductedDays} j. déduit${sp.deductedDays > 1 ? "s" : ""} (-1j/abs)`
                                  : "Retenue appliquée"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-neutral-500 text-xs">
                              0 DA <span className="text-[10px] text-emerald-400 font-semibold">(100% payé)</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-indigo-400">
                          {sp.netSalary.toLocaleString("fr-FR")} DA
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold ${
                              sp.status === "PAID"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/40"
                                : "bg-neutral-100 text-neutral-600 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
                            }`}
                          >
                            {sp.status === "PAID" ? "Viré / Payé" : "Brouillon"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {sp.status !== "PAID" && (
                            <button
                              onClick={() => handleMarkPaid(sp.id)}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
                            >
                              Marquer Payé
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Détail des Commissions Commerciales du Mois */}
          <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/40">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                  <DollarSign className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-neutral-200">
                    Détail des Commissions Commerciales du Cycle ({commissions.length})
                  </h4>
                  <p className="text-xs text-neutral-400">
                    Primes de signature client (+500 DA) et commissions comptabilisées dans le cycle (du 10 au 10).
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-3 py-1 rounded-xl">
                Total : +{kpis.totalCommissions.toLocaleString("fr-FR")} DA
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/30 text-neutral-400 text-xs uppercase font-semibold">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Collaborateur Bénéficiaire</th>
                    <th className="py-3 px-4">Client Signé</th>
                    <th className="py-3 px-4">Motif de Commission</th>
                    <th className="py-3 px-4 text-right">Montant Commission</th>
                    <th className="py-3 px-4 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {commissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-neutral-400">
                        Aucune commission enregistrée pour ce mois. Les commissions de signature (+500 DA par contrat signé) s'ajouteront automatiquement à la signature d'un client.
                      </td>
                    </tr>
                  ) : (
                    commissions.map((comm) => (
                      <tr key={comm.id} className="hover:bg-neutral-800/30 transition text-xs">
                        <td className="py-3 px-4 font-mono text-neutral-400">
                          {new Date(comm.earnedDate).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-3 px-4 font-semibold text-neutral-200">
                          {comm.employee?.firstName} {comm.employee?.lastName}
                        </td>
                        <td className="py-3 px-4 text-neutral-300 font-medium">
                          {comm.client?.companyName || "—"}
                        </td>
                        <td className="py-3 px-4 text-neutral-400">
                          {comm.notes || "Prime de signature client"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          +{Number(comm.amount).toLocaleString("fr-FR")} DA
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/40">
                            Validé
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD EMPLOYEE */}
      {showAddEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Nouveau Collaborateur BOOSTERA
                </h3>
              </div>
              <button
                onClick={() => setShowAddEmpModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="p-6 space-y-4">
              {usersWithoutEmployee.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Lier à un compte utilisateur existant (Optionnel)
                  </label>
                  <select
                    value={newUserId}
                    onChange={(e) => {
                      setNewUserId(e.target.value);
                      const u = usersWithoutEmployee.find((usr) => usr.id === e.target.value);
                      if (u) {
                        const parts = u.name.split(" ");
                        setNewFirstName(parts[0] || "");
                        setNewLastName(parts.slice(1).join(" ") || "");
                        setNewEmail(u.email);
                      }
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Nouveau profil autonome...</option>
                    {usersWithoutEmployee.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email} - {u.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Nom *
                  </label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Rôle / Poste existant *
                  </label>
                  <select
                    value={selectedRoleKey}
                    onChange={(e) => handleSelectRole(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  >
                    {AVAILABLE_ROLES.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Département *
                  </label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value as DepartmentType)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedRoleKey === "CUSTOM" && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Intitulé du poste personnalisé *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Responsable logistique, Social media manager..."
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Téléphone
                  </label>
                  <input
                    type="text"
                    placeholder="05 / 06 / 07..."
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Salaire Fixe de Base (DA) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={newSalary}
                    onChange={(e) => setNewSalary(Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddEmpModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Création..." : "Enregistrer Collaborateur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT EMPLOYEE */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <h3 className="text-lg font-bold text-neutral-100">
                Modifier Collaborateur : {editingEmployee.firstName} {editingEmployee.lastName}
              </h3>
              <button
                onClick={() => setEditingEmployee(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateEmployee} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Rôle / Poste
                  </label>
                  <select
                    value={
                      AVAILABLE_ROLES.some((r) => r.position === editingEmployee.position)
                        ? editingEmployee.position
                        : "CUSTOM"
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== "CUSTOM") {
                        const found = AVAILABLE_ROLES.find((r) => r.position === val);
                        setEditingEmployee({
                          ...editingEmployee,
                          position: val,
                          department: found?.department || editingEmployee.department,
                        });
                      }
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 mb-2"
                  >
                    {AVAILABLE_ROLES.filter((r) => r.key !== "CUSTOM").map((r) => (
                      <option key={r.key} value={r.position}>
                        {r.label}
                      </option>
                    ))}
                    <option value="CUSTOM">✏️ Autre rôle personnalisé...</option>
                  </select>
                  <input
                    type="text"
                    value={editingEmployee.position}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, position: e.target.value })
                    }
                    placeholder="Intitulé exact du poste"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-neutral-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Département
                  </label>
                  <select
                    value={editingEmployee.department}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        department: e.target.value as DepartmentType,
                      })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Salaire Base (DA)
                  </label>
                  <input
                    type="number"
                    value={editingEmployee.baseSalary}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        baseSalary: Number(e.target.value),
                      })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Statut Actif
                  </label>
                  <select
                    value={editingEmployee.isActive ? "true" : "false"}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        isActive: e.target.value === "true",
                      })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200"
                  >
                    <option value="true">Actif</option>
                    <option value="false">Inactif</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => handleDeleteEmployee(editingEmployee)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 dark:border-rose-800/40 text-xs font-semibold transition cursor-pointer"
                  title="Supprimer ce collaborateur"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer</span>
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingEmployee(null)}
                    className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                  >
                    Mettre à jour
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW LEAVE */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Demande de Congé / Absence
                </h3>
              </div>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Collaborateur *
                </label>
                <select
                  value={leaveEmpId}
                  onChange={(e) => setLeaveEmpId(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Sélectionner...</option>
                  {employees
                    .filter((e) => e.isActive)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.firstName} {e.lastName} ({e.position})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Type de Congé *
                  </label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="ANNUAL">🌴 Annuel (Chômé & Payé)</option>
                    <option value="SICK">🩺 Maladie (Non Payé / CNAS)</option>
                    <option value="PERMISSION">⏱️ Permission (Non Payé)</option>
                    <option value="SPECIAL">🎉 Événement Spécial (Payé)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Nombre de Jours *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={leaveDays}
                    onChange={(e) => setLeaveDays(Number(e.target.value))}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 text-center focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Notice explicative de rémunération */}
              {leaveType === "ANNUAL" && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-300 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Congé Annuel (Chômé & Payé) :</span> Le salaire fixe est maintenu à 100%. Zéro retenue ou déduction appliquée sur le bulletin de paie.
                  </div>
                </div>
              )}
              {leaveType === "SICK" && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Congé Maladie (Non Rémunéré par l'employeur) :</span> Les journées d'arrêt maladie sont déduites au prix exact de la journée (Salaire de base / 30 jours). L'indemnité journalière est prise en charge directement par la CNAS.
                  </div>
                </div>
              )}
              {leaveType === "PERMISSION" && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/40 text-xs text-amber-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Permission Courte :</span> Absence autorisée non rémunérée, déduite du calcul de salaire mensuel.
                  </div>
                </div>
              )}
              {leaveType === "SPECIAL" && (
                <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/40 text-xs text-blue-300 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Événement Exceptionnel :</span> Congé pour événement familial rémunéré à 100% selon le cadre légal (mariage, naissance, etc.).
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Date Début *
                  </label>
                  <input
                    type="date"
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Date Fin *
                  </label>
                  <input
                    type="date"
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Motif / Justification
                </label>
                <textarea
                  rows={2}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Raison de la demande..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Envoi..." : "Envoyer Demande"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
