"use client";

import React, { useState } from "react";
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
  MapPin,
  Sparkles,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Wallet,
  Receipt,
  UserCheck,
  ArrowRight,
  Filter,
  Check,
  Briefcase,
  AlertCircle,
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
  const [auditModuleFilter, setAuditModuleFilter] = useState<string>("ALL");

  const currentDate = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const adminData = metrics.adminData;

  // Calcul du taux d'encaissement (%)
  const collectionRate =
    metrics.totalContractValue > 0
      ? Math.round((metrics.totalCollected / metrics.totalContractValue) * 100)
      : 0;

  // Entonnoir de conversion commercial (Pipeline)
  const pb = adminData?.pipelineBreakdown || {
    newCount: metrics.newProspects,
    contactedCount: 0,
    interestedCount: metrics.interestedProspects,
    meetingScheduledCount: metrics.upcomingAppointments,
    proposalSentCount: 0,
    convertedCount: metrics.convertedProspects,
  };

  const totalPipeline = Math.max(1, metrics.totalProspects);

  const funnelSteps = [
    { label: "Nouveaux Leads", count: pb.newCount, color: "bg-sky-500", textColor: "text-sky-400", href: "/prospection" },
    { label: "Contactés", count: pb.contactedCount, color: "bg-blue-500", textColor: "text-blue-400", href: "/appels" },
    { label: "Intéressés", count: pb.interestedCount, color: "bg-amber-500", textColor: "text-amber-400", href: "/relances" },
    { label: "RDV Fixés", count: pb.meetingScheduledCount, color: "bg-purple-500", textColor: "text-purple-400", href: "/rendez-vous" },
    { label: "Offres Envoyées", count: pb.proposalSentCount, color: "bg-indigo-500", textColor: "text-indigo-400", href: "/clients" },
    { label: "Convertis en Clients", count: pb.convertedCount, color: "bg-emerald-500", textColor: "text-emerald-400", href: "/clients" },
  ];

  // Filtrage du journal d'audit
  const filteredActivities =
    auditModuleFilter === "ALL"
      ? metrics.recentActivities
      : metrics.recentActivities.filter(
          (act) => act.module?.toUpperCase() === auditModuleFilter
        );

  const auditModules = [
    { key: "ALL", label: "Tous" },
    { key: "PROSPECTS", label: "Prospects" },
    { key: "CLIENTS", label: "Clients" },
    { key: "FINANCE", label: "Finance" },
    { key: "HR", label: "RH & Paie" },
    { key: "AUTH", label: "Sécurité" },
  ];

  return (
    <div className="space-y-6 select-none">
      {/* 1. Header Exécutif & Actions Stratégiques */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 text-[10px] font-bold uppercase tracking-wider border border-blue-500/30 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Direction Générale • ERP
            </span>
            <span className="text-xs text-neutral-400 capitalize">{currentDate}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-100 mt-2 flex items-center gap-2">
            <span>Tour de Contrôle Administrateur</span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl">
            Vue d'ensemble stratégique : pilotage de la trésorerie, suivi du pipeline de conversion, supervision des équipes et gestion des alertes critiques.
          </p>
        </div>

        {/* Quick Actions Directes */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/direction/google-maps">
            <Button size="sm" className="gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold cursor-pointer border-0 shadow-sm shadow-blue-500/20">
              <MapPin className="w-3.5 h-3.5 text-white" />
              <span>Import Maps</span>
            </Button>
          </Link>
          <Link href="/prospection?modal=new">
            <Button variant="secondary" size="sm" className="gap-1.5 bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-750 font-semibold cursor-pointer shadow-xs">
              <PlusCircle className="w-3.5 h-3.5 text-blue-400" />
              <span>Nouveau Prospect</span>
            </Button>
          </Link>
          <Link href="/facturation">
            <Button variant="secondary" size="sm" className="gap-1.5 bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-750 font-semibold cursor-pointer shadow-xs">
              <Receipt className="w-3.5 h-3.5 text-amber-400" />
              <span>Facturation</span>
            </Button>
          </Link>
          <Link href="/production">
            <Button variant="outline" size="sm" className="gap-1.5 bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-750 font-semibold cursor-pointer shadow-xs">
              <Kanban className="w-3.5 h-3.5 text-emerald-400" />
              <span>Production</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Pointage Quotidien (Maintenu) */}
      <DailyAttendanceWidget />

      {/* 3. Ligne 1 — KPIs Stratégiques Fondamentaux (100% Réels) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* Trésorerie Encaissée */}
        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col justify-between shadow-xs hover:border-emerald-500/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
              Trésorerie Encaissée
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xl font-extrabold text-emerald-400">
              {formatCurrency(metrics.totalCollected)}
            </p>
            <p className="text-[10px] text-emerald-400/80 mt-0.5">
              {collectionRate}% du CA contractualisé
            </p>
          </div>
        </div>

        {/* Reste à Encaisser */}
        <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex flex-col justify-between shadow-xs hover:border-amber-500/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              Créances à Recouvrer
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xl font-extrabold text-amber-400">
              {formatCurrency(metrics.balanceRemaining)}
            </p>
            <p className="text-[10px] text-amber-400/80 mt-0.5">
              Échéances clients en cours
            </p>
          </div>
        </div>

        {/* Total Contrats */}
        <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex flex-col justify-between shadow-xs hover:border-neutral-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              Valeur Contrats
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xl font-extrabold text-neutral-100">
              {formatCurrency(metrics.totalContractValue)}
            </p>
            <p className="text-[10px] text-neutral-400 mt-0.5">
              Cumul des packs & projets
            </p>
          </div>
        </div>

        {/* Clients Actifs */}
        <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex flex-col justify-between shadow-xs hover:border-neutral-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              Clients Signés
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xl font-extrabold text-neutral-100">
              {metrics.activeClients}
            </p>
            <p className="text-[10px] text-neutral-400 mt-0.5">
              Sous contrat actif
            </p>
          </div>
        </div>

        {/* Pipeline & Conversion */}
        <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex flex-col justify-between shadow-xs hover:border-neutral-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              Pipeline Leads
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Target className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <p className="text-xl font-extrabold text-neutral-100">
                {metrics.totalProspects}
              </p>
              <span className="text-xs font-semibold text-emerald-400">
                ({metrics.conversionRate}%)
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 mt-0.5">
              {metrics.newProspects} nouveaux leads
            </p>
          </div>
        </div>

        {/* Appels & RDV du Jour */}
        <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex flex-col justify-between shadow-xs hover:border-neutral-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              Activité Jour
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <PhoneCall className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <p className="text-xl font-extrabold text-neutral-100">
                {metrics.callsToday}
              </p>
              <span className="text-[10px] text-purple-400 font-semibold">
                appels
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 mt-0.5">
              {metrics.upcomingAppointments} RDV programmés
            </p>
          </div>
        </div>
      </div>

      {/* 4. Ligne 2 — Analyse & Visuels Haute Précision */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Volet Trésorerie & Recouvrement (7 colonnes) */}
        <div className="lg:col-span-7 bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Santé Financière & Progression des Encaissements</span>
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Ventilation de la trésorerie réelle encaissée vs créances clients.
              </p>
            </div>
            <Link
              href="/finance"
              className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Détails</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Barre Visuelle Proportionnelle Bicolore */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Encaissé : {formatCurrency(metrics.totalCollected)} ({collectionRate}%)
              </span>
              <span className="text-amber-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Créances : {formatCurrency(metrics.balanceRemaining)} ({100 - collectionRate}%)
              </span>
            </div>

            <div className="w-full h-3.5 bg-neutral-800 rounded-full overflow-hidden flex p-0.5 border border-neutral-700/60">
              <div
                style={{ width: `${Math.min(100, Math.max(0, collectionRate))}%` }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-l-full transition-all duration-500"
                title={`Encaissé : ${formatCurrency(metrics.totalCollected)}`}
              />
              <div
                style={{ width: `${Math.min(100, Math.max(0, 100 - collectionRate))}%` }}
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-r-full transition-all duration-500"
                title={`Créances : ${formatCurrency(metrics.balanceRemaining)}`}
              />
            </div>
          </div>

          {/* Métriques Clés Financières */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
              <span className="text-[10px] text-neutral-400 font-medium">Contrats Validés</span>
              <p className="text-sm font-bold text-neutral-100 mt-1">
                {formatCurrency(metrics.totalContractValue)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
              <span className="text-[10px] text-emerald-400 font-medium">Paiements Validés</span>
              <p className="text-sm font-bold text-emerald-400 mt-1">
                {formatCurrency(metrics.totalCollected)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20">
              <span className="text-[10px] text-amber-400 font-medium">Factures en Retard</span>
              <p className="text-sm font-bold text-amber-400 mt-1">
                {adminData?.overdueInvoicesCount || 0} impayée(s)
              </p>
            </div>
          </div>
        </div>

        {/* Volet Entonnoir Commercial / Pipeline Funnel (5 colonnes) */}
        <div className="lg:col-span-5 bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <Target className="w-4 h-4 text-sky-400" />
                <span>Entonnoir de Prospection Commerciale</span>
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Taux de passage à chaque étape du cycle de vente.
              </p>
            </div>
            <Link
              href="/prospection"
              className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Pipeline</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5 pt-1">
            {funnelSteps.map((step) => {
              const pct = Math.round((step.count / totalPipeline) * 100);
              return (
                <div key={step.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-300 font-medium flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${step.color}`} />
                      {step.label}
                    </span>
                    <span className="font-bold text-neutral-200">
                      {step.count}{" "}
                      <span className="text-[10px] text-neutral-500 font-normal">
                        ({pct}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
                      className={`h-full rounded-full transition-all duration-300 ${step.color}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Objectifs Mensuels de l'Équipe (Maintenu & Synchronisé) */}
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
            ? "Objectifs Mensuels des Collaborateurs (Supervision Équipe)"
            : "Mes Objectifs du Mois"
        }
        subtitle="Suivi en direct des objectifs de chaque collaborateur synchronisés avec leurs actions réelles."
        showEmployeeBadge={Boolean(metrics.allTeamGoals && metrics.allTeamGoals.length > 0)}
      />

      {/* 6. Ligne 3 — Pilotage, Alertes & Supervision Managériale */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Centre d'Alertes Managériales */}
        <div className="lg:col-span-1 bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-neutral-100">
                  Centre d'Alertes Managériales
                </h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                {adminData?.criticalAlerts?.length || 0} active(s)
              </span>
            </div>

            <div className="space-y-2.5">
              {(!adminData?.criticalAlerts || adminData.criticalAlerts.length === 0) ? (
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-center space-y-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                  <p className="text-xs font-bold text-emerald-300">Tous les indicateurs sont au vert</p>
                  <p className="text-[11px] text-emerald-400/80">Aucun retard ni blocage critique signalé.</p>
                </div>
              ) : (
                adminData.criticalAlerts.map((alert) => (
                  <Link
                    key={alert.id}
                    href={alert.link}
                    className="block p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 hover:border-neutral-700 transition-colors group"
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ring-2 ${
                          alert.severity === "URGENT"
                            ? "bg-rose-500 ring-rose-900"
                            : alert.severity === "WARNING"
                            ? "bg-amber-500 ring-amber-900"
                            : "bg-blue-500 ring-blue-900"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-neutral-200 group-hover:text-white transition-colors">
                          {alert.title}
                        </p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          {alert.subtitle}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-300 shrink-0 self-center" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Raccourcis Système */}
          <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
            <Link
              href="/parametres?tab=ATTENDANCE"
              className="text-[11px] text-neutral-400 hover:text-neutral-200 flex items-center gap-1"
            >
              <span>Présences</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
            <Link
              href="/facturation"
              className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Recouvrement</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Leaderboard Commercial */}
        <div className="lg:col-span-1 bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span>Performance Équipe Commerciale</span>
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Suivi des leads assignés, appels et signatures.
              </p>
            </div>
            <Link href="/appels" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
              <span>Détails</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {metrics.salesReps.length === 0 ? (
              <p className="text-xs text-neutral-400 py-6 text-center">Aucun commercial assigné.</p>
            ) : (
              metrics.salesReps.map((rep, idx) => (
                <div
                  key={rep.id}
                  className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl flex items-center justify-between transition-colors hover:border-neutral-700"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-neutral-200 truncate">{rep.name}</p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">
                        {rep._count.assignedProspects} leads • {rep._count.loggedCalls} appels
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-emerald-400">
                      {rep._count.managedClients}
                    </span>
                    <span className="text-[10px] text-neutral-400 block">clients</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Audit Log / Journal d'Activité Récent avec Filtres */}
        <div className="lg:col-span-1 bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-neutral-100">Journal d'Audit Système</h3>
            </div>
            <Link
              href="/parametres?tab=AUDIT"
              className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Complet</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Filtres par Module */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar">
            {auditModules.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setAuditModuleFilter(m.key)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors shrink-0 cursor-pointer ${
                  auditModuleFilter === m.key
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Liste des Activités */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
            {filteredActivities.length === 0 ? (
              <p className="text-xs text-neutral-400 py-6 text-center">Aucune activité enregistrée.</p>
            ) : (
              filteredActivities.map((act) => (
                <div
                  key={act.id}
                  className="p-2.5 bg-neutral-950/40 border border-neutral-800 rounded-xl flex items-center justify-between text-xs transition-colors hover:border-neutral-700"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    <div className="truncate">
                      <p className="text-xs text-neutral-200 truncate">
                        <span className="font-bold text-neutral-100">
                          {act.user?.name || "Système"}
                        </span>{" "}
                        <span className="text-neutral-400 text-[11px]">
                          ({act.action})
                        </span>
                      </p>
                      <p className="text-[10px] text-neutral-500 truncate">
                        Module : {act.module}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-neutral-400 shrink-0 ml-2">
                    {formatDateTime(act.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
