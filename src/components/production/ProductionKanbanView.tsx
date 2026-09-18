"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Kanban,
  Plus,
  Search,
  Filter,
  User,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Sparkles,
  Video,
  Globe,
  Bell,
  Archive,
  RotateCcw,
  Check,
  History,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  STANDARD_TASK_TEMPLATES,
  TASK_PARTS,
  getTaskPart,
} from "@/lib/constants";
import { TaskStatus, TaskPriority } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  createTaskAction,
  updateTaskStatusAction,
  logTaskTimeAction,
  deleteTaskAction,
  updateTaskAction,
  createTaskTemplateAction,
  deleteTaskTemplateAction,
  createBatchTasksAction,
  restoreArchivedTaskAction,
} from "@/actions/production";

interface UserOption {
  id: string;
  name: string;
  role: string;
}

interface ProjectOption {
  id: string;
  name: string;
  code: string;
  client: {
    id: string;
    companyName: string;
  };
}

interface TaskItem {
  id: string;
  projectId: string;
  assigneeId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  timeSpentHours: any;
  createdAt: Date;
  updatedAt: Date;
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
    managerId?: string | null;
    manager?: {
      id: string;
      name: string;
      role: string;
    } | null;
    client: {
      id: string;
      companyName: string;
      brandName: string | null;
    };
  };
}

interface ClientOption {
  id: string;
  companyName: string;
  brandName?: string | null;
}

export interface TaskTemplateItem {
  id: string;
  title: string;
  category: string;
  part: "PART_1" | "PART_2";
  partLabel: string;
  role?: string | null;
  defaultHours: number;
  priority: TaskPriority;
  description?: string | null;
}

interface ProductionKanbanViewProps {
  initialData: {
    kanban: Record<TaskStatus, TaskItem[]>;
    totalTasks: number;
    totalHours: number;
    overdueCount: number;
    archivedTasks?: TaskItem[];
    archivedCount?: number;
    recentValidatedCount?: number;
    allTasks: TaskItem[];
  };
  initialTemplates?: TaskTemplateItem[];
  projects: ProjectOption[];
  clients?: ClientOption[];
  users: UserOption[];
  currentUserId?: string;
  currentUserRole?: string;
  currentUserName?: string;
}

const COLUMNS: { id: TaskStatus; label: string; dot: string }[] = [
  { id: "TODO", label: "À Faire", dot: "bg-neutral-400" },
  { id: "IN_PROGRESS", label: "En Cours", dot: "bg-blue-400" },
  { id: "COMPLETED", label: "Terminé / À Valider", dot: "bg-amber-400" },
  { id: "VALIDATED", label: "Validé Client", dot: "bg-emerald-400" },
];

export function ProductionKanbanView({
  initialData,
  initialTemplates = [],
  projects,
  clients = [],
  users,
  currentUserId,
  currentUserRole,
  currentUserName,
}: ProductionKanbanViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Attach Mode (Par Projet ou Par Client)
  const [attachMode, setAttachMode] = useState<"PROJECT" | "CLIENT">("PROJECT");
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || "");

  // Dynamic Templates & Batch Selection State
  const [templates, setTemplates] = useState<TaskTemplateItem[]>(initialTemplates);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [isManagingTemplates, setIsManagingTemplates] = useState(false);
  const [showAddTemplateForm, setShowAddTemplateForm] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState({
    title: "",
    part: "PART_1" as "PART_1" | "PART_2",
    defaultHours: 2,
    priority: "MEDIUM" as TaskPriority,
    description: "",
  });

  useEffect(() => {
    if (initialTemplates && initialTemplates.length > 0) {
      setTemplates(initialTemplates);
    }
  }, [initialTemplates]);

  const selectedTemplates = templates.filter((t) => selectedTemplateIds.includes(t.id));
  const totalBatchHours = selectedTemplates.reduce((acc, t) => acc + t.defaultHours, 0);

  const toggleTemplateSelection = (templateId: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(templateId) ? prev.filter((id) => id !== templateId) : [...prev, templateId]
    );
  };

  const handleCreateBatchTasks = () => {
    if (selectedTemplateIds.length === 0) return;
    if (attachMode === "PROJECT" && !taskForm.projectId) return;
    if (attachMode === "CLIENT" && !selectedClientId) return;

    startTransition(async () => {
      await createBatchTasksAction({
        projectId: attachMode === "PROJECT" ? taskForm.projectId : undefined,
        clientId: attachMode === "CLIENT" ? (selectedClientId || clients[0]?.id) : undefined,
        templateIds: selectedTemplateIds,
        dueDate: taskForm.dueDate || undefined,
        customAssigneeId: taskForm.assigneeId || undefined,
      });
      setSelectedTemplateIds([]);
      setIsCreateModalOpen(false);
      router.refresh();
    });
  };

  const handleAddNewTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateForm.title.trim()) return;

    startTransition(async () => {
      const res = await createTaskTemplateAction({
        title: newTemplateForm.title,
        part: newTemplateForm.part,
        defaultHours: Number(newTemplateForm.defaultHours) || 2,
        priority: newTemplateForm.priority,
        description: newTemplateForm.description,
      });
      if (res.success && res.template) {
        setTemplates((prev) => [...prev, res.template as any]);
        setNewTemplateForm({
          title: "",
          part: "PART_1",
          defaultHours: 2,
          priority: "MEDIUM",
          description: "",
        });
        setShowAddTemplateForm(false);
      }
      router.refresh();
    });
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Supprimer définitivement ce modèle de tâche ?")) return;

    startTransition(async () => {
      await deleteTaskTemplateAction(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setSelectedTemplateIds((prev) => prev.filter((item) => item !== id));
      router.refresh();
    });
  };

  // View & Filters
  const [mainView, setMainView] = useState<"KANBAN" | "ARCHIVE">("KANBAN");
  const [includeArchivedInColumn, setIncludeArchivedInColumn] = useState(false);
  const [restoringTaskId, setRestoringTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [selectedPart, setSelectedPart] = useState<string>("ALL");
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Forms
  const [targetColumn, setTargetColumn] = useState<TaskStatus>("TODO");
  const [taskForm, setTaskForm] = useState({
    projectId: projects[0]?.id || "",
    assigneeId: users[0]?.id || "",
    title: "",
    description: "",
    priority: "MEDIUM" as TaskPriority,
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    timeSpentHours: 0,
  });

  const [timeForm, setTimeForm] = useState({ hours: 1 });

  // Identification précise des tâches de l'utilisateur
  const isMyTask = (t: TaskItem) => {
    if (!currentUserId) return false;
    // 1. Directement assignée à l'utilisateur
    if (t.assigneeId === currentUserId) return true;
    // 2. Utilisateur est chef du projet auquel appartient la tâche
    if (t.project?.managerId === currentUserId) return true;
    // 3. Rôle Direction (ADMIN ou SALES_DIRECTOR) : tâches Direction
    if (currentUserRole === "ADMIN" || currentUserRole === "SALES_DIRECTOR") {
      if (t.assignee?.role === "ADMIN" || t.assignee?.role === "SALES_DIRECTOR") return true;
    }
    return false;
  };

  const myTasksCount = initialData.allTasks.filter(isMyTask).length;
  const unassignedCount = initialData.allTasks.filter((t) => !t.assigneeId).length;

  // Filter tasks
  const filterTask = (t: TaskItem) => {
    // Filtre "Mes Tâches Uniquement"
    if (onlyMyTasks && !isMyTask(t)) return false;

    // Filtre Membre assigné
    if (selectedAssigneeId === "UNASSIGNED") {
      if (t.assigneeId !== null && t.assigneeId !== undefined) return false;
    } else if (selectedAssigneeId !== "ALL" && t.assigneeId !== selectedAssigneeId) {
      return false;
    }

    // Filtre Priorité
    if (selectedPriority !== "ALL" && t.priority !== selectedPriority) return false;

    // Filtre Partie (Partie 1 Audiovisuel vs Partie 2 Web)
    if (selectedPart !== "ALL" && getTaskPart(t) !== selectedPart) return false;

    // Recherche texte
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = (t.description || "").toLowerCase().includes(q);
      const matchProj = t.project.name.toLowerCase().includes(q);
      const matchClient = t.project.client.companyName.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchProj && !matchClient) return false;
    }
    return true;
  };

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Tâches archivées dans l'historique (+1 jour après validation client)
  const rawArchivedTasks = initialData.archivedTasks || initialData.allTasks.filter((t) => {
    if (t.status !== "VALIDATED") return false;
    return (now - new Date(t.updatedAt).getTime()) >= ONE_DAY_MS;
  });

  const archivedTasks = rawArchivedTasks.filter(filterTask);

  // Tâches récemment validées (< 1 jour)
  const recentValidated = initialData.kanban.VALIDATED.filter(filterTask);

  const displayedValidated = includeArchivedInColumn
    ? [...recentValidated, ...archivedTasks]
    : recentValidated;

  const kanbanData: Record<TaskStatus, TaskItem[]> = {
    TODO: initialData.kanban.TODO.filter(filterTask),
    IN_PROGRESS: initialData.kanban.IN_PROGRESS.filter(filterTask),
    COMPLETED: initialData.kanban.COMPLETED.filter(filterTask),
    VALIDATED: displayedValidated,
  };

  const filteredTotal =
    kanbanData.TODO.length +
    kanbanData.IN_PROGRESS.length +
    kanbanData.COMPLETED.length +
    displayedValidated.length;

  const handleRestoreTask = (taskId: string, targetStatus: TaskStatus = "IN_PROGRESS") => {
    setRestoringTaskId(taskId);
    startTransition(async () => {
      await restoreArchivedTaskAction(taskId, targetStatus);
      setRestoringTaskId(null);
      router.refresh();
    });
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    startTransition(async () => {
      await updateTaskStatusAction(taskId, newStatus);
      router.refresh();
    });
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    if (attachMode === "PROJECT" && !taskForm.projectId) return;
    if (attachMode === "CLIENT" && !selectedClientId) return;

    startTransition(async () => {
      await createTaskAction({
        projectId: attachMode === "PROJECT" ? taskForm.projectId : undefined,
        clientId: attachMode === "CLIENT" ? (selectedClientId || clients[0]?.id) : undefined,
        title: taskForm.title,
        description: taskForm.description,
        assigneeId: taskForm.assigneeId || undefined,
        status: targetColumn,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || undefined,
        timeSpentHours: Number(taskForm.timeSpentHours) || 0,
      });
      setIsCreateModalOpen(false);
      setTaskForm({
        projectId: projects[0]?.id || "",
        assigneeId: users[0]?.id || "",
        title: "",
        description: "",
        priority: "MEDIUM",
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        timeSpentHours: 0,
      });
      router.refresh();
    });
  };

  const handleLogTime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return;

    startTransition(async () => {
      await logTaskTimeAction(selectedTaskId, Number(timeForm.hours) || 0);
      setIsTimeModalOpen(false);
      setSelectedTaskId(null);
      router.refresh();
    });
  };

  const handleDeleteTask = (taskId: string) => {
    if (!confirm("Voulez-vous supprimer cette tâche ?")) return;
    startTransition(async () => {
      await deleteTaskAction(taskId);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Kanban className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
              Production Technique & Tâches
            </h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Tableau Kanban des monteurs vidéo, graphistes, rédacteurs et développeurs.
          </p>
        </div>

        <Button
          onClick={() => {
            setTargetColumn("TODO");
            setIsCreateModalOpen(true);
          }}
          className="gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Tâche</span>
        </Button>
      </div>

      {/* Top View Selector: Kanban vs Historique */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 pb-3">
        <button
          type="button"
          onClick={() => setMainView("KANBAN")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            mainView === "KANBAN"
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border border-neutral-800"
          }`}
        >
          <Kanban className="w-4 h-4" />
          <span>Tableau Kanban Actif</span>
        </button>

        <button
          type="button"
          onClick={() => setMainView("ARCHIVE")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            mainView === "ARCHIVE"
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border border-neutral-800"
          }`}
        >
          <Archive className="w-4 h-4 text-emerald-400" />
          <span>Historique des Tâches Validées (+1 Jour)</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-extrabold ${
              mainView === "ARCHIVE"
                ? "bg-white/20 text-white"
                : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
            }`}
          >
            {archivedTasks.length}
          </span>
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80">
          <span className="text-[11px] font-medium text-neutral-400">Tâches Totales</span>
          <p className="text-2xl font-extrabold text-neutral-100 mt-0.5">
            {initialData.totalTasks}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80">
          <span className="text-[11px] font-medium text-blue-400 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Heures Passées
          </span>
          <p className="text-2xl font-extrabold text-blue-300 mt-0.5">
            {initialData.totalHours}h
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80">
          <span className="text-[11px] font-medium text-amber-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            En Cours
          </span>
          <p className="text-2xl font-extrabold text-amber-300 mt-0.5">
            {initialData.kanban.IN_PROGRESS.length}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80">
          <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Validé Client (&lt; 24h)
          </span>
          <p className="text-2xl font-extrabold text-emerald-300 mt-0.5">
            {recentValidated.length}
          </p>
        </div>

        <div
          onClick={() => setMainView("ARCHIVE")}
          className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 cursor-pointer hover:border-emerald-500/40 transition-colors group"
          title="Cliquer pour voir l'historique des tâches validées de plus de 24h"
        >
          <span className="text-[11px] font-medium text-purple-400 flex items-center gap-1.5">
            <Archive className="w-3 h-3 text-purple-400 group-hover:text-emerald-400 transition-colors" />
            Historique (+1j)
          </span>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-2xl font-extrabold text-purple-300 group-hover:text-emerald-300 transition-colors">
              {archivedTasks.length}
            </p>
            <span className="text-[10px] text-purple-400/80 group-hover:text-emerald-400 font-semibold group-hover:underline">
              Ouvrir →
            </span>
          </div>
        </div>
      </div>

      {/* VUE 1 : TABLEAU KANBAN ACTIF */}
      {mainView === "KANBAN" && (
        <>
          {/* Filters Bar */}
          <div className="p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Filtrer les tâches, projets, clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Assignee Filter */}
          <select
            value={selectedAssigneeId}
            onChange={(e) => {
              setSelectedAssigneeId(e.target.value);
              if (e.target.value !== "ALL") {
                setOnlyMyTasks(false);
              }
            }}
            className="h-8 px-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL" className="bg-neutral-900 text-neutral-200">Tous les membres</option>
            {unassignedCount > 0 && (
              <option value="UNASSIGNED" className="bg-neutral-900 text-neutral-200">Non assignées ({unassignedCount})</option>
            )}
            {users.map((u) => (
              <option key={u.id} value={u.id} className="bg-neutral-900 text-neutral-200">
                {u.name}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="h-8 px-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL" className="bg-neutral-900 text-neutral-200">Toutes priorités</option>
            {Object.entries(TASK_PRIORITIES).map(([k, v]) => (
              <option key={k} value={k} className="bg-neutral-900 text-neutral-200">
                {v.label}
              </option>
            ))}
          </select>

          {/* Part Filter */}
          <select
            value={selectedPart}
            onChange={(e) => setSelectedPart(e.target.value)}
            className="h-8 px-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL" className="bg-neutral-900 text-neutral-200">Toutes les parties</option>
            <option value="PART_1" className="bg-neutral-900 text-neutral-200">Partie 1 : Audiovisuel & Social</option>
            <option value="PART_2" className="bg-neutral-900 text-neutral-200">Partie 2 : Web & Extra</option>
          </select>
        </div>

        {/* Quick Toggle: Only My Tasks */}
        {currentUserId && (
          <button
            type="button"
            onClick={() => {
              const next = !onlyMyTasks;
              setOnlyMyTasks(next);
              if (next) {
                setSelectedAssigneeId("ALL");
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              onlyMyTasks
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 ring-1 ring-white/20"
                : "bg-neutral-950 text-neutral-300 hover:text-white hover:bg-neutral-900 border border-neutral-800"
            }`}
            title="Afficher uniquement les tâches qui me sont assignées ou associées à mes projets"
          >
            <User className="w-3.5 h-3.5" />
            <span>Mes Tâches Uniquement</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                onlyMyTasks
                  ? "bg-white/25 text-white"
                  : "bg-neutral-800 text-neutral-400"
              }`}
            >
              {myTasksCount}
            </span>
          </button>
        )}
      </div>

      {/* Active "Mes Tâches" Banner */}
      {onlyMyTasks && (
        <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-950/40 via-neutral-900 to-neutral-900 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-xs">
          <div className="flex items-center gap-2.5 text-blue-300">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div>
              <span className="font-bold text-neutral-100">Filtre actif : Mes Tâches</span>
              <span className="text-neutral-400 ml-1.5">
                ({filteredTotal} tâche{filteredTotal > 1 ? "s" : ""} trouvée{filteredTotal > 1 ? "s" : ""}
                {currentUserName ? ` pour ${currentUserName}` : ""})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOnlyMyTasks(false)}
            className="text-xs text-blue-400 hover:text-blue-300 font-bold underline underline-offset-4 cursor-pointer shrink-0"
          >
            ← Afficher toutes les tâches ({initialData.totalTasks})
          </button>
        </div>
      )}

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {COLUMNS.map((col) => {
          const tasksInCol = kanbanData[col.id] || [];
          const colConfig = TASK_STATUSES[col.id];

          return (
            <div
              key={col.id}
              className="rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex flex-col max-h-[calc(100vh-280px)] overflow-hidden shadow-sm"
            >
              {/* Column Header */}
              <div
                className={`p-3 border-b border-neutral-800 flex items-center justify-between ${colConfig.headerBg}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                  <span className="text-xs font-bold text-neutral-200">{col.label}</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-300">
                    {tasksInCol.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTargetColumn(col.id);
                    setIsCreateModalOpen(true);
                  }}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
                  title={`Ajouter dans "${col.label}"`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tasks List inside Column */}
              <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1 min-h-[150px] scrollbar-thin scrollbar-thumb-neutral-800">
                {tasksInCol.length === 0 ? (
                  <div className="py-8 text-center text-[11px] text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
                    Aucune tâche
                  </div>
                ) : (
                  tasksInCol.map((task) => {
                    const priorityConfig =
                      TASK_PRIORITIES[task.priority as TaskPriority] || TASK_PRIORITIES.MEDIUM;
                    const isOverdue =
                      task.dueDate &&
                      new Date(task.dueDate) < new Date() &&
                      task.status !== "COMPLETED" &&
                      task.status !== "VALIDATED";

                    return (
                      <div
                        key={task.id}
                        className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/90 hover:border-neutral-700 shadow-sm space-y-2.5 transition-all group"
                      >
                        {/* Project & Priority Badges */}
                        <div className="flex items-center justify-between gap-1">
                          <Link
                            href={`/projets/${task.projectId}`}
                            className="font-mono text-[10px] font-bold text-blue-400 hover:underline truncate max-w-[140px]"
                            title={`Projet : ${task.project.name}`}
                          >
                            {task.project.code}
                          </Link>

                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${priorityConfig.color}`}
                          >
                            {priorityConfig.label}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h4 className="text-xs font-bold text-neutral-100 leading-snug">
                            {task.title}
                          </h4>
                          <span className="text-[10px] text-neutral-400 block truncate mt-0.5">
                            {task.project.client.companyName}
                          </span>
                          {task.description && (
                            <p className="text-[11px] text-neutral-400/80 line-clamp-2 mt-1">
                              {task.description}
                            </p>
                          )}
                        </div>

                        {/* Assignee & Dates & Hours */}
                        <div className="pt-2 border-t border-neutral-850 flex items-center justify-between text-[10px] text-neutral-400">
                          <span className="flex items-center gap-1 truncate max-w-[110px]">
                            <User className="w-3 h-3 text-neutral-500 shrink-0" />
                            <span className="truncate">
                              {task.assignee ? task.assignee.name.split(" ")[0] : "Libre"}
                            </span>
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTaskId(task.id);
                              setIsTimeModalOpen(true);
                            }}
                            className="flex items-center gap-1 text-blue-400 hover:underline cursor-pointer font-medium"
                            title="Cliquer pour ajouter du temps"
                          >
                            <Clock className="w-3 h-3" />
                            <span>{Number(task.timeSpentHours || 0)}h</span>
                          </button>

                          {task.dueDate && (
                            <span
                              className={`flex items-center gap-0.5 ${
                                isOverdue ? "text-rose-400 font-bold" : "text-neutral-500"
                              }`}
                              title={`Échéance : ${formatDate(task.dueDate)}`}
                            >
                              {isOverdue && <AlertCircle className="w-2.5 h-2.5 shrink-0" />}
                              <span>{formatDate(task.dueDate)}</span>
                            </span>
                          )}
                        </div>

                        {/* Notice d'archivage automatique pour les tâches Validées */}
                        {task.status === "VALIDATED" && (
                          <div className="pt-2 border-t border-neutral-900 flex items-center justify-between text-[10px]">
                            {(() => {
                              const hoursAgo = Math.max(0, Math.floor((now - new Date(task.updatedAt).getTime()) / (1000 * 60 * 60)));
                              const isOlder = hoursAgo >= 24;
                              if (isOlder) {
                                const daysAgo = Math.max(1, Math.floor(hoursAgo / 24));
                                return (
                                  <span className="px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-400 border border-neutral-800 flex items-center gap-1 font-mono text-[9px]">
                                    <Archive className="w-3 h-3 text-neutral-500" />
                                    <span>Historique (+{daysAgo}j)</span>
                                  </span>
                                );
                              } else {
                                const hoursLeft = Math.max(0, 24 - hoursAgo);
                                return (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 font-mono text-[9px]" title="Sera automatiquement déplacée dans l'historique après 24h">
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>Validé ({hoursAgo}h) • Archivage auto dans {hoursLeft}h</span>
                                  </span>
                                );
                              }
                            })()}
                          </div>
                        )}

                        {/* Quick Action Transitions */}
                        <div className="pt-1.5 border-t border-neutral-900 flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1">
                            {col.id !== "TODO" && (
                              <button
                                type="button"
                                onClick={() => {
                                  const prevMap: Record<TaskStatus, TaskStatus> = {
                                    IN_PROGRESS: "TODO",
                                    COMPLETED: "IN_PROGRESS",
                                    VALIDATED: "COMPLETED",
                                    TODO: "TODO",
                                  };
                                  handleStatusChange(task.id, prevMap[col.id]);
                                }}
                                className="p-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                                title="Déplacer à l'étape précédente"
                              >
                                <ChevronLeft className="w-3 h-3" />
                              </button>
                            )}

                            {col.id !== "VALIDATED" && (
                              <button
                                type="button"
                                onClick={() => {
                                  const nextMap: Record<TaskStatus, TaskStatus> = {
                                    TODO: "IN_PROGRESS",
                                    IN_PROGRESS: "COMPLETED",
                                    COMPLETED: "VALIDATED",
                                    VALIDATED: "VALIDATED",
                                  };
                                  handleStatusChange(task.id, nextMap[col.id]);
                                }}
                                className="p-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                                title="Avancer à l'étape suivante"
                              >
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1 text-neutral-600 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Supprimer la tâche"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer spécial pour la colonne VALIDATED */}
              {col.id === "VALIDATED" && (
                <div className="p-3 bg-neutral-950/95 border-t border-neutral-800 rounded-b-2xl flex flex-col gap-2 shrink-0">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400 flex items-center gap-1.5 font-medium">
                      <Archive className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{archivedTasks.length} dans l'historique (+1j)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setMainView("ARCHIVE")}
                      className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
                    >
                      Ouvrir →
                    </button>
                  </div>
                  {archivedTasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIncludeArchivedInColumn(!includeArchivedInColumn)}
                      className="text-[10px] text-neutral-400 hover:text-neutral-200 text-left hover:underline cursor-pointer"
                    >
                      {includeArchivedInColumn
                        ? "← Masquer les tâches archivées (+1j)"
                        : "+ Afficher aussi l'historique dans cette colonne"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
        </>
      )}

      {/* VUE 2 : HISTORIQUE DES TÂCHES VALIDÉES (+1 JOUR) */}
      {mainView === "ARCHIVE" && (
        <div className="space-y-4">
          {/* En-tête de l'Historique */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-neutral-900 to-neutral-900 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-neutral-100">
                    Historique des Tâches Validées Client (+1 Jour)
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                    Archivage Automatique
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Règle : Les tâches validées restent 24h sur le tableau Kanban, puis sont automatiquement déplacées ici pour conserver un espace de travail clair.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMainView("KANBAN")}
                className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Retour au Tableau Kanban</span>
              </button>
            </div>
          </div>

          {/* Filters Bar dans l'historique */}
          <div className="p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Rechercher dans l'historique (tâche, projet, client)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <select
                value={selectedAssigneeId}
                onChange={(e) => setSelectedAssigneeId(e.target.value)}
                className="h-8 px-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">Tous les membres</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="h-8 px-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">Toutes priorités</option>
                {Object.entries(TASK_PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-neutral-400 font-mono">
              <span className="font-bold text-neutral-200">{archivedTasks.length}</span> tâche(s) archivée(s)
            </div>
          </div>

          {/* Tableau des Tâches Archivées */}
          {archivedTasks.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                <Archive className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-neutral-300">Aucune tâche archivée pour l'instant</h4>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                Dès qu'une tâche validée par le client dépasse 24 heures (1 jour), elle sera automatiquement classée ici dans l'historique sans action manuelle.
              </p>
              <button
                type="button"
                onClick={() => setMainView("KANBAN")}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                ← Revenir au tableau Kanban
              </button>
            </div>
          ) : (
            <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950/70 border-b border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Projet & Client</th>
                      <th className="px-4 py-3">Tâche Validée</th>
                      <th className="px-4 py-3">Assigné</th>
                      <th className="px-4 py-3 text-center">Temps</th>
                      <th className="px-4 py-3">Validé le (+1j)</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {archivedTasks.map((task) => {
                      const hoursAgo = Math.max(0, Math.floor((now - new Date(task.updatedAt).getTime()) / (1000 * 60 * 60)));
                      const daysAgo = Math.max(1, Math.floor(hoursAgo / 24));
                      const isRestoring = restoringTaskId === task.id;

                      return (
                        <tr key={task.id} className="hover:bg-neutral-800/30 transition-colors">
                          <td className="px-4 py-3.5">
                            <Link
                              href={`/projets/${task.projectId}`}
                              className="font-mono text-xs font-bold text-blue-400 hover:underline block"
                            >
                              {task.project.code}
                            </Link>
                            <span className="text-[11px] text-neutral-200 font-semibold block">
                              {task.project.name}
                            </span>
                            <span className="text-[10px] text-neutral-400">
                              {task.project.client.companyName}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 max-w-md">
                            <div className="font-bold text-neutral-100">{task.title}</div>
                            {task.description && (
                              <p className="text-[11px] text-neutral-400 line-clamp-2 mt-0.5">
                                {task.description}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-neutral-300 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                              <span>{task.assignee ? task.assignee.name : "Non assigné"}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-center font-mono font-bold text-blue-400 whitespace-nowrap">
                            {Number(task.timeSpentHours || 0)}h
                          </td>

                          <td className="px-4 py-3.5 text-neutral-400 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-neutral-300 font-medium">{formatDate(task.updatedAt)}</span>
                              <span className="text-[10px] text-emerald-400 font-mono">
                                il y a {daysAgo} jour{daysAgo > 1 ? "s" : ""}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRestoreTask(task.id, "IN_PROGRESS")}
                                disabled={isRestoring}
                                className="gap-1 text-[11px] border-neutral-700 hover:bg-neutral-800 text-neutral-200 cursor-pointer h-7"
                                title="Rétablir cette tâche dans le tableau Kanban (En Cours)"
                              >
                                <RotateCcw className={`w-3 h-3 text-blue-400 ${isRestoring ? "animate-spin" : ""}`} />
                                <span>{isRestoring ? "Restauration..." : "Restaurer dans Kanban"}</span>
                              </Button>

                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-1.5 text-neutral-500 hover:text-rose-400 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                                title="Supprimer la tâche"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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

      {/* Modal: Create Task */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Créer une Tâche de Production"
        description="Assignez la tâche à un membre et définissez le projet et la deadline."
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          {/* 1. Rattachement de la tâche & Échéance */}
          <div className="space-y-2.5 p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 shadow-2xs">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-300">
                Rattachement de la tâche *
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-950 border border-neutral-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAttachMode("PROJECT")}
                  className={`flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    attachMode === "PROJECT"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Par Projet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAttachMode("CLIENT")}
                  className={`flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    attachMode === "CLIENT"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Par Client</span>
                </button>
              </div>

              {attachMode === "PROJECT" ? (
                <div className="space-y-1">
                  <select
                    value={taskForm.projectId}
                    onChange={(e) => setTaskForm({ ...taskForm, projectId: e.target.value })}
                    className="w-full h-9 px-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    required
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id} className="bg-neutral-900 text-neutral-200">
                        {p.code} — {p.name} ({p.client.companyName})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-neutral-400">
                    Les tâches seront intégrées dans le tableau de bord du projet sélectionné.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <select
                    value={selectedClientId || (clients[0]?.id || "")}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    required
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id} className="bg-neutral-900 text-neutral-200">
                        {c.companyName} {c.brandName ? `(${c.brandName})` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-neutral-400">
                    Les tâches seront rattachées directement au dossier client.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-1 flex items-center justify-between gap-3 border-t border-neutral-800">
              <label className="text-xs font-semibold text-neutral-300 shrink-0">
                Date d'échéance :
              </label>
              <Input
                type="date"
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                className="h-8 text-xs max-w-44"
              />
            </div>
          </div>

          {/* 2. Modèles de Tâches Dynamiques & Sélection Multiple */}
          <div className="space-y-3 p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 shadow-2xs">
            {/* Header de la section modèles */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Modèles de Tâches</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 font-bold border border-blue-500/30">
                  Sélection 1-Clic
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddTemplateForm(!showAddTemplateForm)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-blue-400 hover:bg-blue-500/10 rounded-lg border border-blue-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span className="hidden sm:inline">Nouveau modèle</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsManagingTemplates(!isManagingTemplates)}
                  className={`p-1 text-[11px] rounded-lg border transition-colors cursor-pointer ${
                    isManagingTemplates
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      : "text-neutral-400 hover:text-neutral-200 border-neutral-800"
                  }`}
                  title={isManagingTemplates ? "Quitter le mode gestion" : "Gérer / Supprimer des modèles"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Formulaire Inline d'ajout de nouveau modèle */}
            {showAddTemplateForm && (
              <div className="p-3 bg-neutral-900 rounded-xl border border-blue-500/30 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-100">
                    Ajouter un modèle de tâche personnalisé
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddTemplateForm(false)}
                    className="text-xs text-neutral-400 hover:text-neutral-200 cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-neutral-400 font-medium">Titre du modèle *</label>
                    <Input
                      placeholder="Ex: Animation Motion Design 2D"
                      value={newTemplateForm.title}
                      onChange={(e) => setNewTemplateForm({ ...newTemplateForm, title: e.target.value })}
                      className="h-8 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 font-medium">Section</label>
                    <select
                      value={newTemplateForm.part}
                      onChange={(e) => setNewTemplateForm({ ...newTemplateForm, part: e.target.value as any })}
                      className="w-full h-8 px-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 cursor-pointer"
                    >
                      <option value="PART_1" className="bg-neutral-900 text-neutral-200">Partie 1 : Sur site & Voix-Off</option>
                      <option value="PART_2" className="bg-neutral-900 text-neutral-200">Partie 2 : Montage, Web & Extras</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-neutral-400 font-medium">Heures estimées</label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={newTemplateForm.defaultHours}
                      onChange={(e) => setNewTemplateForm({ ...newTemplateForm, defaultHours: parseFloat(e.target.value) || 1 })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 font-medium">Priorité</label>
                    <select
                      value={newTemplateForm.priority}
                      onChange={(e) => setNewTemplateForm({ ...newTemplateForm, priority: e.target.value as any })}
                      className="w-full h-8 px-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 cursor-pointer"
                    >
                      {Object.entries(TASK_PRIORITIES).map(([k, v]) => (
                        <option key={k} value={k} className="bg-neutral-900 text-neutral-200">{v.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-neutral-400 font-medium">Description (optionnelle)</label>
                  <Input
                    placeholder="Instructions, brief, livrable..."
                    value={newTemplateForm.description}
                    onChange={(e) => setNewTemplateForm({ ...newTemplateForm, description: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddTemplateForm(false)}
                    className="h-7 text-xs px-2.5"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    onClick={handleAddNewTemplate}
                    disabled={isPending || !newTemplateForm.title.trim()}
                    className="h-7 text-xs px-3 bg-blue-600 text-white"
                  >
                    Enregistrer le modèle
                  </Button>
                </div>
              </div>
            )}

            {/* Partie 1 : Modèles sur site & Voix-Off */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-blue-400 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5" />
                    <span>Partie 1 : Modèles sur site & Voix-Off</span>
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {templates.filter((t) => t.part === "PART_1").length} modèles
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {templates.filter((t) => t.part === "PART_1").map((tpl) => {
                  const isSelected = selectedTemplateIds.includes(tpl.id);
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => {
                        toggleTemplateSelection(tpl.id);
                        setTaskForm({
                          ...taskForm,
                          title: tpl.title,
                          description: tpl.description || "",
                          priority: tpl.priority as TaskPriority,
                          timeSpentHours: tpl.defaultHours,
                        });
                      }}
                      className={`text-left px-2.5 py-1.5 rounded-lg border text-[11px] transition-all cursor-pointer flex items-center justify-between gap-1 group shadow-2xs ${
                        isSelected
                          ? "bg-blue-500/20 border-blue-500 text-blue-200 font-semibold ring-1 ring-blue-500/40"
                          : "bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] border transition-colors ${
                          isSelected ? "bg-blue-600 text-white border-blue-600 font-bold" : "border-neutral-700 bg-neutral-800 text-neutral-400"
                        }`}>
                          {isSelected ? "✓" : "+"}
                        </span>
                        <span className="truncate">
                          {tpl.title.split("(")[0].trim()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {tpl.defaultHours}h
                        </span>
                        {isManagingTemplates && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                            className="p-0.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded"
                            title="Supprimer ce modèle"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Partie 2 : Modèles Montage, Web, Marketing & Additionnels */}
            <div className="space-y-1.5 pt-2.5 border-t border-neutral-800">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-purple-400 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Partie 2 : Modèles Montage, Web & Extras</span>
                  </span>
                </div>
                <span className="text-[10px] text-purple-400/80 font-mono">
                  {templates.filter((t) => t.part === "PART_2").length} modèles
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {templates.filter((t) => t.part === "PART_2").map((tpl) => {
                  const isSelected = selectedTemplateIds.includes(tpl.id);
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => {
                        toggleTemplateSelection(tpl.id);
                        setTaskForm({
                          ...taskForm,
                          title: tpl.title,
                          description: tpl.description || "",
                          priority: tpl.priority as TaskPriority,
                          timeSpentHours: tpl.defaultHours,
                        });
                      }}
                      className={`text-left px-2.5 py-1.5 rounded-lg border text-[11px] transition-all cursor-pointer flex items-center justify-between gap-1 group shadow-2xs ${
                        isSelected
                          ? "bg-purple-500/20 border-purple-500 text-purple-200 font-semibold ring-1 ring-purple-500/40"
                          : "bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] border transition-colors ${
                          isSelected ? "bg-purple-600 text-white border-purple-600 font-bold" : "border-neutral-700 bg-neutral-800 text-neutral-400"
                        }`}>
                          {isSelected ? "✓" : "+"}
                        </span>
                        <span className="truncate">
                          {tpl.title.split("(")[0].trim()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {tpl.defaultHours}h
                        </span>
                        {isManagingTemplates && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                            className="p-0.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded"
                            title="Supprimer ce modèle"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bandeau d'action groupée si au moins une tâche est cochée */}
            {selectedTemplateIds.length > 0 && (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-500/15 via-indigo-500/15 to-blue-500/15 border border-blue-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200 shadow-md">
                <div>
                  <p className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>{selectedTemplateIds.length} tâche{selectedTemplateIds.length > 1 ? "s" : ""} cochée{selectedTemplateIds.length > 1 ? "s" : ""} pour création groupée</span>
                  </p>
                  <p className="text-[11px] text-neutral-300 mt-0.5">
                    Durée totale cumulée : <span className="font-mono font-bold text-blue-300">{totalBatchHours}h</span> • Notifications automatiques incluses
                  </p>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedTemplateIds([])}
                    className="text-xs text-neutral-400 hover:text-neutral-200 px-2 py-1 cursor-pointer transition-colors"
                  >
                    Désélectionner
                  </button>
                  <Button
                    type="button"
                    onClick={handleCreateBatchTasks}
                    disabled={isPending}
                    className="shrink-0 h-8 text-xs px-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-nowrap">{isPending ? "Création..." : `Créer les ${selectedTemplateIds.length} tâches en 1 clic`}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 3. Séparateur & Création / Personnalisation d'une tâche unique */}
          <div className="pt-2 border-t border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-200">
                Ou personnaliser une tâche unique
              </span>
              <span className="text-[10px] text-neutral-400">
                Formulaire individuel
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Titre de la tâche *</label>
              <Input
                placeholder="Ex: Shooting Photo / Vidéo sur place"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-300">Assigné à</label>
                  <span className="text-[10px] text-blue-400 font-semibold flex items-center gap-1">
                    <Bell className="w-3 h-3" />
                    Sera notifié(e)
                  </span>
                </div>
                <select
                  value={taskForm.assigneeId}
                  onChange={(e) => setTaskForm({ ...taskForm, assigneeId: e.target.value })}
                  className="w-full h-9 px-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="" className="bg-neutral-900 text-neutral-400">-- Non assigné (aucune notification) --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id} className="bg-neutral-900 text-neutral-200">
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
                {taskForm.assigneeId ? (
                  <p className="text-[11px] text-blue-300 bg-blue-500/10 border border-blue-500/30 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                    <Bell className="w-3 h-3 text-blue-400 shrink-0" />
                    <span>
                      <strong>{users.find((u) => u.id === taskForm.assigneeId)?.name}</strong> recevra une notification automatique lors de la création de la tâche.
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] text-neutral-500 italic px-1">
                    Aucune notification ne sera envoyée tant qu'aucun membre n'est assigné.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Priorité</label>
                <select
                  value={taskForm.priority}
                  onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as TaskPriority })}
                  className="w-full h-9 px-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {Object.entries(TASK_PRIORITIES).map(([k, v]) => (
                    <option key={k} value={k} className="bg-neutral-900 text-neutral-200">
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Temps estimé (Heures)</label>
              <Input
                type="number"
                step="0.5"
                value={taskForm.timeSpentHours}
                onChange={(e) => setTaskForm({ ...taskForm, timeSpentHours: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Description & Spécifications</label>
              <textarea
                rows={2}
                placeholder="Instructions de production, dimensions, brief..."
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                className="w-full p-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" size="sm" disabled={isPending || !taskForm.title.trim()}>
                {isPending ? "Création..." : "Créer la tâche unitaire"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal: Log Time */}
      <Modal
        isOpen={isTimeModalOpen}
        onClose={() => {
          setIsTimeModalOpen(false);
          setSelectedTaskId(null);
        }}
        title="Ajouter du Temps Passé sur la Tâche"
      >
        <form onSubmit={handleLogTime} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              Heures travaillées à ajouter
            </label>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              value={timeForm.hours}
              onChange={(e) => setTimeForm({ hours: Number(e.target.value) })}
              required
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsTimeModalOpen(false);
                setSelectedTaskId(null);
              }}
            >
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Enregistrement..." : "Ajouter les Heures"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
