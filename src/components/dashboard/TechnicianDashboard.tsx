"use client";

import React from "react";
import Link from "next/link";
import {
  Kanban,
  Briefcase,
  Repeat,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  PlusCircle,
  Sparkles,
  Layers,
  Flame,
  FileCheck,
  Calendar,
} from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/utils";
import type { DashboardMetricsResult } from "@/actions/dashboard";
import { DailyAttendanceWidget } from "@/components/attendance/DailyAttendanceWidget";
import { MonthlyGoalsWidget } from "@/components/dashboard/MonthlyGoalsWidget";

interface TechnicianDashboardProps {
  metrics: DashboardMetricsResult;
  userName?: string;
}

export function TechnicianDashboard({ metrics, userName }: TechnicianDashboardProps) {
  const data = metrics.technicianData || {
    tasksInProgressCount: 0,
    tasksTodoCount: 0,
    tasksUrgentCount: 0,
    tasksCompletedCount: 0,
    activeProjectsCount: 0,
    activeSubscriptionsCount: 0,
    urgentTasksList: [],
    activeProjectsList: [],
    activeSubscriptionsList: [],
  };

  const currentDate = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-neutral-900 to-blue-950/30 border border-emerald-500/20 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30">
              Espace Production & Technique
            </span>
            <span className="text-xs text-neutral-400 capitalize">{currentDate}</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-100 mt-1 flex items-center gap-2">
            Bonjour {userName || "Technicien"} 🛠️
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Pilotage de vos tâches de création, montage vidéo, design, développement et suivi des abonnements clients.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/calendrier-technicien">
            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25 cursor-pointer">
              <Calendar className="w-3.5 h-3.5" />
              <span>Calendrier Tâches</span>
            </Button>
          </Link>
          <Link href="/production">
            <Button variant="secondary" size="sm" className="gap-1.5 border-neutral-700 cursor-pointer">
              <Kanban className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tableau Kanban</span>
            </Button>
          </Link>
          <Link href="/projets">
            <Button variant="secondary" size="sm" className="gap-1.5 border-neutral-700 cursor-pointer">
              <Briefcase className="w-3.5 h-3.5 text-blue-400" />
              <span>Projets</span>
            </Button>
          </Link>
          <Link href="/abonnements">
            <Button variant="outline" size="sm" className="gap-1.5 border-neutral-700 cursor-pointer">
              <Repeat className="w-3.5 h-3.5 text-purple-400" />
              <span>Abonnements</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Pointage Quotidien */}
      <DailyAttendanceWidget />

      {/* Objectifs Mensuels (Personnels ou de l'Équipe pour l'Admin) */}
      <MonthlyGoalsWidget
        goals={
          metrics.isAdmin && metrics.allTeamGoals && metrics.allTeamGoals.length > 0
            ? metrics.allTeamGoals
            : metrics.myMonthlyGoals || []
        }
        userName={userName}
        showAdminLink={metrics.isAdmin}
        title={
          metrics.isAdmin && metrics.allTeamGoals && metrics.allTeamGoals.length > 0
            ? "Objectifs Mensuels des Collaborateurs (Équipe)"
            : "Mes Objectifs du Mois"
        }
        subtitle="Suivi en direct des objectifs de chaque collaborateur synchronisés avec leurs actions réelles."
        showEmployeeBadge={Boolean(metrics.isAdmin && metrics.allTeamGoals && metrics.allTeamGoals.length > 0)}
      />

      {/* Row 1: Key Production KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <KpiCard
          title="Tâches en Cours"
          value={data.tasksInProgressCount}
          subtitle="En réalisation active"
          icon={Kanban}
          color="emerald"
        />

        <KpiCard
          title="Tâches à Faire"
          value={data.tasksTodoCount}
          subtitle="En file d'attente"
          icon={Layers}
          color="blue"
        />

        <KpiCard
          title="Priorités Urgentes"
          value={data.tasksUrgentCount}
          subtitle="Deadlines critiques"
          icon={Flame}
          color="amber"
        />

        <KpiCard
          title="Livrables Validés"
          value={data.tasksCompletedCount}
          subtitle="Tâches terminées"
          icon={CheckCircle2}
          color="purple"
        />

        <KpiCard
          title="Projets Actifs"
          value={data.activeProjectsCount}
          subtitle={`${data.activeSubscriptionsCount} abonnements clients`}
          icon={Briefcase}
          color="indigo"
        />
      </div>

      {/* Row 2: Two Interactive Columns (Mes Tâches Prioritaires & Projets / Abonnements) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colonne 1 : Tâches Prioritaires en Production */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Kanban className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-neutral-100">
                Tâches Prioritaires en Production ({data.urgentTasksList.length})
              </h3>
            </div>
            <Link
              href="/production"
              className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Ouvrir Kanban</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {data.urgentTasksList.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-neutral-950/40 border border-neutral-800/80">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs text-neutral-300 font-medium">Toutes vos tâches sont à jour !</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Aucune tâche urgente en attente. Consultez le tableau de production pour en démarrer de nouvelles.
                </p>
              </div>
            ) : (
              data.urgentTasksList.map((task) => {
                const isUrgent = task.priority === "URGENT";
                const isHigh = task.priority === "HIGH";
                const isInProgress = task.status === "IN_PROGRESS";

                return (
                  <div
                    key={task.id}
                    className="p-3.5 bg-neutral-950/60 border border-neutral-800/80 rounded-xl hover:border-emerald-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            isUrgent
                              ? "bg-red-500/15 border-red-500/30 text-red-300"
                              : isHigh
                              ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                              : "bg-blue-500/15 border-blue-500/30 text-blue-300"
                          }`}
                        >
                          {task.priority}
                        </span>

                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            isInProgress
                              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                              : "bg-neutral-800 border-neutral-700 text-neutral-400"
                          }`}
                        >
                          {isInProgress ? "En cours" : "À faire"}
                        </span>

                        <span className="text-xs font-bold text-neutral-200 truncate">
                          {task.title}
                        </span>
                      </div>

                      <p className="text-[11px] text-neutral-400 truncate">
                        {task.clientName} • Projet:{" "}
                        <span className="text-neutral-300 font-medium">{task.projectName}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {task.dueDate && (
                        <span className="text-[10px] text-neutral-400 font-mono bg-neutral-900 px-2 py-1 rounded border border-neutral-800">
                          Échéance: {new Date(task.dueDate).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                      <Link
                        href={`/abonnements/${task.clientId}`}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                        title="Voir la fiche client / abonnement"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Colonne 2 : Projets Actifs & Abonnements Clients */}
        <div className="space-y-6">
          {/* Projets Actifs */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-neutral-100">
                  Projets & Avancement ({data.activeProjectsList.length})
                </h3>
              </div>
              <Link
                href="/projets"
                className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 font-medium"
              >
                <span>Tous les projets</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {data.activeProjectsList.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-4">Aucun projet actif pour le moment.</p>
              ) : (
                data.activeProjectsList.map((prj) => {
                  const percent = prj.totalTasks > 0
                    ? Math.round((prj.completedTasks / prj.totalTasks) * 100)
                    : 0;

                  return (
                    <div
                      key={prj.id}
                      className="p-3 bg-neutral-950/60 border border-neutral-800/80 rounded-xl space-y-2 hover:border-blue-500/40 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-neutral-200">{prj.name}</span>
                          <span className="text-[10px] text-neutral-500 ml-2">({prj.clientName})</span>
                        </div>
                        <span className="text-[11px] font-mono text-blue-400 font-semibold">
                          {prj.completedTasks}/{prj.totalTasks} tâches ({percent}%)
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Abonnements Clients en Production */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-neutral-100">
                  Abonnements en Production ({data.activeSubscriptionsList.length})
                </h3>
              </div>
              <Link
                href="/abonnements"
                className="text-xs text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 font-medium"
              >
                <span>Studio Éditorial</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-2">
              {data.activeSubscriptionsList.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/abonnements/${sub.id}`}
                  className="p-2.5 bg-neutral-950/60 border border-neutral-800/80 rounded-xl flex items-center justify-between text-xs hover:border-purple-500/40 transition-all group"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-200 group-hover:text-purple-300 transition-colors truncate">
                      {sub.brandName || sub.companyName}
                    </p>
                    <p className="text-[10px] text-neutral-500 truncate">
                      {sub.sector || "Secteur général"} {sub.wilaya && `• ${sub.wilaya}`}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 shrink-0">
                    {sub.offerType}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
