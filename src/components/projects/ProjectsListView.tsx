"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Plus,
  Search,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  ChevronRight,
  TrendingUp,
  Filter,
  Layers,
  LayoutGrid,
  List,
  AlertCircle,
  FolderOpen,
  ArrowUpRight,
  Sparkles,
  Archive,
  PlayCircle,
  History,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PROJECT_STATUSES } from "@/lib/constants";
import { ProjectStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { createProjectAction, updateProjectStatusAction } from "@/actions/projects";

interface ClientOption {
  id: string;
  companyName: string;
  brandName?: string | null;
  sector?: string | null;
  wilaya?: string | null;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

interface ProjectItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: ProjectStatus;
  startDate: Date | null;
  deadline: Date | null;
  budget: number;
  currency: string;
  progress: number;
  totalSpentHours: number;
  totalCosts: number;
  grossMargin: number;
  client: {
    id: string;
    companyName: string;
    brandName: string | null;
    sector: string;
    wilaya: string | null;
  };
  manager: {
    id: string;
    name: string;
    role: string;
  } | null;
  tasks: {
    id: string;
    status: string;
    timeSpentHours: any;
  }[];
  costs: {
    id: string;
    amount: any;
  }[];
  _count: {
    documents: number;
    tasks: number;
    costs: number;
  };
}

interface ProjectsListViewProps {
  projects: ProjectItem[];
  clients: ClientOption[];
  users: UserOption[];
}

export function ProjectsListView({ projects, clients, users }: ProjectsListViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedClientId, setSelectedClientId] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Scope: ACTIVE (Projets Actifs), HISTORY (Historique des Projets terminés / annulés), ALL (Tous)
  const [projectScope, setProjectScope] = useState<"ACTIVE" | "HISTORY" | "ALL">(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("tab");
      if (p === "history") return "HISTORY";
      if (p === "all") return "ALL";
    }
    return "ACTIVE";
  });

  const handleScopeChange = (scope: "ACTIVE" | "HISTORY" | "ALL") => {
    setProjectScope(scope);
    setSelectedStatus("ALL");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (scope === "HISTORY") {
        url.searchParams.set("tab", "history");
      } else if (scope === "ALL") {
        url.searchParams.set("tab", "all");
      } else {
        url.searchParams.delete("tab");
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    clientId: clients[0]?.id || "",
    name: "",
    code: "",
    description: "",
    managerId: users.find((u) => u.role === "TECH_LEAD")?.id || users[0]?.id || "",
    startDate: new Date().toISOString().split("T")[0],
    deadline: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    budget: 30000,
  });
  const [formError, setFormError] = useState("");

  // Quick stats
  const totalProjects = projects.length;
  const inProductionCount = projects.filter((p) => p.status === "IN_PRODUCTION").length;
  const inValidationCount = projects.filter((p) => p.status === "CLIENT_VALIDATION").length;
  const completedCount = projects.filter((p) => p.status === "COMPLETED").length;
  const cancelledCount = projects.filter((p) => p.status === "CANCELLED").length;
  const activeProjectsCount = projects.filter(
    (p) => p.status !== "COMPLETED" && p.status !== "CANCELLED"
  ).length;
  const historyProjectsCount = completedCount + cancelledCount;
  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);

  // Filtered list according to Scope + Filters
  const filteredProjects = projects.filter((p) => {
    // 1. Scope filter (ACTIVE / HISTORY / ALL)
    if (projectScope === "ACTIVE") {
      if (p.status === "COMPLETED" || p.status === "CANCELLED") return false;
    } else if (projectScope === "HISTORY") {
      if (p.status !== "COMPLETED" && p.status !== "CANCELLED") return false;
    }

    // 2. Specific status filter
    if (selectedStatus !== "ALL" && p.status !== selectedStatus) return false;

    // 3. Client filter
    if (selectedClientId !== "ALL" && p.client.id !== selectedClientId) return false;

    // 4. Search text filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchCode = p.code.toLowerCase().includes(q);
      const matchClient = p.client.companyName.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchClient) return false;
    }
    return true;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Le nom du projet est obligatoire.");
      return;
    }
    if (!formData.clientId) {
      setFormError("Veuillez sélectionner un client.");
      return;
    }

    setFormError("");
    startTransition(async () => {
      try {
        const res = await createProjectAction({
          clientId: formData.clientId,
          name: formData.name,
          code: formData.code || undefined,
          description: formData.description,
          managerId: formData.managerId || undefined,
          startDate: formData.startDate,
          deadline: formData.deadline,
          budget: Number(formData.budget) || 0,
        });

        if (res.success && res.project) {
          setIsCreateModalOpen(false);
          setFormData({
            clientId: clients[0]?.id || "",
            name: "",
            code: "",
            description: "",
            managerId: users.find((u) => u.role === "TECH_LEAD")?.id || users[0]?.id || "",
            startDate: new Date().toISOString().split("T")[0],
            deadline: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
            budget: 30000,
          });
          router.push(`/projets/${res.project.id}`);
        }
      } catch (err: any) {
        setFormError(err.message || "Erreur lors de la création du projet.");
      }
    });
  };

  const handleQuickStatusChange = (projectId: string, newStatus: ProjectStatus) => {
    startTransition(async () => {
      await updateProjectStatusAction(projectId, newStatus);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Briefcase className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
              Gestion des Projets Clients
            </h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Cycle de vie complet, production technique, respect des deadlines et rentabilité brute.
          </p>
        </div>

        <Button
          onClick={() => {
            setFormData({
              clientId: clients[0]?.id || "",
              name: "",
              code: "",
              description: "",
              managerId: users.find((u) => u.role === "TECH_LEAD")?.id || users[0]?.id || "",
              startDate: new Date().toISOString().split("T")[0],
              deadline: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
              budget: 30000,
            });
            setIsCreateModalOpen(true);
          }}
          className="gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Projet</span>
        </Button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div
          onClick={() => handleScopeChange("ALL")}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer bg-neutral-900/80 shadow-xs ${
            projectScope === "ALL"
              ? "border-blue-500/60 ring-2 ring-blue-500/20 shadow-md shadow-blue-500/10 bg-blue-500/10"
              : "border-neutral-800 hover:border-neutral-700 hover:shadow-xs"
          }`}
          title="Afficher tous les projets"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-400">Total Projets</span>
            <span className="text-[10px] text-neutral-400 font-bold bg-neutral-800 px-1.5 py-0.2 rounded border border-neutral-700">Tous</span>
          </div>
          <p className="text-2xl font-extrabold text-neutral-100 mt-0.5">{totalProjects}</p>
          <span className="text-[10px] text-neutral-400 block mt-0.5">
            {activeProjectsCount} actif{activeProjectsCount > 1 ? "s" : ""} • {historyProjectsCount} historique
          </span>
        </div>

        <div
          onClick={() => {
            handleScopeChange("ACTIVE");
            setSelectedStatus("IN_PRODUCTION");
          }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer bg-neutral-900/80 shadow-xs ${
            projectScope === "ACTIVE" && selectedStatus === "IN_PRODUCTION"
              ? "border-amber-500/60 ring-2 ring-amber-500/20 shadow-md shadow-amber-500/10 bg-amber-500/10"
              : "border-neutral-800 hover:border-amber-500/30 hover:shadow-xs"
          }`}
          title="Filtrer les projets en production"
        >
          <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            En Production
          </span>
          <p className="text-2xl font-extrabold text-amber-400 mt-0.5">{inProductionCount}</p>
          <span className="text-[10px] text-neutral-400 block mt-0.5">En cours de réalisation</span>
        </div>

        <div
          onClick={() => {
            handleScopeChange("ACTIVE");
            setSelectedStatus("CLIENT_VALIDATION");
          }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer bg-neutral-900/80 shadow-xs ${
            projectScope === "ACTIVE" && selectedStatus === "CLIENT_VALIDATION"
              ? "border-purple-500/60 ring-2 ring-purple-500/20 shadow-md shadow-purple-500/10 bg-purple-500/10"
              : "border-neutral-800 hover:border-purple-500/30 hover:shadow-xs"
          }`}
          title="Filtrer les projets en validation client"
        >
          <span className="text-[11px] font-semibold text-purple-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Validation Client
          </span>
          <p className="text-2xl font-extrabold text-purple-400 mt-0.5">{inValidationCount}</p>
          <span className="text-[10px] text-neutral-400 block mt-0.5">En attente approbation</span>
        </div>

        <div
          onClick={() => handleScopeChange("HISTORY")}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer bg-neutral-900/80 shadow-xs ${
            projectScope === "HISTORY"
              ? "border-emerald-500/60 ring-2 ring-emerald-500/20 shadow-md shadow-emerald-500/10 bg-emerald-500/10"
              : "border-neutral-800 hover:border-emerald-500/30 hover:shadow-xs"
          }`}
          title="Consulter l'historique des projets livrés et terminés"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
              <Archive className="w-3 h-3" />
              Livrés / Terminés
            </span>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 px-1.5 py-0.2 rounded border border-emerald-500/20">
              Historique
            </span>
          </div>
          <p className="text-2xl font-extrabold text-emerald-400 mt-0.5">{completedCount}</p>
          <span className="text-[10px] text-neutral-400 block mt-0.5">
            {cancelledCount > 0 ? `+ ${cancelledCount} annulé(s)` : "Archivés dans l'historique"}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 col-span-2 md:col-span-1 shadow-xs">
          <span className="text-[11px] font-semibold text-blue-400 flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" />
            Budget Cumulé
          </span>
          <p className="text-xl font-extrabold text-blue-400 mt-0.5 truncate">
            {formatCurrency(totalBudget)}
          </p>
          <span className="text-[10px] text-neutral-400 block mt-0.5">Tous projets confondus</span>
        </div>
      </div>

      {/* Tabs / Scope Switcher (Projets Actifs vs Historique des Projets vs Tous) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-2xl w-fit shadow-xs">
          {/* Tab 1: Projets Actifs */}
          <button
            type="button"
            onClick={() => handleScopeChange("ACTIVE")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              projectScope === "ACTIVE"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>Projets Actifs</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold ${
                projectScope === "ACTIVE"
                  ? "bg-white/20 text-white"
                  : "bg-neutral-800 text-neutral-300"
              }`}
            >
              {activeProjectsCount}
            </span>
          </button>

          {/* Tab 2: Historique des Projets */}
          <button
            type="button"
            onClick={() => handleScopeChange("HISTORY")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              projectScope === "HISTORY"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Historique des Projets</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold ${
                projectScope === "HISTORY"
                  ? "bg-white/20 text-white"
                  : "bg-neutral-800 text-neutral-300"
              }`}
            >
              {historyProjectsCount}
            </span>
          </button>

          {/* Tab 3: Tous */}
          <button
            type="button"
            onClick={() => handleScopeChange("ALL")}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              projectScope === "ALL"
                ? "bg-neutral-800 text-white shadow-xs font-bold"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/30"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tous</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-medium ${
                projectScope === "ALL"
                  ? "bg-neutral-700 text-neutral-200"
                  : "text-neutral-400"
              }`}
            >
              {totalProjects}
            </span>
          </button>
        </div>

        {/* Informative helper label */}
        <div className="text-xs text-neutral-400 hidden lg:flex items-center gap-1.5 font-medium">
          {projectScope === "ACTIVE" ? (
            <span className="text-neutral-300 flex items-center gap-1.5">
              <span>🚀</span>
              <span>Projets en cours de production et validation</span>
            </span>
          ) : projectScope === "HISTORY" ? (
            <span className="text-emerald-400 flex items-center gap-1.5 font-semibold">
              <span>📁</span>
              <span>Projets livrés, terminés et annulés (archives)</span>
            </span>
          ) : (
            <span className="text-neutral-400">Cycle global complet de l'agence</span>
          )}
        </div>
      </div>

      {/* History Scope Banner Notification */}
      {projectScope === "HISTORY" && (
        <div className="p-4 rounded-2xl bg-neutral-900/80 border border-emerald-500/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 text-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 shadow-xs">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-neutral-100">
                  Historique des Projets Clôturés
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  {historyProjectsCount} projet{historyProjectsCount > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Regroupe tous les projets marqués comme <strong className="text-emerald-300 font-bold">Livré & Terminé</strong> ({completedCount}) et <strong className="text-neutral-200 font-bold">Annulé</strong> ({cancelledCount}).
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleScopeChange("ACTIVE")}
            className="gap-1.5 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-bold cursor-pointer shrink-0"
          >
            <span>← Revenir aux projets actifs</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-[10px]">
              {activeProjectsCount}
            </span>
          </Button>
        </div>
      )}

      {/* Filters & View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800 shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, code PRJ, client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Status Filter (Scoped) */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-8 px-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">
              {projectScope === "ACTIVE"
                ? "Tous les statuts actifs"
                : projectScope === "HISTORY"
                ? "Tout l'historique"
                : "Tous les statuts"}
            </option>
            {Object.entries(PROJECT_STATUSES)
              .filter(([key]) => {
                if (projectScope === "ACTIVE") {
                  return key !== "COMPLETED" && key !== "CANCELLED";
                }
                if (projectScope === "HISTORY") {
                  return key === "COMPLETED" || key === "CANCELLED";
                }
                return true;
              })
              .map(([key, item]) => (
                <option key={key} value={key} className="bg-neutral-900 text-neutral-200">
                  {item.label}
                </option>
              ))}
          </select>

          {/* Client Filter */}
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="h-8 px-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 focus:outline-none focus:border-blue-500 max-w-[200px] truncate cursor-pointer"
          >
            <option value="ALL">Tous les clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id} className="bg-neutral-900 text-neutral-200">
                {c.companyName}
              </option>
            ))}
          </select>
        </div>

        {/* View Switcher Button Group */}
        <div className="flex items-center gap-1 self-end md:self-auto bg-neutral-950 p-1 rounded-xl border border-neutral-800">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
              viewMode === "table" ? "bg-neutral-800 text-white shadow-xs font-bold" : "text-neutral-400 hover:text-neutral-200"
            }`}
            title="Vue Tableau"
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Tableau</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
              viewMode === "grid" ? "bg-neutral-800 text-white shadow-xs font-bold" : "text-neutral-400 hover:text-neutral-200"
            }`}
            title="Vue Cartes"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Grille</span>
          </button>
        </div>
      </div>

      {/* Projects Content: Table or Grid */}
      {filteredProjects.length === 0 ? (
        <div className="p-12 sm:p-16 text-center rounded-3xl bg-neutral-900/60 border border-neutral-800 shadow-xs space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-xs">
            <FolderOpen className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-neutral-100">
              {projectScope === "ACTIVE"
                ? "Aucun projet actif en cours"
                : projectScope === "HISTORY"
                ? "Aucun projet dans l'historique"
                : "Aucun projet trouvé"}
            </h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
              {search || selectedStatus !== "ALL" || selectedClientId !== "ALL"
                ? "Aucun projet ne correspond à vos critères de recherche actuels."
                : projectScope === "ACTIVE"
                ? `Tous vos projets sont archivés dans l'historique (${historyProjectsCount}) ou aucun projet n'a encore été créé.`
                : projectScope === "HISTORY"
                ? "Dès qu'un projet est marqué 'Livré & Terminé' ou 'Annulé', il sera automatiquement transféré ici."
                : "Créez votre premier projet client pour démarrer la planification et le suivi de production."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2.5 pt-2 flex-wrap">
            {projectScope === "ACTIVE" && historyProjectsCount > 0 && (
              <Button
                onClick={() => handleScopeChange("HISTORY")}
                variant="outline"
                size="sm"
                className="gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-bold"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Voir l'Historique ({historyProjectsCount})</span>
              </Button>
            )}
            {projectScope === "HISTORY" && activeProjectsCount > 0 && (
              <Button
                onClick={() => handleScopeChange("ACTIVE")}
                variant="outline"
                size="sm"
                className="gap-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 font-bold"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Voir les Projets Actifs ({activeProjectsCount})</span>
              </Button>
            )}
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              size="sm"
              className="gap-1.5 font-bold shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau Projet</span>
            </Button>
          </div>
        </div>
      ) : viewMode === "table" ? (
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950/80 border-b border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Code & Projet</th>
                  <th className="px-4 py-3 whitespace-nowrap">Client</th>
                  <th className="px-4 py-3 whitespace-nowrap">Chef de Projet</th>
                  <th className="px-4 py-3 whitespace-nowrap">Statut</th>
                  <th className="px-4 py-3 whitespace-nowrap">Avancement</th>
                  <th className="px-4 py-3 whitespace-nowrap">Deadline</th>
                  <th className="px-4 py-3 whitespace-nowrap">Budget</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredProjects.map((p) => {
                  const statusConfig = PROJECT_STATUSES[p.status] || PROJECT_STATUSES.NEW_REQUEST;
                  const isOverdue =
                    p.deadline &&
                    new Date(p.deadline) < new Date() &&
                    p.status !== "COMPLETED" &&
                    p.status !== "CANCELLED";

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-neutral-800/40 transition-colors group cursor-pointer"
                      onClick={() => router.push(`/projets/${p.id}`)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold text-blue-400">
                              {p.code}
                            </span>
                            {(p.status === "COMPLETED" || p.status === "CANCELLED") && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                <Archive className="w-2.5 h-2.5" />
                                {p.status === "COMPLETED" ? "Archivé" : "Annulé"}
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-neutral-100 group-hover:text-blue-400 transition-colors">
                            {p.name}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-medium text-neutral-200">
                          {p.client.companyName}
                        </span>
                        {p.client.sector && (
                          <span className="text-[10px] text-neutral-400 block">
                            {p.client.sector}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-neutral-300">
                        {p.manager ? (
                          <span className="font-medium text-xs">{p.manager.name}</span>
                        ) : (
                          <span className="text-neutral-500 italic text-[11px]">Non assigné</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={p.status}
                          onChange={(e) =>
                            handleQuickStatusChange(p.id, e.target.value as ProjectStatus)
                          }
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${statusConfig.color} bg-neutral-950 focus:outline-none`}
                        >
                          {Object.entries(PROJECT_STATUSES).map(([key, item]) => (
                            <option key={key} value={key} className="bg-neutral-900 text-neutral-200">
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-3.5 min-w-[130px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-neutral-400 font-medium">
                            <span>{p.progress}%</span>
                            <span>
                              {p.tasks.filter((t) => t.status === "COMPLETED" || t.status === "VALIDATED").length} /{" "}
                              {p.tasks.length} tâches
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                              style={{ width: `${p.progress}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {p.deadline ? (
                          <span
                            className={`flex items-center gap-1 text-xs ${
                              isOverdue ? "text-rose-400 font-bold" : "text-neutral-400"
                            }`}
                          >
                            {isOverdue && <AlertCircle className="w-3 h-3 shrink-0" />}
                            <span>{formatDate(p.deadline)}</span>
                          </span>
                        ) : (
                          <span className="text-neutral-500 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 font-semibold text-neutral-200 whitespace-nowrap">
                        {formatCurrency(p.budget)}
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <Link href={`/projets/${p.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-400 hover:text-blue-300">
                            <span>Ouvrir</span>
                            <ChevronRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p) => {
            const statusConfig = PROJECT_STATUSES[p.status] || PROJECT_STATUSES.NEW_REQUEST;
            const isOverdue =
              p.deadline &&
              new Date(p.deadline) < new Date() &&
              p.status !== "COMPLETED" &&
              p.status !== "CANCELLED";

            return (
              <div
                key={p.id}
                onClick={() => router.push(`/projets/${p.id}`)}
                className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900 transition-all cursor-pointer flex flex-col justify-between space-y-4 group shadow-xs hover:shadow-sm"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-blue-400 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                        {p.code}
                      </span>
                      {(p.status === "COMPLETED" || p.status === "CANCELLED") && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                          <Archive className="w-2.5 h-2.5" />
                          {p.status === "COMPLETED" ? "Archivé" : "Annulé"}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConfig.color}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-neutral-100 group-hover:text-blue-400 transition-colors line-clamp-1">
                      {p.name}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5 font-medium">
                      Client : {p.client.companyName}
                    </p>
                  </div>

                  {p.description && (
                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-2 border-t border-neutral-800">
                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-neutral-400">
                      <span>Progression</span>
                      <span className="font-bold text-neutral-200">{p.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Details Row */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-neutral-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                      <span className={isOverdue ? "text-rose-400 font-bold" : ""}>
                        {p.deadline ? formatDate(p.deadline) : "Sans deadline"}
                      </span>
                    </span>

                    <span className="font-bold text-neutral-100">{formatCurrency(p.budget)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Nouveau Projet */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Créer un Nouveau Projet Client"
        description="Générez un projet pour structurer la production de l'agence (Brief, Tâches, Deadline & Budget)."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {formError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Client associé *</label>
            <select
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              className="w-full h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              required
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName} {c.wilaya ? `(${c.wilaya})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Nom du projet *</label>
              <Input
                placeholder="Ex: Production Pack Gold — Mars 2026"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Code Projet</label>
              <Input
                placeholder="Auto (PRJ-2026-...)"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Chef de projet</label>
              <select
                value={formData.managerId}
                onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
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
                placeholder="30000"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Date de début</label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Échéance (Deadline)</label>
              <Input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Description / Objectifs</label>
            <textarea
              rows={3}
              placeholder="Spécifications, attentes client, livrables attendus..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2.5 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Création..." : "Créer le Projet"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
