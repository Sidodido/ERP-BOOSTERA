"use client";

import React from "react";
import Link from "next/link";
import {
  Target,
  PhoneCall,
  Calendar,
  Users,
  TrendingUp,
  Video,
  Palette,
  Sparkles,
  CheckCircle2,
  Flame,
  Clock,
  ArrowUpRight,
  Award,
} from "lucide-react";
import type { MonthlyGoalDisplay } from "@/lib/goals-sync";
import { formatCurrency } from "@/lib/utils";

interface MonthlyGoalsWidgetProps {
  goals: MonthlyGoalDisplay[];
  month?: number;
  year?: number;
  userName?: string;
  showAdminLink?: boolean;
  title?: string;
  subtitle?: string;
  showEmployeeBadge?: boolean;
}

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

export function MonthlyGoalsWidget({
  goals = [],
  month,
  year,
  userName,
  showAdminLink = false,
  title,
  subtitle,
  showEmployeeBadge = false,
}: MonthlyGoalsWidgetProps) {
  const currentMonthNum = month || new Date().getMonth() + 1;
  const currentYearNum = year || new Date().getFullYear();
  const monthName = MONTH_NAMES[currentMonthNum - 1] || "";

  const [selectedCollaborator, setSelectedCollaborator] = React.useState<string>(
    // Non-admin users (showEmployeeBadge=false) only see their own goals anyway,
    // but admins should start on "ALL" to see everyone
    showEmployeeBadge ? "ALL" : (userName || "ALL")
  );

  // Extract distinct collaborators if showEmployeeBadge is true
  const distinctEmployees = React.useMemo(() => {
    if (!showEmployeeBadge) return [];
    const map = new Map<string, { id: string; name: string; position?: string }>();
    for (const g of goals) {
      if (g.employeeName) {
        map.set(g.employeeName, {
          id: g.employeeId,
          name: g.employeeName,
          position: g.position,
        });
      }
    }
    return Array.from(map.values());
  }, [goals, showEmployeeBadge]);

  const filteredGoals = React.useMemo(() => {
    if (selectedCollaborator === "ALL") return goals;
    return goals.filter((g) => g.employeeName === selectedCollaborator);
  }, [goals, selectedCollaborator]);

  // Group goals by collaborator for team overview
  const goalsByCollaborator = React.useMemo(() => {
    if (!showEmployeeBadge) return [];
    const map = new Map<
      string,
      {
        employeeName: string;
        position?: string;
        goals: MonthlyGoalDisplay[];
        completedCount: number;
        averageProgress: number;
      }
    >();

    for (const g of goals) {
      const name = g.employeeName || "Non assigné";
      if (!map.has(name)) {
        map.set(name, {
          employeeName: name,
          position: g.position,
          goals: [],
          completedCount: 0,
          averageProgress: 0,
        });
      }
      map.get(name)!.goals.push(g);
    }

    for (const item of map.values()) {
      item.completedCount = item.goals.filter((g) => g.achievedValue >= g.targetValue).length;
      const totalPct = item.goals.reduce((acc, g) => acc + g.progressPercentage, 0);
      item.averageProgress = item.goals.length > 0 ? Math.round(totalPct / item.goals.length) : 0;
    }

    return Array.from(map.values());
  }, [goals, showEmployeeBadge]);

  const totalGoals = filteredGoals.length;
  const completedGoals = filteredGoals.filter((g) => g.achievedValue >= g.targetValue).length;

  const getMetricIcon = (metric: string) => {
    switch (metric.toUpperCase()) {
      case "APPELS":
        return <PhoneCall className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case "RENDEZ_VOUS":
        return <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
      case "CLIENTS":
        return <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case "CA":
      case "CA_DA":
        return <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case "VIDEOS":
        return <Video className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
      case "DESIGNS":
      case "CREATIONS":
        return <Palette className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      default:
        return <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
    }
  };

  const getMetricBadgeStyle = (metric: string) => {
    switch (metric.toUpperCase()) {
      case "APPELS":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30";
      case "RENDEZ_VOUS":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30";
      case "CLIENTS":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30";
      case "CA":
      case "CA_DA":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30";
      case "VIDEOS":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30";
      default:
        return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/30";
    }
  };

  if (totalGoals === 0) {
    return (
      <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-neutral-200">
                Objectifs Mensuels ({monthName} {currentYearNum})
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700">
                Non assigné
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Aucun objectif fixé pour ce mois. Vos activités restent automatiquement enregistrées.
            </p>
          </div>
        </div>
        {showAdminLink && (
          <Link
            href="/equipes?tab=GOALS"
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/30 transition flex items-center gap-1.5 shrink-0"
          >
            <span>Fixer un objectif</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Widget */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center">
            <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 dark:text-neutral-100">
                {title || "Mes Objectifs du Mois"}
              </h2>
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 text-[11px] font-bold border border-indigo-200 dark:border-indigo-800/40 shadow-xs">
                {monthName} {currentYearNum}
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800/40 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Synchronisé en direct
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
              {subtitle || "Progression calculée automatiquement d'après vos actions réelles enregistrées."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-medium text-slate-700 dark:text-neutral-300 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-neutral-800 flex items-center gap-2 shadow-xs">
            <Award className="w-3.5 h-3.5 text-amber-500" />
            <span>
              <strong className="text-emerald-600 dark:text-emerald-400">{completedGoals}</strong> / {totalGoals} objectifs atteints
            </span>
          </div>
          <Link
            href="/equipes?tab=GOALS"
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-1 font-semibold transition"
          >
            <span>Détails</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Collaborator Filter Pills (if multiple employees available) */}
      {showEmployeeBadge && distinctEmployees.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedCollaborator("ALL")}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer ${
              selectedCollaborator === "ALL"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                : "bg-white dark:bg-neutral-900/80 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-200 border border-slate-200 dark:border-neutral-800 hover:border-slate-300"
            }`}
          >
            Tous les collaborateurs ({distinctEmployees.length})
          </button>
          {distinctEmployees.map((emp) => {
            const isSelected = selectedCollaborator === emp.name;
            const empGoalsCount = goals.filter((g) => g.employeeName === emp.name).length;
            return (
              <button
                key={emp.id || emp.name}
                type="button"
                onClick={() => setSelectedCollaborator(emp.name)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                    : "bg-white dark:bg-neutral-900/80 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-200 border border-slate-200 dark:border-neutral-800 hover:border-slate-300"
                }`}
              >
                <span>👤</span>
                <span>{emp.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-indigo-700 text-white" : "bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400"}`}>
                  {empGoalsCount}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* VUE 1 : GROUPÉE PAR COLLABORATEUR (Quand TOUS est sélectionné) */}
      {showEmployeeBadge && distinctEmployees.length > 1 && selectedCollaborator === "ALL" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {goalsByCollaborator.map((collab) => {
            const isAllCompleted = collab.completedCount === collab.goals.length && collab.goals.length > 0;
            return (
              <div
                key={collab.employeeName}
                className={`rounded-2xl p-5 border transition-all shadow-xs flex flex-col justify-between ${
                  isAllCompleted
                    ? "bg-white dark:bg-neutral-900 border-emerald-300 dark:border-emerald-500/30 ring-1 ring-emerald-300/40"
                    : "bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 hover:border-slate-300"
                }`}
              >
                <div>
                  {/* Collaborator Card Header */}
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-neutral-800/80 pb-3 mb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center font-bold text-sm text-indigo-700 dark:text-indigo-300">
                        {collab.employeeName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-100">
                            {collab.employeeName}
                          </h3>
                          {collab.position && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 border border-slate-200 dark:border-neutral-700 font-medium">
                              {collab.position}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 dark:text-neutral-400">
                          {collab.goals.length} objectif(s) fixés pour {monthName} {currentYearNum}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-xl font-bold border flex items-center gap-1.5 ${
                          isAllCompleted
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40"
                            : collab.completedCount > 0
                            ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
                            : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700"
                        }`}
                      >
                        <span>🎯</span>
                        <span>{collab.completedCount} / {collab.goals.length} atteints</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedCollaborator(collab.employeeName)}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-semibold p-1 hover:underline cursor-pointer"
                        title="Voir en détail"
                      >
                        Détail →
                      </button>
                    </div>
                  </div>

                  {/* List of Goals for this Collaborator */}
                  <div className="space-y-2.5">
                    {collab.goals.map((goal) => {
                      const isReached = goal.achievedValue >= goal.targetValue;
                      const progressPercent = goal.progressPercentage;
                      const barWidth = Math.min(100, progressPercent);
                      const isCA = goal.metric === "CA" || goal.metric === "CA_DA";

                      return (
                        <div
                          key={goal.id}
                          className="p-3 rounded-xl bg-slate-50/70 dark:bg-neutral-950/60 border border-slate-200/80 dark:border-neutral-800/80 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getMetricIcon(goal.metric)}
                              <span className="text-xs font-bold text-slate-800 dark:text-neutral-200">
                                {goal.metricLabel}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-slate-900 dark:text-neutral-100">
                                {isCA ? formatCurrency(goal.achievedValue) : goal.achievedValue} / {isCA ? formatCurrency(goal.targetValue) : goal.targetValue} {goal.unit}
                              </span>
                              <span
                                className={`text-xs font-mono font-black ${
                                  isReached
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : progressPercent >= 70
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-slate-600 dark:text-neutral-400"
                                }`}
                              >
                                ({progressPercent}%)
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-slate-200/70 dark:bg-neutral-900 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-neutral-800">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isReached
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                                  : progressPercent >= 70
                                  ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                                  : "bg-gradient-to-r from-blue-500 to-indigo-500"
                              }`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer of card */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-neutral-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-neutral-400">
                  <span>Moyenne d'avancement : <strong className="text-slate-800 dark:text-neutral-200">{collab.averageProgress}%</strong></span>
                  <button
                    type="button"
                    onClick={() => setSelectedCollaborator(collab.employeeName)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-semibold hover:underline cursor-pointer"
                  >
                    Filtrer sur ce collaborateur
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VUE 2 : GRILLE DE CARTES DÉTAILLÉES (Quand un collaborateur précis est sélectionné ou vue individuelle) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGoals.map((goal) => {
            const isOverachieved = goal.achievedValue > goal.targetValue;
            const isReached = goal.achievedValue >= goal.targetValue;
            const progressPercent = goal.progressPercentage;
            const barWidth = Math.min(100, progressPercent);

            const remaining = Math.max(0, goal.targetValue - goal.achievedValue);
            const surplus = Math.max(0, goal.achievedValue - goal.targetValue);

            const isCA = goal.metric === "CA" || goal.metric === "CA_DA";

            const cardBorder = isReached
              ? "bg-white dark:bg-neutral-900 border-emerald-300 dark:border-emerald-500/40 ring-1 ring-emerald-300/40"
              : progressPercent >= 70
              ? "bg-white dark:bg-neutral-900 border-amber-300 dark:border-amber-500/40 ring-1 ring-amber-300/40"
              : "bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 hover:border-slate-300";

            return (
              <div
                key={goal.id}
                className={`relative overflow-hidden rounded-2xl p-5 border transition-all shadow-xs ${cardBorder}`}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border ${getMetricBadgeStyle(
                        goal.metric
                      )}`}
                    >
                      {getMetricIcon(goal.metric)}
                    </div>
                    <div>
                      {showEmployeeBadge && goal.employeeName && (
                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-0.5 flex items-center gap-1">
                          <span>👤</span> {goal.employeeName}
                        </span>
                      )}
                      <h3 className="text-sm font-bold text-slate-900 dark:text-neutral-100">
                        {goal.metricLabel}
                      </h3>
                      <span className="text-[11px] text-slate-500 dark:text-neutral-400 capitalize">
                        {goal.unit}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isOverachieved ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40">
                        <Flame className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        Dépassement 🚀
                      </span>
                    ) : isReached ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        Atteint 🎯
                      </span>
                    ) : progressPercent >= 70 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30">
                        <Flame className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        En très bonne voie 🔥
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700">
                        <Clock className="w-3 h-3 text-slate-500 dark:text-neutral-400" />
                        En cours ⏳
                      </span>
                    )}
                  </div>
                </div>

                {/* Numbers Display */}
                <div className="flex items-baseline justify-between pt-1 pb-2">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={`text-2xl font-black font-mono tracking-tight ${
                          isReached
                            ? "text-emerald-600 dark:text-emerald-400"
                            : progressPercent >= 70
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-slate-900 dark:text-neutral-100"
                        }`}
                      >
                        {isCA ? formatCurrency(goal.achievedValue) : goal.achievedValue}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-neutral-500 font-mono">
                        / {isCA ? formatCurrency(goal.targetValue) : goal.targetValue} {goal.unit}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-neutral-400 font-medium">
                      Réalisé ce mois
                    </span>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-xl font-black font-mono ${
                        isReached
                          ? "text-emerald-600 dark:text-emerald-400"
                          : progressPercent >= 70
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-slate-800 dark:text-neutral-200"
                      }`}
                    >
                      {progressPercent}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 dark:bg-neutral-950 h-2.5 rounded-full overflow-hidden border border-slate-200 dark:border-neutral-800/80 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isReached
                        ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-xs"
                        : progressPercent >= 70
                        ? "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-xs"
                        : "bg-gradient-to-r from-indigo-600 to-blue-500 shadow-xs"
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>

                {/* Motivational Footer */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-neutral-800/60 flex items-center justify-between text-[11px]">
                  {isReached ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      {isOverachieved
                        ? `Objectif validé ! +${surplus} ${goal.unit} au-delà de la cible.`
                        : "Bravo ! Objectif mensuel parfaitement validé."}
                    </span>
                  ) : (
                    <span className="text-slate-500 dark:text-neutral-400 font-medium">
                      Plus que <strong className="text-slate-800 dark:text-neutral-200 font-bold">{remaining} {goal.unit}</strong> pour valider la cible.
                    </span>
                  )}

                  <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-mono font-medium">
                    {goal.metric}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
