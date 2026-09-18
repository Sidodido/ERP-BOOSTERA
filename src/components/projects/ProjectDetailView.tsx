"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  Trash2,
  FileText,
  User,
  AlertCircle,
  TrendingUp,
  Download,
  ExternalLink,
  Layers,
  ChevronRight,
  Sparkles,
  Receipt,
  Edit2,
  Check,
  Video,
  Globe,
  Film,
  Bell,
  Archive,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime, formatBytes } from "@/lib/utils";
import {
  PROJECT_STATUSES,
  TASK_STATUSES,
  TASK_PRIORITIES,
  STANDARD_TASK_TEMPLATES,
  TASK_PARTS,
  getTaskPart,
} from "@/lib/constants";
import { ProjectStatus, TaskStatus, TaskPriority, OfferType } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  updateProjectStatusAction,
  updateProjectAction,
  deleteProjectAction,
  addProjectCostAction,
  deleteProjectCostAction,
} from "@/actions/projects";
import {
  createTaskAction,
  updateTaskStatusAction,
  logTaskTimeAction,
  deleteTaskAction,
} from "@/actions/production";
import { uploadDocumentAction, deleteDocumentAction } from "@/actions/documents";
import { WEEKLY_QUOTAS_BY_OFFER } from "@/lib/aiContentGenerator";

interface UserOption {
  id: string;
  name: string;
  role: string;
}

interface ProjectDetailViewProps {
  project: any;
  users: UserOption[];
}

export function ProjectDetailView({ project, users }: ProjectDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"tasks" | "costs" | "documents" | "invoices">("tasks");
  const [taskPartFilter, setTaskPartFilter] = useState<"ALL" | "PART_1" | "PART_2">("ALL");

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLogTimeModalOpen, setIsLogTimeModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Forms state
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assigneeId: users[0]?.id || "",
    priority: "MEDIUM" as TaskPriority,
    dueDate: project.deadline ? new Date(project.deadline).toISOString().split("T")[0] : "",
    timeSpentHours: 0,
  });

  const [costForm, setCostForm] = useState({
    costType: "FREELANCER",
    amount: 10000,
    description: "",
    date: new Date().toISOString().split("T")[0],
  });

  const [docForm, setDocForm] = useState({
    name: "",
    fileUrl: "",
    fileType: "PDF",
    category: "BRIEF",
  });

  const [timeForm, setTimeForm] = useState({
    hours: 1,
  });

  const [editForm, setEditForm] = useState({
    name: project.name,
    description: project.description || "",
    managerId: project.managerId || "",
    startDate: project.startDate ? new Date(project.startDate).toISOString().split("T")[0] : "",
    deadline: project.deadline ? new Date(project.deadline).toISOString().split("T")[0] : "",
    budget: project.budget,
  });

  const statusConfig = PROJECT_STATUSES[project.status as ProjectStatus] || PROJECT_STATUSES.NEW_REQUEST;
  const isOverdue =
    project.deadline &&
    new Date(project.deadline) < new Date() &&
    project.status !== "COMPLETED" &&
    project.status !== "CANCELLED";

  // Quick Status Transition
  const handleStatusChange = (newStatus: ProjectStatus) => {
    startTransition(async () => {
      await updateProjectStatusAction(project.id, newStatus);
      router.refresh();
    });
  };

  // Create Task
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;

    startTransition(async () => {
      await createTaskAction({
        projectId: project.id,
        title: taskForm.title,
        description: taskForm.description,
        assigneeId: taskForm.assigneeId || undefined,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || undefined,
        timeSpentHours: Number(taskForm.timeSpentHours) || 0,
      });
      setIsTaskModalOpen(false);
      setTaskForm({
        title: "",
        description: "",
        assigneeId: users[0]?.id || "",
        priority: "MEDIUM",
        dueDate: project.deadline ? new Date(project.deadline).toISOString().split("T")[0] : "",
        timeSpentHours: 0,
      });
      router.refresh();
    });
  };

  // Add Cost
  const handleAddCost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!costForm.description.trim()) return;

    startTransition(async () => {
      await addProjectCostAction({
        projectId: project.id,
        costType: costForm.costType,
        amount: Number(costForm.amount) || 0,
        description: costForm.description,
        date: costForm.date,
      });
      setIsCostModalOpen(false);
      setCostForm({
        costType: "FREELANCER",
        amount: 10000,
        description: "",
        date: new Date().toISOString().split("T")[0],
      });
      router.refresh();
    });
  };

  // Add Document
  const handleAddDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.name.trim() || !docForm.fileUrl.trim()) return;

    startTransition(async () => {
      await uploadDocumentAction({
        name: docForm.name,
        fileUrl: docForm.fileUrl,
        fileType: docForm.fileType,
        category: docForm.category,
        projectId: project.id,
        clientId: project.clientId,
      });
      setIsDocModalOpen(false);
      setDocForm({
        name: "",
        fileUrl: "",
        fileType: "PDF",
        category: "BRIEF",
      });
      router.refresh();
    });
  };

  // Edit Project
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await updateProjectAction(project.id, {
        name: editForm.name,
        description: editForm.description,
        managerId: editForm.managerId || undefined,
        startDate: editForm.startDate,
        deadline: editForm.deadline,
        budget: Number(editForm.budget) || 0,
      });
      setIsEditModalOpen(false);
      router.refresh();
    });
  };

  // Quick Task Status Change
  const handleTaskStatusChange = (taskId: string, newStatus: TaskStatus) => {
    startTransition(async () => {
      await updateTaskStatusAction(taskId, newStatus);
      router.refresh();
    });
  };

  // Log Time
  const handleLogTime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return;

    startTransition(async () => {
      await logTaskTimeAction(selectedTaskId, Number(timeForm.hours) || 0);
      setIsLogTimeModalOpen(false);
      setSelectedTaskId(null);
      router.refresh();
    });
  };

  // Delete Task
  const handleDeleteTask = (taskId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette tâche ?")) return;
    startTransition(async () => {
      await deleteTaskAction(taskId);
      router.refresh();
    });
  };

  // Delete Cost
  const handleDeleteCost = (costId: string) => {
    if (!confirm("Voulez-vous supprimer ce coût imputé ?")) return;
    startTransition(async () => {
      await deleteProjectCostAction(costId, project.id);
      router.refresh();
    });
  };

  // Delete Document
  const handleDeleteDoc = (docId: string) => {
    if (!confirm("Voulez-vous supprimer ce document ?")) return;
    startTransition(async () => {
      await deleteDocumentAction(docId);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={project.status === "COMPLETED" || project.status === "CANCELLED" ? "/projets?tab=history" : "/projets"}>
            <Button variant="ghost" size="sm" className="p-2 h-9 w-9 rounded-xl" title="Retour aux projets">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-blue-400 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                {project.code}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConfig.color}`}
              >
                {statusConfig.label}
              </span>
              {(project.status === "COMPLETED" || project.status === "CANCELLED") && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Archive className="w-3 h-3" />
                  Archivé dans l'Historique
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-100 mt-1">{project.name}</h1>
            <p className="text-xs text-neutral-400">
              Client :{" "}
              <Link
                href={`/clients/${project.clientId}`}
                className="text-blue-400 hover:underline font-semibold"
              >
                {project.client.companyName}
              </Link>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            className="gap-1.5"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Modifier</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsTaskModalOpen(true)}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Tâche</span>
          </Button>
        </div>
      </div>

      {/* Archive Notice Banner */}
      {(project.status === "COMPLETED" || project.status === "CANCELLED") && (
        <div className="p-4 rounded-2xl bg-neutral-900/80 border border-emerald-500/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
              <Archive className="w-4 h-4" />
            </div>
            <span className="text-neutral-300 font-medium">
              Ce projet est <strong className="text-emerald-300 font-bold">{project.status === "COMPLETED" ? "Livré & Terminé" : "Annulé"}</strong> et se trouve dans l'<strong className="text-neutral-100 font-bold">Historique des Projets</strong>.
            </span>
          </div>
          <Link
            href="/projets?tab=history"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-bold transition-colors cursor-pointer shrink-0"
          >
            ← Consulter l'Historique des Projets
          </Link>
        </div>
      )}


      {/* Lifecycle Status Stepper */}
      <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-neutral-300">Cycle de Vie du Projet</span>
          <span className="text-neutral-400">
            Cliquez sur une étape pour changer l'état instantanément
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {(
            [
              "NEW_REQUEST",
              "PLANNING",
              "IN_PRODUCTION",
              "CLIENT_VALIDATION",
              "REVISION",
              "COMPLETED",
            ] as ProjectStatus[]
          ).map((st) => {
            const cfg = PROJECT_STATUSES[st];
            const isCurrent = project.status === st;

            return (
              <button
                key={st}
                type="button"
                onClick={() => handleStatusChange(st)}
                disabled={isPending}
                className={`p-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  isCurrent
                    ? `${cfg.color} ring-2 ring-white/20 font-bold shadow-md`
                    : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] opacity-70">Étape {cfg.step}</span>
                  {isCurrent && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span className="text-xs mt-1 truncate">{cfg.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPIs Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Manager */}
        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80">
          <span className="text-[11px] font-medium text-neutral-400 flex items-center gap-1.5">
            <User className="w-3 h-3 text-neutral-500" />
            Chef de Projet
          </span>
          <p className="text-sm font-bold text-neutral-200 mt-1 truncate">
            {project.manager?.name || "Non assigné"}
          </p>
          <span className="text-[10px] text-neutral-500 block">
            {project.manager?.role || "—"}
          </span>
        </div>

        {/* Dates */}
        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80">
          <span className="text-[11px] font-medium text-neutral-400 flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-neutral-500" />
            Échéance (Deadline)
          </span>
          <p
            className={`text-sm font-bold mt-1 ${
              isOverdue ? "text-rose-400" : "text-neutral-200"
            }`}
          >
            {project.deadline ? formatDate(project.deadline) : "Non définie"}
          </p>
          <span className="text-[10px] text-neutral-500 block">
            {isOverdue ? "En retard !" : "Dans les délais"}
          </span>
        </div>

        {/* Progress */}
        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80">
          <div className="flex items-center justify-between text-[11px] font-medium text-neutral-400">
            <span>Progression Tâches</span>
            <span className="font-bold text-neutral-200">{project.progress}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden mt-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${project.progress}%` }}
            />
          </div>
          <span className="text-[10px] text-neutral-500 block mt-1">
            {project.tasks.filter((t: any) => t.status === "COMPLETED" || t.status === "VALIDATED").length} /{" "}
            {project.tasks.length} validées
          </span>
        </div>

        {/* Budget */}
        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80">
          <span className="text-[11px] font-medium text-blue-400">Budget Client</span>
          <p className="text-base font-extrabold text-blue-300 mt-1 truncate">
            {formatCurrency(project.budget)}
          </p>
          <span className="text-[10px] text-neutral-500 block">
            Coûts : {formatCurrency(project.totalCosts)}
          </span>
        </div>

        {/* Margin & Profitability */}
        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 col-span-2 md:col-span-1">
          <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" />
            Marge Brute Projet
          </span>
          <p className="text-base font-extrabold text-emerald-300 mt-1 truncate">
            {formatCurrency(project.grossMargin)}
          </p>
          <span className="text-[10px] text-neutral-400 block font-semibold">
            Rentabilité : {project.marginPercentage}%
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-neutral-800/80 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("tasks")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "tasks"
              ? "bg-neutral-800 text-white shadow-xs"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
          <span>Tâches & Production ({project.tasks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("costs")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "costs"
              ? "bg-neutral-800 text-white shadow-xs"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          <span>Rentabilité & Coûts ({project.costs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("documents")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "documents"
              ? "bg-neutral-800 text-white shadow-xs"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-amber-400" />
          <span>Livrables & Fichiers ({project.documents.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("invoices")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "invoices"
              ? "bg-neutral-800 text-white shadow-xs"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Receipt className="w-3.5 h-3.5 text-purple-400" />
          <span>Factures ({project.invoices.length})</span>
        </button>
      </div>

      {/* Tab 1: Tasks */}
      {activeTab === "tasks" && (() => {
        const part1Tasks = project.tasks.filter((t: any) => getTaskPart(t) === "PART_1");
        const part2Tasks = project.tasks.filter((t: any) => getTaskPart(t) === "PART_2");

        const part1Completed = part1Tasks.filter((t: any) => t.status === "VALIDATED" || t.status === "COMPLETED").length;
        const part2Completed = part2Tasks.filter((t: any) => t.status === "VALIDATED" || t.status === "COMPLETED").length;

        const part1Pct = part1Tasks.length > 0 ? Math.round((part1Completed / part1Tasks.length) * 100) : 0;
        const part2Pct = part2Tasks.length > 0 ? Math.round((part2Completed / part2Tasks.length) * 100) : 0;

        const clientOfferType = (project.client?.offerType as any) || "STARTER";
        const quotaConfig =
          WEEKLY_QUOTAS_BY_OFFER[clientOfferType as keyof typeof WEEKLY_QUOTAS_BY_OFFER] ||
          WEEKLY_QUOTAS_BY_OFFER.STARTER;

        const openForPart = (part?: "PART_1" | "PART_2") => {
          setTaskForm({
            title: "",
            description: "",
            assigneeId: users[0]?.id || "",
            priority: "MEDIUM",
            dueDate: project.deadline ? new Date(project.deadline).toISOString().split("T")[0] : "",
            timeSpentHours: 0,
          });
          setIsTaskModalOpen(true);
        };

        const renderTaskRow = (t: any, part: "PART_1" | "PART_2") => {
          const priorityConfig = TASK_PRIORITIES[t.priority as TaskPriority] || TASK_PRIORITIES.MEDIUM;
          const statusConfig = TASK_STATUSES[t.status as TaskStatus] || TASK_STATUSES.TODO;
          const isPart1 = part === "PART_1";

          return (
            <div
              key={t.id}
              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-800/30 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityConfig.color}`}
                  >
                    {priorityConfig.label}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                      isPart1
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                    }`}
                  >
                    {isPart1 ? "📐 Phase 1 : Conception & UI/UX" : "💻 Phase 2 : Dév & Mise en Ligne"}
                  </span>
                  {t.status === "VALIDATED" && (
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 font-mono ${
                        Date.now() - new Date(t.updatedAt).getTime() >= 24 * 60 * 60 * 1000
                          ? "bg-neutral-800 text-neutral-400 border-neutral-700"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {Date.now() - new Date(t.updatedAt).getTime() >= 24 * 60 * 60 * 1000 ? (
                        <>
                          <Archive className="w-2.5 h-2.5 text-neutral-500" />
                          <span>Historique (+1j)</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Validé (&lt; 24h)</span>
                        </>
                      )}
                    </span>
                  )}
                  <h4 className="text-xs font-bold text-neutral-100">{t.title}</h4>
                </div>
                {t.description && (
                  <p className="text-xs text-neutral-400 max-w-xl">{t.description}</p>
                )}
                <div className="flex items-center gap-3 text-[11px] text-neutral-500 pt-0.5 flex-wrap">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-neutral-500" />
                    {t.assignee?.name || "Non assigné"}
                  </span>
                  {t.dueDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-neutral-500" />
                      {formatDate(t.dueDate)}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-blue-400 font-medium">
                    <Clock className="w-3 h-3" />
                    {Number(t.timeSpentHours || 0)}h passées
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                {/* Status Selector */}
                <select
                  value={t.status}
                  onChange={(e) => handleTaskStatusChange(t.id, e.target.value as TaskStatus)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold border cursor-pointer ${statusConfig.color} bg-neutral-950 focus:outline-none`}
                >
                  {Object.entries(TASK_STATUSES).map(([key, item]) => (
                    <option key={key} value={key} className="bg-neutral-900 text-neutral-200">
                      {item.label}
                    </option>
                  ))}
                </select>

                {/* Log time button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedTaskId(t.id);
                    setIsLogTimeModalOpen(true);
                  }}
                  className="h-7 text-xs text-neutral-300"
                  title="Ajouter du temps passé"
                >
                  + Heures
                </Button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => handleDeleteTask(t.id)}
                  className="p-1 text-neutral-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                  title="Supprimer la tâche"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-5">
            {/* Top Bar: Sub-filters by Part & Global Add */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/80 border border-neutral-800 p-3.5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-neutral-400">Organisation :</span>
                <div className="flex bg-neutral-950 border border-neutral-800 rounded-xl p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setTaskPartFilter("ALL")}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      taskPartFilter === "ALL"
                        ? "bg-neutral-800 text-white shadow-xs"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    Vue complète ({project.tasks.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskPartFilter("PART_1")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      taskPartFilter === "PART_1"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Phase 1 : Conception & UI/UX ({part1Tasks.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskPartFilter("PART_2")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      taskPartFilter === "PART_2"
                        ? "bg-purple-600 text-white shadow-xs"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Phase 2 : Dév & Déploiement ({part2Tasks.length})</span>
                  </button>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => openForPart()}
                className="gap-1.5 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouvelle Tâche Tech</span>
              </Button>
            </div>

            {/* SECTION 1 : PHASE 1 (Conception & Architecture UI/UX) */}
            {(taskPartFilter === "ALL" || taskPartFilter === "PART_1") && (
              <div className="bg-white dark:bg-neutral-900/60 border border-slate-200 dark:border-neutral-800/80 rounded-2xl overflow-hidden shadow-xs space-y-0">
                {/* Section Header */}
                <div className="p-4 bg-slate-50/80 dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30 flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-neutral-100">
                          Phase 1 : Conception, Architecture & UI/UX Figma
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 font-bold">
                          Conception & UI/UX
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                        Cahier des charges, Wireframes & Maquettes Figma (Web/Mobile), Architecture technique
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-auto">
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-neutral-300 font-mono font-semibold">
                      {part1Completed}/{part1Tasks.length} validées ({part1Pct}%)
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openForPart("PART_1")}
                      className="gap-1 text-xs bg-white dark:bg-transparent border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Ajouter</span>
                    </Button>
                  </div>
                </div>

                {/* Tasks List */}
                {part1Tasks.length === 0 ? (
                  <div className="p-6 text-center text-xs text-neutral-500">
                    Aucune tâche de conception ou UI/UX pour l'instant.
                    <button
                      type="button"
                      onClick={() => openForPart("PART_1")}
                      className="ml-2 text-blue-400 hover:underline font-semibold cursor-pointer"
                    >
                      + Ajouter une tâche de conception
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-800/60">
                    {part1Tasks.map((t: any) => renderTaskRow(t, "PART_1"))}
                  </div>
                )}
              </div>
            )}

            {/* SECTION 2 : PHASE 2 (Développement Web, Mobile & Déploiement) */}
            {(taskPartFilter === "ALL" || taskPartFilter === "PART_2") && (
              <div className="bg-white dark:bg-neutral-900/60 border border-slate-200 dark:border-neutral-800/80 rounded-2xl overflow-hidden shadow-xs space-y-0">
                {/* Section Header */}
                <div className="p-4 bg-slate-50/80 dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30 flex items-center justify-center shrink-0">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-neutral-100">
                          Phase 2 : Développement Web, Mobile & Déploiement
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20 font-bold">
                          Développement & Mise en Ligne
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                        Développement Frontend & Mobile, Backend APIs, Tests QA, Serveur, Domaine & Stores
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-neutral-300 font-mono font-semibold">
                      {part2Completed}/{part2Tasks.length} ({part2Pct}%)
                    </span>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openForPart("PART_2")}
                      className="gap-1 text-xs bg-white dark:bg-transparent border border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-500/10 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Ajouter Tâche</span>
                    </Button>
                  </div>
                </div>

                {/* Tasks List */}
                {part2Tasks.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-500 space-y-2">
                    <p>Aucune tâche de développement ou déploiement pour l'instant.</p>
                    <button
                      type="button"
                      onClick={() => openForPart("PART_2")}
                      className="text-purple-400 hover:underline font-semibold cursor-pointer"
                    >
                      + Ajouter une tâche de développement
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-800/60">
                    {part2Tasks.map((t: any) => renderTaskRow(t, "PART_2"))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Tab 2: Costs */}
      {activeTab === "costs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-neutral-200">Coûts Imputables au Projet</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Enregistrez les dépenses directement liées à la réalisation de ce projet (freelances, ads, outils, etc.).
              </p>
            </div>
            <Button size="sm" onClick={() => setIsCostModalOpen(true)} className="gap-1 text-xs">
              <Plus className="w-3.5 h-3.5" />
              <span>Imputer un Coût</span>
            </Button>
          </div>

          {project.costs.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800/60 space-y-2">
              <p className="text-xs text-neutral-400">Aucun coût imputé pour le moment.</p>
              <p className="text-[11px] text-neutral-500">
                La marge brute est actuellement de 100% ({formatCurrency(project.budget)}).
              </p>
            </div>
          ) : (
            <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950/70 border-b border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase">
                  <tr>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Montant</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {project.costs.map((c: any) => (
                    <tr key={c.id} className="hover:bg-neutral-800/30">
                      <td className="px-4 py-3 font-semibold text-neutral-200">{c.description}</td>
                      <td className="px-4 py-3 text-neutral-400">
                        <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-[10px] font-mono">
                          {c.costType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-400">{formatDate(c.date)}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-400">
                        - {formatCurrency(Number(c.amount))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteCost(c.id)}
                          className="p-1 text-neutral-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Documents */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-200">
              Documents, Briefs & Livrables du Projet
            </h3>
            <Button size="sm" onClick={() => setIsDocModalOpen(true)} className="gap-1 text-xs">
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter un Fichier</span>
            </Button>
          </div>

          {project.documents.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800/60 space-y-2">
              <p className="text-xs text-neutral-400">Aucun livrable ou brief associé à ce projet.</p>
              <Button size="sm" variant="outline" onClick={() => setIsDocModalOpen(true)}>
                Déposer un premier livrable
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {project.documents.map((d: any) => (
                <div
                  key={d.id}
                  className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                        {d.fileType}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(d.id)}
                        className="text-neutral-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <h4 className="text-xs font-bold text-neutral-100 mt-2 line-clamp-1">{d.name}</h4>
                    <p className="text-[10px] text-neutral-500 mt-0.5">
                      {formatBytes(d.fileSize)} • {formatDate(d.createdAt)}
                    </p>
                  </div>

                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-xs font-semibold text-neutral-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Consulter / Télécharger</span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Invoices */}
      {activeTab === "invoices" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-200">Factures rattachées</h3>
            <Link href={`/clients/${project.clientId}`}>
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <span>Créer une facture client</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>

          {project.invoices.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800/60 text-xs text-neutral-400">
              Aucune facture directement rattachée à ce projet. Les factures peuvent être créées depuis la fiche client.
            </div>
          ) : (
            <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl overflow-hidden divide-y divide-neutral-800/60">
              {project.invoices.map((inv: any) => (
                <div key={inv.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-blue-400">{inv.invoiceNumber}</span>
                    <p className="text-[11px] text-neutral-400 mt-0.5">{formatDate(inv.issueDate)}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-neutral-100">{formatCurrency(Number(inv.total))}</span>
                    <span className="text-[10px] text-emerald-400 block font-semibold">{inv.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Create Task */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title="Ajouter une Tâche de Production"
        description={`Projet : ${project.name} (${project.code})`}
      >
        <form onSubmit={handleCreateTask} className="space-y-3.5">
          <div className="space-y-3 p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 shadow-2xs">
            {/* Partie 1 : Modèles sur site & Voix-Off */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-blue-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Phase 1 : Modèles Conception, Architecture & UI/UX</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                    Figma & Tech Lead
                  </span>
                </div>
                <span className="text-[10px] text-blue-400/80 font-mono">
                  {STANDARD_TASK_TEMPLATES.filter((t) => t.part === "PART_1").length} modèles
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {STANDARD_TASK_TEMPLATES.filter((t) => t.part === "PART_1").map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setTaskForm({
                        ...taskForm,
                        title: tpl.title,
                        description: tpl.description,
                        priority: tpl.priority as TaskPriority,
                        timeSpentHours: tpl.defaultHours,
                      });
                    }}
                    className="text-left px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-blue-600/20 hover:border-blue-500/40 border border-neutral-800 text-[11px] text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center justify-between gap-1 group shadow-2xs"
                  >
                    <span className="truncate group-hover:text-blue-300 font-medium">
                      + {tpl.title.split("(")[0].trim()}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono shrink-0 ml-1">
                      {tpl.defaultHours}h
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Phase 2 : Modèles Développement Web, Mobile & Déploiement */}
            <div className="space-y-1.5 pt-2.5 border-t border-neutral-800">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-purple-400 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Phase 2 : Modèles Dév Web, Mobile, APIs & Déploiement</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                    Développeurs & DevOps
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {STANDARD_TASK_TEMPLATES.filter((t) => t.part === "PART_2").length} modèles
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {STANDARD_TASK_TEMPLATES.filter((t) => t.part === "PART_2").map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setTaskForm({
                        ...taskForm,
                        title: tpl.title,
                        description: tpl.description,
                        priority: tpl.priority as TaskPriority,
                        timeSpentHours: tpl.defaultHours,
                      });
                    }}
                    className="text-left px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-purple-600/20 hover:border-purple-500/40 border border-neutral-800 text-[11px] text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center justify-between gap-1 group shadow-2xs"
                  >
                    <span className="truncate group-hover:text-purple-300 font-medium">
                      + {tpl.title.split("(")[0].trim()}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono shrink-0 ml-1">
                      {tpl.defaultHours}h
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Titre de la tâche *</label>
            <Input
              placeholder="Ex: Montage vidéo Reel Promo"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-300">Membre assigné</label>
                <span className="text-[10px] text-blue-400 font-semibold flex items-center gap-1">
                  <Bell className="w-3 h-3" />
                  Sera notifié(e)
                </span>
              </div>
              <select
                value={taskForm.assigneeId}
                onChange={(e) => setTaskForm({ ...taskForm, assigneeId: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">-- Non assigné (aucune notification) --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
              {taskForm.assigneeId ? (
                <p className="text-[11px] text-blue-300 bg-blue-950/40 border border-blue-800/60 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
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
                className="w-full h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {Object.entries(TASK_PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Échéance de la tâche</label>
              <Input
                type="date"
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
              />
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
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Consignes / Description</label>
            <textarea
              rows={2}
              placeholder="Détails, formats, liens vers fichiers..."
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              className="w-full p-2 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsTaskModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Création..." : "Ajouter la Tâche"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Cost */}
      <Modal
        isOpen={isCostModalOpen}
        onClose={() => setIsCostModalOpen(false)}
        title="Imputer un Coût au Projet"
        description="Ce montant sera déduit du budget pour calculer la marge brute exacte."
      >
        <form onSubmit={handleAddCost} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Description de la dépense *</label>
            <Input
              placeholder="Ex: Rémunération monteur externe, Achat assets, Meta Ads..."
              value={costForm.description}
              onChange={(e) => setCostForm({ ...costForm, description: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Type de coût</label>
              <select
                value={costForm.costType}
                onChange={(e) => setCostForm({ ...costForm, costType: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="FREELANCER">Prestataire / Freelance</option>
                <option value="ADVERTISING">Campagne Pub / Ads</option>
                <option value="SOFTWARE">Outil / Logiciel / Hosting</option>
                <option value="HARDWARE">Matériel / Location</option>
                <option value="OTHER">Autre coût direct</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Montant (DA) *</label>
              <Input
                type="number"
                value={costForm.amount}
                onChange={(e) => setCostForm({ ...costForm, amount: Number(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Date de la dépense</label>
            <Input
              type="date"
              value={costForm.date}
              onChange={(e) => setCostForm({ ...costForm, date: e.target.value })}
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCostModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Enregistrement..." : "Enregistrer le Coût"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Document */}
      <Modal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        title="Ajouter un Livrable ou Brief"
        description="Associez un fichier consultable ou téléchargeable à ce projet."
      >
        <form onSubmit={handleAddDoc} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Nom du fichier / Livrable *</label>
            <Input
              placeholder="Ex: Brief Client Validé, Vidéo Finale v1, Maquettes Figma..."
              value={docForm.name}
              onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Lien du fichier / URL *</label>
            <Input
              placeholder="https://drive.google.com/... ou lien média"
              value={docForm.fileUrl}
              onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Format</label>
              <select
                value={docForm.fileType}
                onChange={(e) => setDocForm({ ...docForm, fileType: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="PDF">PDF</option>
                <option value="VIDEO">Vidéo (MP4, MOV)</option>
                <option value="IMAGE">Image / Visuel (PNG, JPG)</option>
                <option value="EXCEL">Excel / Sheets</option>
                <option value="OTHER">Autre format</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Catégorie</label>
              <select
                value={docForm.category}
                onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="BRIEF">Brief & Cahier des charges</option>
                <option value="MEDIA">Livrable média (Vidéo / Graphisme)</option>
                <option value="CONTRACT">Contrat & Avenant</option>
                <option value="INVOICE">Facture & Devis</option>
                <option value="OTHER">Autre document</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsDocModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Ajout..." : "Ajouter le Document"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Log Time */}
      <Modal
        isOpen={isLogTimeModalOpen}
        onClose={() => {
          setIsLogTimeModalOpen(false);
          setSelectedTaskId(null);
        }}
        title="Ajouter des Heures Passées"
        description="Incrémentez le temps de travail passé sur cette tâche."
      >
        <form onSubmit={handleLogTime} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Nombre d'heures à ajouter</label>
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
                setIsLogTimeModalOpen(false);
                setSelectedTaskId(null);
              }}
            >
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Enregistrement..." : "Ajouter"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Project */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Modifier les Informations du Projet"
      >
        <form onSubmit={handleEditSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Nom du projet</label>
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Chef de projet</label>
              <select
                value={editForm.managerId}
                onChange={(e) => setEditForm({ ...editForm, managerId: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Budget alloué (DA)</label>
              <Input
                type="number"
                value={editForm.budget}
                onChange={(e) => setEditForm({ ...editForm, budget: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Date de début</label>
              <Input
                type="date"
                value={editForm.startDate}
                onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Deadline</label>
              <Input
                type="date"
                value={editForm.deadline}
                onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Description</label>
            <textarea
              rows={3}
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full p-2 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
