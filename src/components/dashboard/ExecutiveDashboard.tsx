"use client";

import React from "react";
import Link from "next/link";
import {
  Target,
  PhoneCall,
  Calendar,
  TrendingUp,
  Activity,
  ArrowUpRight,
  PlusCircle,
  PhoneOutgoing,
  Kanban,
  CreditCard,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { DashboardMetricsResult } from "@/actions/dashboard";
import { DailyAttendanceWidget } from "@/components/attendance/DailyAttendanceWidget";
import { MonthlyGoalsWidget } from "@/components/dashboard/MonthlyGoalsWidget";

interface ExecutiveDashboardProps {
  metrics: DashboardMetricsResult;
  userName?: string;
}

export function ExecutiveDashboard({ metrics, userName }: ExecutiveDashboardProps) {
  const currentDate = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/90 dark:border-neutral-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 text-[10px] font-bold uppercase tracking-wider border border-purple-200 dark:border-purple-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              Direction Générale
            </span>
            <span className="text-xs text-slate-500 dark:text-neutral-400 capitalize">{currentDate}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-neutral-100 mt-1 flex items-center gap-2">
            Tableau de Bord Direction
          </h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
            Pilotage opérationnel, financier et commercial en temps réel de l'agence BOOSTERA.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/prospection?modal=new">
            <Button size="sm" className="gap-1.5 shadow-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer">
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Nouveau Prospect</span>
            </Button>
          </Link>
          <Link href="/appels">
            <Button variant="secondary" size="sm" className="gap-1.5 bg-white dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 border border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-750 font-semibold shadow-sm cursor-pointer">
              <PhoneOutgoing className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Journal Appels</span>
            </Button>
          </Link>
          <Link href="/production">
            <Button variant="outline" size="sm" className="gap-1.5 bg-white dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 border border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-750 font-semibold shadow-sm cursor-pointer">
              <Kanban className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Production</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Pointage Quotidien */}
      <DailyAttendanceWidget />

      {/* Objectifs Mensuels des Collaborateurs (Synchronisés en Direct pour l'Admin) */}
      <MonthlyGoalsWidget
        goals={
          metrics.allTeamGoals && metrics.allTeamGoals.length > 0
            ? metrics.allTeamGoals
            : metrics.myMonthlyGoals || []
        }
        userName={userName}
        showAdminLink={metrics.isAdmin}
        title={
          metrics.allTeamGoals && metrics.allTeamGoals.length > 0
            ? "Objectifs Mensuels des Collaborateurs (Équipe)"
            : "Mes Objectifs du Mois"
        }
        subtitle="Suivi en direct des objectifs de chaque collaborateur synchronisés avec leurs actions réelles."
        showEmployeeBadge={Boolean(metrics.allTeamGoals && metrics.allTeamGoals.length > 0)}
      />

      {/* Row 1: Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Prospects"
          value={metrics.totalProspects}
          subtitle={`${metrics.newProspects} nouveaux leads`}
          icon={Target}
          color="blue"
        />

        <KpiCard
          title="Appels du Jour"
          value={metrics.callsToday}
          subtitle={`${metrics.totalCalls} appels au total`}
          icon={PhoneCall}
          color="emerald"
        />

        <KpiCard
          title="Rendez-vous programmés"
          value={metrics.upcomingAppointments}
          subtitle="Visio & rendez-vous clients"
          icon={Calendar}
          color="purple"
        />

        <KpiCard
          title="Taux de Conversion"
          value={`${metrics.conversionRate}%`}
          subtitle={`${metrics.activeClients} clients actifs signés`}
          icon={TrendingUp}
          color="amber"
        />
      </div>

      {/* Row 2: Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex flex-col justify-between shadow-xs">
          <span className="text-xs font-medium text-neutral-400">Total Valeur Contrats</span>
          <div className="mt-2">
            <p className="text-2xl font-bold text-neutral-100">
              {formatCurrency(metrics.totalContractValue)}
            </p>
            <p className="text-[11px] text-neutral-400 mt-1">Cumul des contrats clients actifs</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between shadow-xs">
          <span className="text-xs font-semibold text-emerald-400">Total Encaissé (Trésorerie)</span>
          <div className="mt-2">
            <p className="text-2xl font-bold text-emerald-400">
              {formatCurrency(metrics.totalCollected)}
            </p>
            <p className="text-[11px] text-emerald-400/70 mt-1">Paiements validés (BaridiMob, Cash, Virement)</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col justify-between shadow-xs">
          <span className="text-xs font-semibold text-amber-400">Reste à Encaisser</span>
          <div className="mt-2">
            <p className="text-2xl font-bold text-amber-400">
              {formatCurrency(metrics.balanceRemaining)}
            </p>
            <p className="text-[11px] text-amber-400/70 mt-1">Créances clients en attente d'échéance</p>
          </div>
        </div>
      </div>

      {/* Row 3: Commercial Team Leaderboard & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="lg:col-span-1 bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-100">Performance Équipe</h3>
            <Link href="/appels" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
              <span>Détails</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {metrics.salesReps.map((rep) => (
              <div
                key={rep.id}
                className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl flex items-center justify-between transition-colors hover:border-neutral-700"
              >
                <div>
                  <p className="text-xs font-semibold text-neutral-200">{rep.name}</p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    {rep._count.assignedProspects} leads • {rep._count.loggedCalls} appels
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-blue-400">
                    {rep._count.managedClients}
                  </span>
                  <span className="text-[10px] text-neutral-400 block">clients</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Stream */}
        <div className="lg:col-span-2 bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-neutral-100">Journal d'Activité Récent (Audit Log)</h3>
            </div>
            <span className="text-[11px] text-neutral-400">Traçabilité complète</span>
          </div>

          <div className="space-y-2.5">
            {metrics.recentActivities.length === 0 && (
              <p className="text-xs text-neutral-400 py-6 text-center">Aucune activité enregistrée.</p>
            )}
            {metrics.recentActivities.map((act) => (
              <div
                key={act.id}
                className="p-3 bg-neutral-950/40 border border-neutral-800 rounded-xl flex items-center justify-between text-xs transition-colors hover:border-neutral-700"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 ring-2 ring-blue-900" />
                  <div>
                    <span className="font-bold text-neutral-100">
                      {act.user?.name || "Système"}
                    </span>{" "}
                    <span className="text-neutral-300">
                      a effectué l'action{" "}
                      <code className="text-blue-300 bg-blue-950/50 border border-blue-800/60 px-1.5 py-0.5 rounded font-mono text-[11px]">
                        {act.action}
                      </code>{" "}
                      dans le module{" "}
                      <span className="text-neutral-200 font-semibold">{act.module}</span>
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-neutral-400 shrink-0 ml-2">
                  {formatDateTime(act.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
