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
  Layers,
  Target,
  Flame,
  Download,
  Search,
  Filter,
  Eye,
  ChevronLeft,
  ChevronDown,
  LayoutGrid,
  List,
  Coffee,
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
  getMonthlyAttendancesAction,
  getTodayAllUsersBreaksAction,
  type EmployeeTodayBreak,
} from "@/actions/rh";
import {
  createEmployeeGoalAction,
  updateEmployeeGoalAction,
  deleteEmployeeGoalAction,
  syncGoalsAction,
} from "@/actions/teams";
import { DepartmentType, AttendanceStatus, LeaveType, LeaveStatus, Role } from "@prisma/client";

interface DepartmentData {
  name: string;
  label: string;
  members: {
    id: string;
    userId: string;
    name: string;
    position: string;
    email?: string | null;
    phone?: string | null;
    activeTasksCount: number;
    goals: {
      id: string;
      metric: string;
      targetValue: number;
      achievedValue: number;
    }[];
    reviews?: {
      id: string;
      scorePercentage: number;
      feedback?: string | null;
    }[];
  }[];
  activeTasksCount: number;
}

interface GoalItem {
  id: string;
  employeeId: string;
  metric: string;
  targetValue: number;
  achievedValue: number;
  employee: { id: string; firstName: string; lastName: string; position: string };
}

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
  date?: Date | string;
  clockIn?: Date | string | null;
  clockOut?: Date | string | null;
  breakMinutes: number;
  notes?: string | null;
  employee: { id: string; firstName: string; lastName: string; position: string; department?: DepartmentType };
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

export type RhTab =
  | "DIRECTORY"
  | "DEPARTMENTS"
  | "GOALS"
  | "ATTENDANCE"
  | "MONTHLY_ATTENDANCE"
  | "LEAVES"
  | "PAYROLL";

interface RhClientProps {
  month: number;
  year: number;
  cycleInfo?: PayrollCycleInfoClient;
  availableCycles?: AvailablePayrollCycleClient[];
  employees: EmployeeItem[];
  attendances: AttendanceItem[];
  monthlyAttendances?: AttendanceItem[];
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
  departments?: DepartmentData[];
  goals?: GoalItem[];
  employeesList?: { id: string; name: string; position: string }[];
  userRole?: string;
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
  monthlyAttendances = [],
  leaveRequests,
  salaryPayments,
  commissions = [],
  usersWithoutEmployee,
  kpis,
  departments = [],
  goals = [],
  employeesList = [],
  userRole = "ADMIN",
  initialTab,
}: RhClientProps) {
  const router = useRouter();
  const getInitialTab = (): RhTab => {
    if (initialTab) {
      const upper = initialTab.toUpperCase();
      if (upper === "DEPARTMENTS" || upper === "POLES") return "DEPARTMENTS";
      if (upper === "GOALS" || upper === "OBJECTIFS") return "GOALS";
      if (upper === "MONTHLY" || upper === "MENSUEL" || upper === "MONTHLY_ATTENDANCE" || upper === "POINTAGE_MENSUEL") {
        return "MONTHLY_ATTENDANCE";
      }
      if (
        [
          "DIRECTORY",
          "DEPARTMENTS",
          "GOALS",
          "ATTENDANCE",
          "MONTHLY_ATTENDANCE",
          "LEAVES",
          "PAYROLL",
        ].includes(upper)
      ) {
        return upper as RhTab;
      }
    }
    return "DIRECTORY";
  };

  const [activeTab, setActiveTab] = useState<RhTab>(getInitialTab());
  const [isPending, startTransition] = useTransition();

  // État local réactif pour la synchronisation automatique en temps réel des pointages
  const [attendancesList, setAttendancesList] = useState<AttendanceItem[]>(attendances);
  const [monthlyAttendancesList, setMonthlyAttendancesList] = useState<AttendanceItem[]>(monthlyAttendances);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<number>(month);
  const [selectedYearFilter, setSelectedYearFilter] = useState<number>(year);
  const [monthlyDeptFilter, setMonthlyDeptFilter] = useState<string>("ALL");
  const [monthlyEmployeeFilter, setMonthlyEmployeeFilter] = useState<string>("ALL");
  const [monthlyStatusFilter, setMonthlyStatusFilter] = useState<string>("ALL");
  const [monthlySearch, setMonthlySearch] = useState<string>("");
  const [monthlyViewMode, setMonthlyViewMode] = useState<"SUMMARY" | "MATRIX" | "LOG">("SUMMARY");
  const [isLoadingMonthly, setIsLoadingMonthly] = useState<boolean>(false);
  const [kpisState, setKpisState] = useState(kpis);
  const [isSyncing, setIsSyncing] = useState(false);

  // Vue des pauses quotidiennes de tous les collaborateurs
  const [dailyAttendanceSubView, setDailyAttendanceSubView] = useState<"ATTENDANCE" | "BREAKS">("ATTENDANCE");
  const [allUsersBreaks, setAllUsersBreaks] = useState<EmployeeTodayBreak[]>([]);
  const [allUsersBreaksKpis, setAllUsersBreaksKpis] = useState<{
    totalEmployees: number;
    clockedInCount: number;
    currentlyOnBreak: number;
    totalCompanyBreakMinutes: number;
    exceededCount: number;
  } | null>(null);
  const [isLoadingAllUsersBreaks, setIsLoadingAllUsersBreaks] = useState<boolean>(false);
  const [breaksSearchQuery, setBreaksSearchQuery] = useState<string>("");
  const [expandedBreakEmployeeId, setExpandedBreakEmployeeId] = useState<string | null>(null);

  const loadAllUsersBreaks = async () => {
    setIsLoadingAllUsersBreaks(true);
    try {
      const res = await getTodayAllUsersBreaksAction();
      if (res && res.success) {
        setAllUsersBreaks(res.breaks);
        setAllUsersBreaksKpis(res.kpis);
      }
    } catch (err) {
      console.error("Erreur chargement pauses RH:", err);
    } finally {
      setIsLoadingAllUsersBreaks(false);
    }
  };

  useEffect(() => {
    setAttendancesList(attendances);
    setMonthlyAttendancesList(monthlyAttendances);
    setKpisState(kpis);
  }, [attendances, monthlyAttendances, kpis]);

  useEffect(() => {
    if (activeTab === "ATTENDANCE" && dailyAttendanceSubView === "BREAKS") {
      loadAllUsersBreaks();
    }
  }, [activeTab, dailyAttendanceSubView]);

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
      if (dailyAttendanceSubView === "BREAKS") {
        await loadAllUsersBreaks();
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
      const tabFromUrl = params.get("tab")?.toUpperCase() as any;
      if (tabFromUrl) {
        if (tabFromUrl === "DEPARTMENTS" || tabFromUrl === "POLES") {
          setActiveTab("DEPARTMENTS");
        } else if (tabFromUrl === "GOALS" || tabFromUrl === "OBJECTIFS") {
          setActiveTab("GOALS");
        } else if (
          [
            "DIRECTORY",
            "DEPARTMENTS",
            "GOALS",
            "ATTENDANCE",
            "LEAVES",
            "PAYROLL",
          ].includes(tabFromUrl)
        ) {
          setActiveTab(tabFromUrl);
        }
      }
    } catch {}
  }, []);

  const handleSelectTab = (tab: RhTab) => {
    setActiveTab(tab);
    try {
      const url = new URL(window.location.href);
      if (tab === "DIRECTORY") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", tab);
      }
      window.history.replaceState(null, "", url.toString());
    } catch {}
  };

  // État & handlers pour les Objectifs Mensuels
  const isPrivileged =
    userRole === "ADMIN" || userRole === "SALES_DIRECTOR" || userRole === "HR";
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalEmpId, setGoalEmpId] = useState("");
  const [goalMetric, setGoalMetric] = useState("APPELS");
  const [goalTarget, setGoalTarget] = useState<number>(100);
  const [isSyncingGoals, setIsSyncingGoals] = useState(false);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalEmpId || goalTarget <= 0) {
      alert("Champs obligatoires manquants");
      return;
    }

    startTransition(async () => {
      try {
        await createEmployeeGoalAction({
          employeeId: goalEmpId,
          month,
          year,
          metric: goalMetric,
          targetValue: goalTarget,
        });
        setShowGoalModal(false);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur de création de l'objectif");
      }
    });
  };

  const handleUpdateGoalProgress = (id: string, current: number, delta: number) => {
    const nextVal = Math.max(0, current + delta);
    startTransition(async () => {
      try {
        await updateEmployeeGoalAction(id, nextVal);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur");
      }
    });
  };

  const handleDeleteGoal = (id: string, label?: string) => {
    const confirmed = window.confirm(
      label
        ? `Êtes-vous sûr de vouloir supprimer l'objectif pour ${label} ?`
        : "Êtes-vous sûr de vouloir supprimer cet objectif ?"
    );
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteEmployeeGoalAction(id);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur lors de la suppression de l'objectif");
      }
    });
  };

  const handleSyncGoals = async () => {
    setIsSyncingGoals(true);
    try {
      await syncGoalsAction(month, year);
      router.refresh();
    } catch (err: any) {
      alert("Erreur lors de la synchronisation des objectifs");
    } finally {
      setIsSyncingGoals(false);
    }
  };

  // Modals
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null);

  // Formulaire Pointage Admin
  const [attendanceModalEmp, setAttendanceModalEmp] = useState<EmployeeItem | null>(null);
  const [attFormEmpId, setAttFormEmpId] = useState("");
  const [attFormDate, setAttFormDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [attFormStatus, setAttFormStatus] = useState<AttendanceStatus>("PRESENT");
  const [attFormClockIn, setAttFormClockIn] = useState("");
  const [attFormClockOut, setAttFormClockOut] = useState("");
  const [attFormNotes, setAttFormNotes] = useState("");
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

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

  const handleOpenEditAttendanceModal = (emp: EmployeeItem, att?: AttendanceItem, dateStr?: string) => {
    setAttendanceModalEmp(emp);
    setAttFormEmpId(emp.id);
    const initialDate =
      dateStr ||
      (att?.date
        ? new Date(att.date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]);
    setAttFormDate(initialDate);

    if (att) {
      setAttFormStatus(att.status);
      setAttFormClockIn(
        att.clockIn
          ? new Date(att.clockIn).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
          : ""
      );
      setAttFormClockOut(
        att.clockOut
          ? new Date(att.clockOut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
          : ""
      );
      setAttFormNotes(att.notes || "");
    } else {
      setAttFormStatus("PRESENT");
      setAttFormClockIn("08:30");
      setAttFormClockOut("");
      setAttFormNotes("");
    }
    setShowAttendanceModal(true);
  };

  const handleOpenNewAttendanceModal = (dateStr?: string) => {
    setAttendanceModalEmp(null);
    const firstActive = employees.find((e) => e.isActive);
    setAttFormEmpId(firstActive ? firstActive.id : "");
    setAttFormDate(dateStr || new Date().toISOString().split("T")[0]);
    setAttFormStatus("PRESENT");
    setAttFormClockIn("08:30");
    setAttFormClockOut("17:00");
    setAttFormNotes("");
    setShowAttendanceModal(true);
  };

  const handleChangeMonthlyPeriod = async (newMonth: number, newYear: number) => {
    setSelectedMonthFilter(newMonth);
    setSelectedYearFilter(newYear);
    try {
      setIsLoadingMonthly(true);
      const res = await getMonthlyAttendancesAction(newMonth, newYear);
      if (res.success) {
        setMonthlyAttendancesList(res.attendances as any);
      }
    } catch (err) {
      console.error("Erreur chargement pointages mensuels:", err);
    } finally {
      setIsLoadingMonthly(false);
    }
  };

  const handleExportMonthlyCSV = () => {
    const activeEmps = employees.filter((e) => e.isActive);
    const rows = [
      ["Collaborateur", "Poste", "Departement", "Date", "Statut", "Arrivee", "Sortie", "Notes"],
    ];

    monthlyAttendancesList.forEach((att) => {
      const emp = activeEmps.find((e) => e.id === att.employeeId);
      if (!emp) return;
      const dateStr = att.date ? new Date(att.date).toLocaleDateString("fr-FR") : "";
      const clockIn = att.clockIn
        ? new Date(att.clockIn).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        : "";
      const clockOut = att.clockOut
        ? new Date(att.clockOut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        : "";
      rows.push([
        `${emp.firstName} ${emp.lastName}`,
        emp.position,
        emp.department,
        dateStr,
        att.status,
        clockIn,
        clockOut,
        (att.notes || "").replace(/"/g, '""'),
      ]);
    });

    const csvContent =
      "\uFEFF" +
      rows
        .map((row) => row.map((cell) => `"${cell}"`).join(";"))
        .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pointages-mensuels-${selectedMonthFilter}-${selectedYearFilter}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmpId = attendanceModalEmp?.id || attFormEmpId;
    if (!targetEmpId) {
      alert("Veuillez sélectionner un collaborateur");
      return;
    }

    try {
      setIsSavingAttendance(true);
      const res = await recordAttendanceAction({
        employeeId: targetEmpId,
        status: attFormStatus,
        clockInTime: attFormClockIn,
        clockOutTime: attFormClockOut,
        notes: attFormNotes,
        date: attFormDate,
      });

      if (res.success && res.attendance) {
        // Mettre à jour la liste journalière si la date correspond à aujourd'hui
        const isToday =
          new Date(attFormDate).toDateString() === new Date().toDateString();
        if (isToday) {
          setAttendancesList((prev) => {
            const index = prev.findIndex((a) => a.employeeId === targetEmpId);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = res.attendance as any;
              return updated;
            } else {
              return [res.attendance as any, ...prev];
            }
          });
        }

        // Mettre à jour la liste mensuelle
        setMonthlyAttendancesList((prev) => {
          const targetDateOnly = new Date(attFormDate).toISOString().split("T")[0];
          const index = prev.findIndex(
            (a) =>
              a.employeeId === targetEmpId &&
              a.date &&
              new Date(a.date).toISOString().split("T")[0] === targetDateOnly
          );
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = { ...res.attendance, date: attFormDate } as any;
            return updated;
          } else {
            return [{ ...res.attendance, date: attFormDate } as any, ...prev];
          }
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("crm:attendance-updated"));
          try {
            const bc = new BroadcastChannel("crm_attendance_sync");
            bc.postMessage({ timestamp: Date.now(), employeeId: targetEmpId });
            bc.close();
          } catch {}
        }

        setShowAttendanceModal(false);
        syncAttendances();
        router.refresh();
      }
    } catch (err: any) {
      console.error("Erreur enregistrement pointage:", err);
      alert(err.message || "Erreur lors de l'enregistrement du pointage");
    } finally {
      setIsSavingAttendance(false);
    }
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
          {activeTab === "GOALS" && (
            <button
              onClick={() => setShowGoalModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
            >
              <Target className="w-4 h-4" /> Fixer Objectif
            </button>
          )}
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
            {[5, 6].includes(new Date().getDay())
              ? "Week-end (Vendredi & Samedi chômés & payés)"
              : `${
                  kpisState.activeEmployees > 0
                    ? Math.round((kpisState.presentToday / kpisState.activeEmployees) * 100)
                    : 0
                }% de présence au poste`}
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
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3 overflow-x-auto">
        <button
          onClick={() => handleSelectTab("DIRECTORY")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 ${
            activeTab === "DIRECTORY"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Annuaire Collaborateurs ({employees.length})
        </button>
        <button
          onClick={() => handleSelectTab("DEPARTMENTS")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 ${
            activeTab === "DEPARTMENTS"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Pôles de l'Agence ({departments.filter((d) => d.members.length > 0).length || departments.length})
        </button>
        <button
          onClick={() => handleSelectTab("GOALS")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 ${
            activeTab === "GOALS"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Objectifs Mensuels ({goals.length})
        </button>
        <button
          onClick={() => handleSelectTab("ATTENDANCE")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 ${
            activeTab === "ATTENDANCE"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Pointage Quotidien
        </button>
        <button
          onClick={() => handleSelectTab("MONTHLY_ATTENDANCE")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 flex items-center gap-2 ${
            activeTab === "MONTHLY_ATTENDANCE"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Pointage Mensuel
        </button>
        <button
          onClick={() => handleSelectTab("LEAVES")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 ${
            activeTab === "LEAVES"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          Demandes de Congés ({leaveRequests.length})
        </button>
        <button
          onClick={() => handleSelectTab("PAYROLL")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 ${
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
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                <span className="text-sm font-semibold text-neutral-200">
                  Feuille d'émargement du jour ({new Date().toLocaleDateString("fr-FR")})
                </span>
              </div>

              {/* Sub-view switcher: Pointages vs Pauses Aujourd'hui */}
              <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-xl p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setDailyAttendanceSubView("ATTENDANCE")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    dailyAttendanceSubView === "ATTENDANCE"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pointages</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDailyAttendanceSubView("BREAKS");
                    loadAllUsersBreaks();
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    dailyAttendanceSubView === "BREAKS"
                      ? "bg-amber-600 text-neutral-950 font-bold shadow-sm"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>Pauses Aujourd'hui (Tous)</span>
                  {allUsersBreaksKpis?.currentlyOnBreak ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
                      {allUsersBreaksKpis.currentlyOnBreak}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
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
              {isPrivileged && (
                <button
                  type="button"
                  onClick={() => handleOpenNewAttendanceModal()}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition cursor-pointer"
                  title="Ajuster ou enregistrer manuellement un pointage"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajuster un pointage</span>
                </button>
              )}
            </div>
          </div>

          {[5, 6].includes(new Date().getDay()) && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
              <Calendar className="w-4 h-4 shrink-0 text-blue-400" />
              <div>
                <span className="font-bold text-blue-200">Vendredi & Samedi (Week-end chômé et payé) :</span> Les collaborateurs sont au repos. Aucun pointage n&apos;est requis et aucune retenue d&apos;absence n&apos;est décomptée du salaire.
              </div>
            </div>
          )}

          {/* SOUS-VUE 1 : TABLEAU DES POINTAGES */}
          {dailyAttendanceSubView === "ATTENDANCE" && (
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
                      <th className="py-3.5 px-4 text-center">Pauses Aujourd'hui</th>
                      {isPrivileged && <th className="py-3.5 px-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {employees
                      .filter((e) => e.isActive)
                      .map((emp) => {
                        const att = attendancesList.find((a) => a.employeeId === emp.id);
                        const isTodayWeekend = [5, 6].includes(new Date().getDay());
                        const isPresent = att && (att.status === "PRESENT" || Boolean(att.clockIn));
                        const isLate = att && att.status === "LATE";
                        const isOnLeave = att && att.status === "ON_LEAVE";
                        const isHalfDay = att && att.status === "HALF_DAY";
                        const isWeekend = isTodayWeekend && !isPresent && !isLate && !isOnLeave;
                        const status = isWeekend ? "WEEKEND" : (att ? att.status : "ABSENT");

                        return (
                          <tr key={emp.id} className="hover:bg-neutral-800/30 transition">
                            <td className="py-3 px-4 font-semibold text-neutral-200">
                              <div className="flex items-center gap-2">
                                <span>{emp.firstName} {emp.lastName}</span>
                                {att?.notes && (
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 font-normal truncate max-w-[150px]"
                                    title={att.notes}
                                  >
                                    {att.notes}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-neutral-400 text-xs">
                              {emp.position}
                            </td>
                            <td className="py-3 px-4">
                              {isPrivileged ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditAttendanceModal(emp, att)}
                                  className={`group inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer hover:scale-105 active:scale-95 transition ${
                                    isPresent
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/30 hover:border-emerald-500/50"
                                      : isLate
                                      ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/30 hover:border-amber-500/50"
                                      : isOnLeave
                                      ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/30 hover:border-blue-500/50"
                                      : isHalfDay
                                      ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800/30 hover:border-purple-500/50"
                                      : isWeekend
                                      ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/30"
                                      : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/30 hover:border-rose-500/50"
                                  }`}
                                  title="Modifier le pointage et le statut de ce collaborateur"
                                >
                                  <span>
                                    {isPresent
                                      ? "Présent"
                                      : isLate
                                      ? "En retard"
                                      : isOnLeave
                                      ? "En congé"
                                      : isHalfDay
                                      ? "Demi-journée"
                                      : isWeekend
                                      ? "Week-end (Chômé & payé)"
                                      : "Absent (-1j paye)"}
                                  </span>
                                  <Edit2 className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition" />
                                </button>
                              ) : (
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                    isPresent
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/30"
                                      : isLate
                                      ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/30"
                                      : isOnLeave
                                      ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/30"
                                      : isHalfDay
                                      ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800/30"
                                      : isWeekend
                                      ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/30"
                                      : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/30"
                                  }`}
                                >
                                  {isPresent
                                    ? "Présent"
                                    : isLate
                                    ? "En retard"
                                    : isOnLeave
                                    ? "En congé"
                                    : isHalfDay
                                    ? "Demi-journée"
                                    : isWeekend
                                    ? "Week-end (Chômé & payé)"
                                    : "Absent (-1j paye)"}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-neutral-400">
                              {att?.clockIn ? (
                                new Date(att.clockIn).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              ) : isWeekend ? (
                                <span className="text-neutral-500 font-sans italic text-xs">Repos</span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-amber-400">
                              {att?.clockOut ? (
                                new Date(att.clockOut).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              ) : isWeekend ? (
                                <span className="text-neutral-500 font-sans italic text-xs">Repos</span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {att && att.breakMinutes > 0 ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold ${
                                    att.breakMinutes > 60
                                      ? "bg-rose-950/70 text-rose-300 border border-rose-800"
                                      : att.breakMinutes >= 45
                                      ? "bg-amber-950/70 text-amber-300 border border-amber-800"
                                      : "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                                  }`}
                                  title={`${att.breakMinutes} min de pause cumulée aujourd'hui`}
                                >
                                  <Coffee className="w-3 h-3 text-amber-400" />
                                  <span>{att.breakMinutes} min</span>
                                  {att.breakMinutes > 60 && <span className="text-[10px]">⚠️</span>}
                                </span>
                              ) : (
                                <span className="text-neutral-500 font-mono text-xs">0 min</span>
                              )}
                            </td>
                            {isPrivileged && (
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditAttendanceModal(emp, att)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-indigo-50 text-neutral-700 hover:text-indigo-600 border border-neutral-200 dark:bg-neutral-800/80 dark:hover:bg-indigo-950/40 dark:text-neutral-300 dark:hover:text-indigo-300 dark:border-neutral-700/50 dark:hover:border-indigo-500/30 text-xs font-semibold transition cursor-pointer"
                                  title="Modifier le pointage"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>Modifier</span>
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SOUS-VUE 2 : TABLEAU DÉTAILLÉ DES PAUSES AUJOURD'HUI DE TOUS LES COLLABORATEURS */}
          {dailyAttendanceSubView === "BREAKS" && (
            <div className="space-y-4">
              {/* KPIs Pauses de l'Équipe */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    En Poste Aujourd'hui
                  </span>
                  <div className="font-mono text-xl font-bold text-emerald-400">
                    {allUsersBreaksKpis?.clockedInCount || 0} / {allUsersBreaksKpis?.totalEmployees || 0}
                  </div>
                  <p className="text-[10px] text-neutral-500">Collaborateurs pointés</p>
                </div>

                <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    En Pause Active
                  </span>
                  <div className="font-mono text-xl font-bold text-amber-400 flex items-center gap-2">
                    <span>{allUsersBreaksKpis?.currentlyOnBreak || 0}</span>
                    {(allUsersBreaksKpis?.currentlyOnBreak || 0) > 0 && (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    )}
                  </div>
                  <p className="text-[10px] text-neutral-500">En pause en direct</p>
                </div>

                <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    Cumul Pauses Entreprise
                  </span>
                  <div className="font-mono text-xl font-bold text-indigo-400">
                    {allUsersBreaksKpis?.totalCompanyBreakMinutes
                      ? `${Math.floor(allUsersBreaksKpis.totalCompanyBreakMinutes / 60)}h ${String(allUsersBreaksKpis.totalCompanyBreakMinutes % 60).padStart(2, "0")}m`
                      : "0 min"}
                  </div>
                  <p className="text-[10px] text-neutral-500">Temps total de repos</p>
                </div>

                <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    Dépassements &gt; 40m
                  </span>
                  <div
                    className={`font-mono text-xl font-bold ${
                      (allUsersBreaksKpis?.exceededCount || 0) > 0 ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {allUsersBreaksKpis?.exceededCount || 0}
                  </div>
                  <p className="text-[10px] text-neutral-500">
                    {(allUsersBreaksKpis?.exceededCount || 0) === 0 ? "Tous quotas respectés 🎉" : "Au-dessus de 40 min"}
                  </p>
                </div>
              </div>

              {/* Barre de Recherche & Filtre */}
              <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-500" />
                  <input
                    type="text"
                    value={breaksSearchQuery}
                    onChange={(e) => setBreaksSearchQuery(e.target.value)}
                    placeholder="Rechercher un collaborateur, un poste..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => loadAllUsersBreaks()}
                  disabled={isLoadingAllUsersBreaks}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-850 text-neutral-300 border border-neutral-800 text-xs font-semibold transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAllUsersBreaks ? "animate-spin text-indigo-400" : ""}`} />
                  <span>Actualiser les pauses</span>
                </button>
              </div>

              {/* Table détaillée des pauses */}
              <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                        <th className="py-3.5 px-4">Collaborateur</th>
                        <th className="py-3.5 px-4">Poste & Pôle</th>
                        <th className="py-3.5 px-4">Statut en Direct</th>
                        <th className="py-3.5 px-4 text-center">Cumul Aujourd'hui</th>
                        <th className="py-3.5 px-4 text-center">Sessions</th>
                        <th className="py-3.5 px-4 text-right">Détail Sessions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {allUsersBreaks
                        .filter((b) => {
                          if (!breaksSearchQuery.trim()) return true;
                          const q = breaksSearchQuery.toLowerCase();
                          return (
                            b.firstName.toLowerCase().includes(q) ||
                            b.lastName.toLowerCase().includes(q) ||
                            b.position.toLowerCase().includes(q)
                          );
                        })
                        .map((b) => {
                          const isExp = expandedBreakEmployeeId === b.employeeId;
                          return (
                            <React.Fragment key={b.employeeId}>
                              <tr className="hover:bg-neutral-800/30 transition">
                                <td className="py-3 px-4 font-semibold text-neutral-200">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-xs text-neutral-300 shrink-0">
                                      {b.firstName[0]}{b.lastName[0]}
                                    </div>
                                    <span>{b.firstName} {b.lastName}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-xs text-neutral-400">
                                  <div>{b.position}</div>
                                  {b.department && <div className="text-[10px] text-neutral-500">{b.department}</div>}
                                </td>
                                <td className="py-3 px-4">
                                  {b.isOnBreak ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
                                      <Coffee className="w-3.5 h-3.5 text-amber-400" />
                                      <span>En Pause ({b.currentBreakElapsedMinutes} min) — {b.currentBreakReason}</span>
                                    </span>
                                  ) : b.clockIn && !b.clockOut ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                                      🟢 Au poste
                                    </span>
                                  ) : b.clockOut ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-neutral-900 text-neutral-400 border border-neutral-800">
                                      Journée terminée
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-neutral-900 text-neutral-500 border border-neutral-800">
                                      Non pointé
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center font-mono">
                                  <div className="text-xs font-bold text-neutral-200">
                                    {b.totalBreakMinutes} min / 40m
                                  </div>
                                  <div className="text-[10px] mt-0.5">
                                    {b.isExceeded ? (
                                      <span className="text-rose-400 font-semibold">⚠️ Dépassement (+{b.totalBreakMinutes - 40}m)</span>
                                    ) : (
                                      <span className="text-emerald-400">✓ Conforme</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center font-mono text-xs text-neutral-300">
                                  {b.sessionsCount} pause{b.sessionsCount > 1 ? "s" : ""}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedBreakEmployeeId(isExp ? null : b.employeeId)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-950 hover:bg-neutral-850 text-neutral-300 border border-neutral-800 text-xs font-medium transition cursor-pointer"
                                  >
                                    <span>{isExp ? "Masquer" : "Voir"} ({b.sessionsCount})</span>
                                    {isExp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  </button>
                                </td>
                              </tr>
                              {isExp && (
                                <tr className="bg-neutral-950/50">
                                  <td colSpan={6} className="p-3">
                                    <div className="space-y-1.5 pl-4">
                                      <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                                        Détail des pauses aujourd'hui pour {b.firstName} {b.lastName} :
                                      </div>
                                      {b.sessions && b.sessions.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                          {b.sessions.map((s, idx) => {
                                            const isLunch = s.reason.toLowerCase().includes("déjeuner");
                                            const lim = isLunch ? 45 : 15;
                                            const isOver = s.durationMinutes > lim;
                                            return (
                                              <div
                                                key={s.id || idx}
                                                className="bg-neutral-900 p-2.5 rounded-xl border border-neutral-850 text-xs space-y-1"
                                              >
                                                <div className="flex items-center justify-between">
                                                  <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                                                    <span className={s.isAutoDetected ? "text-indigo-400" : "text-amber-400"}>
                                                      {s.isAutoDetected ? "🤖" : "☕"}
                                                    </span>
                                                    <span>{s.reason}</span>
                                                    {s.isAutoDetected && (
                                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40">
                                                        Auto &gt;15m
                                                      </span>
                                                    )}
                                                  </span>
                                                  <span
                                                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                                      s.isOngoing
                                                        ? "bg-amber-950 text-amber-300 border border-amber-800 animate-pulse"
                                                        : isOver
                                                        ? "bg-amber-950 text-amber-300 border border-amber-800"
                                                        : "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                                                    }`}
                                                  >
                                                    {s.durationMinutes} min {s.isOngoing && "(En cours)"}
                                                  </span>
                                                </div>
                                                <div className="text-[11px] font-mono text-neutral-400">
                                                  {new Date(s.startTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} →{" "}
                                                  {s.endTime
                                                    ? new Date(s.endTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                                                    : "En cours..."}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="text-xs text-neutral-500 italic">
                                          Aucune session individuelle de pause trouvée pour aujourd'hui.
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2b: MONTHLY ATTENDANCE */}
      {activeTab === "MONTHLY_ATTENDANCE" && (() => {
        // Mois civil sélectionné
        const totalDaysInMonth = new Date(selectedYearFilter, selectedMonthFilter, 0).getDate();
        const daysInMonth = Array.from(
          { length: totalDaysInMonth },
          (_, i) => new Date(selectedYearFilter, selectedMonthFilter - 1, i + 1)
        );

        // Filtrage des collaborateurs actifs
        const activeEmployees = employees.filter((emp) => {
          if (!emp.isActive) return false;
          if (monthlyDeptFilter !== "ALL" && emp.department !== monthlyDeptFilter) return false;
          if (monthlyEmployeeFilter !== "ALL" && emp.id !== monthlyEmployeeFilter) return false;
          if (monthlySearch.trim() !== "") {
            const q = monthlySearch.toLowerCase();
            const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
            const pos = emp.position.toLowerCase();
            if (!fullName.includes(q) && !pos.includes(q)) return false;
          }
          return true;
        });

        // Filtrage des pointages mensuels
        const filteredMonthlyAttendances = monthlyAttendancesList.filter((att) => {
          if (monthlyDeptFilter !== "ALL" && att.employee.department && att.employee.department !== monthlyDeptFilter) return false;
          if (monthlyEmployeeFilter !== "ALL" && att.employeeId !== monthlyEmployeeFilter) return false;
          if (monthlyStatusFilter !== "ALL" && att.status !== monthlyStatusFilter) return false;
          if (monthlySearch.trim() !== "") {
            const q = monthlySearch.toLowerCase();
            const fullName = `${att.employee.firstName} ${att.employee.lastName}`.toLowerCase();
            if (!fullName.includes(q)) return false;
          }
          return true;
        });

        // Calcul des KPI globaux
        const totalPresents = monthlyAttendancesList.filter(
          (a) => a.status === "PRESENT" || (a.status === "LATE" && Boolean(a.clockIn))
        ).length;
        const totalLates = monthlyAttendancesList.filter((a) => a.status === "LATE").length;
        const totalAbsents = monthlyAttendancesList.filter((a) => a.status === "ABSENT").length;
        const totalLeaves = monthlyAttendancesList.filter((a) => a.status === "ON_LEAVE").length;
        const totalHalfDays = monthlyAttendancesList.filter((a) => a.status === "HALF_DAY").length;
        const totalWorked = totalPresents + totalLates + totalHalfDays * 0.5;
        const evaluatedBase = totalPresents + totalLates + totalHalfDays + totalAbsents;
        const globalRate = evaluatedBase > 0 ? Math.round((totalWorked / evaluatedBase) * 100) : 100;

        return (
          <div className="space-y-5">
            {/* Header / Command Bar */}
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                    <span>Pointage & Émargement Mensuel</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950/60 text-indigo-400 border border-indigo-800/40 font-mono">
                      {selectedMonthFilter.toString().padStart(2, "0")}/{selectedYearFilter}
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Registre complet des présences, retards, absences décomptées et congés.
                  </p>
                </div>
              </div>

              {/* Action buttons & Selectors */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Sélecteur de mois/cycle */}
                <select
                  value={`${selectedMonthFilter}-${selectedYearFilter}`}
                  onChange={(e) => {
                    const [m, y] = e.target.value.split("-").map(Number);
                    handleChangeMonthlyPeriod(m, y);
                  }}
                  disabled={isLoadingMonthly}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                >
                  {availableCycles.map((c) => (
                    <option key={`${c.month}-${c.year}`} value={`${c.month}-${c.year}`}>
                      {c.label} {c.isCurrent ? "(Mois en cours)" : ""}
                    </option>
                  ))}
                  {!availableCycles.some((c) => c.month === selectedMonthFilter && c.year === selectedYearFilter) && (
                    <option value={`${selectedMonthFilter}-${selectedYearFilter}`}>
                      Mois {selectedMonthFilter}/{selectedYearFilter}
                    </option>
                  )}
                </select>

                {/* Switcher de vue */}
                <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-xl p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setMonthlyViewMode("SUMMARY")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      monthlyViewMode === "SUMMARY"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                    title="Synthèse par collaborateur"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Synthèse</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthlyViewMode("MATRIX")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      monthlyViewMode === "MATRIX"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                    title="Matrice Calendrier (1 à 31)"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Calendrier</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthlyViewMode("LOG")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      monthlyViewMode === "LOG"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                    title="Journal chronologique"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Journal</span>
                  </button>
                </div>

                {/* Export CSV */}
                <button
                  type="button"
                  onClick={handleExportMonthlyCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300 dark:border-transparent text-xs font-semibold transition cursor-pointer"
                  title="Exporter le registre mensuel en fichier Excel / CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Export Excel</span>
                </button>

                {/* Bouton Pointer / Ajuster (Admin) */}
                {isPrivileged && (
                  <button
                    type="button"
                    onClick={() => handleOpenNewAttendanceModal()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition cursor-pointer"
                    title="Ajuster ou saisir un pointage manuellement"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajuster pointage</span>
                  </button>
                )}
              </div>
            </div>

            {/* KPI Cards Mensuels */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Présences</span>
                  <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <UserCheck className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-neutral-100 mt-2">{totalPresents}</div>
                <p className="text-[10px] text-neutral-500 mt-0.5">journées pointées</p>
              </div>

              <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Retards</span>
                  <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Clock className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-amber-400 mt-2">{totalLates}</div>
                <p className="text-[10px] text-neutral-500 mt-0.5">arrivées tardives</p>
              </div>

              <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Absences (-1j)</span>
                  <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <AlertCircle className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-rose-400 mt-2">{totalAbsents}</div>
                <p className="text-[10px] text-rose-400/80 mt-0.5">décomptées du salaire</p>
              </div>

              <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Congés</span>
                  <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Calendar className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-blue-400 mt-2">{totalLeaves}</div>
                <p className="text-[10px] text-neutral-500 mt-0.5">jours validés</p>
              </div>

              <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5 shadow-sm col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Assiduité</span>
                  <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-indigo-300 mt-2">{globalRate}%</div>
                <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      globalRate >= 90 ? "bg-emerald-500" : globalRate >= 75 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${globalRate}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Barre de Filtres & Recherche */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-3 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
                <input
                  type="text"
                  value={monthlySearch}
                  onChange={(e) => setMonthlySearch(e.target.value)}
                  placeholder="Rechercher un collaborateur, un poste..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
                {monthlySearch && (
                  <button
                    type="button"
                    onClick={() => setMonthlySearch("")}
                    className="absolute right-2.5 top-2 text-xs text-neutral-500 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-neutral-400" />
                <select
                  value={monthlyDeptFilter}
                  onChange={(e) => setMonthlyDeptFilter(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">Tous les pôles</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={monthlyEmployeeFilter}
                onChange={(e) => setMonthlyEmployeeFilter(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500 max-w-[180px] truncate"
              >
                <option value="ALL">Tous les collaborateurs</option>
                {employees
                  .filter((e) => e.isActive)
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
              </select>

              {monthlyViewMode === "LOG" && (
                <select
                  value={monthlyStatusFilter}
                  onChange={(e) => setMonthlyStatusFilter(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="PRESENT">Présent</option>
                  <option value="LATE">En retard</option>
                  <option value="ABSENT">Absent (-1j paye)</option>
                  <option value="ON_LEAVE">En congé</option>
                  <option value="HALF_DAY">Demi-journée</option>
                </select>
              )}

              {isLoadingMonthly && (
                <span className="flex items-center gap-1.5 text-xs text-indigo-400 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Chargement...</span>
                </span>
              )}
            </div>

            {/* VUE 1 : SYNTHÈSE COLLABORATEURS */}
            {monthlyViewMode === "SUMMARY" && (
              <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                        <th className="py-3.5 px-4">Collaborateur</th>
                        <th className="py-3.5 px-4">Poste & Pôle</th>
                        <th className="py-3.5 px-4 text-center">Présents</th>
                        <th className="py-3.5 px-4 text-center">Retards</th>
                        <th className="py-3.5 px-4 text-center">Absences (-1j)</th>
                        <th className="py-3.5 px-4 text-center">Congés</th>
                        <th className="py-3.5 px-4 text-center">Demi-j.</th>
                        <th className="py-3.5 px-4">Taux Présence</th>
                        {isPrivileged && <th className="py-3.5 px-4 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {activeEmployees.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-neutral-400 text-sm">
                            Aucun collaborateur trouvé pour ces critères de filtre.
                          </td>
                        </tr>
                      ) : (
                        activeEmployees.map((emp) => {
                          const empAtts = monthlyAttendancesList.filter((a) => a.employeeId === emp.id);
                          const pCount = empAtts.filter((a) => a.status === "PRESENT" || (a.status === "LATE" && Boolean(a.clockIn))).length;
                          const lCount = empAtts.filter((a) => a.status === "LATE").length;
                          const aCount = empAtts.filter((a) => a.status === "ABSENT").length;
                          const cCount = empAtts.filter((a) => a.status === "ON_LEAVE").length;
                          const hCount = empAtts.filter((a) => a.status === "HALF_DAY").length;
                          const totalWork = pCount + lCount + hCount * 0.5;
                          const totalBase = pCount + lCount + hCount + aCount;
                          const rate = totalBase > 0 ? Math.round((totalWork / totalBase) * 100) : 100;

                          return (
                            <tr key={emp.id} className="hover:bg-neutral-800/30 transition">
                              <td className="py-3 px-4 font-semibold text-neutral-200">
                                <div>{emp.firstName} {emp.lastName}</div>
                                {emp.email && <div className="text-[11px] text-neutral-500 font-normal">{emp.email}</div>}
                              </td>
                              <td className="py-3 px-4 text-xs">
                                <div className="text-neutral-300">{emp.position}</div>
                                <div className="text-neutral-500">{emp.department}</div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                                  {pCount} j
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono ${
                                  lCount > 0
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    : "text-neutral-500"
                                }`}>
                                  {lCount} j
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono ${
                                  aCount > 0
                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                    : "text-neutral-500"
                                }`}>
                                  {aCount} j
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono ${
                                  cCount > 0
                                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                    : "text-neutral-500"
                                }`}>
                                  {cCount} j
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono ${
                                  hCount > 0
                                    ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                    : "text-neutral-500"
                                }`}>
                                  {hCount} j
                                </span>
                              </td>
                              <td className="py-3 px-4 w-44">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs font-mono">
                                    <span className={rate >= 90 ? "text-emerald-400 font-bold" : rate >= 75 ? "text-amber-400 font-bold" : "text-rose-400 font-bold"}>
                                      {rate}%
                                    </span>
                                    <span className="text-[10px] text-neutral-500">{totalWork}/{totalBase || 1} j</span>
                                  </div>
                                  <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        rate >= 90 ? "bg-emerald-500" : rate >= 75 ? "bg-amber-500" : "bg-rose-500"
                                      }`}
                                      style={{ width: `${rate}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              {isPrivileged && (
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMonthlyEmployeeFilter(emp.id);
                                        setMonthlyViewMode("MATRIX");
                                      }}
                                      className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
                                      title="Voir la grille calendrier de ce collaborateur"
                                    >
                                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditAttendanceModal(emp)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 text-xs font-semibold transition cursor-pointer"
                                      title="Ajuster un pointage pour ce collaborateur"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                      <span>Ajuster</span>
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VUE 2 : MATRICE CALENDRIER (JOUR 1 À 31) */}
            {monthlyViewMode === "MATRIX" && (
              <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-3 bg-neutral-950/60 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-200">Légende :</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                      <strong>P</strong> Présent
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      <strong>R</strong> Retard
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30">
                      <strong>A</strong> Absent (-1j)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30">
                      <strong>C</strong> Congé
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                      <strong>WE</strong> Repos Vendredi/Samedi
                    </span>
                  </div>
                  {isPrivileged && (
                    <span className="text-[11px] text-indigo-400 font-medium">
                      💡 Cliquez sur n'importe quel jour pour ajuster ou modifier le pointage
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-20 bg-neutral-950/95 backdrop-blur-md">
                      <tr className="border-b border-neutral-800 text-neutral-400 uppercase font-semibold">
                        <th className="py-3 px-4 min-w-[180px] sticky left-0 z-30 bg-neutral-950">
                          Collaborateur
                        </th>
                        {daysInMonth.map((day) => {
                          const isWeekend = [5, 6].includes(day.getDay());
                          const dayNum = day.getDate();
                          const dayLetter = ["D", "L", "M", "M", "J", "V", "S"][day.getDay()];
                          return (
                            <th
                              key={dayNum}
                              className={`py-2 px-1 text-center min-w-[34px] border-l border-neutral-800/40 ${
                                isWeekend ? "bg-blue-950/20 text-blue-300" : ""
                              }`}
                            >
                              <div className="font-bold">{dayNum}</div>
                              <div className="text-[9px] opacity-60">{dayLetter}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {activeEmployees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-neutral-800/20 transition">
                          <td className="py-2.5 px-4 font-semibold text-neutral-200 sticky left-0 z-10 bg-neutral-900 border-r border-neutral-800">
                            <div className="truncate max-w-[160px]">{emp.firstName} {emp.lastName}</div>
                            <div className="text-[10px] text-neutral-500 font-normal truncate max-w-[160px]">{emp.position}</div>
                          </td>
                          {daysInMonth.map((day) => {
                            const isWeekend = [5, 6].includes(day.getDay());
                            const dayDateStr = day.toISOString().split("T")[0];
                            const att = monthlyAttendancesList.find((a) => {
                              if (a.employeeId !== emp.id) return false;
                              if (!a.date) return false;
                              return new Date(a.date).toISOString().split("T")[0] === dayDateStr;
                            });

                            const isPresent = att && (att.status === "PRESENT" || Boolean(att.clockIn));
                            const isLate = att && att.status === "LATE";
                            const isOnLeave = att && att.status === "ON_LEAVE";
                            const isHalfDay = att && att.status === "HALF_DAY";
                            const isAbsent = att && att.status === "ABSENT";
                            const isFuture = day.getTime() > new Date().getTime();

                            let cellBadge = "—";
                            let cellClass = "text-neutral-600";
                            let cellTitle = `${day.toLocaleDateString("fr-FR")} : Non pointé`;

                            if (isPresent) {
                              cellBadge = "P";
                              cellClass = "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold";
                              cellTitle = `${day.toLocaleDateString("fr-FR")} : Présent ${att?.clockIn ? `(${new Date(att.clockIn).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})` : ""}`;
                            } else if (isLate) {
                              cellBadge = "R";
                              cellClass = "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold";
                              cellTitle = `${day.toLocaleDateString("fr-FR")} : En retard ${att?.clockIn ? `(${new Date(att.clockIn).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})` : ""}`;
                            } else if (isOnLeave) {
                              cellBadge = "C";
                              cellClass = "bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold";
                              cellTitle = `${day.toLocaleDateString("fr-FR")} : En congé`;
                            } else if (isHalfDay) {
                              cellBadge = "½";
                              cellClass = "bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold";
                              cellTitle = `${day.toLocaleDateString("fr-FR")} : Demi-journée`;
                            } else if (isAbsent) {
                              cellBadge = "A";
                              cellClass = "bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold";
                              cellTitle = `${day.toLocaleDateString("fr-FR")} : Absent (-1j paye)`;
                            } else if (isWeekend) {
                              cellBadge = "WE";
                              cellClass = "bg-blue-950/20 text-blue-400/50 font-normal";
                              cellTitle = `${day.toLocaleDateString("fr-FR")} : Week-end repos payé`;
                            } else if (isFuture) {
                              cellBadge = "·";
                              cellClass = "text-neutral-700";
                              cellTitle = `${day.toLocaleDateString("fr-FR")} : À venir`;
                            }

                            return (
                              <td
                                key={day.getDate()}
                                className={`p-1 text-center border-l border-neutral-800/30 ${
                                  isWeekend ? "bg-blue-950/10" : ""
                                }`}
                              >
                                {isPrivileged ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditAttendanceModal(emp, att, dayDateStr)}
                                    className={`w-7 h-7 rounded-lg inline-flex items-center justify-center text-[10px] cursor-pointer hover:scale-110 active:scale-95 transition ${cellClass}`}
                                    title={cellTitle}
                                  >
                                    {cellBadge}
                                  </button>
                                ) : (
                                  <span
                                    className={`w-7 h-7 rounded-lg inline-flex items-center justify-center text-[10px] ${cellClass}`}
                                    title={cellTitle}
                                  >
                                    {cellBadge}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VUE 3 : JOURNAL CHRONOLOGIQUE DES POINTAGES */}
            {monthlyViewMode === "LOG" && (
              <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4">Collaborateur</th>
                        <th className="py-3.5 px-4">Pôle / Poste</th>
                        <th className="py-3.5 px-4 text-center">Statut</th>
                        <th className="py-3.5 px-4 text-center">Entrée</th>
                        <th className="py-3.5 px-4 text-center">Sortie</th>
                        <th className="py-3.5 px-4">Motif / Notes</th>
                        {isPrivileged && <th className="py-3.5 px-4 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {filteredMonthlyAttendances.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-neutral-400 text-sm">
                            <Clock className="w-8 h-8 text-neutral-600 mx-auto mb-2 opacity-50" />
                            <p className="font-medium">Aucun enregistrement trouvé pour ces critères.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredMonthlyAttendances.map((att) => {
                          const dateObj = att.date ? new Date(att.date) : null;
                          const isPresent = att.status === "PRESENT" || Boolean(att.clockIn);
                          const isLate = att.status === "LATE";
                          const isOnLeave = att.status === "ON_LEAVE";
                          const isHalfDay = att.status === "HALF_DAY";

                          return (
                            <tr key={att.id} className="hover:bg-neutral-800/30 transition">
                              <td className="py-3 px-4 font-mono text-xs text-neutral-300">
                                {dateObj ? dateObj.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "—"}
                              </td>
                              <td className="py-3 px-4 font-semibold text-neutral-200">
                                {att.employee.firstName} {att.employee.lastName}
                              </td>
                              <td className="py-3 px-4 text-xs text-neutral-400">
                                <div>{att.employee.position}</div>
                                {att.employee.department && <div className="text-neutral-500">{att.employee.department}</div>}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                    isPresent
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/30"
                                      : isLate
                                      ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/30"
                                      : isOnLeave
                                      ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/30"
                                      : isHalfDay
                                      ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800/30"
                                      : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/30"
                                  }`}
                                >
                                  {isPresent
                                    ? "Présent"
                                    : isLate
                                    ? "En retard"
                                    : isOnLeave
                                    ? "En congé"
                                    : isHalfDay
                                    ? "Demi-journée"
                                    : "Absent (-1j paye)"}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-mono text-xs text-neutral-300">
                                {att.clockIn
                                  ? new Date(att.clockIn).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                                  : "—"}
                              </td>
                              <td className="py-3 px-4 text-center font-mono text-xs text-amber-400">
                                {att.clockOut
                                  ? new Date(att.clockOut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                                  : "—"}
                              </td>
                              <td className="py-3 px-4 text-xs text-neutral-400 max-w-[200px] truncate" title={att.notes || ""}>
                                {att.notes || "—"}
                              </td>
                              {isPrivileged && (
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const emp = employees.find((e) => e.id === att.employeeId);
                                      if (emp) {
                                        const dStr = att.date ? new Date(att.date).toISOString().split("T")[0] : undefined;
                                        handleOpenEditAttendanceModal(emp, att, dStr);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-indigo-50 text-neutral-700 hover:text-indigo-600 border border-neutral-200 dark:bg-neutral-800/80 dark:hover:bg-indigo-950/40 dark:text-neutral-300 dark:hover:text-indigo-300 dark:border-neutral-700/50 dark:hover:border-indigo-500/30 text-xs font-semibold transition cursor-pointer"
                                    title="Modifier ce pointage"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                                    <span>Modifier</span>
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}

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

      {/* TAB: DEPARTMENTS GRID */}
      {activeTab === "DEPARTMENTS" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((dept) => (
            <div
              key={dept.name}
              className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm flex flex-col"
            >
              <div className="p-4 bg-neutral-950/60 border-b border-neutral-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-neutral-200 text-sm">{dept.label}</h3>
                  <span className="text-xs text-neutral-400">
                    {dept.members.length} collaborateur{dept.members.length > 1 ? "s" : ""}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-neutral-800 text-xs font-semibold text-neutral-300">
                  {dept.activeTasksCount} tâches en cours
                </span>
              </div>

              <div className="p-4 space-y-3 flex-1 divide-y divide-neutral-800/50">
                {dept.members.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-500">
                    Aucun collaborateur affecté à ce pôle.
                  </div>
                ) : (
                  dept.members.map((m) => (
                    <div key={m.id} className="pt-3 first:pt-0">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-neutral-200 text-sm">
                          {m.name}
                        </div>
                        <span className="text-[11px] text-indigo-400 font-medium">
                          {m.position}
                        </span>
                      </div>

                      {m.phone && (
                        <div className="text-xs text-neutral-400 font-mono mt-0.5">
                          {m.phone}
                        </div>
                      )}

                      {/* Goals snapshot if any */}
                      {m.goals.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {m.goals.map((g) => {
                            const pct = Math.min(
                              100,
                              Math.round((g.achievedValue / g.targetValue) * 100)
                            );
                            return (
                              <div key={g.id} className="text-[11px]">
                                <div className="flex justify-between text-neutral-400">
                                  <span>{g.metric}</span>
                                  <span className="font-mono">
                                    {g.achievedValue} / {g.targetValue} ({pct}%)
                                  </span>
                                </div>
                                <div className="w-full bg-neutral-800 h-1 rounded-full mt-0.5 overflow-hidden">
                                  <div
                                    className="bg-indigo-500 h-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB: GOALS LIST */}
      {activeTab === "GOALS" && (
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-neutral-950/40 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-200">
                  Objectifs Mensuels des Collaborateurs ({month}/{year})
                </span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 text-[10px] font-bold border border-emerald-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Synchronisation Active ⚡
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Les valeurs réalisées sont calculées en direct d'après les appels, rendez-vous, clients signés et livrables réels.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncGoals}
                disabled={isSyncingGoals}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition disabled:opacity-50 cursor-pointer"
                title="Recalculer en direct depuis les actions réelles"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingGoals ? "animate-spin" : ""}`} />
                <span>{isSyncingGoals ? "Calcul..." : "Actualiser"}</span>
              </button>

              <button
                onClick={() => setShowGoalModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-sm shadow-indigo-600/30 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Nouvel Objectif
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 text-xs uppercase font-semibold">
                  <th className="py-3.5 px-4">Collaborateur</th>
                  <th className="py-3.5 px-4">Métrique</th>
                  <th className="py-3.5 px-4 text-center">Cible</th>
                  <th className="py-3.5 px-4 text-center">Réalisé en Direct ⚡</th>
                  <th className="py-3.5 px-4">Progression & Statut</th>
                  {isPrivileged && <th className="py-3.5 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {goals.length === 0 ? (
                  <tr>
                    <td colSpan={isPrivileged ? 6 : 5} className="py-12 text-center text-neutral-400">
                      Aucun objectif fixé pour ce mois.
                    </td>
                  </tr>
                ) : (
                  goals.map((g) => {
                    const pct = Math.min(
                      100,
                      Math.round((g.achievedValue / g.targetValue) * 100)
                    );
                    const isOver = g.achievedValue > g.targetValue;
                    return (
                      <tr key={g.id} className="hover:bg-neutral-800/30 transition">
                        <td className="py-3 px-4 font-semibold text-neutral-200">
                          <div>{g.employee.firstName} {g.employee.lastName}</div>
                          <div className="text-[11px] text-neutral-400 font-normal">{g.employee.position}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-950/60 text-indigo-400 border border-indigo-800/30">
                            {g.metric}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-neutral-200">
                          {g.targetValue}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                          <span className="inline-flex items-center gap-1.5">
                            {g.achievedValue}
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" title="Synchronisé en direct avec la base de données" />
                          </span>
                        </td>
                        <td className="py-3 px-4 w-52">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className={pct >= 100 ? "text-emerald-400 font-bold" : "text-neutral-300 font-bold"}>
                                {pct}%
                              </span>
                              {pct >= 100 ? (
                                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                                  <CheckCircle2 className="w-3 h-3" /> {isOver ? "Dépassement 🚀" : "Atteint 🎯"}
                                </span>
                              ) : pct >= 70 ? (
                                <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-0.5">
                                  <Flame className="w-3 h-3" /> En bonne voie
                                </span>
                              ) : (
                                <span className="text-[10px] text-neutral-400 font-semibold">
                                  En cours
                                </span>
                              )}
                            </div>
                            <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  pct >= 100
                                    ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                                    : pct >= 70
                                    ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                                    : "bg-gradient-to-r from-indigo-500 to-blue-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        {isPrivileged && (
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() =>
                                  handleUpdateGoalProgress(g.id, g.achievedValue, -1)
                                }
                                title="Diminuer manuellement (-1)"
                                className="px-2 py-0.5 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300 dark:border-transparent text-xs font-bold cursor-pointer transition"
                              >
                                -1
                              </button>
                              <button
                                onClick={() =>
                                  handleUpdateGoalProgress(g.id, g.achievedValue, 1)
                                }
                                title="Augmenter manuellement (+1)"
                                className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:text-white dark:border-transparent text-xs font-bold cursor-pointer transition"
                              >
                                +1
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteGoal(
                                    g.id,
                                    `${g.employee.firstName} ${g.employee.lastName} (${g.metric})`
                                  )
                                }
                                title="Supprimer cet objectif"
                                className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 dark:border-rose-800/40 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ATTENDANCE (ADMIN) */}
      {showAttendanceModal && (
        <div
          onClick={() => setShowAttendanceModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cursor-default bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-100">
                    {attendanceModalEmp
                      ? `Modifier le pointage · ${attendanceModalEmp.firstName} ${attendanceModalEmp.lastName}`
                      : "Ajuster un pointage"}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Feuille d'émargement · Date : {new Date(attFormDate).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAttendanceModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAttendance} className="p-6 space-y-4">
              {/* Date du pointage */}
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Date du pointage <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={attFormDate}
                  onChange={(e) => setAttFormDate(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {/* Collaborateur (si création/ajustement sans employé pré-sélectionné) */}
              {!attendanceModalEmp && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Collaborateur <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={attFormEmpId}
                    onChange={(e) => setAttFormEmpId(e.target.value)}
                    required
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Sélectionner un collaborateur...</option>
                    {employees
                      .filter((e) => e.isActive)
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName} — {emp.position}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Sélection du statut avec boutons interactifs clairs */}
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Statut du collaborateur aujourd'hui <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    {
                      key: "PRESENT" as AttendanceStatus,
                      label: "Présent",
                      color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                      active: "ring-2 ring-emerald-500 bg-emerald-500/20 text-emerald-200 border-emerald-500",
                      defaultIn: "08:30",
                      defaultOut: "17:00",
                    },
                    {
                      key: "LATE" as AttendanceStatus,
                      label: "En retard",
                      color: "border-amber-500/30 bg-amber-500/10 text-amber-300",
                      active: "ring-2 ring-amber-500 bg-amber-500/20 text-amber-200 border-amber-500",
                      defaultIn: "09:45",
                      defaultOut: "17:00",
                    },
                    {
                      key: "ABSENT" as AttendanceStatus,
                      label: "Absent (-1j paye)",
                      color: "border-rose-500/30 bg-rose-500/10 text-rose-300",
                      active: "ring-2 ring-rose-500 bg-rose-500/20 text-rose-200 border-rose-500",
                      defaultIn: "",
                      defaultOut: "",
                    },
                    {
                      key: "ON_LEAVE" as AttendanceStatus,
                      label: "En congé",
                      color: "border-blue-500/30 bg-blue-500/10 text-blue-300",
                      active: "ring-2 ring-blue-500 bg-blue-500/20 text-blue-200 border-blue-500",
                      defaultIn: "",
                      defaultOut: "",
                    },
                    {
                      key: "HALF_DAY" as AttendanceStatus,
                      label: "Demi-journée",
                      color: "border-purple-500/30 bg-purple-500/10 text-purple-300",
                      active: "ring-2 ring-purple-500 bg-purple-500/20 text-purple-200 border-purple-500",
                      defaultIn: "08:30",
                      defaultOut: "12:30",
                    },
                  ].map((s) => {
                    const isSelected = attFormStatus === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => {
                          setAttFormStatus(s.key);
                          if (s.key === "ABSENT" || s.key === "ON_LEAVE") {
                            setAttFormClockIn("");
                            setAttFormClockOut("");
                          } else {
                            if (!attFormClockIn && s.defaultIn) setAttFormClockIn(s.defaultIn);
                            if (!attFormClockOut && s.defaultOut) setAttFormClockOut(s.defaultOut);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-semibold transition text-left flex flex-col justify-between cursor-pointer ${
                          isSelected ? s.active : `${s.color} hover:opacity-85`
                        }`}
                      >
                        <span className="font-bold">{s.label}</span>
                        {isSelected && <span className="text-[10px] opacity-80 mt-0.5">● Actif</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Heures d'entrée et de sortie */}
              {attFormStatus !== "ABSENT" && attFormStatus !== "ON_LEAVE" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Heure d'entrée
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        value={attFormClockIn}
                        onChange={(e) => setAttFormClockIn(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      {attFormClockIn && (
                        <button
                          type="button"
                          onClick={() => setAttFormClockIn("")}
                          className="absolute right-2 top-2.5 text-xs text-neutral-500 hover:text-neutral-300 px-1"
                          title="Effacer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Heure de sortie (Optionnel)
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        value={attFormClockOut}
                        onChange={(e) => setAttFormClockOut(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      {attFormClockOut && (
                        <button
                          type="button"
                          onClick={() => setAttFormClockOut("")}
                          className="absolute right-2 top-2.5 text-xs text-neutral-500 hover:text-neutral-300 px-1"
                          title="Effacer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-neutral-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-neutral-500 shrink-0" />
                  <span>
                    Pour le statut <strong>{attFormStatus === "ABSENT" ? "Absent (-1j paye)" : "En congé"}</strong>, les heures de pointage sont réinitialisées et aucune heure n'est requise.
                  </span>
                </div>
              )}

              {/* Justification / Notes */}
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Motif / Remarque administrative (Optionnel)
                </label>
                <input
                  type="text"
                  value={attFormNotes}
                  onChange={(e) => setAttFormNotes(e.target.value)}
                  placeholder="Ex : Retard justifié transport, présence validée par direction..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Actions du modal */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowAttendanceModal(false)}
                  disabled={isSavingAttendance}
                  className="px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-sm font-semibold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingAttendance || (!attendanceModalEmp && !attFormEmpId)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isSavingAttendance ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Enregistrer les modifications</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD EMPLOYEE */}
      {showAddEmpModal && (
        <div
          onClick={() => setShowAddEmpModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cursor-default bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
          >
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
        <div
          onClick={() => setEditingEmployee(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cursor-default bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
          >
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
        <div
          onClick={() => setShowLeaveModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cursor-default bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          >
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

      {/* MODAL: NEW GOAL */}
      {showGoalModal && (
        <div
          onClick={() => setShowGoalModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cursor-default bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2.5">
                <Target className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-neutral-100">
                  Fixer un Objectif Mensuel
                </h3>
              </div>
              <button
                onClick={() => setShowGoalModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Collaborateur *
                </label>
                <select
                  value={goalEmpId}
                  onChange={(e) => setGoalEmpId(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Sélectionner...</option>
                  {(employeesList.length > 0
                    ? employeesList
                    : employees.map((e) => ({
                        id: e.id,
                        name: `${e.firstName} ${e.lastName}`,
                        position: e.position,
                      }))
                  ).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.position})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Métrique de Performance *
                </label>
                <select
                  value={goalMetric}
                  onChange={(e) => setGoalMetric(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="APPELS">Nombre d'Appels Passés</option>
                  <option value="RENDEZ_VOUS">Rendez-vous Décrochés</option>
                  <option value="CLIENTS">Nouveaux Clients Closés</option>
                  <option value="CA_DA">Chiffre d'Affaires Généré (DA)</option>
                  <option value="VIDEOS">Vidéos Montées & Livrées</option>
                  <option value="DESIGNS">Créations Graphiques Validées</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                  Valeur Cible *
                </label>
                <input
                  type="number"
                  min="1"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(Number(e.target.value))}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? "Attribution..." : "Valider l'Objectif"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
