"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Search,
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  Building2,
  Repeat,
  Video,
  Palette,
  Globe,
  TrendingUp,
  FileCheck,
  Check,
  ArrowUpRight,
  ExternalLink,
  Layers,
  Sparkles,
  Kanban,
  ListFilter,
  Eye,
  Target,
  Bookmark,
  Bell,
  Send,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { TaskStatus, TaskPriority, OfferType } from "@prisma/client";
import {
  updateTaskStatusAction,
  updateTaskAssigneeAction,
  createTaskAction,
  saveClientEditorialThemeAction,
  createManualSubjectTaskAction,
  triggerWeeklyReminderAction,
} from "@/actions/production";
import { toLocalDateString, formatDate, formatDateTime } from "@/lib/utils";

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

const DAYS_OF_WEEK = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const PACK_BADGES: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  STARTER: {
    label: "Pack Starter",
    bg: "bg-blue-500/15",
    text: "text-blue-300",
    border: "border-blue-500/30",
  },
  SILVER: {
    label: "Pack Silver",
    bg: "bg-amber-500/15",
    text: "text-amber-300",
    border: "border-amber-500/30",
  },
  GOLD: {
    label: "Pack Gold",
    bg: "bg-yellow-500/15",
    text: "text-yellow-300",
    border: "border-yellow-500/30",
  },
  CUSTOM: {
    label: "Sur-Mesure",
    bg: "bg-purple-500/15",
    text: "text-purple-300",
    border: "border-purple-500/30",
  },
};

const TASK_STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; badge: string; dot: string; icon: string }
> = {
  TODO: {
    label: "À faire",
    badge: "bg-neutral-800 text-neutral-300 border-neutral-700",
    dot: "bg-neutral-400",
    icon: "⏳",
  },
  IN_PROGRESS: {
    label: "En cours",
    badge: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    dot: "bg-blue-400",
    icon: "⚡",
  },
  COMPLETED: {
    label: "Terminée",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-400",
    icon: "✅",
  },
  VALIDATED: {
    label: "Validée Client",
    badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    dot: "bg-purple-400",
    icon: "🌟",
  },
};

export interface TechnicianCalendarTask {
  id: string;
  projectId: string;
  assigneeId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  timeSpentHours: number;
  createdAt: string;
  updatedAt: string;
  assignee: {
    id: string;
    name: string;
    role: string;
  } | null;
  project: {
    id: string;
    name: string;
    code: string;
    status: string;
    client: {
      id: string;
      companyName: string;
      brandName: string | null;
      sector: string;
      offerType: string;
      status: string;
      phone: string;
    };
  };
}

interface Props {
  initialTasks: TechnicianCalendarTask[];
  users: { id: string; name: string; role: string }[];
  activeClients: {
    id: string;
    companyName: string;
    brandName: string | null;
    offerType: string;
    status: string;
    projects: { id: string; name: string; code: string }[];
    themes?: { id: string; pillar: string; title: string; description: string; color: string }[];
    publications?: any[];
  }[];
  currentUserId?: string;
  initialMonth?: number;
  initialYear?: number;
}

export function TechnicianCalendarClient({
  initialTasks,
  users,
  activeClients,
  currentUserId,
  initialMonth,
  initialYear,
}: Props) {
  const router = useRouter();

  const [tasks, setTasks] = useState<TechnicianCalendarTask[]>(initialTasks);
  const now = new Date();
  const [currentYear, setCurrentYear] = useState<number>(initialYear || now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(
    initialMonth !== undefined ? initialMonth - 1 : now.getMonth()
  ); // 0-indexed for Date math

  // View modes
  const [viewMode, setViewMode] = useState<"calendar" | "agenda" | "by_client" | "themes">("calendar");

  // Filters
  const [search, setSearch] = useState("");
  const [packFilter, setPackFilter] = useState<"ALL" | OfferType>("ALL");
  const [clientStatusFilter, setClientStatusFilter] = useState<"ALL" | "ACTIVE" | "IN_PREPARATION">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TaskStatus>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null);

  // Modals
  const [selectedTask, setSelectedTask] = useState<TechnicianCalendarTask | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New task modal
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [newTaskClientId, setNewTaskClientId] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState(toLocalDateString(new Date()));
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState(currentUserId || "");
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // New Theme modal state (Saisie manuelle des thèmes)
  const [isNewThemeModalOpen, setIsNewThemeModalOpen] = useState(false);
  const [themeClientId, setThemeClientId] = useState("");
  const [themeWeekNumber, setThemeWeekNumber] = useState<number>(1);
  const [themePillar, setThemePillar] = useState("Semaine 1 : Notoriété & Savoir-faire");
  const [themeTitle, setThemeTitle] = useState("");
  const [themeDescription, setThemeDescription] = useState("");
  const [themeColor, setThemeColor] = useState("purple");
  const [isSavingTheme, setIsSavingTheme] = useState(false);

  // New Subject modal state (Saisie manuelle des sujets de publication)
  const [isNewSubjectModalOpen, setIsNewSubjectModalOpen] = useState(false);
  const [subjectClientId, setSubjectClientId] = useState("");
  const [subjectThemeTitle, setSubjectThemeTitle] = useState("");
  const [subjectWeekNumber, setSubjectWeekNumber] = useState<number>(1);
  const [subjectTitle, setSubjectTitle] = useState("");
  const [subjectFormat, setSubjectFormat] = useState<"REEL_9_16" | "CAROUSEL" | "STATIC_POST" | "STORY_INTERACTIVE" | "OTHER">("REEL_9_16");
  const [subjectDueDate, setSubjectDueDate] = useState(toLocalDateString(new Date()));
  const [subjectHook, setSubjectHook] = useState("");
  const [subjectScript, setSubjectScript] = useState("");
  const [subjectAssigneeId, setSubjectAssigneeId] = useState(currentUserId || "");
  const [subjectPriority, setSubjectPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);

  // Weekly reminder state
  const [isSendingReminder, setIsSendingReminder] = useState(false);

  // Month navigation — navigate via URL so the server reloads data for the correct month
  const handlePrevMonth = () => {
    let m = currentMonth;
    let y = currentYear;
    if (m === 0) {
      m = 11;
      y = y - 1;
    } else {
      m = m - 1;
    }
    setSelectedDayStr(null);
    router.push(`/calendrier-technicien?month=${m + 1}&year=${y}`);
  };

  const handleNextMonth = () => {
    let m = currentMonth;
    let y = currentYear;
    if (m === 11) {
      m = 0;
      y = y + 1;
    } else {
      m = m + 1;
    }
    setSelectedDayStr(null);
    router.push(`/calendrier-technicien?month=${m + 1}&year=${y}`);
  };

  const handleCurrentMonth = () => {
    const today = new Date();
    setSelectedDayStr(null);
    router.push(`/calendrier-technicien?month=${today.getMonth() + 1}&year=${today.getFullYear()}`);
  };


  // Helper to detect deliverable type icon
  const getDeliverableIcon = (title: string, description?: string | null) => {
    const text = `${title} ${description || ""}`.toLowerCase();
    if (text.includes("shooting") || text.includes("tournage")) {
      return <Video className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    }
    if (text.includes("publication") || text.includes("post") || text.includes("réseaux") || text.includes("social")) {
      return <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    }
    if (text.includes("video") || text.includes("vidéo") || text.includes("reel") || text.includes("montage")) {
      return <Video className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    }
    if (text.includes("design") || text.includes("maquette") || text.includes("carrousel") || text.includes("visuel") || text.includes("logo") || text.includes("affiche")) {
      return <Palette className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
    }
    if (text.includes("web") || text.includes("site") || text.includes("dev") || text.includes("landing") || text.includes("seo") || text.includes("domaine")) {
      return <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    }
    if (text.includes("ads") || text.includes("sponsor") || text.includes("pub") || text.includes("facebook") || text.includes("instagram") || text.includes("campagne")) {
      return <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
    return <Kanban className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // 1. Pack Filter
      if (packFilter !== "ALL" && t.project.client.offerType !== packFilter) {
        return false;
      }
      // 2. Client Status Filter (Actif vs En préparation)
      if (clientStatusFilter !== "ALL" && t.project.client.status !== clientStatusFilter) {
        return false;
      }
      // 3. Task Status Filter
      if (statusFilter !== "ALL" && t.status !== statusFilter) {
        return false;
      }
      // 4. Assignee Filter
      if (assigneeFilter === "MINE") {
        if (t.assigneeId !== currentUserId) return false;
      } else if (assigneeFilter === "UNASSIGNED") {
        if (t.assigneeId) return false;
      } else if (assigneeFilter !== "ALL") {
        if (t.assigneeId !== assigneeFilter) return false;
      }
      // 5. Text Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          t.project.client.companyName.toLowerCase().includes(q) ||
          (t.project.client.brandName && t.project.client.brandName.toLowerCase().includes(q)) ||
          (t.assignee && t.assignee.name.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [tasks, packFilter, clientStatusFilter, statusFilter, assigneeFilter, search, currentUserId]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const total = filteredTasks.length;
    const todo = filteredTasks.filter((t) => t.status === "TODO").length;
    const inProgress = filteredTasks.filter((t) => t.status === "IN_PROGRESS").length;
    const completed = filteredTasks.filter((t) => t.status === "COMPLETED").length;
    const validated = filteredTasks.filter((t) => t.status === "VALIDATED").length;
    const urgent = filteredTasks.filter((t) => t.priority === "URGENT" || t.priority === "HIGH").length;

    const doneCount = completed + validated;
    const completionRate = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    // Packs breakdown
    const starterCount = filteredTasks.filter((t) => t.project.client.offerType === "STARTER").length;
    const silverCount = filteredTasks.filter((t) => t.project.client.offerType === "SILVER").length;
    const goldCount = filteredTasks.filter((t) => t.project.client.offerType === "GOLD").length;
    const customCount = filteredTasks.filter((t) => t.project.client.offerType === "CUSTOM").length;

    // Active vs Prep
    const activeClientsCount = new Set(
      filteredTasks.filter((t) => t.project.client.status === "ACTIVE").map((t) => t.project.client.id)
    ).size;
    const prepClientsCount = new Set(
      filteredTasks.filter((t) => t.project.client.status === "IN_PREPARATION").map((t) => t.project.client.id)
    ).size;

    return {
      total,
      todo,
      inProgress,
      completed,
      validated,
      urgent,
      completionRate,
      starterCount,
      silverCount,
      goldCount,
      customCount,
      activeClientsCount,
      prepClientsCount,
    };
  }, [filteredTasks]);

  // Calendar Days Computation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    let startDayOfWeek = firstDayOfMonth.getDay() - 1; // 0 = Mon, 6 = Sun
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: {
      date: Date;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      tasks: TechnicianCalendarTask[];
    }[] = [];

    const todayStr = toLocalDateString(new Date());

    // Padding previous month
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1, prevMonthLastDay - i);
      const dateStr = toLocalDateString(d);
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        tasks: filteredTasks.filter((t) => {
          const tDate = t.dueDate ? toLocalDateString(new Date(t.dueDate)) : toLocalDateString(new Date(t.createdAt));
          return tDate === dateStr;
        }),
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= lastDayOfMonth.getDate(); dayNum++) {
      const d = new Date(currentYear, currentMonth, dayNum);
      const dateStr = toLocalDateString(d);
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        tasks: filteredTasks.filter((t) => {
          const tDate = t.dueDate ? toLocalDateString(new Date(t.dueDate)) : toLocalDateString(new Date(t.createdAt));
          return tDate === dateStr;
        }),
      });
    }

    // Padding next month to complete weeks
    const remainingDays = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(currentYear, currentMonth + 1, i);
      const dateStr = toLocalDateString(d);
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        tasks: filteredTasks.filter((t) => {
          const tDate = t.dueDate ? toLocalDateString(new Date(t.dueDate)) : toLocalDateString(new Date(t.createdAt));
          return tDate === dateStr;
        }),
      });
    }

    return days;
  }, [currentYear, currentMonth, filteredTasks]);

  // Tasks for selected day
  const selectedDayTasks = useMemo(() => {
    if (!selectedDayStr) return [];
    return filteredTasks.filter((t) => {
      const tDate = t.dueDate ? toLocalDateString(new Date(t.dueDate)) : toLocalDateString(new Date(t.createdAt));
      return tDate === selectedDayStr;
    });
  }, [selectedDayStr, filteredTasks]);

  // Handle status update
  const handleUpdateStatus = async (taskId: string, newStatus: TaskStatus) => {
    setIsUpdating(true);
    setFeedback(null);
    try {
      const res = await updateTaskStatusAction(taskId, newStatus);
      if (res.success) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
        );
        if (selectedTask && selectedTask.id === taskId) {
          setSelectedTask((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
        setFeedback({
          type: "success",
          text: `Statut de la tâche mis à jour : ${TASK_STATUS_CONFIG[newStatus].label}`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "Erreur lors de la mise à jour du statut.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle assignee change
  const handleUpdateAssignee = async (taskId: string, assigneeId: string) => {
    setIsUpdating(true);
    setFeedback(null);
    try {
      const res = await updateTaskAssigneeAction(taskId, assigneeId === "NONE" ? null : assigneeId);
      if (res.success) {
        const assignedUser = users.find((u) => u.id === assigneeId) || null;
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  assigneeId: assigneeId === "NONE" ? null : assigneeId,
                  assignee: assignedUser
                    ? { id: assignedUser.id, name: assignedUser.name, role: assignedUser.role }
                    : null,
                }
              : t
          )
        );
        if (selectedTask && selectedTask.id === taskId) {
          setSelectedTask((prev) =>
            prev
              ? {
                  ...prev,
                  assigneeId: assigneeId === "NONE" ? null : assigneeId,
                  assignee: assignedUser
                    ? { id: assignedUser.id, name: assignedUser.name, role: assignedUser.role }
                    : null,
                }
              : null
          );
        }
        setFeedback({
          type: "success",
          text: `Assignation mise à jour avec succès.`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "Erreur lors de la réassignation.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle create new task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskClientId) {
      setFeedback({ type: "error", text: "Veuillez sélectionner un client." });
      return;
    }
    if (!newTaskTitle.trim()) {
      setFeedback({ type: "error", text: "Veuillez saisir le titre de la tâche." });
      return;
    }

    setIsCreatingTask(true);
    setFeedback(null);
    try {
      const targetClient = activeClients.find((c) => c.id === newTaskClientId);
      const projectId = targetClient?.projects[0]?.id;

      const res = await createTaskAction({
        clientId: newTaskClientId,
        projectId: projectId,
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || undefined,
        priority: newTaskPriority,
        dueDate: newTaskDueDate,
        assigneeId: newTaskAssigneeId || undefined,
      });

      if (res.success && res.task) {
        setFeedback({
          type: "success",
          text: `Tâche "${newTaskTitle}" planifiée avec succès dans le calendrier.`,
        });
        setIsNewTaskModalOpen(false);
        setNewTaskTitle("");
        setNewTaskDescription("");
        router.refresh();
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "Erreur lors de la création de la tâche.",
      });
    } finally {
      setIsCreatingTask(false);
    }
  };

  // Helper pour ouvrir le modal de thème pré-rempli pour un client
  const handleOpenThemeForClient = (clientId: string, weekNum: number = 1) => {
    setThemeClientId(clientId);
    setThemeWeekNumber(weekNum);
    const defaultPillars = [
      "Semaine 1 : Notoriété & Savoir-faire",
      "Semaine 2 : Éducation & Conseils",
      "Semaine 3 : Preuve Sociale & Avis",
      "Semaine 4 : Offre Spéciale & Conversion",
      "Semaine 5 : Coulisses & Présentation",
    ];
    setThemePillar(defaultPillars[weekNum - 1] || `Semaine ${weekNum}`);

    const targetClient = activeClients.find((c) => c.id === clientId);
    const existingTheme = targetClient?.themes?.[weekNum - 1];
    if (existingTheme) {
      setThemeTitle(existingTheme.title || "");
      setThemeDescription(existingTheme.description || "");
      setThemeColor(existingTheme.color || (weekNum === 1 ? "purple" : weekNum === 2 ? "blue" : weekNum === 3 ? "emerald" : "amber"));
    } else {
      setThemeTitle("");
      setThemeDescription("");
      setThemeColor(weekNum === 1 ? "purple" : weekNum === 2 ? "blue" : weekNum === 3 ? "emerald" : "amber");
    }
    setIsNewThemeModalOpen(true);
  };

  // Enregistrement manuel d'un thème
  const handleSaveTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!themeClientId) {
      setFeedback({ type: "error", text: "Veuillez sélectionner un client." });
      return;
    }
    if (!themeTitle.trim()) {
      setFeedback({ type: "error", text: "Veuillez saisir le titre du thème." });
      return;
    }

    setIsSavingTheme(true);
    setFeedback(null);
    try {
      const res = await saveClientEditorialThemeAction({
        clientId: themeClientId,
        weekNumber: themeWeekNumber,
        pillar: themePillar,
        title: themeTitle.trim(),
        description: themeDescription.trim() || undefined,
        color: themeColor,
        month: currentMonth + 1,
        year: currentYear,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          text: `Thème Semaine ${themeWeekNumber} enregistré avec succès !`,
        });
        setIsNewThemeModalOpen(false);
        setThemeTitle("");
        setThemeDescription("");
        router.refresh();
      } else {
        setFeedback({ type: "error", text: res.error || "Erreur enregistrement thème." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Erreur serveur." });
    } finally {
      setIsSavingTheme(false);
    }
  };

  // Helper pour ouvrir le modal de sujet pré-rempli
  const handleOpenSubjectForClient = (clientId: string, weekNum: number = 1, themeTitleVal?: string) => {
    setSubjectClientId(clientId);
    setSubjectWeekNumber(weekNum);
    const targetClient = activeClients.find((c) => c.id === clientId);
    const defaultTheme = themeTitleVal || targetClient?.themes?.[weekNum - 1]?.title || "";
    setSubjectThemeTitle(defaultTheme);
    setSubjectTitle("");
    setSubjectHook("");
    setSubjectScript("");
    setIsNewSubjectModalOpen(true);
  };

  // Création manuelle d'un sujet (tâche de production)
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectClientId) {
      setFeedback({ type: "error", text: "Veuillez sélectionner un client." });
      return;
    }
    if (!subjectTitle.trim()) {
      setFeedback({ type: "error", text: "Veuillez saisir le titre du sujet." });
      return;
    }

    setIsCreatingSubject(true);
    setFeedback(null);
    try {
      const res = await createManualSubjectTaskAction({
        clientId: subjectClientId,
        themeTitle: subjectThemeTitle.trim() || undefined,
        weekNumber: subjectWeekNumber,
        title: subjectTitle.trim(),
        format: subjectFormat,
        dueDate: subjectDueDate,
        hook: subjectHook.trim() || undefined,
        scriptOrDescription: subjectScript.trim() || undefined,
        assigneeId: subjectAssigneeId || undefined,
        priority: subjectPriority,
      });

      if (res.success && res.task) {
        setFeedback({
          type: "success",
          text: `Sujet "${subjectTitle}" planifié avec succès dans le calendrier !`,
        });
        setIsNewSubjectModalOpen(false);
        setSubjectTitle("");
        setSubjectHook("");
        setSubjectScript("");
        router.refresh();
      } else {
        setFeedback({ type: "error", text: res.error || "Erreur création sujet." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Erreur serveur." });
    } finally {
      setIsCreatingSubject(false);
    }
  };

  // Déclenchement manuel du rappel début de semaine
  const handleTriggerWeeklyReminder = async () => {
    setIsSendingReminder(true);
    try {
      const res = await triggerWeeklyReminderAction();
      if (res.success) {
        setFeedback({
          type: "success",
          text: (res as any).alreadySent
            ? "Le rappel hebdomadaire a déjà été envoyé cette semaine."
            : `Notification de début de semaine envoyée avec succès à ${(res as any).count || "l'"}équipe !`,
        });
      } else {
        setFeedback({ type: "error", text: "Erreur lors de l'envoi du rappel." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Erreur lors de l'envoi." });
    } finally {
      setIsSendingReminder(false);
    }
  };

  // Group by client for "by_client" view
  const tasksByClient = useMemo(() => {
    const map = new Map<
      string,
      {
        client: TechnicianCalendarTask["project"]["client"];
        tasks: TechnicianCalendarTask[];
      }
    >();

    for (const t of filteredTasks) {
      const c = t.project.client;
      if (!map.has(c.id)) {
        map.set(c.id, { client: c, tasks: [] });
      }
      map.get(c.id)!.tasks.push(t);
    }

    return Array.from(map.values());
  }, [filteredTasks]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-neutral-900 to-indigo-950/30 border border-emerald-500/20 shadow-xl">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30">
              Espace Technique & Production
            </span>
            <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 text-xs font-semibold border border-neutral-700">
              Packs Signés & En Préparation
            </span>
            <span className="flex items-center gap-1 text-xs text-neutral-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Synchronisation direct
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-100 mt-1.5 flex items-center gap-2.5">
            <CalendarIcon className="w-7 h-7 text-emerald-400" />
            <span>Calendrier Mensuel des Tâches</span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-3xl">
            Toutes les livrables du mois (Vidéos Reels, Carrousels, Maquettes, Campagnes Ads, Web) issues des abonnements et packs signés, classées par date d'échéance et technicien responsable.
          </p>
        </div>

        {/* Actions & Month switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-xl p-1 shadow-inner">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              title="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-neutral-200 min-w-[125px] text-center capitalize">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              title="Mois suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCurrentMonth}
            className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-xl text-xs font-medium text-neutral-300 hover:text-white transition cursor-pointer"
          >
            Aujourd'hui
          </button>

          {/* Bouton Nouveau Sujet */}
          <Button
            size="sm"
            onClick={() => {
              if (activeClients.length > 0 && !subjectClientId) {
                setSubjectClientId(activeClients[0].id);
              }
              setIsNewSubjectModalOpen(true);
            }}
            className="gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-600/25 cursor-pointer"
          >
            <Film className="w-4 h-4" />
            <span>+ Nouveau Sujet</span>
          </Button>

          {/* Bouton Nouveau Thème */}
          <Button
            size="sm"
            onClick={() => {
              if (activeClients.length > 0 && !themeClientId) {
                setThemeClientId(activeClients[0].id);
              }
              setIsNewThemeModalOpen(true);
            }}
            className="gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-md shadow-amber-600/25 cursor-pointer"
          >
            <Target className="w-4 h-4" />
            <span>+ Nouveau Thème</span>
          </Button>

          {/* Bouton Nouvelle Tâche Générale */}
          <Button
            size="sm"
            onClick={() => setIsNewTaskModalOpen(true)}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Tâche</span>
          </Button>
        </div>
      </div>

      {/* BANDEAU RAPPEL DÉBUT DE SEMAINE : Remplissage des Thèmes & Sujets */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 via-neutral-900 to-indigo-950/50 border border-purple-500/30 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center justify-center shrink-0 shadow-inner">
            <Bell className="w-5 h-5 text-purple-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                🔔 Rappel Début de Semaine
              </span>
              <span className="text-xs text-neutral-400 font-medium">
                {activeClients.length} clients sous contrat
              </span>
            </div>
            <h3 className="text-sm font-bold text-neutral-100 mt-0.5">
              Remplissez manuellement les thèmes et sujets de publications pour la semaine
            </h3>
            <p className="text-xs text-neutral-400">
              Définissez les axes stratégiques et les livrables (Reels, Carrousels, Maquettes) pour chaque client sous contrat.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("themes")}
            className="px-3 py-1.5 rounded-xl bg-purple-600/25 hover:bg-purple-600/40 border border-purple-500/40 text-purple-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Bookmark className="w-3.5 h-3.5 text-purple-300" />
            <span>Vue Thèmes & Sujets</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (activeClients.length > 0 && !themeClientId) setThemeClientId(activeClients[0].id);
              setIsNewThemeModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-600/25 hover:bg-amber-600/40 border border-amber-500/40 text-amber-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-amber-300" />
            <span>+ Thème</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (activeClients.length > 0 && !subjectClientId) setSubjectClientId(activeClients[0].id);
              setIsNewSubjectModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-md shadow-purple-600/25 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Sujet</span>
          </button>

          <button
            type="button"
            onClick={handleTriggerWeeklyReminder}
            disabled={isSendingReminder}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition cursor-pointer disabled:opacity-50"
            title="Envoyer la notification de début de semaine à toute l'équipe"
          >
            <Send className={`w-3.5 h-3.5 ${isSendingReminder ? "animate-spin text-purple-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Feedback message */}
      {feedback && (
        <div
          className={`p-3 text-xs rounded-xl font-medium border flex items-center justify-between gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-neutral-400 hover:text-white text-xs font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Row 1: KPI Workload & Pack Distribution Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span>Tâches du Mois</span>
            <CalendarDays className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-neutral-100">{kpis.total}</span>
            <span className="text-[11px] text-neutral-400">tâches totales</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-400 font-medium">
            {kpis.activeClientsCount} clients actifs • {kpis.prepClientsCount} en prép
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span>En Cours & À Faire</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-400">
              {kpis.inProgress + kpis.todo}
            </span>
            <span className="text-[11px] text-neutral-400">
              ({kpis.inProgress} en cours, {kpis.todo} à faire)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-neutral-400 font-medium">
            À finaliser par l'équipe technique
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span>Livrées & Validées</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">
              {kpis.completed + kpis.validated}
            </span>
            <span className="text-[11px] text-emerald-400 font-bold">
              {kpis.completionRate}% complété
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all"
              style={{ width: `${kpis.completionRate}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span>Priorité Haute & Urgente</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-400">{kpis.urgent}</span>
            <span className="text-[11px] text-neutral-400">tâches urgentes</span>
          </div>
          <div className="mt-1 text-[11px] text-rose-400 font-medium">
            À traiter en priorité absolue
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-sm flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span>Répartition Packs</span>
            <Repeat className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Starter : {kpis.starterCount}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Silver : {kpis.silverCount}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
              Gold : {kpis.goldCount}
            </span>
            {kpis.customCount > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Sur-mesure : {kpis.customCount}
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-neutral-400 font-medium">
            Quotas et productions du mois
          </div>
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-md space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* View mode toggle */}
          <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded-lg transition-colors cursor-pointer ${
                viewMode === "calendar"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Grille Calendrier</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("agenda")}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded-lg transition-colors cursor-pointer ${
                viewMode === "agenda"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Agenda Chronologique ({filteredTasks.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("by_client")}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded-lg transition-colors cursor-pointer ${
                viewMode === "by_client"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Par Client & Pack ({tasksByClient.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("themes")}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded-lg transition-colors cursor-pointer ${
                viewMode === "themes"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5 text-purple-300" />
              <span>Thèmes & Sujets Semaine ({activeClients.length})</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher tâche, client, pack..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500/50"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin text-xs">
          <span className="text-neutral-500 font-semibold flex items-center gap-1 shrink-0">
            <Filter className="w-3 h-3" />
            Filtres :
          </span>

          {/* Pack Filter */}
          <select
            value={packFilter}
            onChange={(e) => setPackFilter(e.target.value as any)}
            className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1 text-xs text-neutral-300 focus:outline-hidden focus:border-emerald-500/50 shrink-0"
          >
            <option value="ALL">Tous les Packs</option>
            <option value="STARTER">Pack Starter (1/sem)</option>
            <option value="SILVER">Pack Silver (2/sem)</option>
            <option value="GOLD">Pack Gold (3/sem)</option>
            <option value="CUSTOM">Pack Sur-Mesure</option>
          </select>

          {/* Client Status */}
          <select
            value={clientStatusFilter}
            onChange={(e) => setClientStatusFilter(e.target.value as any)}
            className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1 text-xs text-neutral-300 focus:outline-hidden focus:border-emerald-500/50 shrink-0"
          >
            <option value="ALL">Tous Statuts Client</option>
            <option value="ACTIVE">Clients Actifs (Signés)</option>
            <option value="IN_PREPARATION">Clients En Préparation</option>
          </select>

          {/* Task Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1 text-xs text-neutral-300 focus:outline-hidden focus:border-emerald-500/50 shrink-0"
          >
            <option value="ALL">Tous Statuts Tâche</option>
            <option value="TODO">⏳ À faire</option>
            <option value="IN_PROGRESS">⚡ En cours</option>
            <option value="COMPLETED">✅ Terminée</option>
            <option value="VALIDATED">🌟 Validée Client</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1 text-xs text-neutral-300 focus:outline-hidden focus:border-emerald-500/50 shrink-0"
          >
            <option value="ALL">Tous les Techniciens</option>
            <option value="MINE">Mes Tâches Uniquement</option>
            <option value="UNASSIGNED">Non Assignées</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                👤 {u.name}
              </option>
            ))}
          </select>

          {selectedDayStr && (
            <button
              type="button"
              onClick={() => setSelectedDayStr(null)}
              className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold shrink-0 flex items-center gap-1 hover:bg-emerald-500/30"
            >
              <span>Jour : {formatDate(selectedDayStr)}</span>
              <span>✕</span>
            </button>
          )}

          {(packFilter !== "ALL" ||
            clientStatusFilter !== "ALL" ||
            statusFilter !== "ALL" ||
            assigneeFilter !== "ALL" ||
            search ||
            selectedDayStr) && (
            <button
              type="button"
              onClick={() => {
                setPackFilter("ALL");
                setClientStatusFilter("ALL");
                setStatusFilter("ALL");
                setAssigneeFilter("ALL");
                setSearch("");
                setSelectedDayStr(null);
              }}
              className="text-xs text-neutral-400 hover:text-neutral-200 underline shrink-0 ml-1"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* 1. VUE GRILLE CALENDRIER MENSUEL */}
      {viewMode === "calendar" && (
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {DAYS_OF_WEEK.map((dayName, idx) => (
              <div
                key={dayName}
                className={`text-center py-2 text-xs font-bold uppercase tracking-wider rounded-lg ${
                  idx >= 5 ? "text-neutral-500 bg-neutral-950/40" : "text-neutral-400 bg-neutral-950/60"
                }`}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarDays.map((dayItem, index) => {
              const isSelected = selectedDayStr === dayItem.dateStr;
              const hasTasks = dayItem.tasks.length > 0;
              const hasUrgent = dayItem.tasks.some((t) => t.priority === "URGENT" || t.priority === "HIGH");

              return (
                <div
                  key={`${dayItem.dateStr}-${index}`}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedDayStr(null);
                    } else {
                      setSelectedDayStr(dayItem.dateStr);
                    }
                  }}
                  className={`min-h-[110px] sm:min-h-[135px] p-2 rounded-xl border transition-all flex flex-col justify-between cursor-pointer group ${
                    dayItem.isCurrentMonth
                      ? isSelected
                        ? "bg-emerald-950/30 border-emerald-500 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500"
                        : "bg-neutral-950/60 border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-900/60"
                      : "bg-neutral-950/20 border-neutral-900/50 opacity-45 hover:opacity-70"
                  } ${dayItem.isToday ? "ring-2 ring-emerald-500/60" : ""}`}
                >
                  {/* Top Day Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                          dayItem.isToday
                            ? "bg-emerald-600 text-white"
                            : isSelected
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "text-neutral-300 group-hover:text-white"
                        }`}
                      >
                        {dayItem.date.getDate()}
                      </span>
                      {dayItem.isToday && (
                        <span className="hidden sm:inline text-[9px] font-bold text-emerald-400 uppercase tracking-tighter">
                          Auj
                        </span>
                      )}
                    </div>

                    {hasTasks && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          hasUrgent
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : "bg-neutral-800 text-neutral-300"
                        }`}
                      >
                        {dayItem.tasks.length}
                      </span>
                    )}
                  </div>

                  {/* Task Pills (Max 3 visible, rest in counter) */}
                  <div className="mt-1.5 space-y-1 overflow-hidden flex-1">
                    {dayItem.tasks.slice(0, 3).map((task) => {
                      const packBadge = PACK_BADGES[task.project.client.offerType] || PACK_BADGES.CUSTOM;
                      const statusConf = TASK_STATUS_CONFIG[task.status];
                      const isUrgent = task.priority === "URGENT" || task.priority === "HIGH";

                      return (
                        <div
                          key={task.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTask(task);
                          }}
                          className={`px-1.5 py-1 rounded-md text-[10px] border transition flex items-center gap-1 truncate ${
                            isUrgent
                              ? "bg-rose-950/30 border-rose-500/30 text-rose-200 hover:border-rose-400"
                              : task.status === "VALIDATED" || task.status === "COMPLETED"
                              ? "bg-emerald-950/30 border-emerald-500/25 text-emerald-300 hover:border-emerald-400"
                              : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700"
                          }`}
                          title={`${task.title} — ${task.project.client.companyName} (${packBadge.label})`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusConf.dot}`} />
                          <span className="truncate font-medium flex-1">
                            {task.title}
                          </span>
                        </div>
                      );
                    })}

                    {dayItem.tasks.length > 3 && (
                      <div className="text-[9px] text-neutral-400 font-semibold text-center pt-0.5">
                        +{dayItem.tasks.length - 3} de plus...
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day Inspector (shown below calendar when a day is clicked) */}
      {viewMode === "calendar" && selectedDayStr && (
        <div className="p-5 rounded-2xl bg-neutral-900/90 border border-emerald-500/40 shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                📅
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                  <span>Tâches prévues le {formatDate(selectedDayStr)}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                    {selectedDayTasks.length} tâche(s)
                  </span>
                </h3>
                <p className="text-xs text-neutral-400">
                  Détail des livrables et assignations pour cette journée
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedDayStr(null)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white transition"
            >
              Fermer l'aperçu du jour
            </button>
          </div>

          {selectedDayTasks.length === 0 ? (
            <div className="py-6 text-center text-xs text-neutral-500">
              Aucune tâche planifiée précisément pour ce jour. Cliquez sur « Nouvelle Tâche » pour en ajouter une.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {selectedDayTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onSelect={() => setSelectedTask(t)}
                  onStatusChange={handleUpdateStatus}
                  getDeliverableIcon={getDeliverableIcon}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. VUE AGENDA CHRONOLOGIQUE */}
      {viewMode === "agenda" && (
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="p-8 text-center bg-neutral-900/60 rounded-2xl border border-neutral-800 text-neutral-400 text-sm">
              Aucune tâche trouvée pour ce mois avec les filtres sélectionnés.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onSelect={() => setSelectedTask(t)}
                  onStatusChange={handleUpdateStatus}
                  getDeliverableIcon={getDeliverableIcon}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. VUE PAR PACK & CLIENT */}
      {viewMode === "by_client" && (
        <div className="space-y-4">
          {tasksByClient.length === 0 ? (
            <div className="p-8 text-center bg-neutral-900/60 rounded-2xl border border-neutral-800 text-neutral-400 text-sm">
              Aucun client actif ou en préparation avec des tâches pour les filtres sélectionnés.
            </div>
          ) : (
            <div className="space-y-4">
              {tasksByClient.map(({ client, tasks: clientTasks }) => {
                const packBadge = PACK_BADGES[client.offerType] || PACK_BADGES.CUSTOM;
                const isPrep = client.status === "IN_PREPARATION";

                return (
                  <div
                    key={client.id}
                    className="p-4 sm:p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-md space-y-3"
                  >
                    {/* Client Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-sm text-neutral-200">
                          {client.companyName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-neutral-100">
                              {client.companyName}
                            </h3>
                            {client.brandName && (
                              <span className="text-xs text-neutral-400">
                                ({client.brandName})
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${packBadge.bg} ${packBadge.text} ${packBadge.border}`}
                            >
                              {packBadge.label}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                isPrep
                                  ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                                  : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              }`}
                            >
                              {isPrep ? "En préparation" : "Actif (Signé)"}
                            </span>
                          </div>
                          <span className="text-xs text-neutral-400">
                            Secteur : {client.sector || "Non spécifié"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-400 font-semibold">
                          {clientTasks.length} tâche(s) ce mois
                        </span>
                        <Link
                          href={`/abonnements?clientId=${client.id}`}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
                          title="Voir le pack complet"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>

                    {/* Tasks of this client */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                      {clientTasks.map((t) => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          onSelect={() => setSelectedTask(t)}
                          onStatusChange={handleUpdateStatus}
                          getDeliverableIcon={getDeliverableIcon}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. VUE THÈMES & SUJETS DE LA SEMAINE PAR CLIENT */}
      {viewMode === "themes" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
            <div>
              <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-purple-400" />
                <span>Planification Manuelle des Thèmes & Sujets Hebdomadaires</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Vue récapitulative des 4 semaines du mois pour chaque client sous contrat. Remplissez les thèmes et ajoutez directement vos sujets.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (activeClients.length > 0 && !themeClientId) setThemeClientId(activeClients[0].id);
                  setIsNewThemeModalOpen(true);
                }}
                className="gap-1 text-xs bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Définir un Thème</span>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (activeClients.length > 0 && !subjectClientId) setSubjectClientId(activeClients[0].id);
                  setIsNewSubjectModalOpen(true);
                }}
                className="gap-1 text-xs bg-purple-600 hover:bg-purple-500 text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Planifier un Sujet</span>
              </Button>
            </div>
          </div>

          {activeClients.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-neutral-900/50 border border-neutral-800 text-neutral-400 text-xs">
              Aucun client actif ou en préparation pour le moment.
            </div>
          ) : (
            <div className="space-y-4">
              {activeClients.map((client) => {
                const packBadge = PACK_BADGES[client.offerType] || PACK_BADGES.CUSTOM;
                const clientTasks = tasks.filter((t) => t.project.client.id === client.id);

                return (
                  <div
                    key={client.id}
                    className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-lg space-y-4"
                  >
                    {/* Header Client */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center font-bold text-sm shrink-0">
                          {client.companyName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-neutral-100">
                              {client.companyName}
                            </h3>
                            {client.brandName && (
                              <span className="text-xs text-neutral-400">
                                ({client.brandName})
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${packBadge.bg} ${packBadge.text} ${packBadge.border}`}
                            >
                              {packBadge.label}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                client.status === "IN_PREPARATION"
                                  ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                                  : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              }`}
                            >
                              {client.status === "IN_PREPARATION" ? "En préparation" : "Actif"}
                            </span>
                          </div>
                          <span className="text-[11px] text-neutral-400">
                            {clientTasks.length} publication(s)/tâche(s) planifiée(s) pour ce mois
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenSubjectForClient(client.id, 1)}
                          className="text-xs border-purple-500/40 text-purple-300 hover:bg-purple-500/10 gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Nouveau Sujet</span>
                        </Button>
                        <Link
                          href={`/abonnements?clientId=${client.id}`}
                          className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition"
                        >
                          <span>Voir Abonnement</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>

                    {/* Grille des 4 Semaines pour ce client */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {[1, 2, 3, 4].map((weekNum) => {
                        const theme = client.themes?.[weekNum - 1];
                        const hasTheme = Boolean(theme && theme.title);

                        // Trouver les tâches qui correspondent à cette semaine
                        const weekTasks = clientTasks.filter((t) => {
                          const desc = `${t.title} ${t.description || ""}`.toLowerCase();
                          if (desc.includes(`semaine ${weekNum}`) || desc.includes(`s${weekNum}`)) {
                            return true;
                          }
                          if (t.dueDate) {
                            const d = new Date(t.dueDate);
                            const day = d.getDate();
                            if (weekNum === 1 && day <= 7) return true;
                            if (weekNum === 2 && day > 7 && day <= 14) return true;
                            if (weekNum === 3 && day > 14 && day <= 21) return true;
                            if (weekNum === 4 && day > 21) return true;
                          }
                          return false;
                        });

                        return (
                          <div
                            key={weekNum}
                            className={`p-3.5 rounded-2xl border flex flex-col justify-between transition-all ${
                              hasTheme
                                ? "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700"
                                : "bg-neutral-950/30 border-dashed border-neutral-800 hover:border-neutral-700"
                            }`}
                          >
                            <div className="space-y-2">
                              {/* En-tête Semaine */}
                              <div className="flex items-center justify-between">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-900 border border-neutral-800 text-neutral-300">
                                  Semaine {weekNum}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => handleOpenThemeForClient(client.id, weekNum)}
                                  className="text-[11px] text-neutral-400 hover:text-purple-300 font-medium transition cursor-pointer"
                                  title="Modifier ou définir le thème"
                                >
                                  {hasTheme ? "Modifier" : "+ Thème"}
                                </button>
                              </div>

                              {/* Affichage du Thème */}
                              {hasTheme ? (
                                <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/25 space-y-1">
                                  <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider truncate">
                                    {theme?.pillar || `Semaine ${weekNum}`}
                                  </div>
                                  <div className="text-xs font-bold text-neutral-100 line-clamp-2">
                                    {theme?.title}
                                  </div>
                                  {theme?.description && (
                                    <p className="text-[10px] text-neutral-400 line-clamp-2">
                                      {theme.description}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenThemeForClient(client.id, weekNum)}
                                  className="w-full py-3 px-2 rounded-xl border border-dashed border-neutral-800 hover:border-purple-500/40 text-center text-xs text-neutral-500 hover:text-purple-300 transition cursor-pointer block"
                                >
                                  + Définir le thème de la semaine
                                </button>
                              )}

                              {/* Sujets planifiés pour cette semaine */}
                              <div className="space-y-1.5 pt-1">
                                <div className="flex items-center justify-between text-[10px] text-neutral-400 font-semibold">
                                  <span>Sujets ({weekTasks.length}) :</span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSubjectForClient(client.id, weekNum, theme?.title)}
                                    className="text-purple-400 hover:text-purple-300 transition cursor-pointer"
                                  >
                                    + Ajouter
                                  </button>
                                </div>

                                {weekTasks.length === 0 ? (
                                  <div className="text-[10px] text-neutral-600 italic py-1">
                                    Aucun sujet planifié
                                  </div>
                                ) : (
                                  weekTasks.map((t) => (
                                    <div
                                      key={t.id}
                                      onClick={() => setSelectedTask(t)}
                                      className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition cursor-pointer space-y-1"
                                    >
                                      <div className="flex items-start gap-1.5">
                                        <div className="mt-0.5">{getDeliverableIcon(t.title, t.description)}</div>
                                        <span className="text-[11px] font-semibold text-neutral-200 line-clamp-1">
                                          {t.title}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between text-[9px] text-neutral-400">
                                        <span>{t.dueDate ? formatDate(t.dueDate) : "Sans date"}</span>
                                        <span
                                          className={`px-1.5 py-0.2 rounded font-bold ${
                                            t.status === "VALIDATED" || t.status === "COMPLETED"
                                              ? "text-emerald-400 bg-emerald-500/10"
                                              : t.status === "IN_PROGRESS"
                                              ? "text-blue-400 bg-blue-500/10"
                                              : "text-neutral-400 bg-neutral-800"
                                          }`}
                                        >
                                          {TASK_STATUS_CONFIG[t.status].label}
                                        </span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            {/* Footer de carte Semaine */}
                            <div className="pt-2 mt-2 border-t border-neutral-800/60">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenSubjectForClient(client.id, weekNum, theme?.title)}
                                className="w-full text-[10px] h-7 border-neutral-800 hover:border-purple-500/50 text-neutral-300 hover:text-purple-300 cursor-pointer"
                              >
                                + Nouveau Sujet S{weekNum}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TASK DETAIL & FAST UPDATE MODAL */}
      {selectedTask && (
        <Modal
          isOpen={Boolean(selectedTask)}
          onClose={() => setSelectedTask(null)}
          title="Fiche & Avancement de la Tâche"
        >
          <div className="space-y-4 text-xs">
            {/* Top info badge bar */}
            <div className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-xl bg-neutral-950 border border-neutral-800">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                    PACK_BADGES[selectedTask.project.client.offerType]?.bg || "bg-neutral-800"
                  } ${
                    PACK_BADGES[selectedTask.project.client.offerType]?.text || "text-neutral-300"
                  } ${
                    PACK_BADGES[selectedTask.project.client.offerType]?.border || "border-neutral-700"
                  }`}
                >
                  {PACK_BADGES[selectedTask.project.client.offerType]?.label || selectedTask.project.client.offerType}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                    selectedTask.project.client.status === "IN_PREPARATION"
                      ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                      : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  }`}
                >
                  {selectedTask.project.client.status === "IN_PREPARATION"
                    ? "En préparation"
                    : "Client Actif"}
                </span>
              </div>

              <div className="text-xs text-neutral-400">
                Projet : <strong className="text-neutral-200">{selectedTask.project.code}</strong>
              </div>
            </div>

            {/* Title & Client */}
            <div>
              <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                {selectedTask.project.client.companyName}
              </span>
              <h2 className="text-base font-bold text-neutral-100 mt-0.5">
                {selectedTask.title}
              </h2>
            </div>

            {/* Description if present */}
            {selectedTask.description && (
              <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                {selectedTask.description}
              </div>
            )}

            {/* Grid details */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-neutral-950/50 border border-neutral-800/80">
              <div>
                <span className="text-neutral-500 text-[10px] uppercase font-bold">Échéance</span>
                <p className="text-neutral-200 font-medium mt-0.5">
                  {selectedTask.dueDate ? formatDateTime(selectedTask.dueDate) : "Non planifiée"}
                </p>
              </div>

              <div>
                <span className="text-neutral-500 text-[10px] uppercase font-bold">Priorité</span>
                <p
                  className={`font-bold mt-0.5 ${
                    selectedTask.priority === "URGENT" || selectedTask.priority === "HIGH"
                      ? "text-rose-400"
                      : "text-neutral-200"
                  }`}
                >
                  {selectedTask.priority}
                </p>
              </div>

              <div>
                <span className="text-neutral-500 text-[10px] uppercase font-bold">Temps estimé / passé</span>
                <p className="text-neutral-200 font-medium mt-0.5">
                  {selectedTask.timeSpentHours > 0 ? `${selectedTask.timeSpentHours}h` : "—"}
                </p>
              </div>

              <div>
                <span className="text-neutral-500 text-[10px] uppercase font-bold">Technicien assigné</span>
                <select
                  value={selectedTask.assigneeId || "NONE"}
                  onChange={(e) => handleUpdateAssignee(selectedTask.id, e.target.value)}
                  disabled={isUpdating}
                  className="w-full mt-0.5 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-neutral-200 focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="NONE">Non assigné</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      👤 {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Fast status switcher */}
            <div>
              <span className="text-neutral-400 text-xs font-semibold block mb-2">
                Mettre à jour le statut en un clic :
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["TODO", "IN_PROGRESS", "COMPLETED", "VALIDATED"] as TaskStatus[]).map((st) => {
                  const conf = TASK_STATUS_CONFIG[st];
                  const isCurrent = selectedTask.status === st;

                  return (
                    <button
                      key={st}
                      type="button"
                      disabled={isUpdating || isCurrent}
                      onClick={() => handleUpdateStatus(selectedTask.id, st)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                        isCurrent
                          ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                          : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900"
                      } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <span className="text-base">{conf.icon}</span>
                      <span>{conf.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
              <Link
                href={`/production`}
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>Ouvrir dans le Kanban global</span>
                <ExternalLink className="w-3 h-3" />
              </Link>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedTask(null)}
              >
                Fermer
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* NEW TASK MODAL */}
      {isNewTaskModalOpen && (
        <Modal
          isOpen={isNewTaskModalOpen}
          onClose={() => setIsNewTaskModalOpen(false)}
          title="Ajouter une Tâche de Production (Pack Signé)"
        >
          <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Client (Pack Actif ou En Préparation) *
              </label>
              <select
                value={newTaskClientId}
                onChange={(e) => setNewTaskClientId(e.target.value)}
                required
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-emerald-500"
              >
                <option value="">Sélectionnez un client...</option>
                {activeClients.map((c) => {
                  const pBadge = PACK_BADGES[c.offerType]?.label || c.offerType;
                  const isPrep = c.status === "IN_PREPARATION";
                  return (
                    <option key={c.id} value={c.id}>
                      {c.companyName} — [{pBadge}] ({isPrep ? "En préparation" : "Actif"})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Titre de la tâche (ex: Montage Reel 9:16, Maquette Carrousel) *
              </label>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="ex: Tournage Vidéo sur site / Création 3 Visuels Instagram"
                required
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Date d'échéance / Diffusion *
                </label>
                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">Priorité</label>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-emerald-500"
                >
                  <option value={TaskPriority.LOW}>Faible</option>
                  <option value={TaskPriority.MEDIUM}>Moyenne</option>
                  <option value={TaskPriority.HIGH}>Haute</option>
                  <option value={TaskPriority.URGENT}>Urgente 🚨</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Technicien responsable
              </label>
              <select
                value={newTaskAssigneeId}
                onChange={(e) => setNewTaskAssigneeId(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-emerald-500"
              >
                <option value="">Non assigné</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    👤 {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Instructions ou Script (facultatif)
              </label>
              <textarea
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Consignes particulières, lien drive ou texte du post..."
                rows={3}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-800">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsNewTaskModalOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isCreatingTask}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {isCreatingTask ? "Enregistrement..." : "Planifier la Tâche"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: NOUVEAU THÈME HEBDOMADAIRE (SAISIE MANUELLE) */}
      {isNewThemeModalOpen && (
        <Modal
          isOpen={isNewThemeModalOpen}
          onClose={() => setIsNewThemeModalOpen(false)}
          title="Définir un Thème de la Semaine (Saisie Manuelle)"
        >
          <form onSubmit={handleSaveTheme} className="space-y-4 text-xs">
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Client sous contrat *
              </label>
              <select
                value={themeClientId}
                onChange={(e) => {
                  setThemeClientId(e.target.value);
                  const found = activeClients.find((c) => c.id === e.target.value);
                  const ex = found?.themes?.[themeWeekNumber - 1];
                  if (ex) {
                    setThemeTitle(ex.title || "");
                    setThemeDescription(ex.description || "");
                  }
                }}
                required
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-amber-500"
              >
                <option value="">Sélectionnez un client...</option>
                {activeClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    🏢 {c.companyName} ({c.offerType})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Semaine du mois *
                </label>
                <select
                  value={themeWeekNumber}
                  onChange={(e) => {
                    const wk = parseInt(e.target.value, 10);
                    setThemeWeekNumber(wk);
                    const defaultPillars = [
                      "Semaine 1 : Notoriété & Savoir-faire",
                      "Semaine 2 : Éducation & Conseils",
                      "Semaine 3 : Preuve Sociale & Avis",
                      "Semaine 4 : Offre Spéciale & Conversion",
                      "Semaine 5 : Coulisses & Présentation",
                    ];
                    setThemePillar(defaultPillars[wk - 1] || `Semaine ${wk}`);
                    const found = activeClients.find((c) => c.id === themeClientId);
                    const ex = found?.themes?.[wk - 1];
                    if (ex) {
                      setThemeTitle(ex.title || "");
                      setThemeDescription(ex.description || "");
                    }
                  }}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-amber-500"
                >
                  <option value={1}>Semaine 1</option>
                  <option value={2}>Semaine 2</option>
                  <option value={3}>Semaine 3</option>
                  <option value={4}>Semaine 4</option>
                  <option value={5}>Semaine 5</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Couleur du badge
                </label>
                <select
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-amber-500"
                >
                  <option value="purple">🟣 Violet (Notoriété)</option>
                  <option value="blue">🔵 Bleu (Éducation)</option>
                  <option value="emerald">🟢 Vert Émeraude (Preuve sociale)</option>
                  <option value="amber">🟠 Ambre / Or (Offre commerciale)</option>
                  <option value="rose">🔴 Rose / Rouge (Événement)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Axe / Pilier Stratégique
              </label>
              <input
                type="text"
                value={themePillar}
                onChange={(e) => setThemePillar(e.target.value)}
                placeholder="Ex: Notoriété & Savoir-faire"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Titre du Thème de la semaine *
              </label>
              <input
                type="text"
                value={themeTitle}
                onChange={(e) => setThemeTitle(e.target.value)}
                placeholder="Ex: Les 3 erreurs courantes lors d'un achat immobilier"
                required
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 font-bold focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Description / Objectif du thème (facultatif)
              </label>
              <textarea
                value={themeDescription}
                onChange={(e) => setThemeDescription(e.target.value)}
                placeholder="Angle spécifique, cible visée ou message clé..."
                rows={2}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-800">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsNewThemeModalOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingTheme}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold"
              >
                {isSavingTheme ? "Enregistrement..." : "Enregistrer le Thème"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 4: NOUVEAU SUJET DE PUBLICATION (SAISIE MANUELLE) */}
      {isNewSubjectModalOpen && (
        <Modal
          isOpen={isNewSubjectModalOpen}
          onClose={() => setIsNewSubjectModalOpen(false)}
          title="Planifier un Nouveau Sujet de Publication"
        >
          <form onSubmit={handleCreateSubject} className="space-y-4 text-xs">
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Client sous contrat *
              </label>
              <select
                value={subjectClientId}
                onChange={(e) => {
                  setSubjectClientId(e.target.value);
                  const found = activeClients.find((c) => c.id === e.target.value);
                  const themeForWeek = found?.themes?.[subjectWeekNumber - 1];
                  if (themeForWeek?.title) {
                    setSubjectThemeTitle(themeForWeek.title);
                  }
                }}
                required
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-purple-500"
              >
                <option value="">Sélectionnez un client...</option>
                {activeClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    🏢 {c.companyName} ({c.offerType})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Semaine
                </label>
                <select
                  value={subjectWeekNumber}
                  onChange={(e) => {
                    const wk = parseInt(e.target.value, 10);
                    setSubjectWeekNumber(wk);
                    const found = activeClients.find((c) => c.id === subjectClientId);
                    const themeForWeek = found?.themes?.[wk - 1];
                    if (themeForWeek?.title) {
                      setSubjectThemeTitle(themeForWeek.title);
                    }
                  }}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-purple-500"
                >
                  <option value={1}>Semaine 1</option>
                  <option value={2}>Semaine 2</option>
                  <option value={3}>Semaine 3</option>
                  <option value={4}>Semaine 4</option>
                  <option value={5}>Semaine 5</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Format de publication *
                </label>
                <select
                  value={subjectFormat}
                  onChange={(e) => setSubjectFormat(e.target.value as any)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-purple-500"
                >
                  <option value="REEL_9_16">🎬 Reel / Vidéo courte (9:16)</option>
                  <option value="CAROUSEL">📑 Carrousel multi-pages</option>
                  <option value="STATIC_POST">🖼️ Post Visuel Graphique</option>
                  <option value="STORY_INTERACTIVE">📱 Story Interactive</option>
                  <option value="OTHER">📄 Autre livrable</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Thème de rattachement
              </label>
              <input
                type="text"
                value={subjectThemeTitle}
                onChange={(e) => setSubjectThemeTitle(e.target.value)}
                placeholder="Ex: Conseils & Éducation, ou Notoriété..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Titre du Sujet de publication *
              </label>
              <input
                type="text"
                value={subjectTitle}
                onChange={(e) => setSubjectTitle(e.target.value)}
                placeholder="Ex: Comment négocier le prix de son appartement sans stress"
                required
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 font-bold focus:outline-hidden focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Date de publication / Échéance *
                </label>
                <input
                  type="date"
                  value={subjectDueDate}
                  onChange={(e) => setSubjectDueDate(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Priorité
                </label>
                <select
                  value={subjectPriority}
                  onChange={(e) => setSubjectPriority(e.target.value as any)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-purple-500"
                >
                  <option value={TaskPriority.LOW}>Basse</option>
                  <option value={TaskPriority.MEDIUM}>Moyenne</option>
                  <option value={TaskPriority.HIGH}>Haute</option>
                  <option value={TaskPriority.URGENT}>Urgente</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Accroche / Hook (les 3 premières secondes)
              </label>
              <input
                type="text"
                value={subjectHook}
                onChange={(e) => setSubjectHook(e.target.value)}
                placeholder="Ex: Ne signez jamais un compromis avant d'avoir vérifié ceci !"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Briefing, Script ou Consignes de tournage / montage
              </label>
              <textarea
                value={subjectScript}
                onChange={(e) => setSubjectScript(e.target.value)}
                placeholder="Décrivez les étapes de la vidéo, les visuels souhaités ou le texte pour le carrousel..."
                rows={3}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">
                Technicien responsable (Monteur / Graphiste)
              </label>
              <select
                value={subjectAssigneeId}
                onChange={(e) => setSubjectAssigneeId(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-purple-500"
              >
                <option value="">Non assigné</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    👤 {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-800">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsNewSubjectModalOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isCreatingSubject}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold"
              >
                {isCreatingSubject ? "Enregistrement..." : "Planifier le Sujet"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/**
 * Single Task Card component reused across Agenda and Grouped views
 */
function TaskCard({
  task,
  onSelect,
  onStatusChange,
  getDeliverableIcon,
}: {
  task: TechnicianCalendarTask;
  onSelect: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  getDeliverableIcon: (t: string, d?: string | null) => React.ReactNode;
}) {
  const packBadge = PACK_BADGES[task.project.client.offerType] || PACK_BADGES.CUSTOM;
  const statusConf = TASK_STATUS_CONFIG[task.status];
  const isUrgent = task.priority === "URGENT" || task.priority === "HIGH";

  return (
    <div
      onClick={onSelect}
      className={`p-3.5 rounded-2xl border transition-all shadow-xs flex flex-col justify-between cursor-pointer hover:border-neutral-600 group ${
        isUrgent
          ? "bg-gradient-to-b from-rose-950/20 via-neutral-900 to-neutral-900 border-rose-500/30"
          : task.status === "VALIDATED" || task.status === "COMPLETED"
          ? "bg-gradient-to-b from-emerald-950/20 via-neutral-900 to-neutral-900 border-emerald-500/30"
          : "bg-neutral-900/90 border-neutral-800"
      }`}
    >
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-1.5 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${packBadge.bg} ${packBadge.text} ${packBadge.border}`}
            >
              {packBadge.label}
            </span>
            {task.project.client.status === "IN_PREPARATION" && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                En prép
              </span>
            )}
          </div>

          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${statusConf.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
            <span>{statusConf.label}</span>
          </span>
        </div>

        {/* Client Name */}
        <span className="text-[11px] font-bold text-neutral-400 block truncate">
          {task.project.client.companyName}
        </span>

        {/* Task Title */}
        <div className="flex items-start gap-2 mt-1">
          <div className="mt-0.5">{getDeliverableIcon(task.title, task.description)}</div>
          <h4 className="text-xs font-bold text-neutral-100 group-hover:text-emerald-300 transition line-clamp-2">
            {task.title}
          </h4>
        </div>
      </div>

      {/* Card Footer: Due date + Assignee */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-neutral-800/80 text-[11px] text-neutral-400">
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-neutral-500" />
          <span className={isUrgent ? "text-rose-400 font-bold" : ""}>
            {task.dueDate ? formatDate(task.dueDate) : "Sans échéance"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <User className="w-3.5 h-3.5 text-neutral-500" />
          <span className="truncate max-w-[100px] font-medium text-neutral-300">
            {task.assignee?.name || "Non assigné"}
          </span>
        </div>
      </div>
    </div>
  );
}
